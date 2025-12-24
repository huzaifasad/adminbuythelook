import { createClient } from "@supabase/supabase-js"

function transformBrightdataProduct(product) {
  return {
    product_id: product.product_id,
    product_name: product.product_name,
    price: Number.parseFloat(product.price) || 0,
    currency: product.currency || null,
    colour: product.colour || null,
    colour_code: product.colour_code ? Number.parseInt(product.colour_code) : null,
    size: product.size || "",
    description: product.description || null,
    sku: product.sku || null,
    url: product.url || product.product_url || null,
    image: Array.isArray(product.image) ? JSON.stringify(product.image) : product.image || null,
    images: Array.isArray(product.images) ? product.images : product.image ? [product.image] : null,
    availability: product.availability || null,
    low_on_stock: product.low_on_stock === true || product.low_on_stock === "true" ? true : false,
    section: product.section || null,
    product_family: product.product_family || null,
    product_family_en: product.product_family_en || null,
    product_subfamily: product.product_subfamily || null,
    care: typeof product.care === "object" ? JSON.stringify(product.care) : product.care || null,
    materials: Array.isArray(product.materials) ? JSON.stringify(product.materials) : product.materials || null,
    materials_description: product.materials_description || null,
    category_id: product.category_id ? Number.parseInt(product.category_id) : null,
    category_name: product.category_name || null,
    seo_category_id: product.seo_category_id ? Number.parseInt(product.seo_category_id) : null,
    source: "zara",
    sync_method: "cron_auto",
    last_synced: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: product.availability !== "out_of_stock" && product.availability !== false,
    created_at: new Date().toISOString(),
  }
}

async function getLatestSnapshot(apiKey, datasetId) {
  console.log("[v0] Fetching latest snapshot for dataset:", datasetId)

  const response = await fetch(`https://api.brightdata.com/datasets/v3/snapshots?dataset_id=${datasetId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch snapshots: ${response.status} - ${errorText}`)
  }

  const snapshots = await response.json()

  if (!snapshots || snapshots.length === 0) {
    throw new Error("No snapshots found for dataset")
  }

  // Find the latest snapshot with status "ready"
  const readySnapshots = snapshots.filter((s) => s.status === "ready")

  if (readySnapshots.length === 0) {
    throw new Error("No ready snapshots available")
  }

  // Sort by created date descending and get the first one
  const latestSnapshot = readySnapshots.sort((a, b) => new Date(b.created) - new Date(a.created))[0]

  console.log("[v0] Found latest snapshot:", latestSnapshot.snapshot_id, "created at", latestSnapshot.created)

  return latestSnapshot.snapshot_id
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aqkeprwxxsryropnhfvm.supabase.co"
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxa2Vwcnd4eHNyeXJvcG5oZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MzE4MjksImV4cCI6MjA1MzQwNzgyOX0.1nstrLtlahU3kGAu-UrzgOVw6XwyKU6n5H5q4Taqtus"
  return createClient(supabaseUrl, supabaseKey)
}

export async function GET(request) {
  try {
    console.log("[v0] Cron sync triggered at", new Date().toISOString())

    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error("[v0] Unauthorized cron attempt")
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const apiKey = process.env.BRIGHTDATA_API_KEY
    const datasetId = process.env.BRIGHTDATA_DATASET_ID || "v_mjh8g0ch2a14440g47"

    if (!apiKey) {
      console.log("[v0] Missing Brightdata credentials")
      return Response.json(
        {
          success: false,
          error: "Brightdata API key not configured",
        },
        { status: 400 },
      )
    }

    const snapshotId = await getLatestSnapshot(apiKey, datasetId)

    console.log("[v0] Downloading snapshot:", snapshotId)
    const response = await fetch(`https://api.brightdata.com/datasets/snapshots/${snapshotId}/download`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Brightdata download error:", response.status, errorText)
      throw new Error(`Brightdata download error: ${response.status}`)
    }

    const products = await response.json()
    const productsArray = Array.isArray(products) ? products : [products]

    console.log(`[v0] Downloaded ${productsArray.length} products from snapshot ${snapshotId}`)

    let added = 0
    let updated = 0
    let failed = 0
    const batchSize = 20

    // Process in batches
    for (let i = 0; i < productsArray.length; i += batchSize) {
      const batch = productsArray.slice(i, i + batchSize)
      console.log(
        `[v0] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productsArray.length / batchSize)}`,
      )

      for (const product of batch) {
        try {
          const transformed = transformBrightdataProduct(product)

          const supabase = getSupabaseClient()
          const { data: existing } = await supabase
            .from("zara_cloth_test")
            .select("id")
            .eq("product_id", transformed.product_id)
            .eq("colour_code", transformed.colour_code || "")
            .eq("size", transformed.size || "")
            .maybeSingle()

          if (existing) {
            const { error: updateError } = await supabase
              .from("zara_cloth_test")
              .update(transformed)
              .eq("id", existing.id)

            if (updateError) throw updateError
            updated++
          } else {
            const { error: insertError } = await supabase.from("zara_cloth_test").insert([transformed])

            if (insertError) throw insertError
            added++
          }
        } catch (err) {
          failed++
          console.error("[v0] Cron product sync error:", err.message)
        }
      }
    }

    // Log sync history
    const supabase = getSupabaseClient()
    await supabase.from("brightdata_sync_history").insert([
      {
        sync_method: "cron_auto",
        total_processed: productsArray.length,
        total_added: added,
        total_updated: updated,
        total_failed: failed,
        status: "completed",
        synced_at: new Date().toISOString(),
      },
    ])

    console.log(`[v0] Cron sync completed: ${added} added, ${updated} updated, ${failed} failed`)

    return Response.json({
      success: true,
      total: productsArray.length,
      added,
      updated,
      failed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Cron sync error:", error)

    // Log failed sync
    const supabase = getSupabaseClient()
    await supabase.from("brightdata_sync_history").insert([
      {
        sync_method: "cron_auto",
        status: "failed",
        error_message: error.message,
        synced_at: new Date().toISOString(),
      },
    ])

    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

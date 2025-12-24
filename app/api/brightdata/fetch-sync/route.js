// app/api/brightdata/fetch-sync/route.js
// FIXED VERSION - Actually connects to BrightData API

import { createClient } from "@supabase/supabase-js"

// IMPORTANT: API routes MUST use service key, not anon key!
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials. Check your environment variables.")
}

const supabase = createClient(supabaseUrl, supabaseKey)

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
    sync_method: "fetch_button",
    last_synced: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: product.availability !== "out_of_stock" && product.availability !== false,
    created_at: new Date().toISOString(),
  }
}

// STEP 1: Get list of snapshots and find latest "ready" one
async function getLatestSnapshot(apiKey, datasetId) {
  console.log("[BrightData] Fetching snapshots for dataset:", datasetId)

  const response = await fetch(
    `https://api.brightdata.com/datasets/v3/snapshots?dataset_id=${datasetId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch snapshots: ${response.status} - ${errorText}`)
  }

  const snapshots = await response.json()

  if (!snapshots || snapshots.length === 0) {
    throw new Error("No snapshots found for this dataset")
  }

  // Find latest "ready" snapshot
  const readySnapshots = snapshots.filter((s) => s.status === "ready")

  if (readySnapshots.length === 0) {
    throw new Error("No ready snapshots available. Please wait for BrightData to process data.")
  }

  // Sort by created date (newest first)
  const latestSnapshot = readySnapshots.sort(
    (a, b) => new Date(b.created) - new Date(a.created)
  )[0]

  console.log("[BrightData] Latest snapshot:", latestSnapshot.snapshot_id, "created:", latestSnapshot.created)

  return latestSnapshot.snapshot_id
}

// STEP 2: Download snapshot data
async function downloadSnapshot(apiKey, snapshotId) {
  console.log("[BrightData] Downloading snapshot:", snapshotId)

  const response = await fetch(
    `https://api.brightdata.com/datasets/snapshots/${snapshotId}/download`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to download snapshot: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data
}

export async function POST(request) {
  const startTime = Date.now()

  try {
    console.log("[BrightData] Fetch sync started at", new Date().toISOString())

    // Get credentials from environment
    const apiKey = process.env.BRIGHTDATA_API_KEY
    const datasetId = process.env.BRIGHTDATA_DATASET_ID

    // Validate credentials
    if (!apiKey) {
      console.error("[BrightData] Missing API key")
      return Response.json(
        {
          success: false,
          error: "BRIGHTDATA_API_KEY not configured. Add it to your environment variables.",
        },
        { status: 400 }
      )
    }

    if (!datasetId) {
      console.error("[BrightData] Missing dataset ID")
      return Response.json(
        {
          success: false,
          error: "BRIGHTDATA_DATASET_ID not configured. Add it to your environment variables.",
        },
        { status: 400 }
      )
    }

    // STEP 1: Get latest snapshot ID
    const snapshotId = await getLatestSnapshot(apiKey, datasetId)

    // STEP 2: Download the snapshot
    const products = await downloadSnapshot(apiKey, snapshotId)
    const productsArray = Array.isArray(products) ? products : [products]

    console.log(`[BrightData] Downloaded ${productsArray.length} products from snapshot ${snapshotId}`)

    // STEP 3: Process and sync to Supabase
    let added = 0
    let updated = 0
    let failed = 0
    const batchSize = 20

    for (let i = 0; i < productsArray.length; i += batchSize) {
      const batch = productsArray.slice(i, i + batchSize)
      console.log(
        `[BrightData] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productsArray.length / batchSize)}`
      )

      for (const product of batch) {
        try {
          const transformed = transformBrightdataProduct(product)

          // Check if exists
          const { data: existing } = await supabase
            .from("zara_cloth_test")
            .select("id")
            .eq("product_id", transformed.product_id)
            .eq("colour_code", transformed.colour_code || "")
            .eq("size", transformed.size || "")
            .maybeSingle()

          if (existing) {
            // Update existing
            const { error: updateError } = await supabase
              .from("zara_cloth_test")
              .update(transformed)
              .eq("id", existing.id)

            if (updateError) throw updateError
            updated++
          } else {
            // Insert new
            const { error: insertError } = await supabase
              .from("zara_cloth_test")
              .insert([transformed])

            if (insertError) throw insertError
            added++
          }
        } catch (err) {
          failed++
          console.error("[BrightData] Product sync error:", err.message)
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    // Log to sync history
    await supabase.from("brightdata_sync_history").insert([
      {
        sync_method: "fetch_button",
        total_processed: productsArray.length,
        total_added: added,
        total_updated: updated,
        total_failed: failed,
        status: "completed",
        synced_at: new Date().toISOString(),
      },
    ])

    console.log(`[BrightData] Sync completed: ${added} added, ${updated} updated, ${failed} failed in ${duration}s`)

    return Response.json({
      success: true,
      total: productsArray.length,
      added,
      updated,
      failed,
      snapshotId,
      duration: parseFloat(duration),
    })

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    console.error("[BrightData] Fetch sync error:", error)

    // Log failed sync
    await supabase.from("brightdata_sync_history").insert([
      {
        sync_method: "fetch_button",
        status: "failed",
        error_message: error.message,
        synced_at: new Date().toISOString(),
      },
    ])

    return Response.json(
      { 
        success: false, 
        error: error.message,
        duration: parseFloat(duration)
      }, 
      { status: 500 }
    )
  }
}
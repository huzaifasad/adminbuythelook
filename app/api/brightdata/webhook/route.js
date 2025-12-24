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
    image: Array.isArray(product.image) ? product.image[0] : product.image || null,
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
    sync_method: "webhook",
    last_synced: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: product.availability !== "out_of_stock" && product.availability !== false,
    created_at: new Date().toISOString(),
  }
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aqkeprwxxsryropnhfvm.supabase.co"
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxa2Vwcnd4eHNyeXJvcG5oZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MzE4MjksImV4cCI6MjA1MzQwNzgyOX0.1nstrLtlahU3kGAu-UrzgOVw6XwyKU6n5H5q4Taqtus"
  return createClient(supabaseUrl, supabaseKey)
}

export async function POST(request) {
  const supabase = getSupabaseClient() // Declare supabase variable before using it

  try {
    console.log("[v0] Webhook triggered at", new Date().toISOString())

    const webhookSecret = process.env.BRIGHTDATA_WEBHOOK_SECRET
    if (webhookSecret) {
      const authHeader = request.headers.get("authorization")
      if (!authHeader || authHeader !== `Bearer ${webhookSecret}`) {
        console.error("[v0] Webhook authentication failed")
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
      }
    }

    const payload = await request.json()
    console.log("[v0] Webhook payload received:", {
      hasData: !!payload.data,
      dataLength: Array.isArray(payload.data) ? payload.data.length : "not array",
    })

    let products = payload.data || payload.products || payload
    if (!Array.isArray(products)) {
      products = [products]
    }

    console.log("[v0] Processing", products.length, "products from webhook")

    let added = 0
    let updated = 0
    let failed = 0
    const errors = []
    const batchSize = 20

    // Process in batches to avoid timeouts
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize)
      console.log(`[v0] Webhook batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`)

      for (const product of batch) {
        try {
          const transformed = transformBrightdataProduct(product)

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
            console.log(`[v0] Updated product: ${transformed.product_id}`)
          } else {
            const { error: insertError } = await supabase.from("zara_cloth_test").insert([transformed])

            if (insertError) throw insertError
            added++
            console.log(`[v0] Added product: ${transformed.product_id}`)
          }
        } catch (err) {
          failed++
          const errorMsg = err.message || String(err)
          errors.push(errorMsg)
          console.error("[v0] Webhook product error:", errorMsg)
        }
      }
    }

    const syncRecord = {
      sync_method: "webhook",
      total_processed: products.length,
      total_added: added,
      total_updated: updated,
      total_failed: failed,
      status: failed === 0 ? "completed" : "completed_with_errors",
      synced_at: new Date().toISOString(),
    }

    if (errors.length > 0) {
      syncRecord.error_details = errors.slice(0, 10) // Store first 10 errors
    }

    await supabase.from("brightdata_sync_history").insert([syncRecord])

    console.log(`[v0] Webhook sync completed: ${added} added, ${updated} updated, ${failed} failed`)

    return Response.json({
      success: true,
      total: products.length,
      added,
      updated,
      failed,
      message: `Webhook processed: ${added} added, ${updated} updated, ${failed} failed`,
    })
  } catch (error) {
    console.error("[v0] Webhook error:", error.message || String(error))

    try {
      await supabase.from("brightdata_sync_history").insert([
        {
          sync_method: "webhook",
          status: "failed",
          error_message: error.message || String(error),
          synced_at: new Date().toISOString(),
        },
      ])
    } catch (logError) {
      console.error("[v0] Failed to log webhook error:", logError)
    }

    return Response.json(
      {
        success: false,
        error: error.message || "Webhook processing failed",
      },
      { status: 500 },
    )
  }
}

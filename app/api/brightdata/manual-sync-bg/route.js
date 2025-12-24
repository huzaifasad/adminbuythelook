import { createClient } from "@supabase/supabase-js"

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aqkeprwxxsryropnhfvm.supabase.co"
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxa2Vwcnd4eHNyeXJvcG5oZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MzE4MjksImV4cCI6MjA1MzQwNzgyOX0.1nstrLtlahU3kGAu-UrzgOVw6XwyKU6n5H5q4Taqtus"
  return createClient(supabaseUrl, supabaseKey)
}

function transformBrightdataProduct(product) {
  return {
    product_id: product.product_id,
    product_name: product.product_name,
    price: Number.parseFloat(product.price) || 0,
    currency: product.currency,
    colour: product.colour,
    colour_code: product.colour_code,
    size: product.size || "",
    description: product.description,
    sku: product.sku,
    url: product.url || product.product_url,
    image: product.image?.[0] || null,
    images: product.images || product.image,
    availability: product.availability,
    low_on_stock: product.low_on_stock || false,
    section: product.section,
    product_family: product.product_family,
    product_family_en: product.product_family_en,
    product_subfamily: product.product_subfamily,
    care: product.care,
    materials: product.materials,
    materials_description: product.materials_description,
    category_id: product.category_id,
    category_name: product.category_name,
    seo_category_id: product.seo_category_id,
    source: "zara",
    sync_method: "manual",
    last_synced: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: product.availability !== "out_of_stock",
    created_at: new Date().toISOString(),
  }
}

async function processSyncInBackground(products, jobId) {
  const supabase = getSupabaseClient()
  let added = 0
  let updated = 0
  let failed = 0
  let processedCount = 0
  const errors = []
  const productLogs = []
  const batchSize = 100

  try {
    const totalProducts = products.length

    for (let i = 0; i < totalProducts; i += batchSize) {
      const { data: jobStatus } = await supabase
        .from("brightdata_sync_history")
        .select("status")
        .eq("job_id", jobId)
        .single()

      if (jobStatus?.status === "stopped") {
        console.log(" Sync stopped by user")
        break
      }

      const batch = products.slice(i, Math.min(i + batchSize, totalProducts))

      const batchPromises = batch.map(async (product) => {
        try {
          const transformed = transformBrightdataProduct(product)

          if (!transformed.product_id) {
            failed++
            productLogs.push(`❌ ${transformed.product_name || "Unknown"} - Missing product ID`)
            return
          }

          const { data: existing } = await supabase
            .from("zara_cloth_test")
            .select("id")
            .eq("product_id", transformed.product_id)
            .eq("colour_code", transformed.colour_code || null)
            .eq("size", transformed.size || "")
            .maybeSingle()

          if (existing) {
            await supabase.from("zara_cloth_test").update(transformed).eq("id", existing.id)
            updated++
            productLogs.push(`✏️ ${transformed.product_name} (${transformed.size})`)
          } else {
            await supabase.from("zara_cloth_test").insert([transformed])
            added++
            productLogs.push(`✅ ${transformed.product_name} (${transformed.size})`)
          }
        } catch (err) {
          failed++
          productLogs.push(`❌ ${product.product_name || "Unknown"} - ${err.message}`)
          errors.push(`Product ${product.product_id}: ${err.message}`)
          console.error(" Product sync error:", err.message)
        }

        processedCount++
      })

      await Promise.all(batchPromises)

      // Update progress after batch completes
      const progressPercentage = Math.round((processedCount / totalProducts) * 100)
      await supabase
        .from("brightdata_sync_history")
        .update({
          processed_count: processedCount,
          progress_percentage: progressPercentage,
          logs: productLogs.slice(-50), // Keep last 50 logs
        })
        .eq("job_id", jobId)
    }

    await supabase
      .from("brightdata_sync_history")
      .update({
        status: "completed",
        total_processed: totalProducts,
        total_added: added,
        total_updated: updated,
        total_failed: failed,
        processed_count: totalProducts,
        progress_percentage: 100,
        logs: productLogs,
        error_details: errors.length > 0 ? errors.slice(0, 10) : null,
      })
      .eq("job_id", jobId)

    console.log(` Sync completed: ${added} added, ${updated} updated, ${failed} failed`)
  } catch (error) {
    console.error(" Background sync error:", error)
    await supabase
      .from("brightdata_sync_history")
      .update({
        status: "failed",
        error_details: [error.message],
      })
      .eq("job_id", jobId)
  }
}

export async function POST(request) {
  try {
    const { products, jobId } = await request.json()

    if (!products || !Array.isArray(products) || !jobId) {
      return Response.json({ error: "Invalid request" }, { status: 400 })
    }

    console.log(` Background sync started for job ${jobId} with ${products.length} products`)

    processSyncInBackground(products, jobId).catch((err) => console.error(" Unhandled background sync error:", err))

    return Response.json({ success: true, jobId, message: "Sync processing started in background" })
  } catch (error) {
    console.error(" Request handling error:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

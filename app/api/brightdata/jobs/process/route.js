import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aqkeprwxxsryropnhfvm.supabase.co"
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxa2Vwcnd4eHNyeXJvcG5oZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MzE4MjksImV4cCI6MjA1MzQwNzgyOX0.1nstrLtlahU3kGAu-UrzgOVw6XwyKU6n5H5q4Taqtus"
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
    sync_method: "manual",
    last_synced: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: product.availability !== "out_of_stock" && product.availability !== false,
    created_at: new Date().toISOString(),
  }
}

async function addJobLog(jobId, message, type = "info") {
  const { data: job } = await supabase.from("brightdata_sync_jobs").select("logs").eq("id", jobId).single()

  if (job) {
    const logs = job.logs || []
    logs.push({ message, type, timestamp: new Date().toISOString() })
    await supabase.from("brightdata_sync_jobs").update({ logs }).eq("id", jobId)
  }
}

export async function POST(request) {
  try {
    const { jobId, products } = await request.json()

    console.log("[v0] Processing job:", jobId)

    // Update job status to processing
    await supabase.from("brightdata_sync_jobs").update({ status: "processing" }).eq("id", jobId)

    await addJobLog(jobId, `Starting sync of ${products.length} products`, "info")

    let added = 0
    let updated = 0
    let failed = 0
    const errors = []

    const BATCH_SIZE = 50
    const totalBatches = Math.ceil(products.length / BATCH_SIZE)

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1

      console.log(`[v0] Processing batch ${batchNum}/${totalBatches}`)
      await addJobLog(jobId, `Processing batch ${batchNum}/${totalBatches} (${batch.length} products)`, "info")

      for (const product of batch) {
        try {
          // Skip products without product_id
          if (!product.product_id) {
            failed++
            continue
          }

          const transformed = transformBrightdataProduct(product)

          // Check if product exists (same logic as working code)
          const { data: existing } = await supabase
            .from("zara_cloth_test")
            .select("id")
            .eq("product_id", transformed.product_id)
            .eq("colour_code", transformed.colour_code || "")
            .eq("size", transformed.size || "")
            .maybeSingle()

          if (existing) {
            await supabase.from("zara_cloth_test").update(transformed).eq("id", existing.id)
            updated++
          } else {
            await supabase.from("zara_cloth_test").insert([transformed])
            added++
          }
        } catch (err) {
          failed++
          errors.push(`Product ${product.product_id}: ${err.message}`)
          console.error("[v0] Product sync error:", err.message)
        }
      }

      // Update job progress
      await supabase
        .from("brightdata_sync_jobs")
        .update({
          current_batch: batchNum,
          processed: Math.min(i + BATCH_SIZE, products.length),
          added,
          updated,
          failed,
        })
        .eq("id", jobId)
    }

    // Mark job as completed
    await supabase
      .from("brightdata_sync_jobs")
      .update({
        status: failed === products.length ? "failed" : "completed",
        completed_at: new Date().toISOString(),
        error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
      })
      .eq("id", jobId)

    await addJobLog(jobId, `Sync complete: ${added} added, ${updated} updated, ${failed} failed`, "success")

    // Log to sync history
    await supabase.from("brightdata_sync_history").insert([
      {
        sync_method: "manual_upload",
        total_processed: products.length,
        total_added: added,
        total_updated: updated,
        total_failed: failed,
        error_details: errors.length > 0 ? errors.slice(0, 10) : null,
        status: failed === 0 ? "completed" : "completed_with_errors",
      },
    ])

    console.log(`[v0] Job ${jobId} completed: ${added} added, ${updated} updated, ${failed} failed`)

    return Response.json({ success: true })
  } catch (error) {
    console.error("[v0] Job processing error:", error)

    // Mark job as failed
    if (request.body.jobId) {
      await supabase
        .from("brightdata_sync_jobs")
        .update({
          status: "failed",
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", request.body.jobId)
    }

    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

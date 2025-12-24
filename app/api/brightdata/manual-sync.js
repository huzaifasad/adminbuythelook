import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

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

export async function POST(request) {
  try {
    const { products } = await request.json()
    const productsArray = Array.isArray(products) ? products : [products]

    console.log("[v0] Manual sync API: processing", productsArray.length, "products")

    let added = 0
    let updated = 0
    let failed = 0
    const errors = []
    const batchSize = 50 // Increased batch size for faster processing

    for (let i = 0; i < productsArray.length; i += batchSize) {
      const batch = productsArray.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(productsArray.length / batchSize)
      console.log(`[v0] Processing batch ${batchNum}/${totalBatches} (${batch.length} products)`)

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
    }

    await supabase.from("brightdata_sync_history").insert([
      {
        sync_method: "manual_upload",
        total_processed: productsArray.length,
        total_added: added,
        total_updated: updated,
        total_failed: failed,
        error_details: errors.length > 0 ? errors.slice(0, 10) : null, // Store first 10 errors
        status: failed === 0 ? "completed" : "completed_with_errors",
      },
    ])

    console.log(`[v0] Manual sync completed: ${added} added, ${updated} updated, ${failed} failed`)

    return Response.json({ success: true, added, updated, failed })
  } catch (error) {
    console.error("[v0] Manual sync error:", error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

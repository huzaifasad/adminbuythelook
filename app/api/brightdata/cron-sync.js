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
    sync_method: "cron_auto",
    last_synced: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: product.availability !== "out_of_stock",
    created_at: new Date().toISOString(),
  }
}

export async function GET(request) {
  try {
    console.log("[v0] Cron sync triggered at", new Date().toISOString())

    // Verify cron secret
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // TODO: Fetch from Brightdata API
    const productsData = []

    let added = 0
    let updated = 0
    let failed = 0

    for (const product of productsData) {
      try {
        const transformed = transformBrightdataProduct(product)

        const { data: existing } = await supabase
          .from("zara_cloth_test")
          .select("id")
          .eq("product_id", transformed.product_id)
          .eq("colour_code", transformed.colour_code || "")
          .eq("size", transformed.size || "")
          .single()

        if (existing) {
          await supabase.from("zara_cloth_test").update(transformed).eq("id", existing.id)
          updated++
        } else {
          await supabase.from("zara_cloth_test").insert([transformed])
          added++
        }
      } catch (err) {
        failed++
        console.error("[v0] Cron product sync error:", err.message)
      }
    }

    await supabase.from("brightdata_sync_history").insert([
      {
        sync_method: "cron_auto",
        total_processed: productsData.length,
        total_added: added,
        total_updated: updated,
        total_failed: failed,
        status: "completed",
      },
    ])

    return Response.json({ success: true, added, updated, failed, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error("[v0] Cron sync error:", error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

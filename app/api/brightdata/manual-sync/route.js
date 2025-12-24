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
    sync_method: "manual_upload",
    last_synced: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: product.availability !== "out_of_stock" && product.availability !== false,
    created_at: new Date().toISOString(),
  }
}

export async function POST(request) {
  try {
    const body = await request.json()

    if (!body.products || !Array.isArray(body.products) || body.products.length === 0) {
      return Response.json(
        {
          success: false,
          error: "No products provided",
          added: 0,
          updated: 0,
          failed: 0,
        },
        { status: 400 },
      )
    }

    const { products } = body
    let added = 0
    let updated = 0
    let failed = 0
    const errors = []

    const batchSize = 20
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, Math.min(i + batchSize, products.length))

      const batchResults = await Promise.all(
        batch.map(async (product) => {
          try {
            if (!product.product_id) {
              return {
                type: "failed",
                error: "Missing product_id",
                name: product.product_name || "Unknown",
              }
            }

            const transformedProduct = transformBrightdataProduct(product)

            let query = supabase
              .from("zara_cloth_test")
              .select("id")
              .eq("product_id", transformedProduct.product_id)
              .eq("size", transformedProduct.size || "")

            // Handle NULL vs actual value for colour_code
            if (transformedProduct.colour_code === null) {
              query = query.is("colour_code", null)
            } else {
              query = query.eq("colour_code", transformedProduct.colour_code)
            }

            const { data: existing, error: checkError } = await query.maybeSingle()

            if (checkError && checkError.code !== "PGRST116") {
              throw checkError
            }

            if (existing) {
              const { error: updateError } = await supabase
                .from("zara_cloth_test")
                .update({
                  ...transformedProduct,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existing.id)

              if (updateError) throw updateError
              return { type: "updated", name: transformedProduct.product_name || transformedProduct.product_id }
            } else {
              const { error: insertError } = await supabase.from("zara_cloth_test").insert([transformedProduct])

              if (insertError) {
                // If we still get duplicate key error, try to find and update
                if (insertError.code === "23505") {
                  const { data: retry } = await query.maybeSingle()
                  if (retry) {
                    const { error: retryError } = await supabase
                      .from("zara_cloth_test")
                      .update({
                        ...transformedProduct,
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", retry.id)
                    if (retryError) throw retryError
                    return { type: "updated", name: transformedProduct.product_name || transformedProduct.product_id }
                  }
                }
                throw insertError
              }
              return { type: "added", name: transformedProduct.product_name || transformedProduct.product_id }
            }
          } catch (err) {
            const productName = product.product_name || product.product_id || "Unknown Product"
            return { type: "failed", error: err.message, name: productName }
          }
        }),
      )

      batchResults.forEach((result) => {
        if (result.type === "added") {
          added++
        } else if (result.type === "updated") {
          updated++
        } else if (result.type === "failed") {
          failed++
          errors.push(`${result.name}: ${result.error}`)
        }
      })
    }

    try {
      await supabase.from("brightdata_sync_history").insert([
        {
          sync_method: "manual_upload",
          total_processed: products.length,
          total_added: added,
          total_updated: updated,
          total_failed: failed,
          error_details: errors.length > 0 ? errors.slice(0, 10) : null,
          status: failed === 0 ? "completed" : "completed_with_errors",
          sync_timestamp: new Date().toISOString(),
        },
      ])
    } catch (historyErr) {
      console.error("[v0] Failed to log sync history:", historyErr)
    }

    return Response.json({ success: true, added, updated, failed, errors: errors.slice(0, 5) })
  } catch (error) {
    console.error("[v0] Manual sync error:", error)
    return Response.json(
      {
        success: false,
        error: error.message || "Internal server error",
        added: 0,
        updated: 0,
        failed: 0,
      },
      { status: 500 },
    )
  }
}

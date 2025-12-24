import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aqkeprwxxsryropnhfvm.supabase.co"
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxa2Vwcnd4eHNyeXJvcG5oZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MzE4MjksImV4cCI6MjA1MzQwNzgyOX0.1nstrLtlahU3kGAu-UrzgOVw6XwyKU6n5H5q4Taqtus"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request) {
  try {
    const { products } = await request.json()
    const productsArray = Array.isArray(products) ? products : [products]

    console.log("[v0] Starting background job for", productsArray.length, "products")

    // Calculate batches
    const BATCH_SIZE = 50
    const totalBatches = Math.ceil(productsArray.length / BATCH_SIZE)

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from("brightdata_sync_jobs")
      .insert([
        {
          status: "pending",
          sync_method: "manual_upload",
          total_products: productsArray.length,
          total_batches: totalBatches,
          logs: [],
        },
      ])
      .select()
      .single()

    if (jobError) {
      console.error("[v0] Failed to create job:", jobError)
      throw new Error("Failed to create sync job")
    }

    console.log("[v0] Created job:", job.id)

    // Start processing in background by calling the process endpoint
    // Don't await - let it run in background
    fetch(`${request.url.replace("/start", "/process")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, products: productsArray }),
    }).catch((err) => console.error("[v0] Background process trigger failed:", err))

    return Response.json({ success: true, jobId: job.id })
  } catch (error) {
    console.error("[v0] Job start error:", error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

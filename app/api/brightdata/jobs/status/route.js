import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aqkeprwxxsryropnhfvm.supabase.co"
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxa2Vwcnd4eHNyeXJvcG5oZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MzE4MjksImV4cCI6MjA1MzQwNzgyOX0.1nstrLtlahU3kGAu-UrzgOVw6XwyKU6n5H5q4Taqtus"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get("jobId")

    if (!jobId) {
      // Return latest job if no specific ID
      const { data: jobs, error } = await supabase
        .from("brightdata_sync_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)

      if (error) throw error

      return Response.json({ success: true, job: jobs?.[0] || null })
    }

    // Get specific job
    const { data: job, error } = await supabase.from("brightdata_sync_jobs").select("*").eq("id", jobId).single()

    if (error) throw error

    return Response.json({ success: true, job })
  } catch (error) {
    console.error("[v0] Job status error:", error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

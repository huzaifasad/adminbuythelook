"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Upload, History, Package, ArrowLeft, Search, Filter, X } from "lucide-react"
import Link from "next/link"

function ProductCard({ product }) {
  const [expanded, setExpanded] = useState(false)

  const getImageUrl = () => {
    if (product.image) {
      try {
        if (typeof product.image === "string") {
          if (product.image.startsWith("[")) {
            const parsed = JSON.parse(product.image)
            return parsed[0]?.url || parsed[0] || "/placeholder.svg?height=300&width=300"
          }
          return product.image
        }
      } catch (e) {
        return "/placeholder.svg?height=300&width=300"
      }
    }
    return "/placeholder.svg?height=300&width=300"
  }

  return (
    <div className="group bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all duration-300">
      <div className="relative aspect-square overflow-hidden bg-secondary">
        <img
          src={getImageUrl() || "/placeholder.svg"}
          alt={product.product_name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            e.target.onerror = null
            e.target.src = "/placeholder.svg?height=300&width=300"
          }}
        />
        <div className="absolute top-2 right-2">
          {product.availability && product.availability !== "out_of_stock" ? (
            <div className="px-2 py-1 bg-success text-success-foreground text-xs font-medium rounded-md backdrop-blur-sm">
              In Stock
            </div>
          ) : (
            <div className="px-2 py-1 bg-destructive text-destructive-foreground text-xs font-medium rounded-md backdrop-blur-sm">
              Out of Stock
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-foreground mb-2 line-clamp-2 text-sm leading-relaxed">
          {product.product_name}
        </h3>

        <p className="text-lg font-bold text-foreground mb-3">
          {product.currency || "$"}
          {Number(product.price).toFixed(2)}
        </p>

        {product.url && (
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
          >
            View Product
          </a>
        )}

        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">ID: {product.product_id}</p>
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
}

const transformBrightdataProduct = (product) => {
  const parseCategoryId = (value, fieldName = "field") => {
    if (value === null || value === undefined || value === "" || String(value).trim().toLowerCase() === "null") {
      return null
    }

    const parsed = Number.parseInt(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  return {
    product_id: product.product_id,
    product_name: product.product_name,
    price: Number.parseFloat(product.price) || 0,
    currency: product.currency || null,
    colour: product.colour || null,
    colour_code: parseCategoryId(product.colour_code, "colour_code"),
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
    category_id: parseCategoryId(product.category_id, "category_id"),
    category_name: product.category_name || null,
    seo_category_id: parseCategoryId(product.seo_category_id, "seo_category_id"),
    source: "zara",
    sync_method: "brightdata",
    last_synced: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: product.availability !== "out_of_stock" && product.availability !== false,
    created_at: new Date().toISOString(),
  }
}

const supabaseUrl = "https://aqkeprwxxsryropnhfvm.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxa2Vwcnd4eHNyeXJvcG5oZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MzE4MjksImV4cCI6MjA1MzQwNzgyOX0.1nstrLtlahU3kGAu-UrzgOVw6XwyKU6n5H5q4Taqtus"
const supabase = createClient(supabaseUrl, supabaseKey)

export default function BrightdataSyncPage() {
  const [syncHistory, setSyncHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [stats, setStats] = useState(null)
  const [jsonInput, setJsonInput] = useState("")
  const [activeTab, setActiveTab] = useState("upload")
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const productsPerPage = 24
  const [selectedFile, setSelectedFile] = useState(null)
  const [syncLogs, setSyncLogs] = useState([]) // Real-time logs
  const [lastSyncMethod, setLastSyncMethod] = useState(null) // Track which method was used
  const logsEndRef = useRef(null) // Added ref for auto-scroll

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [syncLogs])

  useEffect(() => {
    loadSyncHistory()
    loadStats()
  }, [])

  const loadSyncHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("brightdata_sync_history")
        .select("*")
        .order("sync_timestamp", { ascending: false })
        .limit(10)

      if (error && error.code === "42P01") {
        console.log("[v0] brightdata_sync_history table not found - run SQL script first")
        toast.error("Please run the SQL script first to create the brightdata_sync_history table")
        return
      }
      if (error) throw error
      setSyncHistory(data || [])
    } catch (err) {
      console.error("[v0] Error loading sync history:", err)
      toast.error("Failed to load sync history")
    }
  }

  const loadStats = async () => {
    try {
      const { data: syncData, error } = await supabase
        .from("brightdata_sync_history")
        .select("total_added, total_updated, total_failed, sync_timestamp, sync_method")
        .order("sync_timestamp", { ascending: false })
        .limit(1)

      if (error && error.code !== "42P01") {
        throw error
      }

      // Fetch total products count separately for the stats section
      const { count } = await supabase
        .from("zara_cloth_test")
        .select("*", { count: "exact", head: true })
        .eq("source", "zara")

      setStats({
        totalProducts: count || 0,
        lastSync: syncData?.[0] || null,
      })
      setLastSyncMethod(syncData?.[0]?.sync_method || null)
    } catch (err) {
      console.error("[v0] Error loading stats:", err)
      toast.error("Failed to load stats")
    }
  }

  const loadProducts = async (page = 1) => {
    setLoading(true)
    try {
      const from = (page - 1) * productsPerPage
      const to = from + productsPerPage - 1

      const { data, error, count } = await supabase
        .from("zara_cloth_test")
        .select("*", { count: "exact" })
        .eq("source", "zara")
        .order("created_at", { ascending: false })
        .range(from, to)

      if (error) throw error

      setProducts(data || [])
      setFilteredProducts(data || [])
      setTotalProducts(count || 0)
    } catch (err) {
      console.error("[v0] Error loading products:", err)
      toast.error("Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = products.filter(
        (p) =>
          p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.product_id?.toString().includes(searchQuery),
      )
      setFilteredProducts(filtered)
    } else {
      setFilteredProducts(products)
    }
  }, [searchQuery, products])

  useEffect(() => {
    if (activeTab === "products") {
      loadProducts(currentPage)
    } else if (activeTab === "history") {
      loadSyncHistory() // Ensure history is loaded when switching to it
    } else if (activeTab === "upload") {
      // Removed 'fetch' condition
      loadStats() // Reload stats to ensure accuracy when switching back to sync tabs
    }
  }, [activeTab, currentPage])

  const addLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString()
    setSyncLogs((prev) => [...prev, { timestamp, message, type }])
  }

  const handleManualUpload = async () => {
    if (!jsonInput.trim() && !selectedFile) {
      toast.error("Please paste JSON data or select a file")
      return
    }

    setSyncing(true)
    setSyncLogs([])
    addLog("Starting manual sync...", "info")

    try {
      let productsToSync = []

      if (selectedFile) {
        addLog(`Reading file: ${selectedFile.name}...`, "info")
        const fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target.result)
          reader.onerror = reject
          reader.readAsText(selectedFile)
        })

        const parsedProducts = JSON.parse(fileContent)
        productsToSync = Array.isArray(parsedProducts) ? parsedProducts : [parsedProducts]
        addLog(`Parsed ${productsToSync.length} products from file`, "info")
      } else if (jsonInput.trim()) {
        const parsedProducts = JSON.parse(jsonInput)
        productsToSync = Array.isArray(parsedProducts) ? parsedProducts : [parsedProducts]
        addLog(`Parsed ${productsToSync.length} products from input`, "info")
      }

      if (productsToSync.length === 0) {
        toast.error("No products found to sync.")
        setSyncing(false)
        return
      }

      let added = 0
      let updated = 0
      let failed = 0
      const errors = []

      const batchSize = 20
      for (let i = 0; i < productsToSync.length; i += batchSize) {
        const batch = productsToSync.slice(i, Math.min(i + batchSize, productsToSync.length))
        const batchResults = await Promise.all(
          batch.map(async (product) => {
            try {
              const transformedProduct = transformBrightdataProduct(product)

              console.log("[v0] Transformed product fields:", {
                colour_code: transformedProduct.colour_code,
                category_id: transformedProduct.category_id,
                seo_category_id: transformedProduct.seo_category_id,
                colour_code_type: typeof transformedProduct.colour_code,
                category_id_type: typeof transformedProduct.category_id,
                seo_category_id_type: typeof transformedProduct.seo_category_id,
              })

              const { data: existing, error: checkError } = await supabase
                .from("zara_cloth_test")
                .select("id")
                .eq("product_id", transformedProduct.product_id)
                .eq("colour_code", transformedProduct.colour_code || "")
                .eq("size", transformedProduct.size || "")
                .maybeSingle()

              if (checkError && checkError.code !== "PGRST116") throw checkError

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

                if (insertError) throw insertError
                return { type: "added", name: transformedProduct.product_name || transformedProduct.product_id }
              }
            } catch (err) {
              console.error("[v0] Error processing product:", err)
              const productName = product.product_name || product.product_id || "Unknown Product"
              return { type: "failed", error: err.message, name: productName }
            }
          }),
        )

        batchResults.forEach((result) => {
          if (result.type === "added") {
            added++
            addLog(`✓ Added: ${result.name}`, "success")
          } else if (result.type === "updated") {
            updated++
            addLog(`↻ Updated: ${result.name}`, "info")
          } else if (result.type === "failed") {
            failed++
            errors.push(`${result.name}: ${result.error}`)
            addLog(`✗ Failed: ${result.name}`, "error")
          }
        })

        const processed = Math.min(i + batchSize, productsToSync.length)
        addLog(`Processing batch: ${processed}/${productsToSync.length}`, "info")
      }

      // Log sync to history
      const { error: logError } = await supabase.from("brightdata_sync_history").insert([
        {
          sync_method: "manual_upload",
          total_processed: productsToSync.length,
          total_added: added,
          total_updated: updated,
          total_failed: failed,
          error_details: errors.length > 0 ? errors.slice(0, 10) : null, // Store first 10 errors
          status: failed === 0 ? "completed" : "completed_with_errors",
          sync_timestamp: new Date().toISOString(),
        },
      ])

      if (logError) console.error("[v0] Error logging sync:", logError)

      const successMessage = `Sync complete: ${added} added, ${updated} updated, ${failed} failed`
      addLog(successMessage, "success")
      toast.dismiss()
      toast.success(successMessage)
      setJsonInput("")
      setSelectedFile(null)
      setLastSyncMethod("manual_upload")
      loadSyncHistory()
      loadStats()
      if (activeTab === "products") {
        // Refresh products if we are on that tab
        loadProducts(currentPage)
      }
    } catch (err) {
      console.error("[v0] Manual sync error:", err)
      addLog(`Error: ${err.message}`, "error")
      toast.dismiss()
      toast.error("Sync failed: " + err.message)
    } finally {
      setSyncing(false)
    }
  }

  const handleFetchSync = async () => {
    setSyncing(true)
    setSyncLogs([])
    addLog("Starting fetch & sync...", "info")

    try {
      const response = await fetch("/api/brightdata/fetch-sync", { method: "POST" })
      const result = await response.json()

      if (result.success) {
        addLog(`Fetched ${result.total} products from Brightdata`, "info")
        addLog(`${result.added} added, ${result.updated} updated, ${result.failed} failed`, "success")
        toast.success(`Sync Complete: ${result.added} added, ${result.updated} updated, ${result.failed} failed`)
        setLastSyncMethod("fetch_sync")
      } else {
        addLog(`Error: ${result.error}`, "error")
        toast.error(result.error || "Sync failed")
      }

      loadSyncHistory()
      loadStats()
      if (activeTab === "products") {
        // Refresh products if we are on that tab
        loadProducts(currentPage)
      }
    } catch (err) {
      console.error("[v0] Fetch sync error:", err)
      addLog(`Error: ${err.message}`, "error")
      toast.error("Fetch sync failed: " + err.message)
    } finally {
      setSyncing(false)
    }
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      setJsonInput("")
      return
    }

    if (!file.name.endsWith(".json")) {
      toast.error("Please select a JSON file")
      setSelectedFile(null)
      setJsonInput("")
      return
    }

    setSelectedFile(file)
    toast.success(`File loaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
  }

  // Enhanced header with back button
  // Stats cards with enhanced design
  // Enhanced tabs with icons
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-secondary rounded-md transition-colors" title="Back">
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Brightdata Sync</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Automated product data management</p>
              </div>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${syncing ? "border-warning/30 bg-warning/10" : "border-success/30 bg-success/10"}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${syncing ? "bg-warning animate-pulse" : "bg-success"}`} />
              <span className={`text-xs font-medium ${syncing ? "text-warning" : "text-success"}`}>
                {syncing ? "Syncing" : "Ready"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Total Products</p>
              <p className="text-3xl font-bold text-foreground">{stats.totalProducts.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Last Sync</p>
              <p className="text-sm font-semibold text-foreground">
                {stats.lastSync?.sync_timestamp
                  ? new Date(stats.lastSync.sync_timestamp).toLocaleDateString()
                  : "Never"}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Sync Method</p>
              <p className="text-sm font-semibold text-foreground capitalize">
                {lastSyncMethod?.replace(/_/g, " ") || "N/A"}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Last Result</p>
              <div className="flex gap-3 text-xs font-medium">
                <span className="text-success">+{stats.lastSync?.total_added || 0}</span>
                <span className="text-primary">↻{stats.lastSync?.total_updated || 0}</span>
                <span className="text-destructive">✗{stats.lastSync?.total_failed || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-border bg-secondary/30">
            <div className="flex">
              <button
                onClick={() => setActiveTab("upload")}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium transition-all ${
                  activeTab === "upload"
                    ? "text-foreground border-b-2 border-primary bg-background/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Upload className="w-4 h-4" />
                Manual Upload
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium transition-all ${
                  activeTab === "history"
                    ? "text-foreground border-b-2 border-primary bg-background/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <History className="w-4 h-4" />
                Sync History
              </button>
              <button
                onClick={() => setActiveTab("products")}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium transition-all ${
                  activeTab === "products"
                    ? "text-foreground border-b-2 border-primary bg-background/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Package className="w-4 h-4" />
                Products
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "upload" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">Upload JSON File</label>

                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-secondary file:text-foreground hover:file:bg-secondary/80 file:cursor-pointer cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <button
                  onClick={handleManualUpload}
                  disabled={syncing || !selectedFile}
                  className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-md font-medium hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {syncing ? (
                    <>
                      <Spinner />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Sync Products
                    </>
                  )}
                </button>

                {/* Sync Logs */}
                {syncLogs.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Live Sync Logs
                    </h3>
                    <div className="bg-background border border-border rounded-md p-4 font-mono text-xs max-h-96 overflow-y-auto">
                      {syncLogs.map((log, i) => (
                        <div
                          key={i}
                          className={`mb-1 ${
                            log.type === "error"
                              ? "text-destructive"
                              : log.type === "success"
                                ? "text-success"
                                : "text-muted-foreground"
                          }`}
                        >
                          <span className="text-muted-foreground/50">[{log.timestamp}]</span> {log.message}
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "products" && (
              <div className="space-y-6">
                {/* Search Bar */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by product name or ID..."
                      className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm text-foreground placeholder:text-muted-foreground transition-all"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                  <button className="p-2.5 border border-border rounded-md hover:bg-secondary transition-colors">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Products Count */}
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{filteredProducts.length}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalProducts}</span> products
                </p>

                {/* Products Grid */}
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Spinner />
                    <span className="ml-3 text-muted-foreground">Loading products...</span>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="bg-card border border-border rounded-lg p-12 text-center">
                    <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No products found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {filteredProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalProducts > productsPerPage && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-border rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-muted-foreground">
                      Page {currentPage} of {Math.ceil(totalProducts / productsPerPage)}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={currentPage >= Math.ceil(totalProducts / productsPerPage)}
                      className="px-4 py-2 border border-border rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div className="space-y-4">
                {syncHistory.length === 0 ? (
                  <div className="bg-card border border-border rounded-lg p-12 text-center">
                    <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No sync history yet</p>
                    <p className="text-sm text-muted-foreground/70 mt-2">Start your first sync to see the history</p>
                  </div>
                ) : (
                  syncHistory.map((sync) => (
                    <div
                      key={sync.id}
                      className="bg-card border border-border rounded-lg p-5 hover:border-primary/50 transition-all"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-semibold text-foreground capitalize">
                            {sync.sync_method?.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(sync.sync_timestamp).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                            sync.status === "completed"
                              ? "bg-success/10 text-success border border-success/20"
                              : "bg-warning/10 text-warning border border-warning/20"
                          }`}
                        >
                          {sync.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-secondary rounded-md p-3">
                          <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Processed</p>
                          <p className="font-bold text-foreground text-lg">{sync.total_processed}</p>
                        </div>
                        <div className="bg-success/10 rounded-md p-3">
                          <p className="text-success text-xs uppercase tracking-wider mb-1">Added</p>
                          <p className="font-bold text-success text-lg">{sync.total_added}</p>
                        </div>
                        <div className="bg-primary/10 rounded-md p-3">
                          <p className="text-primary text-xs uppercase tracking-wider mb-1">Updated</p>
                          <p className="font-bold text-primary text-lg">{sync.total_updated}</p>
                        </div>
                        <div className="bg-destructive/10 rounded-md p-3">
                          <p className="text-destructive text-xs uppercase tracking-wider mb-1">Failed</p>
                          <p className="font-bold text-destructive text-lg">{sync.total_failed}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

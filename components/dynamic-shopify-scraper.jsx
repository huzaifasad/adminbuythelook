"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Search,
  Package,
  Loader2,
  Download,
  Grid,
  DollarSign,
  CheckCircle,
  XCircle,
  Database,
  Check,
  ImageIcon,
  Store,
  Plus,
  Trash2,
  Globe,
  Eye,
  X,
  RefreshCw,
  ShoppingBag,
  Layers,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  AlertCircle,
} from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import toast, { Toaster } from "react-hot-toast"

const supabase = createClient(
  "https://aqkeprwxxsryropnhfvm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxa2Vwcnd4eHNyeXJvcG5oZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MzE4MjksImV4cCI6MjA1MzQwNzgyOX0.1nstrLtlahU3kGAu-UrzgOVw6XwyKU6n5H5q4Taqtus",
)

const DEFAULT_STORES = [
  { name: "Beginning Boutique", url: "https://www.beginningboutique.com", active: true }, // Updated default store
  { name: "Kith", url: "https://kith.com", active: false },
  { name: "Allbirds", url: "https://www.allbirds.com", active: false },
  // Removed other default stores to match the update
]

export default function DynamicShopifyScraper() {
  const [viewMode, setViewMode] = useState("scraper") // 'scraper', 'dashboard', or 'database'
  const [syncLogs, setSyncLogs] = useState([])
  const [priceChanges, setPriceChanges] = useState([])
  const [stockChanges, setStockChanges] = useState([])
  const [dashboardStats, setDashboardStats] = useState({
    totalStores: 0,
    totalProducts: 0,
    recentChanges: 0,
    lastSync: null,
  })
  const [syncing, setSyncing] = useState(false)
  const [selectedStoreForSync, setSelectedStoreForSync] = useState(null)

  // Store Management
  const [stores, setStores] = useState(DEFAULT_STORES)
  const [currentStore, setCurrentStore] = useState(DEFAULT_STORES[0])
  const [showAddStore, setShowAddStore] = useState(false)
  const [newStoreName, setNewStoreName] = useState("")
  const [newStoreUrl, setNewStoreUrl] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // State Management
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState("")
  const [allProducts, setAllProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [productsPerPage] = useState(24)
  const [scrapingAll, setScrapingAll] = useState(false)

  // Renamed 'viewMode' state to 'displayMode' to avoid conflict
  const [displayMode, setDisplayMode] = useState("paginated") // 'paginated' or 'all'

  // Selection & Database States
  const [selectedProducts, setSelectedProducts] = useState(new Set())
  const [uploadingToDb, setUploadingToDb] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [uploadResults, setUploadResults] = useState({ success: 0, failed: 0, skipped: 0 })
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedProductImages, setSelectedProductImages] = useState(null)

  // Quick View State
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [showQuickView, setShowQuickView] = useState(false)
  const [checkingShopify, setCheckingShopify] = useState(false)

  // Filter States
  const [filters, setFilters] = useState({
    vendor: "",
    productType: "",
    tag: "",
    priceMin: "",
    priceMax: "",
    availability: "all",
    searchQuery: "",
  })

  // Metadata States
  const [vendors, setVendors] = useState([])
  const [productTypes, setProductTypes] = useState([])
  const [tags, setTags] = useState([])
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCollections: 0,
    avgPrice: 0,
    inStock: 0,
    outOfStock: 0,
  })

  const [dbProducts, setDbProducts] = useState([])
  const [dbLoading, setDbLoading] = useState(false)
  const [dbCurrentPage, setDbCurrentPage] = useState(1)
  const [dbProductsPerPage] = useState(24)
  const [dbFilters, setDbFilters] = useState({
    searchQuery: "",
    storeName: "",
    hasImages: "all",
    availability: "all",
    priceMin: "",
    priceMax: "",
    brand: "",
    productType: "",
  })
  const [dbStores, setDbStores] = useState([])
  const [dbBrands, setDbBrands] = useState([])
  const [dbProductTypes, setDbProductTypes] = useState([])
  const [selectedDbProducts, setSelectedDbProducts] = useState(new Set())
  const [dbTotalProducts, setDbTotalProducts] = useState(0)

  useEffect(() => {
    if (viewMode === "dashboard") {
      loadDashboardData()
    }
  }, [viewMode])

  useEffect(() => {
    if (viewMode === "database") {
      fetchDatabaseProducts()
    }
  }, [viewMode, dbCurrentPage, dbFilters]) // Added dependencies to re-fetch when page or filters change

  // Load stores from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem("shopify_stores")
    if (saved) {
      const parsedStores = JSON.parse(saved)
      setStores(parsedStores)
      const activeStore = parsedStores.find((s) => s.active) || parsedStores[0]
      setCurrentStore(activeStore)
    }
  }, [])

  // Save stores to localStorage
  useEffect(() => {
    localStorage.setItem("shopify_stores", JSON.stringify(stores))
  }, [stores])

  // Fetch Collections when store changes
  useEffect(() => {
    if (currentStore && viewMode === "scraper") {
      fetchCollections()
      setSelectedCollection("")
      setAllProducts([])
      setSelectedProducts(new Set())
    }
  }, [currentStore, viewMode])

  const loadDashboardData = async () => {
    try {
      // Load sync logs
      const { data: logs, error: logsError } = await supabase
        .from("sync_logs")
        .select("*")
        .order("sync_timestamp", { ascending: false })
        .limit(20)

      // Check if tables don't exist
      if (logsError && logsError.code === "42P01") {
        toast.error("Database tables not found. Please run the SQL scripts first!", { duration: 8000 })
        setDashboardStats({
          totalStores: stores.length,
          totalProducts: 0,
          recentChanges: 0,
          lastSync: null,
        })
        return
      }

      if (logsError) throw logsError
      setSyncLogs(logs || [])

      // Load price changes
      const { data: prices, error: pricesError } = await supabase
        .from("price_history")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(20)

      if (pricesError && pricesError.code !== "42P01") throw pricesError
      setPriceChanges(prices || [])

      // Load stock changes
      const { data: stocks, error: stocksError } = await supabase
        .from("stock_history")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(20)

      if (stocksError && stocksError.code !== "42P01") throw stocksError
      setStockChanges(stocks || [])

      // Calculate dashboard stats
      const { count: productCount } = await supabase
        .from("zara_cloth_test")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)

      setDashboardStats({
        totalStores: stores.length,
        totalProducts: productCount || 0,
        recentChanges: (prices?.length || 0) + (stocks?.length || 0),
        lastSync: logs?.[0]?.sync_timestamp || null,
      })
    } catch (err) {
      console.error("[v0] Error loading dashboard data:", err)
      toast.error("Failed to load dashboard data: " + err.message)
    }
  }

  // Fetch database products based on filters and pagination
  const fetchDatabaseProducts = async () => {
    setDbLoading(true)
    try {
      let countQuery = supabase.from("zara_cloth_test").select("*", { count: "exact", head: true })

      // Apply filters to count query
      if (dbFilters.searchQuery) {
        const searchQueryLower = dbFilters.searchQuery.toLowerCase()
        countQuery = countQuery.or(
          `product_name.ilike.%${searchQueryLower}%,brand.ilike.%${searchQueryLower}%,product_type.ilike.%${searchQueryLower}%,sku.ilike.%${searchQueryLower}%`,
        )
      }
      if (dbFilters.storeName) countQuery = countQuery.eq("store_name", dbFilters.storeName)
      if (dbFilters.brand) countQuery = countQuery.eq("brand", dbFilters.brand)
      if (dbFilters.productType) countQuery = countQuery.eq("product_type", dbFilters.productType)
      if (dbFilters.hasImages === "yes") countQuery = countQuery.neq("images", null).gt("images_count", 0) // Assuming 'images_count' or similar column exists
      if (dbFilters.hasImages === "no")
        countQuery = countQuery.is("images", null).or("images_count.eq.0,images_count.is.null") // Assuming 'images_count' or similar column exists
      if (dbFilters.availability === "in_stock") countQuery = countQuery.eq("availability", true)
      if (dbFilters.availability === "out_of_stock") countQuery = countQuery.eq("availability", false)
      if (dbFilters.priceMin) countQuery = countQuery.gte("price", Number.parseFloat(dbFilters.priceMin))
      if (dbFilters.priceMax) countQuery = countQuery.lte("price", Number.parseFloat(dbFilters.priceMax))

      const { count: totalCount, error: countError } = await countQuery

      if (countError) throw countError

      setDbTotalProducts(totalCount || 0)

      const from = (dbCurrentPage - 1) * dbProductsPerPage
      const to = from + dbProductsPerPage - 1

      let dataQuery = supabase.from("zara_cloth_test").select("*").range(from, to)

      // Apply same filters to data query
      if (dbFilters.searchQuery) {
        const searchQueryLower = dbFilters.searchQuery.toLowerCase()
        dataQuery = dataQuery.or(
          `product_name.ilike.%${searchQueryLower}%,brand.ilike.%${searchQueryLower}%,product_type.ilike.%${searchQueryLower}%,sku.ilike.%${searchQueryLower}%`,
        )
      }
      if (dbFilters.storeName) dataQuery = dataQuery.eq("store_name", dbFilters.storeName)
      if (dbFilters.brand) dataQuery = dataQuery.eq("brand", dbFilters.brand)
      if (dbFilters.productType) dataQuery = dataQuery.eq("product_type", dbFilters.productType)
      if (dbFilters.hasImages === "yes") dataQuery = dataQuery.neq("images", null).gt("images_count", 0) // Assuming 'images_count' or similar column exists
      if (dbFilters.hasImages === "no")
        dataQuery = dataQuery.is("images", null).or("images_count.eq.0,images_count.is.null") // Assuming 'images_count' or similar column exists
      if (dbFilters.availability === "in_stock") dataQuery = dataQuery.eq("availability", true)
      if (dbFilters.availability === "out_of_stock") dataQuery = dataQuery.eq("availability", false)
      if (dbFilters.priceMin) dataQuery = dataQuery.gte("price", Number.parseFloat(dbFilters.priceMin))
      if (dbFilters.priceMax) dataQuery = dataQuery.lte("price", Number.parseFloat(dbFilters.priceMax))

      dataQuery = dataQuery.order("created_at", { ascending: false })

      const { data, error } = await dataQuery

      if (error) throw error

      setDbProducts(data || [])

      const { data: storeData } = await supabase
        .from("zara_cloth_test")
        .select("store_name")
        .not("store_name", "is", null)
      const { data: brandData } = await supabase.from("zara_cloth_test").select("brand").not("brand", "is", null)
      const { data: typeData } = await supabase
        .from("zara_cloth_test")
        .select("product_type")
        .not("product_type", "is", null)

      const stores = [...new Set(storeData?.map((p) => p.store_name).filter(Boolean) || [])].sort()
      const brands = [...new Set(brandData?.map((p) => p.brand).filter(Boolean) || [])].sort()
      const types = [...new Set(typeData?.map((p) => p.product_type).filter(Boolean) || [])].sort()

      setDbStores(stores)
      setDbBrands(brands)
      setDbProductTypes(types)

      toast.success(`Loaded ${data?.length || 0} of ${totalCount} products`)
    } catch (error) {
      console.error("Error fetching database products:", error)
      toast.error(`Failed to load products: ${error.message}`)
    } finally {
      setDbLoading(false)
    }
  }

  // Sync store function remains the same

  const syncStore = async (store) => {
    setSyncing(true)
    setSelectedStoreForSync(store)
    toast.loading(`Syncing ${store.name}...`, { id: "sync" })

    let productsAdded = 0
    let productsUpdated = 0
    let productsRemoved = 0
    let totalProductsSynced = 0

    try {
      // Fetch all products from the store
      const response = await fetch(`${store.url}/products.json?limit=250`)
      if (!response.ok) throw new Error("Failed to fetch products")

      const data = await response.json()
      const shopifyProducts = data.products || []
      totalProductsSynced = shopifyProducts.length

      // Get existing products from database for this store
      const { data: dbProducts, error: dbError } = await supabase
        .from("zara_cloth_test")
        .select("product_id, price, stock_status, product_name, sync_count, is_active, availability") // Added availability
        .eq("store_name", store.name) // Filter by store name

      if (dbError) throw dbError

      const dbProductMap = new Map(dbProducts.map((p) => [p.product_id, p]))

      // Process each product
      for (const product of shopifyProducts) {
        const productId = Number.parseInt(product.id)
        const variant = product.variants?.[0] || {}
        const newPrice = variant.price ? Number.parseFloat(variant.price) : 0
        const newStockStatus = variant.available ? "in_stock" : "out_of_stock"
        const newAvailability = variant.available

        const existingProduct = dbProductMap.get(productId)

        if (!existingProduct) {
          // New product - insert it
          const dbProduct = transformProductForDB(product, store)
          dbProduct.first_scraped_at = new Date().toISOString() // Set first scraped at
          dbProduct.is_active = true // Ensure it's marked active
          dbProduct.sync_count = 1 // Initialize sync count
          dbProduct.stock_status = newStockStatus
          dbProduct.availability = newAvailability
          dbProduct.store_name = store.name // Ensure store_name is set

          const { error: insertError } = await supabase.from("zara_cloth_test").insert([dbProduct])

          if (!insertError) {
            productsAdded++
          } else {
            console.error(`[Sync] Error inserting product ${productId}:`, insertError)
            toast.error(`Failed to insert ${product.title}`)
          }
        } else {
          // Existing product - check for changes
          let hasChanges = false
          const updates = {
            last_synced_at: new Date().toISOString(),
            sync_count: (existingProduct.sync_count || 0) + 1,
          }

          // Check price change
          if (existingProduct.price !== newPrice) {
            await supabase.from("price_history").insert([
              {
                product_id: productId,
                product_name: product.title,
                old_price: existingProduct.price,
                new_price: newPrice,
                store_name: store.name,
              },
            ])
            updates.price = newPrice
            hasChanges = true
          }

          // Check stock change
          if (existingProduct.stock_status !== newStockStatus || existingProduct.availability !== newAvailability) {
            await supabase.from("stock_history").insert([
              {
                product_id: productId,
                product_name: product.title,
                old_status: existingProduct.stock_status,
                new_status: newStockStatus,
                store_name: store.name,
                changed_at: new Date().toISOString(),
              },
            ])
            updates.stock_status = newStockStatus
            updates.availability = newAvailability
            hasChanges = true
          }

          // Check if product should be reactivated
          if (!existingProduct.is_active && (hasChanges || newAvailability)) {
            updates.is_active = true
            hasChanges = true
          }

          if (hasChanges) {
            await supabase.from("zara_cloth_test").update(updates).eq("product_id", productId)
            productsUpdated++
          } else {
            // Just update sync timestamp and count if no other changes
            await supabase
              .from("zara_cloth_test")
              .update({ last_synced_at: new Date().toISOString(), sync_count: updates.sync_count })
              .eq("product_id", productId)
          }

          dbProductMap.delete(productId)
        }
      }

      // Mark remaining products as inactive (removed from store)
      for (const [productId, productData] of dbProductMap) {
        if (productData.is_active) {
          await supabase
            .from("zara_cloth_test")
            .update({ is_active: false, last_synced_at: new Date().toISOString() })
            .eq("product_id", productId)
          productsRemoved++
        }
      }

      // Log the sync
      await supabase.from("sync_logs").insert([
        {
          store_name: store.name,
          store_url: store.url,
          products_added: productsAdded,
          products_updated: productsUpdated,
          products_removed: productsRemoved,
          total_products_synced: totalProductsSynced,
          status: "success",
        },
      ])

      toast.success(
        `Sync complete! Added: ${productsAdded}, Updated: ${productsUpdated}, Removed: ${productsRemoved}`,
        { id: "sync", duration: 6000 },
      )

      // Reload dashboard data
      await loadDashboardData()
      // If in database view, refresh that too
      if (viewMode === "database") {
        fetchDatabaseProducts()
      }
    } catch (err) {
      console.error("Sync error:", err)
      await supabase.from("sync_logs").insert([
        {
          store_name: store.name,
          store_url: store.url,
          products_added: productsAdded,
          products_updated: productsUpdated,
          products_removed: productsRemoved,
          total_products_synced: totalProductsSynced,
          status: "failed",
          error_message: err.message,
        },
      ])
      toast.error(`Sync failed: ${err.message}`, { id: "sync" })
    } finally {
      setSyncing(false)
      setSelectedStoreForSync(null)
    }
  }

  const filteredStores = stores.filter(
    (store) =>
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.url.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const addStore = async () => {
    if (!newStoreName || !newStoreUrl) {
      toast.error("Please enter both store name and URL")
      return
    }

    try {
      setCheckingShopify(true)
      const url = new URL(newStoreUrl)
      const shopifyCheckUrl = `${url.origin}/products.json`

      const response = await fetch(shopifyCheckUrl)

      if (!response.ok) {
        toast.error("This site is not using Shopify.") // Simplified error message
        return
      }

      const data = await response.json()

      if (data.products) {
        const newStore = {
          name: newStoreName,
          url: url.origin,
          active: false,
        }

        setStores((prev) => [...prev, newStore])
        setNewStoreName("")
        setNewStoreUrl("")
        setShowAddStore(false)
        toast.success(`Store "${newStoreName}" added successfully!`) // Simplified success message
      } else {
        toast.error("This site is not a valid Shopify store.") // Simplified error message
      }
    } catch (err) {
      toast.error("This store is not built on Shopify — please enter a Shopify store URL.") // Simplified error message
    } finally {
      setCheckingShopify(false)
    }
  }

  // Delete store
  const deleteStore = (index) => {
    if (confirm(`Delete store "${stores[index].name}"?`)) {
      const newStores = stores.filter((_, i) => i !== index)
      setStores(newStores)
      if (currentStore === stores[index]) {
        setCurrentStore(newStores[0])
      }
      toast.success("Store deleted successfully")
    }
  }

  // Switch store
  const switchStore = (store) => {
    setCurrentStore(store)
    setStores(stores.map((s) => ({ ...s, active: s.url === store.url })))
    toast.success(`Switched to ${store.name}`)
  }

  const fetchCollections = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch(`${currentStore.url}/collections.json`)

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.collections) {
        setCollections(data.collections)
        setStats((prev) => ({ ...prev, totalCollections: data.collections.length }))
      } else {
        setError("No collections found. This might not be a Shopify store.")
      }
    } catch (err) {
      setError(`Failed to fetch collections: ${err.message}`)
      setCollections([])
      toast.error("Failed to fetch collections")
    } finally {
      setLoading(false)
    }
  }

  const fetchCollectionProducts = async (handle, pageNum = 1) => {
    if (!handle) return []

    try {
      const limit = 250
      const url = `${currentStore.url}/collections/${handle}/products.json?limit=${limit}&page=${pageNum}`
      const response = await fetch(url)

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      return data.products || []
    } catch (err) {
      console.error(`Error fetching page ${pageNum}:`, err)
      toast.error(`Error fetching page ${pageNum}`)
      return []
    }
  }

  const scrapeAllCollectionProducts = async (handle) => {
    setScrapingAll(true)
    setError("")
    let allProds = []
    let page = 1
    let hasMore = true

    try {
      toast.loading("Fetching all products...", { id: "scraping" })

      while (hasMore) {
        const prods = await fetchCollectionProducts(handle, page)

        if (prods.length === 0) {
          hasMore = false
        } else {
          allProds = [...allProds, ...prods]
          toast.loading(`Fetched ${allProds.length} products...`, { id: "scraping" })

          if (prods.length < 250) {
            hasMore = false
          }

          page++
          await new Promise((resolve) => setTimeout(resolve, 300)) // Rate limiting
        }
      }

      toast.success(`Successfully fetched ${allProds.length} products!`, { id: "scraping" })
      return allProds
    } catch (err) {
      setError("Error during full scrape: " + err.message)
      toast.error("Error during scraping", { id: "scraping" })
      return allProds
    } finally {
      setScrapingAll(false)
    }
  }

  const handleCollectionSelect = async (handle) => {
    setSelectedCollection(handle)
    setCurrentPage(1)
    setLoading(true)
    setError("")
    setSelectedProducts(new Set())
    setDisplayMode("paginated") // Reset to paginated view

    try {
      const prods = await scrapeAllCollectionProducts(handle)
      setAllProducts(prods)

      extractMetadata(prods)
      calculateStats(prods)
    } catch (err) {
      setError("Failed to load products: " + err.message)
      toast.error("Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  const extractMetadata = (prods) => {
    const vendorSet = new Set()
    const typeSet = new Set()
    const tagSet = new Set()

    prods.forEach((p) => {
      if (p.vendor) vendorSet.add(p.vendor)
      if (p.product_type) typeSet.add(p.product_type)
      if (p.tags) {
        if (Array.isArray(p.tags)) {
          p.tags.forEach((t) => tagSet.add(t))
        } else if (typeof p.tags === "string") {
          p.tags.split(",").forEach((t) => tagSet.add(t.trim()))
        }
      }
    })

    setVendors(Array.from(vendorSet).sort())
    setProductTypes(Array.from(typeSet).sort())
    setTags(Array.from(tagSet).sort())
  }

  const calculateStats = (prods) => {
    let totalPrice = 0
    let inStock = 0
    let outOfStock = 0

    prods.forEach((p) => {
      if (p.variants && p.variants.length > 0) {
        const variant = p.variants[0]
        if (variant.price) {
          totalPrice += Number.parseFloat(variant.price)
        }
        if (variant.available) {
          inStock++
        } else {
          outOfStock++
        }
      }
    })

    setStats({
      totalProducts: prods.length,
      totalCollections: collections.length,
      avgPrice: prods.length > 0 ? (totalPrice / prods.length).toFixed(2) : 0,
      inStock,
      outOfStock,
    })
  }

  const filteredProducts = useMemo(() => {
    let filtered = [...allProducts]

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.vendor?.toLowerCase().includes(query) ||
          p.product_type?.toLowerCase().includes(query),
      )
    }

    if (filters.vendor) {
      filtered = filtered.filter((p) => p.vendor === filters.vendor)
    }

    if (filters.productType) {
      filtered = filtered.filter((p) => p.product_type === filters.productType)
    }

    if (filters.tag) {
      filtered = filtered.filter((p) => {
        if (Array.isArray(p.tags)) {
          return p.tags.includes(filters.tag)
        } else if (typeof p.tags === "string") {
          return p.tags
            .split(",")
            .map((t) => t.trim())
            .includes(filters.tag)
        }
        return false
      })
    }

    if (filters.priceMin || filters.priceMax) {
      filtered = filtered.filter((p) => {
        if (!p.variants || p.variants.length === 0) return false
        const price = Number.parseFloat(p.variants[0].price)
        if (filters.priceMin && price < Number.parseFloat(filters.priceMin)) return false
        if (filters.priceMax && price > Number.parseFloat(filters.priceMax)) return false
        return true
      })
    }

    if (filters.availability !== "all") {
      filtered = filtered.filter((p) => {
        if (!p.variants || p.variants.length === 0) return false
        const available = p.variants[0].available
        return filters.availability === "in-stock" ? available : !available
      })
    }

    return filtered
  }, [allProducts, filters])

  const displayedProducts = useMemo(() => {
    if (displayMode === "all") {
      // Changed from viewMode to displayMode
      return filteredProducts // Show all products
    }
    // Paginated view
    const startIndex = (currentPage - 1) * productsPerPage
    const endIndex = startIndex + productsPerPage
    return filteredProducts.slice(startIndex, endIndex)
  }, [filteredProducts, currentPage, productsPerPage, displayMode]) // Changed from viewMode to displayMode

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage)

  const resetFilters = () => {
    setFilters({
      vendor: "",
      productType: "",
      tag: "",
      priceMin: "",
      priceMax: "",
      availability: "all",
      searchQuery: "",
    })
    toast.success("Filters reset")
  }

  const toggleProductSelection = (id) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedProducts(newSelected)
  }

  const selectAllPage = () => {
    const newSelected = new Set(selectedProducts)
    displayedProducts.forEach((p) => newSelected.add(p.id))
    setSelectedProducts(newSelected) // FIX: Changed newSet to newSelected
    toast.success(`Selected ${displayedProducts.length} products on this page`)
  }

  const selectAllFiltered = () => {
    const newSelected = new Set()
    filteredProducts.forEach((p) => newSelected.add(p.id))
    setSelectedProducts(newSelected)
    toast.success(`Selected all ${filteredProducts.length} filtered products`)
  }

  const deselectAll = () => {
    setSelectedProducts(new Set())
    toast.success("All products deselected")
  }

  const openQuickView = (product) => {
    setQuickViewProduct(product)
    setShowQuickView(true)
  }

  const closeQuickView = () => {
    setShowQuickView(false)
    setQuickViewProduct(null)
  }

  const transformProductForDB = (product, store = currentStore) => {
    const variant = product.variants?.[0] || {}
    const allVariants = product.variants || []

    const sizes = allVariants.map((v) => v.option1 || "One Size").filter(Boolean)
    const images = product.images?.map((img) => img.src) || []

    let tagsArray = []
    if (Array.isArray(product.tags)) {
      tagsArray = product.tags
    } else if (typeof product.tags === "string") {
      tagsArray = product.tags.split(",").map((t) => t.trim())
    }

    const productUrl = `${store.url}/products/${product.handle}`

    const stripHtml = (html) => {
      if (!html) return ""
      return html
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim()
    }

    let productColor = "N/A"
    if (variant.option2) productColor = variant.option2
    else if (variant.option1 && !sizes.includes(variant.option1)) productColor = variant.option1
    else if (tagsArray.length > 0) productColor = tagsArray[0]

    const dbProduct = {
      product_name: product.title || "Untitled Product",
      price: variant.price ? Number.parseFloat(variant.price) : 0,
      colour: productColor,
      description: stripHtml(product.body_html) || null,
      size: sizes,
      availability: variant.available || false,
      product_id: product.id ? Number.parseInt(product.id) : null,
      sku: variant.sku || null,
      url: productUrl,
      image: images.length > 0 ? JSON.stringify(images.map((url) => ({ url }))) : null,
    }

    return dbProduct
  }

  // Modified to use RPC function for inserting/updating data
  const uploadSelectedToDatabase = async () => {
    if (selectedProducts.size === 0) {
      toast.error("Please select products to upload")
      return
    }

    console.log("[v0] Starting upload process...")
    console.log("[v0] Supabase client initialized:", !!supabase)
    console.log("[v0] Number of products selected:", selectedProducts.size)

    const selectedProds = allProducts.filter((p) => selectedProducts.has(p.id))
    console.log("[v0] Filtered selected products:", selectedProds.length)

    setUploadingToDb(true)
    setUploadProgress({ current: 0, total: selectedProds.length })
    setUploadResults({ success: 0, failed: 0, skipped: 0 })

    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    toast.loading(`Uploading 0/${selectedProds.length} products...`, { id: "upload" })

    for (let i = 0; i < selectedProds.length; i++) {
      const product = selectedProds[i]
      console.log(`[v0] Processing product ${i + 1}/${selectedProds.length}: "${product.title}"`)

      setUploadProgress({ current: i + 1, total: selectedProds.length })

      try {
        const dbProduct = transformProductForDB(product)
        console.log("[v0] Calling RPC function with data:", dbProduct)

        const { data: insertResult, error } = await supabase.from("zara_cloth_test").insert([dbProduct])

        if (error) {
          console.error("[v0] Database RPC error:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            product: product.title,
            fullError: error,
          })

          // Check for unique constraint violation specifically
          if (error.code === "23505") {
            // PostgreSQL unique_violation error code
            console.log(
              `[v0] Product "${product.title}" already exists (unique constraint violated), attempting update or skipping...`,
            )
            // In a real scenario, you might want to attempt an update here if the RPC handles it,
            // or simply skip if it's just an insert failure due to duplicate.
            // For now, we'll count it as skipped if it's a unique violation, assuming the RPC handles updates.
            skippedCount++
          } else {
            console.error(`[v0] Failed to upload "${product.title}":`, error.message)
            failedCount++
          }
        } else {
          console.log(`[v0] Successfully uploaded "${product.title}"`)
          successCount++
        }
      } catch (err) {
        console.error(`[v0] Error processing "${product.title}":`, err)
        failedCount++
      }

      setUploadResults({ success: successCount, failed: failedCount, skipped: skippedCount })
      toast.loading(`Uploading ${i + 1}/${selectedProds.length} products...`, { id: "upload" })
      await new Promise((resolve) => setTimeout(resolve, 100)) // Small delay to prevent overwhelming the UI
    }

    setUploadingToDb(false)
    toast.dismiss("upload")
    toast.success(
      `Upload Complete!\n✓ Success: ${successCount}\n⊘ Skipped: ${skippedCount}\n✗ Failed: ${failedCount}`,
      { duration: 8000 },
    )
  }

  const exportToJSON = () => {
    const dataStr = JSON.stringify(filteredProducts, null, 2)
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${currentStore.name.replace(/\s+/g, "-")}-products-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("JSON exported successfully")
  }

  const exportToCSV = () => {
    let csv = "ID,Title,Handle,Vendor,Type,Price,Compare Price,Available,SKU,Tags,Images,Variants,Weight,Inventory\n"

    filteredProducts.forEach((p) => {
      const variant = p.variants?.[0] || {}
      const tags = Array.isArray(p.tags) ? p.tags.join(";") : p.tags || ""
      const images = p.images?.map((img) => img.src).join(";") || ""
      const variantCount = p.variants?.length || 0

      csv += `${p.id},"${(p.title || "").replace(/"/g, '""')}",${p.handle || ""},${p.vendor || ""},${p.product_type || ""},${variant.price || ""},${variant.compare_at_price || ""},${variant.available || false},${variant.sku || ""},"${tags}","${images}",${variantCount},${variant.weight || ""},${variant.inventory_quantity || 0}\n`
    })

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${currentStore.name.replace(/\s+/g, "-")}-products-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exported successfully")
  }

  const showImageGallery = (product) => {
    setSelectedProductImages(product)
    setShowImageModal(true)
  }

  const ProductCard = ({ product }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0)

    // Now check if product exists AFTER all hooks are declared
    if (!product) return null

    const variant = product.variants?.[0] || {}
    const images = product.images || []
    const hasDiscount =
      variant.compare_at_price && Number.parseFloat(variant.compare_at_price) > Number.parseFloat(variant.price)
    const discount = hasDiscount
      ? (
          ((Number.parseFloat(variant.compare_at_price) - Number.parseFloat(variant.price)) /
            Number.parseFloat(variant.compare_at_price)) *
          100
        ).toFixed(0)
      : 0
    const isSelected = selectedProducts.has(product.id)

    const nextImage = (e) => {
      e.stopPropagation()
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
    }

    const prevImage = (e) => {
      e.stopPropagation()
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
    }

    return (
      // Product Card styling to match luxury aesthetic
      <div
        className={`bg-white rounded-none overflow-hidden hover:shadow-2xl transition-all duration-300 border ${isSelected ? "border-black ring-2 ring-gray-300" : "border-gray-200"}`}
      >
        <div className="relative h-96 bg-gray-50 group overflow-hidden">
          {images.length > 0 ? (
            <>
              <img
                src={images[currentImageIndex].src || "/placeholder.svg"}
                alt={product.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />

              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/80 text-white p-2 rounded-none opacity-0 group-hover:opacity-100 transition-all hover:bg-black"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/80 text-white p-2 rounded-none opacity-0 group-hover:opacity-100 transition-all hover:bg-black"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCurrentImageIndex(idx)
                        }}
                        className={`h-1.5 rounded-none transition-all ${
                          idx === currentImageIndex ? "bg-white w-8" : "bg-white/50 hover:bg-white/75 w-1.5"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <Package className="w-20 h-20 text-gray-300" />
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation()
              openQuickView(product)
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black text-white px-8 py-3 rounded-none opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-900 font-light tracking-wider text-sm flex items-center gap-2"
          >
            <Eye className="w-4 h-4" /> QUICK VIEW
          </button>

          <div className="absolute top-4 left-4">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleProductSelection(product.id)
              }}
              className={`w-10 h-10 rounded-none flex items-center justify-center transition-all ${isSelected ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}
            >
              {isSelected && <Check className="w-5 h-5" />}
            </button>
          </div>

          {hasDiscount && (
            <div className="absolute top-4 right-4 bg-black text-white px-3 py-1.5 rounded-none text-xs font-light tracking-wide">
              {discount}% OFF
            </div>
          )}

          <div className="absolute bottom-4 right-4">
            {variant.available ? (
              <span className="bg-white text-black px-3 py-1.5 rounded-none text-xs font-light tracking-wide border border-black">
                IN STOCK
              </span>
            ) : (
              <span className="bg-black text-white px-3 py-1.5 rounded-none text-xs font-light tracking-wide">
                OUT OF STOCK
              </span>
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-light text-black text-sm tracking-wide line-clamp-2 flex-1 uppercase">
              {product.title}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation()
                showImageGallery(product)
              }}
              className="text-gray-400 hover:text-black transition-colors flex-shrink-0"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl font-light text-black tracking-wide">${variant.price}</span>
            {hasDiscount && (
              <span className="text-sm text-gray-400 line-through font-light">${variant.compare_at_price}</span>
            )}
          </div>

          <div className="space-y-2 text-xs text-gray-600 font-light">
            {product.vendor && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">BRAND:</span>
                <span className="uppercase tracking-wide">{product.vendor}</span>
              </div>
            )}
            {product.product_type && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">TYPE:</span>
                <span className="uppercase tracking-wide">{product.product_type}</span>
              </div>
            )}
            {product.variants && product.variants.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">VARIANTS:</span>
                <span>{product.variants.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const statsCard = (icon, value, label, bgColor = "bg-white") => (
    <div className={`${bgColor} p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200`}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-gray-600">{icon}</div>
        <span className="text-3xl font-semibold text-black">{value}</span>
      </div>
      <p className="text-sm text-gray-500 font-medium tracking-wider uppercase">{label}</p>
    </div>
  )

  const DashboardView = () => (
    <div className="space-y-6">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCard(<Store className="w-8 h-8 text-black" />, dashboardStats.totalStores, "Total Stores")}
        {statsCard(<Package className="w-8 h-8 text-black" />, dashboardStats.totalProducts, "Active Products")}
        {statsCard(<Activity className="w-8 h-8 text-black" />, dashboardStats.recentChanges, "Recent Changes")}
        {statsCard(
          <Clock className="w-8 h-8 text-black" />,
          dashboardStats.lastSync ? new Date(dashboardStats.lastSync).toLocaleDateString() : "Never",
          "Last Sync",
        )}
      </div>

      {/* Stores with Sync Buttons */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Store className="w-6 h-6 text-black" />
          <h2 className="text-2xl font-bold text-black">Your Stores</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stores.map((store, idx) => (
            <div
              key={idx}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-black text-lg mb-1">{store.name}</h3>
                  <p className="text-xs text-gray-500 break-all">{store.url}</p>
                </div>
                {store.active && (
                  <span className="bg-green-50 text-green-700 px-3 py-1 text-xs font-semibold rounded-full">
                    Active
                  </span>
                )}
              </div>
              <button
                onClick={() => syncStore(store)}
                disabled={syncing && selectedStoreForSync?.url === store.url}
                className="w-full mt-4 bg-black text-white px-4 py-2.5 rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {syncing && selectedStoreForSync?.url === store.url ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" /> Sync Now
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sync History */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-black" />
          <h2 className="text-2xl font-bold text-black">Sync History</h2>
        </div>

        {syncLogs.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600 font-medium">No sync history yet</p>
            <p className="text-sm text-gray-500 mt-1">Start by syncing a store above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all"
              >
                <div className="flex-1">
                  <p className="font-semibold text-black text-sm">{log.store_name}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(log.sync_timestamp).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-green-600 font-bold text-lg">{log.products_added}</p>
                    <p className="text-xs text-gray-500 font-medium mt-1">Added</p>
                  </div>
                  <div className="text-center">
                    <p className="text-blue-600 font-bold text-lg">{log.products_updated}</p>
                    <p className="text-xs text-gray-500 font-medium mt-1">Updated</p>
                  </div>
                  <div className="text-center">
                    <p className="text-red-600 font-bold text-lg">{log.products_removed}</p>
                    <p className="text-xs text-gray-500 font-medium mt-1">Removed</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Changes */}
        <div className="bg-white p-6 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-light mb-6 text-black tracking-wider uppercase flex items-center gap-2">
            <TrendingDown className="w-6 h-6" /> Price Changes
          </h2>
          <div className="space-y-3">
            {priceChanges.length === 0 ? (
              <p className="text-center py-8 text-gray-500 font-light text-sm">No price changes yet</p>
            ) : (
              priceChanges.slice(0, 10).map((change) => (
                <div key={change.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="font-light text-black text-sm mb-2 line-clamp-1">{change.product_name}</p>
                  <div className="flex items-center gap-4 text-xs font-light">
                    <span className="text-gray-500 line-through">${change.old_price}</span>
                    <TrendingDown className="w-4 h-4 text-green-600" />
                    <span className="text-black">${change.new_price}</span>
                    <span className="ml-auto text-gray-400">{new Date(change.changed_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stock Changes */}
        <div className="bg-white p-6 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-light mb-6 text-black tracking-wider uppercase flex items-center gap-2">
            <TrendingUp className="w-6 h-6" /> Stock Changes
          </h2>
          <div className="space-y-3">
            {stockChanges.length === 0 ? (
              <p className="text-center py-8 text-gray-500 font-light text-sm">No stock changes yet</p>
            ) : (
              stockChanges.slice(0, 10).map((change) => (
                <div key={change.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="font-light text-black text-sm mb-2 line-clamp-1">{change.product_name}</p>
                  <div className="flex items-center gap-4 text-xs font-light">
                    <span
                      className={`px-2 py-1 ${change.old_status === "in_stock" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {change.old_status.replace("_", " ").toUpperCase()}
                    </span>
                    <span>→</span>
                    <span
                      className={`px-2 py-1 ${change.new_status === "in_stock" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {change.new_status.replace("_", " ").toUpperCase()}
                    </span>
                    <span className="ml-auto text-gray-400">{new Date(change.changed_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )

  // Database products view component
  const DatabaseProductsView = () => {
    const deleteAllProducts = async () => {
      if (
        !confirm(
          "⚠️ WARNING: This will DELETE ALL PRODUCTS from the database. This action cannot be undone. Are you absolutely sure?",
        )
      ) {
        return
      }

      if (!confirm("This is your final warning. Type 'DELETE ALL' in your mind and click OK to proceed.")) {
        return
      }

      setDbLoading(true)
      try {
        const { error } = await supabase.from("zara_cloth_test").delete().neq("product_id", 0)

        if (error) throw error

        toast.success("All Products Deleted", {
          description: "All products have been permanently removed from the database.",
        })

        // Refresh the list
        await fetchDatabaseProducts()
        setSelectedDbProducts(new Set())
      } catch (error) {
        console.error("[v0] Error deleting all products:", error)
        toast.error("Delete Failed", {
          description: error.message || "Failed to delete all products",
          variant: "destructive",
        })
      } finally {
        setDbLoading(false)
      }
    }

    // Toggle selection for database products
    const toggleDbProductSelection = (productId) => {
      setSelectedDbProducts((prev) => {
        const newSelected = new Set(prev)
        if (newSelected.has(productId)) {
          newSelected.delete(productId)
        } else {
          newSelected.add(productId)
        }
        return newSelected
      })
    }

    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-5xl font-bold text-black tracking-tight mb-2">Database Products</h2>
              <p className="text-gray-600">
                Connected to table: <span className="font-mono font-semibold text-black">zara_cloth_test</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-black">{dbTotalProducts.toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">Total Products</div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-black">Filters & Actions</h3>
            <div className="flex gap-3">
              <button
                onClick={deleteAllProducts}
                disabled={dbLoading}
                className="px-6 py-2.5 bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete All Products
              </button>

              <button
                onClick={deleteSelectedDbProducts}
                disabled={selectedDbProducts.size === 0 || dbLoading}
                className="px-6 py-2.5 bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedDbProducts.size})
              </button>

              <button
                onClick={() =>
                  setDbFilters({
                    searchQuery: "",
                    storeName: "",
                    hasImages: "all",
                    availability: "all",
                    priceMin: "",
                    priceMax: "",
                    brand: "",
                    productType: "",
                  })
                }
                className="px-6 py-2.5 bg-gray-100 text-gray-800 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Clear Filters
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Search</label>
              <input
                type="text"
                placeholder="Product name, brand, SKU..."
                value={dbFilters.searchQuery}
                onChange={(e) => setDbFilters({ ...dbFilters, searchQuery: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-sm"
              />
            </div>

            {/* Store Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Store Name
              </label>
              <select
                value={dbFilters.storeName}
                onChange={(e) => setDbFilters({ ...dbFilters, storeName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-sm"
              >
                <option value="">All Stores</option>
                {dbStores.map((store) => (
                  <option key={store} value={store}>
                    {store}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Brand</label>
              <select
                value={dbFilters.brand}
                onChange={(e) => setDbFilters({ ...dbFilters, brand: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-sm"
              >
                <option value="">All Brands</option>
                {dbBrands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Product Type
              </label>
              <select
                value={dbFilters.productType}
                onChange={(e) => setDbFilters({ ...dbFilters, productType: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-sm"
              >
                <option value="">All Types</option>
                {dbProductTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Has Images */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Has Images
              </label>
              <select
                value={dbFilters.hasImages}
                onChange={(e) => setDbFilters({ ...dbFilters, hasImages: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-sm"
              >
                <option value="all">All Products</option>
                <option value="yes">With Images</option>
                <option value="no">Without Images</option>
              </select>
            </div>

            {/* Availability */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Availability
              </label>
              <select
                value={dbFilters.availability}
                onChange={(e) => setDbFilters({ ...dbFilters, availability: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-sm"
              >
                <option value="all">All</option>
                <option value="in_stock">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>

            {/* Price Min */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Min Price
              </label>
              <input
                type="number"
                placeholder="0"
                value={dbFilters.priceMin}
                onChange={(e) => setDbFilters({ ...dbFilters, priceMin: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-sm"
              />
            </div>

            {/* Price Max */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Max Price
              </label>
              <input
                type="number"
                placeholder="9999"
                value={dbFilters.priceMax}
                onChange={(e) => setDbFilters({ ...dbFilters, priceMax: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
            <div className="text-sm font-medium">
              Showing <span className="font-bold">{filteredDbProducts.length}</span> of{" "}
              <span className="font-bold">{dbTotalProducts}</span> products
            </div>
            <button
              onClick={() =>
                setDbFilters({
                  searchQuery: "",
                  storeName: "",
                  hasImages: "all",
                  availability: "all",
                  priceMin: "",
                  priceMax: "",
                  brand: "",
                  productType: "",
                })
              }
              className="px-4 py-2 bg-gray-100 text-black rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Clear All Filters
            </button>
          </div>
        </div>

        {/* Products Grid */}
        {dbLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              {/* <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-black mx-auto mb-4"></div> */}
              <Loader2 className="w-12 h-12 animate-spin text-black mx-auto mb-4" />
              <p className="text-gray-600">Loading products from database...</p>
            </div>
          </div>
        ) : dbProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Products Found</h3>
            <p className="text-gray-500">
              {Object.values(dbFilters).some((v) => v)
                ? "Try adjusting your filters"
                : "Start by scraping some products"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {dbProducts.map((product) => {
              let imageUrl = "/placeholder.svg"
              try {
                if (product.image) {
                  let imageData = product.image

                  // If image is a JSON string, parse it
                  if (typeof product.image === "string" && product.image.startsWith("[")) {
                    imageData = JSON.parse(product.image)
                  }

                  // If it's an array, get first item
                  if (Array.isArray(imageData) && imageData.length > 0) {
                    if (typeof imageData[0] === "object" && imageData[0].url) {
                      imageUrl = imageData[0].url
                    } else if (typeof imageData[0] === "string") {
                      imageUrl = imageData[0]
                    }
                  } else if (typeof imageData === "string" && imageData.length > 0) {
                    // If it's just a string URL, use it directly
                    imageUrl = imageData
                  }
                }
              } catch (e) {
                console.log("[v0] Error parsing image for product:", product.product_name, e)
              }

              return (
                <div
                  key={product.product_id}
                  onClick={() => toggleDbProductSelection(product.product_id)}
                  className={`bg-white rounded-lg overflow-hidden border-2 cursor-pointer hover:shadow-lg transition-all ${
                    selectedDbProducts.has(product.product_id) ? "border-black ring-2 ring-gray-300" : "border-gray-200"
                  }`}
                >
                  <div className="relative h-64 bg-gray-100">
                    {imageUrl !== "/placeholder.svg" ? (
                      <img
                        src={imageUrl || "/placeholder.svg"}
                        alt={product.product_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "/placeholder.svg"
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-16 h-16 text-gray-300" />
                      </div>
                    )}
                    {selectedDbProducts.has(product.product_id) && (
                      <div className="absolute top-3 right-3 bg-black text-white p-2 rounded-full">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-medium text-black mb-2 line-clamp-2 text-sm">{product.product_name}</h3>
                    <p className="text-2xl font-bold text-black mb-2">${product.price}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span>{product.brand || "No Brand"}</span>
                      <span className={product.availability ? "text-green-600" : "text-red-600"}>
                        {product.availability ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>
                    {product.store_name && (
                      <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <Store className="w-3 h-3" />
                        {product.store_name}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {dbTotalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setDbCurrentPage((p) => Math.max(1, p - 1))}
              disabled={dbCurrentPage === 1}
              className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:border-black disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              PREVIOUS
            </button>

            <div className="flex gap-2">
              {Array.from({ length: Math.min(5, dbTotalPages) }, (_, i) => {
                let pageNum
                if (dbTotalPages <= 5) {
                  pageNum = i + 1
                } else if (dbCurrentPage <= 3) {
                  pageNum = i + 1
                } else if (dbCurrentPage >= dbTotalPages - 2) {
                  pageNum = dbTotalPages - 4 + i
                } else {
                  pageNum = dbCurrentPage - 2 + i
                }

                return (
                  <button
                    key={i}
                    onClick={() => setDbCurrentPage(pageNum)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm ${
                      dbCurrentPage === pageNum
                        ? "bg-black text-white"
                        : "bg-white text-black border border-gray-300 hover:border-black"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setDbCurrentPage((p) => Math.min(dbTotalPages, p + 1))}
              disabled={dbCurrentPage === dbTotalPages}
              className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:border-black disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              NEXT
            </button>
          </div>
        )}
      </div>
    )
  }

  // REMOVED: Client-side filtering is handled by the server now.
  // const filteredDbProducts = useMemo(() => {
  //   let filtered = dbProducts

  //   if (dbFilters.searchQuery) {
  //     const query = dbFilters.searchQuery.toLowerCase()
  //     filtered = filtered.filter(
  //       (p) =>
  //         p.product_name?.toLowerCase().includes(query) ||
  //         p.brand?.toLowerCase().includes(query) ||
  //         p.product_type?.toLowerCase().includes(query) ||
  //         p.sku?.toLowerCase().includes(query),
  //     )
  //   }

  //   if (dbFilters.storeName) {
  //     filtered = filtered.filter((p) => p.store_name === dbFilters.storeName)
  //   }

  //   if (dbFilters.brand) {
  //     filtered = filtered.filter((p) => p.brand === dbFilters.brand)
  //   }

  //   if (dbFilters.productType) {
  //     filtered = filtered.filter((p) => p.product_type === dbFilters.productType)
  //   }

  //   if (dbFilters.hasImages !== "all") {
  //     filtered = filtered.filter((p) => {
  //       const hasImages = p.images && Array.isArray(p.images) && p.images.length > 0
  //       return dbFilters.hasImages === "yes" ? hasImages : !hasImages
  //     })
  //   }

  //   if (dbFilters.availability !== "all") {
  //     filtered = filtered.filter((p) => {
  //       return dbFilters.availability === "in_stock" ? p.availability : !p.availability
  //     })
  //   }

  //   if (dbFilters.priceMin) {
  //     filtered = filtered.filter((p) => Number.parseFloat(p.price) >= Number.parseFloat(dbFilters.priceMin))
  //   }

  //   if (dbFilters.priceMax) {
  //     filtered = filtered.filter((p) => Number.parseFloat(p.price) <= Number.parseFloat(dbFilters.priceMax))
  //   }

  //   return filtered
  // }, [dbProducts, dbFilters])

  const filteredDbProducts = dbProducts // No longer need to filter client-side

  const dbTotalPages = Math.ceil(dbTotalProducts / dbProductsPerPage)
  const dbPaginatedProducts = dbProducts // Already paginated from server

  // Delete selected database products
  const deleteSelectedDbProducts = async () => {
    if (selectedDbProducts.size === 0) {
      toast.error("No products selected")
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedDbProducts.size} products?`)) {
      return
    }

    try {
      const productIds = Array.from(selectedDbProducts)
      const { error } = await supabase.from("zara_cloth_test").delete().in("product_id", productIds)

      if (error) throw error

      toast.success(`Deleted ${selectedDbProducts.size} products`)
      setSelectedDbProducts(new Set())
      fetchDatabaseProducts() // Refresh the list after deletion
    } catch (error) {
      console.error("Error deleting products:", error)
      toast.error("Failed to delete products")
    }
  }

  // Delete all filtered database products
  const deleteAllFilteredDbProducts = async () => {
    if (filteredDbProducts.length === 0) {
      toast.error("No products to delete")
      return
    }

    if (!confirm(`Are you sure you want to delete ALL ${filteredDbProducts.length} filtered products?`)) {
      return
    }

    try {
      const productIds = filteredDbProducts.map((p) => p.product_id)
      const { error } = await supabase.from("zara_cloth_test").delete().in("product_id", productIds)

      if (error) throw error

      toast.success(`Deleted ${filteredDbProducts.length} products`)
      setSelectedDbProducts(new Set())
      fetchDatabaseProducts() // Refresh the list after deletion
    } catch (error) {
      console.error("Error deleting products:", error)
      toast.error("Failed to delete products")
    }
  }

  return (
    // Redesigned header with luxury black and white aesthetic
    <div className="min-h-screen bg-white">
      <Toaster position="top-right" />

      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-black p-3 rounded-lg">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-black tracking-tight">Shopify Scraper</h1>
                <p className="text-sm text-gray-500 font-medium mt-1">Luxury Product Management Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex gap-2 bg-gray-100 p-1.5 rounded-lg">
                <button
                  onClick={() => setViewMode("scraper")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === "scraper" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black"
                  }`}
                >
                  Scraper
                </button>
                <button
                  onClick={() => setViewMode("dashboard")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === "dashboard" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black"
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setViewMode("database")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === "database" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black"
                  }`}
                >
                  Database
                </button>
              </div>
              <a
                href="/admin/brightdata-sync"
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium text-sm shadow-lg"
              >
                <Package className="w-4 h-4" /> Brightdata Admin
              </a>
              <button
                onClick={() => setShowAddStore(true)}
                className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm"
              >
                <Plus className="w-4 h-4" /> Add Store
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {viewMode === "database" ? (
          <DatabaseProductsView />
        ) : viewMode === "dashboard" ? (
          <DashboardView />
        ) : (
          <>
            {/* Store Manager - adapted for new design */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="w-6 h-6 text-black" />
                <h2 className="text-2xl font-bold text-black">Manage Stores</h2>
              </div>

              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search stores..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-black focus:border-black font-medium text-sm"
                  />
                </div>
              </div>

              {showAddStore && (
                <div className="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-black mb-3 flex items-center gap-2 tracking-wide uppercase">
                    <Plus className="w-5 h-5" /> Add New Store
                  </h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Store Name (e.g., Nike)"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-black focus:border-black font-medium text-sm"
                    />
                    <input
                      type="url"
                      placeholder="Store URL (e.g., https://nike.com)"
                      value={newStoreUrl}
                      onChange={(e) => setNewStoreUrl(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-black focus:border-black font-medium text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addStore}
                        disabled={checkingShopify}
                        className="flex-1 bg-black text-white px-4 py-2.5 rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {checkingShopify ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" /> Add Store
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddStore(false)
                          setNewStoreName("")
                          setNewStoreUrl("")
                        }}
                        className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStores.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Store className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No stores found</p>
                    <p className="text-sm text-gray-500 mt-1">Try adding a new store or adjusting your search</p>
                  </div>
                ) : (
                  filteredStores.map((store, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        currentStore.url === store.url
                          ? "border-black bg-gray-50 shadow-md"
                          : "border-gray-200 bg-white hover:border-black hover:shadow-md"
                      }`}
                      onClick={() => switchStore(store)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-black mb-1 tracking-wide uppercase">{store.name}</h3>
                          <a
                            href={store.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-black hover:underline flex items-center gap-1 font-light tracking-wide"
                          >
                            {store.url} <Globe className="w-3 h-3" />
                          </a>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteStore(index)
                          }}
                          className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {currentStore.url === store.url && (
                        <div className="flex items-center gap-2 text-xs text-green-700 font-semibold tracking-wide">
                          <CheckCircle className="w-4 h-4" /> Currently Active
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
                <div className="bg-black text-white p-4 rounded-lg shadow-sm">
                  <p className="text-xs text-gray-300 font-medium tracking-wider uppercase">Total Stores</p>
                  <p className="text-3xl font-bold text-white tracking-wide">{stores.length}</p>
                </div>
                <div className="bg-white border border-gray-300 text-black p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-500 font-medium tracking-wider uppercase">Active Store</p>
                  <p className="text-3xl font-bold text-black tracking-wide">1</p>
                </div>
                <div className="bg-black text-white p-4 rounded-lg shadow-sm">
                  <p className="text-xs text-gray-300 font-medium tracking-wider uppercase">Collections</p>
                  <p className="text-3xl font-bold text-white tracking-wide">{collections.length}</p>
                </div>
                <div className="bg-white border border-gray-300 text-black p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-500 font-medium tracking-wider uppercase">Products</p>
                  <p className="text-3xl font-bold text-black tracking-wide">{allProducts.length}</p>
                </div>
              </div>
            </div>

            {allProducts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-black text-white p-6 rounded-lg shadow-sm">
                  <Package className="w-6 h-6 mb-3 opacity-80" />
                  <div className="text-3xl font-bold mb-2">{stats.totalProducts}</div>
                  <div className="text-gray-400 text-xs font-medium uppercase">Total Products</div>
                </div>

                <div className="bg-white border border-gray-200 text-black p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <Grid className="w-6 h-6 mb-3 opacity-80" />
                  <div className="text-3xl font-bold mb-2">{selectedProducts.size}</div>
                  <div className="text-gray-600 text-xs font-medium uppercase">Selected</div>
                </div>

                <div className="bg-black text-white p-6 rounded-lg shadow-sm">
                  <DollarSign className="w-6 h-6 mb-3 opacity-80" />
                  <div className="text-3xl font-bold mb-2">${stats.avgPrice}</div>
                  <div className="text-gray-400 text-xs font-medium uppercase">Avg Price</div>
                </div>

                <div className="bg-white border border-gray-200 text-black p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <CheckCircle className="w-6 h-6 mb-3 opacity-80" />
                  <div className="text-3xl font-bold mb-2">{stats.inStock}</div>
                  <div className="text-gray-600 text-xs font-medium uppercase">In Stock</div>
                </div>

                <div className="bg-black text-white p-6 rounded-lg shadow-sm">
                  <XCircle className="w-6 h-6 mb-3 opacity-80" />
                  <div className="text-3xl font-bold mb-2">{stats.outOfStock}</div>
                  <div className="text-gray-400 text-xs font-medium uppercase">Out of Stock</div>
                </div>
              </div>
            )}

            {/* Collection Selector - Categories shown as cards instead of dropdown */}
            {collections.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-light mb-6 text-black tracking-wider uppercase flex items-center gap-3">
                  <Layers className="w-6 h-6" /> Collections from {currentStore.name}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {collections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleCollectionSelect(c.handle)}
                      disabled={loading}
                      className={`p-6 border rounded-lg transition-all text-left group ${
                        selectedCollection === c.handle
                          ? "border-black bg-black text-white"
                          : "border-gray-300 bg-white hover:border-black hover:bg-gray-50"
                      }`}
                    >
                      <h3
                        className={`font-medium tracking-wide mb-2 text-sm ${selectedCollection === c.handle ? "text-white" : "text-black group-hover:text-black"}`}
                      >
                        {c.title}
                      </h3>
                      <p
                        className={`text-xs font-light ${selectedCollection === c.handle ? "text-gray-300" : "text-gray-500"}`}
                      >
                        {c.products_count !== undefined ? `${c.products_count} products` : "View collection"}
                      </p>
                    </button>
                  ))}
                </div>

                {scrapingAll && (
                  <div className="mt-6 bg-black text-white p-4 rounded-lg flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-medium tracking-wide">FETCHING ALL PRODUCTS...</span>
                  </div>
                )}
              </div>
            )}

            {/* Selection Controls - Action Buttons - Redesigned for luxury aesthetic */}
            {allProducts.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={selectAllPage}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-lg border border-black hover:bg-black hover:text-white transition-colors font-medium text-sm"
                  >
                    <Check className="w-4 h-4" /> SELECT PAGE ({displayedProducts.length})
                  </button>
                  <button
                    onClick={selectAllFiltered}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-lg border border-black hover:bg-black hover:text-white transition-colors font-medium text-sm"
                  >
                    <CheckCircle className="w-4 h-4" /> SELECT ALL ({filteredProducts.length})
                  </button>
                  <button
                    onClick={deselectAll}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-lg border border-gray-300 hover:border-black transition-colors font-medium text-sm"
                  >
                    <XCircle className="w-4 h-4" /> DESELECT ALL
                  </button>

                  <button
                    onClick={() => setDisplayMode(displayMode === "paginated" ? "all" : "paginated")} // Changed from viewMode to displayMode
                    className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-lg border border-gray-300 hover:border-black transition-colors font-medium text-sm"
                  >
                    <Grid className="w-4 h-4" /> {displayMode === "paginated" ? "SHOW ALL" : "SHOW PAGINATED"}{" "}
                    {/* Changed from viewMode to displayMode */}
                  </button>

                  <div className="ml-auto flex gap-3">
                    <button
                      onClick={uploadSelectedToDatabase}
                      disabled={uploadingToDb || selectedProducts.size === 0}
                      className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingToDb ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> UPLOADING ({uploadProgress.current}/
                          {uploadProgress.total})
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4" /> UPLOAD TO DB ({selectedProducts.size})
                        </>
                      )}
                    </button>
                    <button
                      onClick={exportToJSON}
                      className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-lg border border-black hover:bg-black hover:text-white transition-colors font-medium text-sm"
                    >
                      <Download className="w-4 h-4" /> JSON
                    </button>
                    <button
                      onClick={exportToCSV}
                      className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-lg border border-black hover:bg-black hover:text-white transition-colors font-medium text-sm"
                    >
                      <Download className="w-4 h-4" /> CSV
                    </button>
                  </div>
                </div>

                {uploadingToDb && (
                  <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between text-sm font-medium tracking-wide mb-2">
                      <span className="text-black">UPLOAD PROGRESS</span>
                      <span className="text-gray-600">
                        {uploadProgress.current} / {uploadProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-lg overflow-hidden">
                      <div
                        className="bg-black h-full transition-all duration-300"
                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium tracking-wide">
                      <span className="text-green-700">SUCCESS: {uploadResults.success}</span>
                      <span className="text-gray-600">SKIPPED: {uploadResults.skipped}</span>
                      <span className="text-red-700">FAILED: {uploadResults.failed}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Products Section - Prominent Header with Count */}
            {displayMode === "paginated" && (
              <div className="mt-12 pt-8 border-t border-gray-200">
                <div className="mb-8">
                  <div className="flex items-end justify-between mb-6">
                    <div>
                      <h2 className="text-4xl font-light tracking-tight text-black mb-2">PRODUCTS</h2>
                      <div className="flex items-baseline gap-3">
                        <span className="text-5xl font-bold text-black">{filteredProducts.length}</span>
                        <span className="text-lg font-light text-gray-600 tracking-wide">Active Products</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 tracking-wide">
                        {displayMode === "paginated" ? `Page ${currentPage} of ${totalPages}` : "Showing All"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ... existing code for filters and product grid ... */}
                {/* Filter summary */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm font-medium tracking-wide text-gray-700">
                    SHOWING {displayedProducts.length.toLocaleString()} OF {filteredProducts.length.toLocaleString()}{" "}
                    PRODUCTS
                    {selectedProducts.size > 0 && (
                      <span className="text-black font-semibold ml-3">{selectedProducts.size} SELECTED</span>
                    )}
                  </div>
                  {/* Active filter tags */}
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(filters).some(([k, v]) => v && k !== "searchQuery") && (
                      <span className="text-xs bg-black text-white px-2.5 py-1 rounded-full font-semibold tracking-wide">
                        FILTERS ACTIVE
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Products Grid - Products Grid - Black and white luxury design */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-black" />
                  <p className="text-black font-medium tracking-wide">LOADING PRODUCTS...</p>
                </div>
              </div>
            ) : displayedProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                  {displayedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {displayMode === "paginated" &&
                  totalPages > 1 && ( // Changed from viewMode to displayMode
                    <div className="flex items-center justify-center gap-3 mt-8">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:border-black disabled:opacity-50 disabled:cursor-not-allowed font-medium tracking-wide text-sm"
                      >
                        PREVIOUS
                      </button>

                      <div className="flex gap-2">
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                          let pageNum
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (currentPage <= 3) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = currentPage - 2 + i
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-10 h-10 rounded-lg font-medium text-sm ${
                                currentPage === pageNum
                                  ? "bg-black text-white"
                                  : "bg-white text-black border border-gray-300 hover:border-black"
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        })}
                      </div>

                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:border-black disabled:opacity-50 disabled:cursor-not-allowed font-medium tracking-wide text-sm"
                      >
                        NEXT
                      </button>
                    </div>
                  )}
              </>
            ) : selectedCollection ? (
              // No products found message - adapted for new design
              <div className="text-center py-20 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-black font-medium tracking-wide text-lg mb-2">NO PRODUCTS FOUND</p>
                <p className="text-gray-500 font-light text-sm">
                  Try adjusting your filters or select a different collection
                </p>
              </div>
            ) : (
              // Select a collection message - adapted for new design
              <div className="text-center py-20 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                <Grid className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-black font-medium tracking-wide text-lg mb-2">SELECT A COLLECTION TO BEGIN</p>
                <p className="text-gray-500 font-light text-sm">Choose a collection from above to view products</p>
              </div>
            )}
          </>
        )}
      </div>

      {showQuickView && quickViewProduct && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-wider uppercase">PRODUCT DETAILS</h2>
              <button onClick={closeQuickView} className="text-black hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  {quickViewProduct.images && quickViewProduct.images.length > 0 ? (
                    <img
                      src={quickViewProduct.images[0].src || "/placeholder.svg"}
                      alt={quickViewProduct.title}
                      className="w-full h-auto border border-gray-200 rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-96 bg-gray-100 flex items-center justify-center border border-gray-200 rounded-lg">
                      <Package className="w-20 h-20 text-gray-300" />
                    </div>
                  )}

                  {quickViewProduct.images && quickViewProduct.images.length > 1 && (
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      {quickViewProduct.images.slice(1, 5).map((img, idx) => (
                        <img
                          key={idx}
                          src={img.src || "/placeholder.svg"}
                          alt={`${quickViewProduct.title} ${idx + 2}`}
                          className="w-full h-24 object-cover border border-gray-200 hover:border-black transition-colors cursor-pointer rounded-md"
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-2xl font-bold tracking-wide mb-4 uppercase">{quickViewProduct.title}</h3>

                  {quickViewProduct.variants && quickViewProduct.variants[0] && (
                    <div className="mb-6">
                      <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-black tracking-wide">
                          ${quickViewProduct.variants[0].price}
                        </span>
                        {quickViewProduct.variants[0].compare_at_price && (
                          <span className="text-lg text-gray-400 line-through font-bold">
                            ${quickViewProduct.variants[0].compare_at_price}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 mb-6 text-sm font-light">
                    {quickViewProduct.vendor && (
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 w-24 tracking-wide uppercase">Brand:</span>
                        <span className="text-black tracking-wide uppercase">{quickViewProduct.vendor}</span>
                      </div>
                    )}
                    {quickViewProduct.product_type && (
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 w-24 tracking-wide uppercase">Type:</span>
                        <span className="text-black tracking-wide uppercase">{quickViewProduct.product_type}</span>
                      </div>
                    )}
                    {quickViewProduct.variants && quickViewProduct.variants[0] && (
                      <>
                        {quickViewProduct.variants[0].sku && (
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500 w-24 tracking-wide uppercase">SKU:</span>
                            <span className="text-black font-mono">{quickViewProduct.variants[0].sku}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 w-24 tracking-wide uppercase">Status:</span>
                          <span
                            className={`tracking-wide uppercase ${quickViewProduct.variants[0].available ? "text-black" : "text-gray-400"}`}
                          >
                            {quickViewProduct.variants[0].available ? "IN STOCK" : "OUT OF STOCK"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {quickViewProduct.body_html && (
                    <div className="border-t border-gray-200 pt-6">
                      <h4 className="text-sm font-bold tracking-wider uppercase mb-3 text-gray-500">Description</h4>
                      <div
                        className="text-sm font-light leading-relaxed text-gray-700"
                        dangerouslySetInnerHTML={{ __html: quickViewProduct.body_html }}
                      />
                    </div>
                  )}

                  {quickViewProduct.variants && quickViewProduct.variants.length > 1 && (
                    <div className="border-t border-gray-200 pt-6 mt-6">
                      <h4 className="text-sm font-bold tracking-wider uppercase mb-3 text-gray-500">
                        Available Variants ({quickViewProduct.variants.length})
                      </h4>
                      <div className="space-y-2">
                        {quickViewProduct.variants.slice(0, 5).map((variant, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm font-light">
                            <span className="text-black tracking-wide">
                              {variant.title || variant.option1 || `Variant ${idx + 1}`}
                            </span>
                            <span className="text-gray-600">${variant.price}</span>
                          </div>
                        ))}
                        {quickViewProduct.variants.length > 5 && (
                          <p className="text-xs text-gray-500 font-light">
                            +{quickViewProduct.variants.length - 5} more variants
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => {
                        toggleProductSelection(quickViewProduct.id)
                        toast.success(
                          selectedProducts.has(quickViewProduct.id)
                            ? "Product removed from selection"
                            : "Product added to selection",
                        )
                      }}
                      className={`w-full py-3 rounded-lg font-bold tracking-wider text-sm transition-colors ${
                        selectedProducts.has(quickViewProduct.id)
                          ? "bg-black text-white hover:bg-gray-900"
                          : "bg-white text-black border border-black hover:bg-black hover:text-white"
                      }`}
                    >
                      {selectedProducts.has(quickViewProduct.id) ? "REMOVE FROM SELECTION" : "ADD TO SELECTION"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImageModal && selectedProductImages && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-wider uppercase">{selectedProductImages.title}</h2>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-black hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {selectedProductImages.images && selectedProductImages.images.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedProductImages.images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img.src || "/placeholder.svg"}
                        alt={`${selectedProductImages.title} ${idx + 1}`}
                        className="w-full h-auto border border-gray-200 rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-black font-bold tracking-wide">NO IMAGES AVAILABLE</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

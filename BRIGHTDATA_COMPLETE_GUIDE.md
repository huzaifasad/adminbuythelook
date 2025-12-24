# Brightdata Integration - Complete Setup Guide

## Overview

Your Brightdata integration allows you to automatically sync Zara product data into your database through three methods:
1. Manual JSON upload
2. Button-triggered fetch from Brightdata API
3. Automated cron job (runs on 23rd of every month at 2 AM)

---

## Step 1: Get Your Brightdata Credentials

### 1.1 Get API Key
1. Go to [Brightdata Dashboard](https://brightdata.com/cp/setting/users)
2. Click on **"API Keys"** tab
3. Click **"Create API Key"** if you don't have one
4. Copy your API key (looks like: `b5648e1096c6442f60a6c4bbbe73f8d2234d3d8324554bd6a7ec8f3f251f07df`)

### 1.2 Get Dataset ID
1. Go to [Brightdata Datasets](https://brightdata.com/cp/datasets)
2. Click on your purchased Zara dataset
3. Copy the Dataset ID from the URL or dataset details (looks like: `gd_l1vijqt9jfj7olije`)

---

## Step 2: Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Click **"Settings"** in the top navigation
3. Click **"Environment Variables"** in the left sidebar
4. Add these three variables:

```
BRIGHTDATA_API_KEY=your_api_key_here
BRIGHTDATA_DATASET_ID=your_dataset_id_here
CRON_SECRET=any_random_secret_string_here
```

**Example:**
```
BRIGHTDATA_API_KEY=b5648e1096c6442f60a6c4bbbe73f8d2234d3d8324554bd6a7ec8f3f251f07df
BRIGHTDATA_DATASET_ID=gd_l1vijqt9jfj7olije
CRON_SECRET=my-super-secret-cron-key-12345
```

5. Click **"Save"**
6. Redeploy your application for changes to take effect

---

## Step 3: Run Database Migration

1. Go to your Supabase Dashboard
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New Query"**
4. Copy and paste the contents of `scripts/04-add-brightdata-columns.sql`
5. Click **"Run"**
6. Verify all tables and columns were created successfully

---

## Step 4: Test Each Sync Method

### Method 1: Manual Upload (Test First)
1. Go to `/admin/brightdata-sync`
2. Click **"Manual Upload"** tab
3. Paste your Brightdata JSON data or click "Choose JSON File"
4. Click **"Upload & Sync"**
5. Watch the real-time logs to see products being synced
6. Check the stats to see: X added, Y updated, Z failed

### Method 2: Fetch Button
1. Ensure environment variables are set (from Step 2)
2. Go to `/admin/brightdata-sync`
3. Click **"Fetch & Sync"** tab
4. Click **"Fetch from Brightdata"** button
5. The system will:
   - Call Brightdata API with your credentials
   - Download latest Zara products
   - Sync to database automatically
   - Show you the results

### Method 3: Automated Cron Job
This runs automatically without any action needed.

**Schedule:** 23rd of every month at 2:00 AM UTC

**What happens:**
- Vercel triggers your cron endpoint
- System fetches latest data from Brightdata
- Syncs all products to database
- Logs results to sync history
- You can check the history in the "History" tab

---

## How The System Works

### Data Flow:
```
Brightdata API
    ↓
Your Fetch/Cron Function
    ↓
Transform Product Data
    ↓
Check if Product Exists (by product_id + colour_code + size)
    ↓
If Exists: UPDATE with new data
If New: INSERT as new product
    ↓
Log to brightdata_sync_history
```

### Deduplication Logic:
Products are identified by a composite key:
- `product_id` + `colour_code` + `size`

This means:
- Same product in different colors = separate records
- Same product in different sizes = separate records
- Exact same product = updates existing record

### Source Tagging:
All Brightdata products are tagged with:
- `source = 'zara'`
- `sync_method = 'manual_upload' | 'fetch_button' | 'cron_auto'`

This allows you to filter and track where data came from.

---

## Troubleshooting

### Error: "Brightdata API credentials not configured"
**Solution:** Add `BRIGHTDATA_API_KEY` and `BRIGHTDATA_DATASET_ID` to Vercel environment variables and redeploy.

### Error: "Unauthorized" on cron job
**Solution:** Add `CRON_SECRET` environment variable to Vercel and ensure it matches the value in `vercel.json`.

### Error: "invalid input syntax for type bigint"
**Solution:** Run the database migration script (`scripts/04-add-brightdata-columns.sql`) to ensure all columns exist with correct types.

### Products not syncing
**Check:**
1. Are environment variables set correctly in Vercel?
2. Did you run the database migration?
3. Check the console logs for detailed error messages
4. Verify your Brightdata API key is valid
5. Ensure your dataset ID is correct

### Cron job not running
**Check:**
1. Cron jobs only run on **production** deployments (not preview)
2. Verify `vercel.json` exists in your project root
3. Check Vercel dashboard → Project → Settings → Cron Jobs to see if it's registered
4. Check your Vercel logs for cron execution

---

## Viewing Synced Products

### In Admin Dashboard:
1. Go to `/admin/brightdata-sync`
2. Click **"Products"** tab
3. See all Zara products from Brightdata
4. Use filters to search by name, section, availability, etc.
5. Click product cards to see full details

### In Main Database View:
1. Go to the main Shopify scraper
2. Click **"Database"** tab
3. Filter by `source = 'zara'` to see only Brightdata products
4. Or view all products together (Shopify + Brightdata)

---

## Monitoring & Logs

### Sync History:
- View all past syncs in the "History" tab
- See: timestamp, method, products processed, added, updated, failed
- Click to expand for full details

### Real-time Logs:
- Watch live sync progress during manual upload or fetch
- See each product being processed
- Color-coded messages (green = success, red = error, blue = info)

### Database Logs:
All sync operations are logged to `brightdata_sync_history` table with:
- Sync method used
- Total products processed
- Counts of added/updated/failed
- Error messages (if any)
- Timestamp

---

## Best Practices

1. **Test manual upload first** with a small dataset before enabling automatic sync
2. **Monitor the first cron job** on 23rd to ensure it works correctly
3. **Check sync history regularly** to catch any issues early
4. **Set up alerts** if you want notifications when sync fails (can be added later)
5. **Backup your database** before running large syncs

---

## Next Steps

1. Add more product details to the product cards (dimensions, care instructions, etc.)
2. Set up email notifications for sync failures
3. Add analytics to track price changes over time
4. Create a comparison view between Shopify and Brightdata products
5. Add bulk edit/delete functionality for products

---

Need help? Check the console logs for detailed error messages or review the sync history in the admin dashboard.

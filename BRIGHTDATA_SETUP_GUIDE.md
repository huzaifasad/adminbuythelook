# Brightdata Integration Setup Guide

## Overview
This guide will help you connect your Brightdata dataset to automatically sync Zara products into your database.

---

## Step 1: Get Brightdata API Credentials

### 1.1 Log in to Brightdata Dashboard
1. Go to [Brightdata Dashboard](https://brightdata.com/cp/zones)
2. Navigate to your dataset for Zara products
3. Click on the dataset you want to use

### 1.2 Get Your API Key
1. Go to **Settings** → **API Access**
2. Copy your **API Key**
3. Note down your **Dataset ID** (found in the dataset URL or settings)

---

## Step 2: Add Environment Variables to Vercel

### 2.1 Go to Vercel Project Settings
1. Open your Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**

### 2.2 Add These Variables
Add the following environment variables:

```
BRIGHTDATA_API_KEY=your_api_key_here
BRIGHTDATA_DATASET_ID=your_dataset_id_here
CRON_SECRET=generate_a_random_secret_key
```

**How to generate CRON_SECRET:**
```bash
# Run in terminal:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.3 Redeploy
After adding variables, click **Redeploy** to apply changes.

---

## Step 3: Update Fetch Sync API

The `app/api/brightdata/fetch-sync.js` file needs your actual Brightdata API endpoint.

### Replace This Line:
```javascript
const response = await fetch("https://api.brightdata.com/v3/datasets/YOUR_DATASET_ID/download", {
```

### With Your Actual Endpoint:
```javascript
const response = await fetch(`https://api.brightdata.com/v3/datasets/${process.env.BRIGHTDATA_DATASET_ID}/download`, {
  headers: {
    Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
  },
})
```

---

## Step 4: Test the Fetch Button

1. Go to `/admin/brightdata-sync`
2. Click the **"Fetch & Sync"** tab
3. Click **"Fetch from Brightdata API"** button
4. Watch the sync progress in real-time
5. Check the sync history to see results

---

## Step 5: Enable Cron Job (Auto Sync)

### 5.1 Verify vercel.json Configuration
Your `vercel.json` already has:
```json
{
  "crons": [
    {
      "path": "/api/brightdata/cron-sync",
      "schedule": "0 2 23 * *"
    }
  ]
}
```

This runs on the **23rd of every month at 2:00 AM UTC**.

### 5.2 Update Cron API Endpoint
Edit `app/api/brightdata/cron-sync.js` to fetch from Brightdata:

```javascript
// Replace the TODO section with:
const response = await fetch(`https://api.brightdata.com/v3/datasets/${process.env.BRIGHTDATA_DATASET_ID}/download`, {
  headers: {
    Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
  },
})

const products = await response.json()
const productsData = Array.isArray(products) ? products : [products]
```

### 5.3 Test Cron Locally (Optional)
You can test the cron by calling it manually:

```bash
curl -X GET "https://your-domain.vercel.app/api/brightdata/cron-sync" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Step 6: Change Cron Schedule (Optional)

If you want to run the cron more frequently, update `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/brightdata/cron-sync",
      "schedule": "0 2 * * *"  // Every day at 2 AM
    }
  ]
}
```

**Schedule Format:** `minute hour day month dayOfWeek`

Examples:
- `"0 2 * * *"` - Every day at 2 AM
- `"0 */6 * * *"` - Every 6 hours
- `"0 0 1 * *"` - First day of each month at midnight
- `"0 2 23 * *"` - 23rd of every month at 2 AM (current)

---

## Step 7: Monitor Sync History

1. Go to `/admin/brightdata-sync`
2. Click the **"History"** tab
3. View all sync operations with:
   - Timestamp
   - Sync method used
   - Products added/updated/failed
   - Status

---

## Troubleshooting

### Issue: "Unauthorized" error
**Solution:** Check that `BRIGHTDATA_API_KEY` is correctly set in Vercel

### Issue: Cron not running
**Solution:** 
1. Verify `CRON_SECRET` is set
2. Check Vercel logs for errors
3. Ensure `vercel.json` is in the project root

### Issue: Products not syncing
**Solution:**
1. Check Brightdata dataset has data
2. Verify dataset ID is correct
3. Check sync history for error messages
4. Look at browser console for detailed logs

---

## Summary

After completing this setup:
- **Manual Upload**: Paste JSON data anytime
- **Fetch Button**: Click to fetch fresh data from Brightdata
- **Auto Cron**: Runs automatically on 23rd of each month at 2 AM

All products will be stored in `zara_cloth_test` table with `source = 'zara'`.

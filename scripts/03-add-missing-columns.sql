-- Add missing columns to zara_cloth_test table
-- Run this in Supabase SQL Editor

-- Add sync tracking columns if they don't exist
ALTER TABLE zara_cloth_test 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sync_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_scraped_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS store_name VARCHAR(255);

-- Add optional columns for better data structure
ALTER TABLE zara_cloth_test
ADD COLUMN IF NOT EXISTS scraped_category VARCHAR(255),
ADD COLUMN IF NOT EXISTS scrape_type VARCHAR(100) DEFAULT 'shopify_api';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_zara_cloth_test_store_name ON zara_cloth_test(store_name);
CREATE INDEX IF NOT EXISTS idx_zara_cloth_test_is_active ON zara_cloth_test(is_active);
CREATE INDEX IF NOT EXISTS idx_zara_cloth_test_last_synced ON zara_cloth_test(last_synced_at);

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'zara_cloth_test'
ORDER BY ordinal_position;

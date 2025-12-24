-- Add Brightdata columns to zara_cloth_test table
ALTER TABLE zara_cloth_test
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'zara',
ADD COLUMN IF NOT EXISTS sync_method TEXT,
ADD COLUMN IF NOT EXISTS last_synced_by TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT,
ADD COLUMN IF NOT EXISTS section TEXT,
ADD COLUMN IF NOT EXISTS product_family TEXT,
ADD COLUMN IF NOT EXISTS product_family_en TEXT,
ADD COLUMN IF NOT EXISTS product_subfamily TEXT,
ADD COLUMN IF NOT EXISTS care JSONB,
ADD COLUMN IF NOT EXISTS materials JSONB,
ADD COLUMN IF NOT EXISTS materials_description TEXT,
ADD COLUMN IF NOT EXISTS match_products JSONB,
ADD COLUMN IF NOT EXISTS similar_products JSONB,
ADD COLUMN IF NOT EXISTS images JSONB,
ADD COLUMN IF NOT EXISTS you_may_also_like TEXT,
ADD COLUMN IF NOT EXISTS category_id TEXT,
ADD COLUMN IF NOT EXISTS category_name TEXT,
ADD COLUMN IF NOT EXISTS colour_code TEXT,
ADD COLUMN IF NOT EXISTS seo_category_id TEXT,
ADD COLUMN IF NOT EXISTS last_synced TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS source_priority INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS flags TEXT[];

-- Create sync history table for Brightdata
CREATE TABLE IF NOT EXISTS brightdata_sync_history (
  id BIGSERIAL PRIMARY KEY,
  sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_method TEXT NOT NULL,
  total_processed INTEGER,
  total_added INTEGER,
  total_updated INTEGER,
  total_failed INTEGER,
  error_details JSONB,
  status TEXT DEFAULT 'completed'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_zara_cloth_test_source ON zara_cloth_test(source);
CREATE INDEX IF NOT EXISTS idx_zara_cloth_test_product_id_source ON zara_cloth_test(product_id, source);
CREATE INDEX IF NOT EXISTS idx_brightdata_sync_history_timestamp ON brightdata_sync_history(sync_timestamp);

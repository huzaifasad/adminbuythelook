-- Add new columns to zara_cloth_test for sync tracking
ALTER TABLE zara_cloth_test
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sync_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on last_synced_at for better performance
CREATE INDEX IF NOT EXISTS idx_zara_cloth_test_last_synced 
ON zara_cloth_test(last_synced_at);

CREATE INDEX IF NOT EXISTS idx_zara_cloth_test_is_active 
ON zara_cloth_test(is_active);

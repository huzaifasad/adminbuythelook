-- Create sync_logs table to track sync history
CREATE TABLE IF NOT EXISTS sync_logs (
  id BIGSERIAL PRIMARY KEY,
  store_name TEXT NOT NULL,
  store_url TEXT NOT NULL,
  sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  products_added INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_removed INTEGER DEFAULT 0,
  total_products_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success', -- 'success', 'partial', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create price_history table to track price changes
CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  product_name TEXT,
  old_price NUMERIC,
  new_price NUMERIC,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  store_name TEXT
);

-- Create stock_history table to track stock changes
CREATE TABLE IF NOT EXISTS stock_history (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  product_name TEXT,
  old_status TEXT, -- 'in_stock', 'out_of_stock'
  new_status TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  store_name TEXT
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sync_logs_store ON sync_logs(store_name);
CREATE INDEX IF NOT EXISTS idx_sync_logs_timestamp ON sync_logs(sync_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);

-- Enable RLS on new tables
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for testing)
CREATE POLICY "Allow all operations on sync_logs" 
ON sync_logs FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on price_history" 
ON price_history FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on stock_history" 
ON stock_history FOR ALL USING (true) WITH CHECK (true);

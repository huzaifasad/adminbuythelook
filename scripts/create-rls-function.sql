-- SQL script to create the RLS function for zara_cloth_test table
-- This function provides the same functionality as upsert_zara_product_v6

CREATE OR REPLACE FUNCTION upsert_zara_product_test(
  p_id INTEGER DEFAULT NULL,
  p_product_name TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_colour TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_size TEXT[] DEFAULT NULL,
  p_materials JSONB[] DEFAULT NULL,
  p_availability BOOLEAN DEFAULT NULL,
  p_category_id INTEGER DEFAULT NULL,
  p_product_id INTEGER DEFAULT NULL,
  p_colour_code TEXT DEFAULT NULL,
  p_section TEXT DEFAULT NULL,
  p_product_family TEXT DEFAULT NULL,
  p_product_family_en TEXT DEFAULT NULL,
  p_product_subfamily TEXT DEFAULT NULL,
  p_care TEXT DEFAULT NULL,
  p_materials_description TEXT DEFAULT NULL,
  p_dimension TEXT DEFAULT NULL,
  p_low_on_stock BOOLEAN DEFAULT NULL,
  p_sku TEXT DEFAULT NULL,
  p_url TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_image JSONB DEFAULT NULL,
  p_you_may_also_like JSONB DEFAULT NULL,
  p_category_path TEXT DEFAULT NULL,
  p_scraped_category TEXT DEFAULT NULL,
  p_scrape_type TEXT DEFAULT NULL,
  p_brand TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_stock_status TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_images JSONB DEFAULT NULL,
  p_product_url TEXT DEFAULT NULL,
  p_care_info TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Insert or update product based on p_product_id (unique identifier)
  INSERT INTO zara_cloth_test (
    id, product_name, price, colour, description, size, materials,
    availability, category_id, product_id, colour_code, section,
    product_family, product_family_en, product_subfamily, care,
    materials_description, dimension, low_on_stock, sku, url,
    currency, image, you_may_also_like, category_path, scraped_category,
    scrape_type, brand, category, stock_status, color, images,
    product_url, care_info
  )
  VALUES (
    p_id, p_product_name, p_price, p_colour, p_description, p_size, p_materials,
    p_availability, p_category_id, p_product_id, p_colour_code, p_section,
    p_product_family, p_product_family_en, p_product_subfamily, p_care,
    p_materials_description, p_dimension, p_low_on_stock, p_sku, p_url,
    p_currency, p_image, p_you_may_also_like, p_category_path, p_scraped_category,
    p_scrape_type, p_brand, p_category, p_stock_status, p_color, p_images,
    p_product_url, p_care_info
  )
  ON CONFLICT (product_id) 
  DO UPDATE SET
    product_name = EXCLUDED.product_name,
    price = EXCLUDED.price,
    colour = EXCLUDED.colour,
    description = EXCLUDED.description,
    size = EXCLUDED.size,
    materials = EXCLUDED.materials,
    availability = EXCLUDED.availability,
    colour_code = EXCLUDED.colour_code,
    section = EXCLUDED.section,
    product_family = EXCLUDED.product_family,
    product_family_en = EXCLUDED.product_family_en,
    product_subfamily = EXCLUDED.product_subfamily,
    care = EXCLUDED.care,
    materials_description = EXCLUDED.materials_description,
    dimension = EXCLUDED.dimension,
    low_on_stock = EXCLUDED.low_on_stock,
    sku = EXCLUDED.sku,
    url = EXCLUDED.url,
    currency = EXCLUDED.currency,
    image = EXCLUDED.image,
    you_may_also_like = EXCLUDED.you_may_also_like,
    category_path = EXCLUDED.category_path,
    scraped_category = EXCLUDED.scraped_category,
    scrape_type = EXCLUDED.scrape_type,
    brand = EXCLUDED.brand,
    category = EXCLUDED.category,
    stock_status = EXCLUDED.stock_status,
    color = EXCLUDED.color,
    images = EXCLUDED.images,
    product_url = EXCLUDED.product_url,
    care_info = EXCLUDED.care_info,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create an index on product_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_zara_cloth_test_product_id ON zara_cloth_test(product_id);

-- Optional: Add a unique constraint on product_id if not already present
ALTER TABLE zara_cloth_test ADD CONSTRAINT unique_product_id UNIQUE (product_id);

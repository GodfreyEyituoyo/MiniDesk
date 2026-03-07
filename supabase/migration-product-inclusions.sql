-- ================================================
-- Add product-level inclusions to bundle_categories
-- Run AFTER migration-phase2.sql
-- ================================================

-- Add product_id for individual product inclusions
ALTER TABLE bundle_categories ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;

-- Make category_id nullable (null when it's a specific product inclusion)
ALTER TABLE bundle_categories ALTER COLUMN category_id DROP NOT NULL;

-- Drop old unique constraint and add a new one that handles both modes
ALTER TABLE bundle_categories DROP CONSTRAINT IF EXISTS bundle_categories_bundle_id_category_id_key;

-- New constraint: unique per (bundle, category) OR (bundle, product)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bundle_cat_unique 
    ON bundle_categories(bundle_id, category_id) WHERE product_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bundle_prod_unique 
    ON bundle_categories(bundle_id, product_id) WHERE product_id IS NOT NULL;

-- Index for product lookups
CREATE INDEX IF NOT EXISTS idx_bundle_categories_product ON bundle_categories(product_id);

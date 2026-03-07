-- ================================================
-- MiniDesk Phase 2: Modular Product Architecture
-- Run this AFTER the initial schema.sql
-- ================================================

-- ── CATEGORIES ──
-- Flexible product groups (one per product type)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── BUNDLES ──
-- Bundle definitions (separate from products)
CREATE TABLE IF NOT EXISTS bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    discount_percent INT DEFAULT 0,
    tag TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER bundles_updated_at
    BEFORE UPDATE ON bundles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ── BUNDLE_CATEGORIES ──
-- What goes in each bundle (links bundles to categories)
CREATE TABLE IF NOT EXISTS bundle_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('static', 'configurable')),
    sort_order INT DEFAULT 0,
    UNIQUE(bundle_id, category_id)
);

-- ── UPDATE PRODUCTS TABLE ──
-- Add category_id FK, images array, color_options
-- (Keep old columns for backward compatibility during migration)
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS color_options JSONB DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_addon BOOLEAN DEFAULT false;

-- ── RLS POLICIES ──
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_categories ENABLE ROW LEVEL SECURITY;

-- Public read for all
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read bundles" ON bundles FOR SELECT USING (true);
CREATE POLICY "Public read bundle_categories" ON bundle_categories FOR SELECT USING (true);

-- Admin write
CREATE POLICY "Admin manage categories" ON categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manage bundles" ON bundles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manage bundle_categories" ON bundle_categories FOR ALL USING (auth.role() = 'authenticated');

-- ── INDEXES ──
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_bundle_categories_bundle ON bundle_categories(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_categories_category ON bundle_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_bundles_slug ON bundles(slug);

-- ── SEED: CATEGORIES ──
INSERT INTO categories (name, slug, description, sort_order) VALUES
    ('Mac Mini', 'mac-mini', 'Apple Mac Mini computers', 1),
    ('Monitors', 'monitors', 'Display monitors', 2),
    ('Keyboards & Mouse', 'keyboards-mouse', 'Keyboard and mouse combos', 3),
    ('USB-C Hubs', 'usb-c-hubs', 'USB-C hub and docking stations', 4),
    ('Mousepads', 'mousepads', 'Keyboard mats and mousepads', 5),
    ('Side Lights', 'side-lights', 'Desk lighting', 6),
    ('Tables', 'tables', 'Workstation desks and tables', 7),
    ('Chairs', 'chairs', 'Ergonomic office chairs', 8),
    ('Storage', 'storage', 'External storage drives', 9),
    ('Stands', 'stands', 'Laptop and monitor stands', 10)
ON CONFLICT (slug) DO NOTHING;

-- ── SEED: BUNDLES ──
INSERT INTO bundles (name, slug, description, discount_percent, tag, sort_order) VALUES
    ('Basic Work Bundle', 'basic', 'Mac mini M4 + Monitor + Keyboard & Mouse + USB-C Hub', 20, '', 1),
    ('Full Workspace Bundle', 'full', 'Everything in Basic + Workstation Desk + Ergonomic Chair + Keyboard Mat + Side Light', 20, 'Best Value', 2)
ON CONFLICT (slug) DO NOTHING;

-- ── SEED: BUNDLE_CATEGORIES ──
-- (Must run after categories and bundles are inserted)
-- Basic bundle:
INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'static', 1
FROM bundles b, categories c
WHERE b.slug = 'basic' AND c.slug = 'mac-mini'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'static', 2
FROM bundles b, categories c
WHERE b.slug = 'basic' AND c.slug = 'usb-c-hubs'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'static', 3
FROM bundles b, categories c
WHERE b.slug = 'basic' AND c.slug = 'mousepads'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'configurable', 4
FROM bundles b, categories c
WHERE b.slug = 'basic' AND c.slug = 'monitors'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'configurable', 5
FROM bundles b, categories c
WHERE b.slug = 'basic' AND c.slug = 'keyboards-mouse'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

-- Full bundle (same as basic + extras):
INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'static', 1
FROM bundles b, categories c
WHERE b.slug = 'full' AND c.slug = 'mac-mini'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'static', 2
FROM bundles b, categories c
WHERE b.slug = 'full' AND c.slug = 'usb-c-hubs'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'static', 3
FROM bundles b, categories c
WHERE b.slug = 'full' AND c.slug = 'mousepads'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'static', 4
FROM bundles b, categories c
WHERE b.slug = 'full' AND c.slug = 'side-lights'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'static', 5
FROM bundles b, categories c
WHERE b.slug = 'full' AND c.slug = 'tables'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'static', 6
FROM bundles b, categories c
WHERE b.slug = 'full' AND c.slug = 'chairs'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'configurable', 7
FROM bundles b, categories c
WHERE b.slug = 'full' AND c.slug = 'monitors'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

INSERT INTO bundle_categories (bundle_id, category_id, role, sort_order)
SELECT b.id, c.id, 'configurable', 8
FROM bundles b, categories c
WHERE b.slug = 'full' AND c.slug = 'keyboards-mouse'
ON CONFLICT (bundle_id, category_id) DO NOTHING;

-- ── SUPABASE STORAGE ──
-- Create a public bucket for product images
-- (Run this via Supabase Dashboard > Storage > New Bucket)
-- Bucket name: product-images
-- Public: Yes
-- File size limit: 5MB
-- Allowed types: image/*

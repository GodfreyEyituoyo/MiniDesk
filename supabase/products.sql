-- ================================================
-- MiniDesk Products Table
-- Run this in your Supabase SQL Editor
-- ================================================

-- Products table: stores all configurable items
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Product categorisation
    category TEXT NOT NULL CHECK (category IN ('bundle', 'monitor', 'keyboard', 'addon')),
    slug TEXT NOT NULL UNIQUE,  -- e.g. 'basic', 'entry', 'mac', 'stand'
    
    -- Display info
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    emoji TEXT DEFAULT '',          -- for bundles/keyboards
    image TEXT DEFAULT '',          -- for monitors/addons (relative path)
    tag TEXT DEFAULT '',            -- e.g. 'Entry Level', 'Best Value'
    tag_class TEXT DEFAULT '',      -- CSS class for tag styling
    specs JSONB DEFAULT '[]'::jsonb, -- array of spec strings for monitors
    
    -- Pricing
    price INTEGER NOT NULL,  -- in Naira (whole units)
    
    -- Configuration rules
    tier TEXT DEFAULT NULL CHECK (tier IN ('entry', 'mid', 'top', 'creator', NULL)),
    requires_tier TEXT[] DEFAULT '{}',  -- which monitor tiers unlock this (for keyboards)
    
    -- State
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Anyone can read active products
CREATE POLICY "Public can read active products" ON products
    FOR SELECT
    USING (is_active = true);

-- Admins can do everything
CREATE POLICY "Admin full access to products" ON products
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Index
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- ================================================
-- Seed: Insert current product data
-- ================================================

-- Bundles
INSERT INTO products (category, slug, name, description, emoji, price, sort_order) VALUES
('bundle', 'basic', 'Basic Work Bundle', 'Mac Mini M4 + Monitor + Keyboard + Mouse + USB-C Dongle. Everything to get to work.', '⚡', 450000, 1),
('bundle', 'full', 'Full Workspace Bundle', 'Everything in Basic + Workstation Desk + Chair + Keyboard Mat + Fancy Side Light.', '🚀', 950000, 2);

-- Update tags
UPDATE products SET tag = 'Best Value', tag_class = 'tag-full' WHERE slug = 'full';

-- Monitors
INSERT INTO products (category, slug, name, description, image, tag, tag_class, price, tier, specs, sort_order) VALUES
('monitor', 'entry', 'Dell SE2726HG', 'Perfect for all your entertainment and gaming, this 27-inch FHD monitor features a high 240Hz refresh rate, fast IPS panel, and is certified by TÜV Rheinland® for 3-star eye comfort.', 'images/monitor-entry.png', 'Entry Level', 'tag-entry', 95000, 'entry', '["27\" · 1920×1080 FHD · 240Hz", "IPS Panel · HDR · VRR", "2× HDMI 2.1 · 1× DisplayPort 1.4"]'::jsonb, 1),
('monitor', 'mid', 'Dell S2725DS', 'A stunning 27-inch QHD display with height-adjustable stand, built-in stereo speakers, and wide colour coverage — ideal for creative work and multitasking.', 'images/monitor-mid.png', 'Mid Range', 'tag-mid', 185000, 'mid', '["27\" · 2560×1440 QHD · 100Hz", "2× 5W Built-in Speakers · VRR", "2× HDMI 2.1 · 1× DisplayPort 1.2"]'::jsonb, 2),
('monitor', 'top', 'Dell S2725QS', 'Breathtaking 4K clarity on a 27-inch IPS display with height-adjustable stand and impeccable colour accuracy — the ultimate screen for professionals.', 'images/monitor-top.png', 'Top Tier', 'tag-top', 380000, 'top', '["27\" · 3840×2160 4K UHD · 120Hz", "Built-in Audio · HDR · VRR", "2× HDMI 2.1 · USB-C 65W PD · USB Hub"]'::jsonb, 3),
('monitor', 'creator', 'ASUS ProArt PA278CV', '27-inch Calman Verified display for creative professionals. Factory calibrated with ΔE < 2 colour accuracy, 100% sRGB / Rec. 709 coverage, and USB-C with 65W power delivery for a single-cable workflow.', 'images/monitor-creator.png', 'Creator''s Choice', 'tag-creator', 280000, 'creator', '["27\" · 2560×1440 QHD · IPS", "Calman Verified · ΔE < 2 · 100% sRGB", "USB-C 65W PD · HDMI · DisplayPort"]'::jsonb, 4);

-- Keyboards
INSERT INTO products (category, slug, name, description, emoji, price, requires_tier, sort_order) VALUES
('keyboard', 'windows', 'Windows Keyboard', 'Wireless compact layout, compatible with any system. Clean and reliable.', '⌨️', 28000, '{}', 1),
('keyboard', 'mac', 'Apple Magic Keyboard', 'Slim, rechargeable, Touch ID — the native Mac experience. Unlocked with Mid/Top/Creator monitor.', '⌨️', 72000, '{mid,top,creator}', 2);

-- Add-ons
INSERT INTO products (category, slug, name, description, image, price, sort_order) VALUES
('addon', 'stand', 'Laptop Stand', 'Foldable, adjustable-height aluminium stand. Elevates your screen for better ergonomics. Works with MacBooks too.', 'images/addon-stand.png', 22000, 1),
('addon', 'ssd', 'SanDisk 1TB Extreme Portable SSD', 'Blazing-fast 1,050MB/s read speeds. Rugged, pocket-sized, and USB-C ready. Never worry about storage again.', 'images/addon-ssd.png', 68000, 2);

-- Included items price (mouse + dongle) — stored as a special "included" product
INSERT INTO products (category, slug, name, description, emoji, price, sort_order) VALUES
('addon', 'included', 'Mouse + USB-C Dongle', 'Included with every bundle.', '🖱️', 45000, 0);

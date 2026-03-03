-- ================================================
-- MiniDesk Products V2 Migration
-- Run this in your Supabase SQL Editor
-- ================================================

-- 1. Clear test orders
DELETE FROM orders;

-- 2. Add new columns for modular bundle system
ALTER TABLE products ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'static' CHECK (role IN ('static', 'configurable', 'addon'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_ids TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0;

-- 3. Drop the old tier lock on keyboards (all keyboards free for now)
-- Remove requires_tier data
UPDATE products SET requires_tier = '{}' WHERE category = 'keyboard';

-- 4. Update product roles and bundle assignments
-- Bundles themselves
UPDATE products SET role = 'static', bundle_ids = '{}' WHERE category = 'bundle';

-- Monitors are configurable, available in both bundles
UPDATE products SET role = 'configurable', bundle_ids = '{basic,full}' WHERE category = 'monitor';

-- Keyboards are configurable, available in both bundles
UPDATE products SET role = 'configurable', bundle_ids = '{basic,full}' WHERE category = 'keyboard';

-- Add-ons remain add-ons
UPDATE products SET role = 'addon', bundle_ids = '{}' WHERE category = 'addon' AND slug != 'included';

-- Included items (mouse + dongle) are static in both bundles
UPDATE products SET role = 'static', bundle_ids = '{basic,full}' WHERE slug = 'included';

-- 5. Update prices to correct Naira values (USD × ₦1,400)
-- Mac Mini was stored as bundle base price, now update individual items

-- Monitors (USD selling price × 1400)
UPDATE products SET price = 428400 WHERE slug = 'entry';   -- $306 × 1400
UPDATE products SET price = 540400 WHERE slug = 'mid';     -- $386 × 1400
UPDATE products SET price = 658000 WHERE slug = 'top';     -- $470 × 1400
UPDATE products SET price = 658000 WHERE slug = 'creator'; -- $470 × 1400

-- Keyboards (USD selling price × 1400)
UPDATE products SET price = 84000 WHERE slug = 'windows';  -- $60 × 1400
UPDATE products SET price = 154000 WHERE slug = 'mac';     -- $110 × 1400

-- Included items (mouse + dongle) — already in Naira, update to match
UPDATE products SET price = 40000, name = 'USB-C Dongle + Mouse' WHERE slug = 'included';

-- Bundle base prices (static items total, excluding configurables)
-- Basic: Mac Mini (1,078,000) + Dongle+Mouse (40,000) + Mousepad (20,000) = 1,138,000
UPDATE products SET price = 1138000 WHERE slug = 'basic';

-- Full: Basic (1,138,000) + Table (65,000) + Chair (230,000) + Light (10,000) = 1,443,000
UPDATE products SET price = 1443000 WHERE slug = 'full';

-- Add-ons — keep as-is (already in Naira)
-- Laptop Stand: 22,000
-- SSD: 68,000

-- 6. Add mousepad as its own static product (was included in "included" price)
INSERT INTO products (category, slug, name, description, emoji, price, role, bundle_ids, sort_order, is_active)
VALUES ('addon', 'mousepad', 'Keyboard/Mouse Pad', 'Premium desk pad for keyboard and mouse.', '🖱️', 20000, 'static', '{basic,full}', 0, true)
ON CONFLICT (slug) DO UPDATE SET price = 20000, role = 'static', bundle_ids = '{basic,full}';

-- 7. Add Full-bundle-only static items
INSERT INTO products (category, slug, name, description, emoji, price, role, bundle_ids, sort_order, is_active)
VALUES 
('addon', 'table', 'Workstation Table', 'Spacious work desk for your setup.', '🪑', 65000, 'static', '{full}', 0, true),
('addon', 'chair', 'Workstation Chair', 'FURGLE Professional Gaming Chair with Footrest.', '💺', 230000, 'static', '{full}', 0, true),
('addon', 'sidelight', 'Fancy Side Light', 'Ambient lighting for your workspace.', '💡', 10000, 'static', '{full}', 0, true)
ON CONFLICT (slug) DO UPDATE SET 
    price = EXCLUDED.price, 
    role = EXCLUDED.role, 
    bundle_ids = EXCLUDED.bundle_ids;

-- 8. Set 20% discount display on bundles
UPDATE products SET discount_percent = 20 WHERE category = 'bundle';

-- 9. Verify final state
SELECT slug, name, category, role, price, bundle_ids, discount_percent, is_active 
FROM products 
ORDER BY category, sort_order;

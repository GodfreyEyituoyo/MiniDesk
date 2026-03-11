-- ================================================
-- MiniDesk Products V3 — Sync DB slugs with frontend
-- Run this in your Supabase SQL Editor
-- ================================================

-- 1. UPSERT bundles (they may not exist yet)
INSERT INTO products (category, slug, name, description, price, is_active, sort_order)
VALUES 
    ('bundle', 'basic', 'Basic Work Bundle', 'Mac Mini M4 + Monitor + Keyboard & Mouse + USB-C Hub', 1138000, true, 1),
    ('bundle', 'full', 'Full Workspace Bundle', 'Everything in Basic + Workstation Desk + Chair + Keyboard Mat + Side Light', 1443000, true, 2)
ON CONFLICT (slug) DO UPDATE SET 
    price = EXCLUDED.price, 
    name = EXCLUDED.name, 
    description = EXCLUDED.description,
    is_active = true;

-- 2. Fix keyboard slugs: windows → mk250, mac → pop-icon
-- First delete old slugs if new ones already exist (avoid unique constraint)
DELETE FROM products WHERE slug IN ('windows', 'mac') 
    AND EXISTS (SELECT 1 FROM products WHERE slug IN ('mk250', 'pop-icon'));

-- Now upsert keyboards
INSERT INTO products (category, slug, name, description, price, is_active, sort_order)
VALUES 
    ('keyboard', 'mk250', 'Logitech MK250 Compact', 'Compact Bluetooth wireless keyboard & mouse combo', 84000, true, 1),
    ('keyboard', 'pop-icon', 'Logitech POP Icon Combo', 'Stylish, compact keyboard & mouse with customizable Action Keys', 154000, true, 2)
ON CONFLICT (slug) DO UPDATE SET 
    price = EXCLUDED.price, 
    name = EXCLUDED.name, 
    description = EXCLUDED.description,
    is_active = true;

-- Also delete old keyboard slugs if they still exist
DELETE FROM products WHERE slug IN ('windows', 'mac');

-- 3. Ensure monitor prices match frontend
UPDATE products SET price = 428400, is_active = true WHERE slug = 'entry';
UPDATE products SET price = 540400, is_active = true WHERE slug = 'mid';
UPDATE products SET price = 658000, is_active = true WHERE slug = 'top';
UPDATE products SET price = 658000, is_active = true WHERE slug = 'creator';

-- 4. Ensure addon prices match
UPDATE products SET price = 22000, is_active = true WHERE slug = 'stand';
UPDATE products SET price = 68000, is_active = true WHERE slug = 'ssd';

-- 5. Verify everything — you should see 10 rows including basic + full
SELECT slug, name, category, price, is_active 
FROM products 
WHERE slug IN ('basic', 'full', 'entry', 'mid', 'top', 'creator', 'mk250', 'pop-icon', 'stand', 'ssd')
ORDER BY category, slug;

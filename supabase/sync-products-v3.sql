-- ================================================
-- MiniDesk Products V3 — Sync DB slugs with frontend
-- Run this in your Supabase SQL Editor
-- ================================================

-- 1. Fix keyboard slugs: windows → mk250, mac → pop-icon
UPDATE products SET 
    slug = 'mk250', 
    name = 'Logitech MK250 Compact', 
    description = 'Compact Bluetooth wireless keyboard & mouse combo',
    price = 84000,
    requires_tier = '{}'
WHERE slug = 'windows';

UPDATE products SET 
    slug = 'pop-icon', 
    name = 'Logitech POP Icon Combo', 
    description = 'Stylish, compact keyboard & mouse with customizable Action Keys',
    price = 154000,
    requires_tier = '{}'
WHERE slug = 'mac';

-- 2. Ensure bundle prices match frontend
UPDATE products SET price = 1138000, is_active = true WHERE slug = 'basic';
UPDATE products SET price = 1443000, is_active = true WHERE slug = 'full';

-- 3. Ensure monitor prices match frontend
UPDATE products SET price = 428400, is_active = true WHERE slug = 'entry';
UPDATE products SET price = 540400, is_active = true WHERE slug = 'mid';
UPDATE products SET price = 658000, is_active = true WHERE slug = 'top';
UPDATE products SET price = 658000, is_active = true WHERE slug = 'creator';

-- 4. Ensure addon prices match
UPDATE products SET price = 22000, is_active = true WHERE slug = 'stand';
UPDATE products SET price = 68000, is_active = true WHERE slug = 'ssd';

-- 5. Verify everything
SELECT slug, name, category, price, is_active 
FROM products 
WHERE slug IN ('basic', 'full', 'entry', 'mid', 'top', 'creator', 'mk250', 'pop-icon', 'stand', 'ssd')
ORDER BY category, slug;

-- ================================================
-- Fix product names + add missing products
-- ================================================

-- 0. Drop old constraints on legacy category column
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE products ALTER COLUMN category DROP NOT NULL;

-- 1. Fix keyboard names to match frontend
UPDATE products SET 
    name = 'Logitech POP Icon Combo',
    slug = 'pop-icon',
    description = 'Stylish, compact keyboard & mouse with customizable Action Keys',
    tag = 'Premium'
WHERE name = 'Apple Magic Keyboard';

UPDATE products SET 
    name = 'Logitech MK250 Compact',
    slug = 'mk250',
    description = 'Compact Bluetooth wireless keyboard & mouse combo',
    tag = ''
WHERE name = 'Windows Keyboard';

-- 2. Add Mac Mini M4
INSERT INTO products (name, slug, description, price, category_id, tag, sort_order, is_active, is_addon)
VALUES (
    'Apple Mac Mini M4',
    'mac-mini-m4',
    'Apple M4 chip, 16GB unified memory, 256GB SSD',
    999000,
    (SELECT id FROM categories WHERE slug = 'mac-mini'),
    'Included',
    0,
    true,
    false
);

-- 3. Add USB-C Hub
INSERT INTO products (name, slug, description, price, category_id, tag, sort_order, is_active, is_addon)
VALUES (
    'USB-C Hub 10-in-1',
    'usbc-hub-10in1',
    '10-in-1 USB-C docking station with HDMI, USB 3.0, SD card reader, ethernet',
    25000,
    (SELECT id FROM categories WHERE slug = 'usb-c-hubs'),
    'Included',
    0,
    true,
    false
);

-- 4. Delete legacy bundle products
DELETE FROM products WHERE name IN ('Basic Work Bundle', 'Full Workspace Bundle');

-- 5. Verify
SELECT p.name, p.price, c.name as category, p.is_addon
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
ORDER BY c.sort_order, p.sort_order;

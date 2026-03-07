-- ================================================
-- Link existing products to new categories
-- Run this AFTER migration-phase2.sql
-- ================================================

-- Map old category text values to new category UUIDs
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'mac-mini')
WHERE category = 'bundle' AND slug IN ('basic', 'full');

-- Actually, bundles are now in the bundles table, not products.
-- Let's map the actual product categories:

-- Monitors
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'monitors')
WHERE category = 'monitor';

-- Keyboards
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'keyboards-mouse')
WHERE category = 'keyboard';

-- Add-ons: need to identify individually
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'stands'), is_addon = true
WHERE slug = 'stand' OR name ILIKE '%laptop stand%';

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'storage'), is_addon = true
WHERE slug = 'ssd' OR name ILIKE '%ssd%' OR name ILIKE '%sandisk%';

-- Static bundle items (from the "included" product or individual items)
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'mac-mini')
WHERE name ILIKE '%mac mini%' AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'usb-c-hubs')
WHERE (name ILIKE '%usb%hub%' OR name ILIKE '%usb-c%' OR name ILIKE '%type-c%') AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'mousepads')
WHERE (name ILIKE '%mousepad%' OR name ILIKE '%keyboard mat%' OR name ILIKE '%mouse pad%') AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'side-lights')
WHERE (name ILIKE '%side light%' OR name ILIKE '%light%') AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'tables')
WHERE (name ILIKE '%table%' OR name ILIKE '%desk%') AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'chairs')
WHERE (name ILIKE '%chair%') AND category_id IS NULL;

-- Bundle products → Mac Mini category (they represent the bundle pricing)
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'mac-mini')
WHERE category = 'bundle' AND category_id IS NULL;

-- Catch-all: any remaining products without category_id
-- (Check after running: SELECT name, category, category_id FROM products WHERE category_id IS NULL;)

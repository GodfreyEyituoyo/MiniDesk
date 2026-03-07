-- ================================================
-- Set product images from existing repo files
-- ================================================

-- Monitors
UPDATE products SET images = '["images/monitor-entry.png"]' WHERE slug = 'dell-se2726hg';
UPDATE products SET images = '["images/monitor-mid.png"]' WHERE slug = 'dell-s2725ds';
UPDATE products SET images = '["images/monitor-top.png"]' WHERE slug = 'dell-s2725qs';
UPDATE products SET images = '["images/monitor-creator.png"]' WHERE slug = 'asus-proart-pa278cv';

-- Mac Mini
UPDATE products SET images = '["images/macmini-m4.jpg"]' WHERE slug = 'mac-mini-m4';

-- Keyboards (primary image = first color variant)
UPDATE products SET images = '["images/keyboards/pop-icon-graphite-white-1.jpg"]' WHERE slug = 'pop-icon';
UPDATE products SET images = '["images/keyboards/mk250-graphite-1.jpg"]' WHERE slug = 'mk250';

-- Addons
UPDATE products SET images = '["images/addon-ssd.png"]' WHERE name ILIKE '%sandisk%';
UPDATE products SET images = '["images/addon-stand.png"]' WHERE name ILIKE '%laptop stand%';

-- Verify
SELECT name, slug, images FROM products ORDER BY name;

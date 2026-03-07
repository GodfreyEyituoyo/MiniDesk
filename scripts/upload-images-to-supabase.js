/**
 * Batch upload local product images to Supabase Storage
 * 
 * Usage: node scripts/upload-images-to-supabase.js
 * 
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 * (same ones used by Netlify functions)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'product-images';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Map: local file path -> product slug for DB update
const imageMap = [
    // Monitors
    { file: 'images/monitor-entry.png', slug: 'dell-se2726hg', name: 'monitor-entry.png' },
    { file: 'images/monitor-mid.png', slug: 'dell-s2725ds', name: 'monitor-mid.png' },
    { file: 'images/monitor-top.png', slug: 'dell-s2725qs', name: 'monitor-top.png' },
    { file: 'images/monitor-creator.png', slug: 'asus-proart-pa278cv', name: 'monitor-creator.png' },
    // Mac Mini
    { file: 'images/macmini-m4.jpg', slug: 'mac-mini-m4', name: 'macmini-m4.jpg' },
    // Keyboards
    { file: 'images/keyboards/pop-icon-graphite-white-1.jpg', slug: 'pop-icon', name: 'pop-icon-graphite-white-1.jpg' },
    { file: 'images/keyboards/mk250-graphite-1.jpg', slug: 'mk250', name: 'mk250-graphite-1.jpg' },
    // Addons
    { file: 'images/addon-ssd.png', slug: null, nameMatch: '%sandisk%', name: 'addon-ssd.png' },
    { file: 'images/addon-stand.png', slug: null, nameMatch: '%laptop stand%', name: 'addon-stand.png' },
];

async function main() {
    const results = [];

    for (const item of imageMap) {
        const filePath = path.join(__dirname, '..', item.file);
        if (!fs.existsSync(filePath)) {
            console.log(`⏭  Skipping ${item.file} (not found)`);
            continue;
        }

        const buffer = fs.readFileSync(filePath);
        const ext = item.name.split('.').pop().toLowerCase();
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const storagePath = `products/${item.name}`;

        console.log(`📤 Uploading ${item.file} → ${storagePath}...`);

        const { data, error } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, buffer, { contentType, upsert: true });

        if (error) {
            console.error(`   ❌ Error: ${error.message}`);
            continue;
        }

        const { data: urlData } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(storagePath);

        const publicUrl = urlData.publicUrl;
        console.log(`   ✅ ${publicUrl}`);
        results.push({ ...item, url: publicUrl });
    }

    // Update database
    console.log('\n📝 Updating product images in database...\n');
    for (const item of results) {
        let query;
        if (item.slug) {
            query = supabase.from('products')
                .update({ images: [item.url] })
                .eq('slug', item.slug);
        } else if (item.nameMatch) {
            query = supabase.from('products')
                .update({ images: [item.url] })
                .ilike('name', item.nameMatch);
        }

        if (query) {
            const { error } = await query;
            if (error) {
                console.error(`   ❌ DB update for ${item.name}: ${error.message}`);
            } else {
                console.log(`   ✅ Updated ${item.slug || item.nameMatch}`);
            }
        }
    }

    console.log('\n🎉 Done! All images uploaded to Supabase Storage.');
}

main().catch(console.error);

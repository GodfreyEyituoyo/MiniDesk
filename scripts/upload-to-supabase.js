require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET_NAME = 'product-images';
const IMAGES_DIR = path.join(__dirname, '../images');

async function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getFiles(filePath, fileList);
        } else if (filePath.endsWith('.webp')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

async function uploadImages() {
    console.log('Checking bucket...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) throw bucketError;

    if (!buckets.find(b => b.name === BUCKET_NAME)) {
        console.log(`Creating bucket ${BUCKET_NAME}...`);
        const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, { public: true });
        if (createError) throw createError;
    }

    const files = await getFiles(IMAGES_DIR);
    console.log(`Found ${files.length} WebP images to upload. Uploading...`);

    for (const filePath of files) {
        // preserve folder structure within images/
        const relativePath = path.relative(IMAGES_DIR, filePath);
        // replace windows separators. Not strictly needed for mac, but good practice
        const storagePath = relativePath.split(path.sep).join('/');

        process.stdout.write(`Uploading ${storagePath}... `);
        const fileBuffer = fs.readFileSync(filePath);

        const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, fileBuffer, {
            contentType: 'image/webp',
            upsert: true
        });

        if (error) {
            console.log(`FAILED: ${error.message}`);
        } else {
            console.log('OK');
        }
    }

    console.log('\nAll done! Images are now in Supabase Storage.');
    console.log(`Public URL base: ${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/`);
}

uploadImages().catch(console.error);

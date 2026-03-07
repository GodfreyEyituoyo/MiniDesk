const { getSupabaseClient, jsonResponse, handleCors, verifyAdmin } = require('./utils');

/**
 * Upload API — Handles image uploads to Supabase Storage
 *
 * POST /api/upload — Upload an image (admin only)
 *   body: { file: base64string, filename: string, bucket: string }
 *   returns: { url: publicUrl }
 *
 * DELETE /api/upload — Delete an image (admin only)
 *   body: { path: string, bucket: string }
 */
exports.handler = async (event) => {
    const cors = handleCors(event);
    if (cors) return cors;

    const admin = await verifyAdmin(event);
    if (!admin) return jsonResponse(401, { error: 'Unauthorized' });

    const supabase = getSupabaseClient();

    try {
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { file, filename, bucket = 'product-images' } = body;

            if (!file || !filename) {
                return jsonResponse(400, { error: 'file (base64) and filename are required' });
            }

            // Decode base64
            const base64Data = file.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            // Determine content type
            const ext = filename.split('.').pop().toLowerCase();
            const contentTypes = {
                jpg: 'image/jpeg', jpeg: 'image/jpeg',
                png: 'image/png', webp: 'image/webp',
                gif: 'image/gif', svg: 'image/svg+xml'
            };
            const contentType = contentTypes[ext] || 'image/jpeg';

            // Generate unique path: product-images/timestamp-filename
            const path = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(path, buffer, {
                    contentType,
                    upsert: false
                });

            if (error) {
                console.error('Upload error:', error);
                return jsonResponse(500, { error: 'Failed to upload image: ' + error.message });
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(path);

            return jsonResponse(200, {
                success: true,
                url: urlData.publicUrl,
                path: path
            });
        }

        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body);
            const { path, bucket = 'product-images' } = body;

            if (!path) {
                return jsonResponse(400, { error: 'path is required' });
            }

            const { error } = await supabase.storage
                .from(bucket)
                .remove([path]);

            if (error) {
                console.error('Delete error:', error);
                return jsonResponse(500, { error: 'Failed to delete image' });
            }

            return jsonResponse(200, { success: true });
        }

        return jsonResponse(405, { error: 'Method not allowed' });

    } catch (err) {
        console.error('Upload handler error:', err);
        return jsonResponse(500, { error: 'Internal server error' });
    }
};

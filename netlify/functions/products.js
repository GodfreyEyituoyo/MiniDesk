const { getSupabaseClient, jsonResponse, handleCors, verifyAdmin } = require('./utils');

/**
 * Products API
 *
 * GET    /api/products              — List all active products (public)
 * GET    /api/products?all=true     — List ALL products including inactive (admin)
 * POST   /api/products              — Create a product (admin)
 * PATCH  /api/products?id=xxx       — Update a product (admin)
 * DELETE /api/products?id=xxx       — Soft-delete (deactivate) a product (admin)
 */
exports.handler = async (event) => {
    const cors = handleCors(event);
    if (cors) return cors;

    const supabase = getSupabaseClient();
    const params = event.queryStringParameters || {};

    try {
        // ── GET: List products ──
        if (event.httpMethod === 'GET') {
            let query = supabase
                .from('products')
                .select('*')
                .order('sort_order', { ascending: true });

            // By default, only return active products (public)
            // Admin can pass ?all=true to see inactive ones too
            if (params.all === 'true') {
                const admin = await verifyAdmin(event);
                if (!admin) {
                    return jsonResponse(401, { error: 'Unauthorized' });
                }
            } else {
                query = query.eq('is_active', true);
            }

            // Optional category filter
            if (params.category) {
                query = query.eq('category', params.category);
            }

            const { data: products, error } = await query;

            if (error) {
                console.error('Products fetch error:', error);
                return jsonResponse(500, { error: 'Failed to fetch products' });
            }

            // Group by category for convenience
            const grouped = {
                bundles: products.filter(p => p.category === 'bundle'),
                monitors: products.filter(p => p.category === 'monitor'),
                keyboards: products.filter(p => p.category === 'keyboard'),
                addons: products.filter(p => p.category === 'addon' && p.slug !== 'included'),
                included: products.find(p => p.slug === 'included') || null
            };

            return jsonResponse(200, { products, grouped });
        }

        // ── All write operations require admin ──
        const admin = await verifyAdmin(event);
        if (!admin) {
            return jsonResponse(401, { error: 'Unauthorized — admin login required' });
        }

        // ── POST: Create product ──
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);

            const required = ['category', 'slug', 'name', 'price'];
            for (const field of required) {
                if (body[field] === undefined || body[field] === null) {
                    return jsonResponse(400, { error: `Missing required field: ${field}` });
                }
            }

            const insertData = {
                category: body.category,
                slug: body.slug,
                name: body.name,
                description: body.description || '',
                emoji: body.emoji || '',
                image: body.image || '',
                tag: body.tag || '',
                tag_class: body.tag_class || '',
                specs: body.specs || [],
                price: parseInt(body.price),
                tier: body.tier || null,
                requires_tier: body.requires_tier || [],
                role: body.role || 'static',
                bundle_ids: body.bundle_ids || [],
                discount_percent: parseInt(body.discount_percent) || 0,
                is_active: body.is_active !== false,
                sort_order: body.sort_order || 0
            };

            // Phase 2 fields
            if (body.category_id) insertData.category_id = body.category_id;
            if (body.images) insertData.images = body.images;
            if (body.color_options) insertData.color_options = body.color_options;
            if (body.is_addon !== undefined) insertData.is_addon = body.is_addon;

            const { data: product, error } = await supabase
                .from('products')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                console.error('Product create error:', error);
                if (error.code === '23505') {
                    return jsonResponse(400, { error: 'A product with that slug already exists' });
                }
                return jsonResponse(500, { error: 'Failed to create product' });
            }

            return jsonResponse(201, { success: true, product });
        }

        // ── PATCH: Update product ──
        if (event.httpMethod === 'PATCH') {
            if (!params.id) {
                return jsonResponse(400, { error: 'Product ID required' });
            }

            const body = JSON.parse(event.body);
            const allowedFields = [
                'name', 'description', 'emoji', 'image', 'tag', 'tag_class',
                'specs', 'price', 'tier', 'requires_tier', 'is_active', 'sort_order', 'slug',
                'role', 'bundle_ids', 'discount_percent',
                'category_id', 'images', 'color_options', 'is_addon'
            ];

            const updates = {};
            for (const field of allowedFields) {
                if (body[field] !== undefined) {
                    if (['price', 'discount_percent', 'sort_order'].includes(field)) {
                        updates[field] = parseInt(body[field]) || 0;
                    } else {
                        updates[field] = body[field];
                    }
                }
            }

            if (Object.keys(updates).length === 0) {
                return jsonResponse(400, { error: 'No valid fields to update' });
            }

            const { data: product, error } = await supabase
                .from('products')
                .update(updates)
                .eq('id', params.id)
                .select()
                .single();

            if (error) {
                console.error('Product update error:', error);
                return jsonResponse(500, { error: 'Failed to update product' });
            }

            return jsonResponse(200, { success: true, product });
        }

        // ── DELETE: Soft-delete (deactivate) ──
        if (event.httpMethod === 'DELETE') {
            if (!params.id) {
                return jsonResponse(400, { error: 'Product ID required' });
            }

            const { data: product, error } = await supabase
                .from('products')
                .update({ is_active: false })
                .eq('id', params.id)
                .select()
                .single();

            if (error) {
                console.error('Product deactivate error:', error);
                return jsonResponse(500, { error: 'Failed to deactivate product' });
            }

            return jsonResponse(200, { success: true, product });
        }

        return jsonResponse(405, { error: 'Method not allowed' });

    } catch (err) {
        console.error('Products handler error:', err);
        return jsonResponse(500, { error: 'Internal server error' });
    }
};

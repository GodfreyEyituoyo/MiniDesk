const { getSupabaseClient, jsonResponse, handleCors, verifyAdmin } = require('./utils');

/**
 * Categories API
 *
 * GET    /api/categories              — List all categories (public)
 * POST   /api/categories              — Create a category (admin)
 * PATCH  /api/categories?id=xxx       — Update a category (admin)
 * DELETE /api/categories?id=xxx       — Delete a category (admin)
 */
exports.handler = async (event) => {
    const cors = handleCors(event);
    if (cors) return cors;

    const supabase = getSupabaseClient();
    const params = event.queryStringParameters || {};

    try {
        // ── GET: List categories ──
        if (event.httpMethod === 'GET') {
            const { data: categories, error } = await supabase
                .from('categories')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Categories fetch error:', error);
                return jsonResponse(500, { error: 'Failed to fetch categories' });
            }

            // Get product counts per category
            const { data: products } = await supabase
                .from('products')
                .select('category_id')
                .eq('is_active', true);

            const counts = {};
            (products || []).forEach(p => {
                if (p.category_id) {
                    counts[p.category_id] = (counts[p.category_id] || 0) + 1;
                }
            });

            const result = (categories || []).map(c => ({
                ...c,
                product_count: counts[c.id] || 0
            }));

            return jsonResponse(200, { categories: result });
        }

        // ── All write operations require admin ──
        const admin = await verifyAdmin(event);
        if (!admin) {
            return jsonResponse(401, { error: 'Unauthorized' });
        }

        // ── POST: Create category ──
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);

            if (!body.name || !body.slug) {
                return jsonResponse(400, { error: 'Name and slug are required' });
            }

            const { data: category, error } = await supabase
                .from('categories')
                .insert({
                    name: body.name,
                    slug: body.slug,
                    description: body.description || '',
                    sort_order: body.sort_order || 0
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    return jsonResponse(400, { error: 'A category with that slug already exists' });
                }
                return jsonResponse(500, { error: 'Failed to create category' });
            }

            return jsonResponse(201, { success: true, category });
        }

        // ── PATCH: Update category ──
        if (event.httpMethod === 'PATCH') {
            if (!params.id) {
                return jsonResponse(400, { error: 'Category ID required' });
            }

            const body = JSON.parse(event.body);
            const updates = {};
            ['name', 'slug', 'description', 'sort_order'].forEach(f => {
                if (body[f] !== undefined) updates[f] = body[f];
            });

            if (Object.keys(updates).length === 0) {
                return jsonResponse(400, { error: 'No valid fields to update' });
            }

            const { data: category, error } = await supabase
                .from('categories')
                .update(updates)
                .eq('id', params.id)
                .select()
                .single();

            if (error) {
                return jsonResponse(500, { error: 'Failed to update category' });
            }

            return jsonResponse(200, { success: true, category });
        }

        // ── DELETE: Delete category ──
        if (event.httpMethod === 'DELETE') {
            if (!params.id) {
                return jsonResponse(400, { error: 'Category ID required' });
            }

            // Check for products using this category
            const { data: products } = await supabase
                .from('products')
                .select('id')
                .eq('category_id', params.id)
                .limit(1);

            if (products && products.length > 0) {
                return jsonResponse(400, { error: 'Cannot delete category that has products. Move or delete them first.' });
            }

            const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', params.id);

            if (error) {
                return jsonResponse(500, { error: 'Failed to delete category' });
            }

            return jsonResponse(200, { success: true });
        }

        return jsonResponse(405, { error: 'Method not allowed' });

    } catch (err) {
        console.error('Categories handler error:', err);
        return jsonResponse(500, { error: 'Internal server error' });
    }
};

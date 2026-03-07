const { getSupabaseClient, jsonResponse, handleCors, verifyAdmin } = require('./utils');

/**
 * Bundles API
 *
 * GET    /api/bundles                  — List all active bundles with their categories + products (public)
 * GET    /api/bundles?slug=xxx         — Get a single bundle by slug with full details
 * POST   /api/bundles                  — Create a bundle (admin)
 * PATCH  /api/bundles?id=xxx           — Update a bundle (admin)
 * DELETE /api/bundles?id=xxx           — Soft-delete a bundle (admin)
 * POST   /api/bundles?action=categories&id=xxx — Set bundle categories (admin)
 */
exports.handler = async (event) => {
    const cors = handleCors(event);
    if (cors) return cors;

    const supabase = getSupabaseClient();
    const params = event.queryStringParameters || {};

    try {
        // ── GET: List bundles with categories and products ──
        if (event.httpMethod === 'GET') {
            let bundleQuery = supabase
                .from('bundles')
                .select('*')
                .order('sort_order', { ascending: true });

            if (params.all !== 'true') {
                bundleQuery = bundleQuery.eq('is_active', true);
            } else {
                const admin = await verifyAdmin(event);
                if (!admin) return jsonResponse(401, { error: 'Unauthorized' });
            }

            // Single bundle by slug
            if (params.slug) {
                bundleQuery = bundleQuery.eq('slug', params.slug).single();
            }

            const { data: bundlesRaw, error: bundleError } = await bundleQuery;
            if (bundleError) {
                console.error('Bundles fetch error:', bundleError);
                return jsonResponse(500, { error: 'Failed to fetch bundles' });
            }

            const bundlesList = params.slug ? [bundlesRaw] : (bundlesRaw || []);

            // Fetch bundle_categories + category details for each
            const bundleIds = bundlesList.map(b => b.id);
            const { data: bundleCats } = await supabase
                .from('bundle_categories')
                .select('*, categories(*), products(*)')
                .in('bundle_id', bundleIds)
                .order('sort_order', { ascending: true });

            // Fetch all active products
            const { data: allProducts } = await supabase
                .from('products')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });

            // Assemble full bundle objects
            const bundles = bundlesList.map(bundle => {
                const entries = (bundleCats || []).filter(bc => bc.bundle_id === bundle.id);

                const staticItems = [];      // Individual products or single-product categories
                const configurableCategories = [];  // Full categories (customer picks)
                let basePrice = 0;

                entries.forEach(bc => {
                    if (bc.product_id && bc.products) {
                        // Individual product inclusion (always static)
                        staticItems.push({
                            type: 'product',
                            product: bc.products,
                            sort_order: bc.sort_order
                        });
                        basePrice += bc.products.price || 0;
                    } else if (bc.category_id && bc.categories) {
                        // Full category reference (configurable)
                        const catProducts = (allProducts || []).filter(p => p.category_id === bc.category_id);
                        configurableCategories.push({
                            ...bc.categories,
                            role: 'configurable',
                            sort_order: bc.sort_order,
                            products: catProducts,
                            product_count: catProducts.length
                        });
                    }
                });

                // Price range = base + min/max of each configurable category
                let minConfig = 0, maxConfig = 0;
                configurableCategories.forEach(cat => {
                    if (cat.products.length > 0) {
                        minConfig += Math.min(...cat.products.map(p => p.price));
                        maxConfig += Math.max(...cat.products.map(p => p.price));
                    }
                });

                return {
                    ...bundle,
                    static_items: staticItems,
                    configurable_categories: configurableCategories,
                    base_price: basePrice,
                    price_range: {
                        low: basePrice + minConfig,
                        high: basePrice + maxConfig
                    }
                };
            });

            // Get add-on products (is_addon = true, not in any bundle)
            const addons = (allProducts || []).filter(p => p.is_addon);

            if (params.slug) {
                return jsonResponse(200, { bundle: bundles[0], addons });
            }

            return jsonResponse(200, { bundles, addons });
        }

        // ── All write operations require admin ──
        const admin = await verifyAdmin(event);
        if (!admin) return jsonResponse(401, { error: 'Unauthorized' });

        // ── POST: Create bundle or set bundle categories ──
        if (event.httpMethod === 'POST') {
            // Set categories for a bundle
            if (params.action === 'categories' && params.id) {
                const body = JSON.parse(event.body);
                const { items } = body; // [{ category_id?, product_id?, role, sort_order }]

                if (!Array.isArray(items)) {
                    return jsonResponse(400, { error: 'items must be an array' });
                }

                // Delete existing bundle_categories
                await supabase
                    .from('bundle_categories')
                    .delete()
                    .eq('bundle_id', params.id);

                // Insert new ones
                if (items.length > 0) {
                    const rows = items.map((item, i) => ({
                        bundle_id: params.id,
                        category_id: item.category_id || null,
                        product_id: item.product_id || null,
                        role: item.role || 'static',
                        sort_order: item.sort_order !== undefined ? item.sort_order : i
                    }));

                    const { error } = await supabase
                        .from('bundle_categories')
                        .insert(rows);

                    if (error) {
                        console.error('Bundle categories insert error:', error);
                        return jsonResponse(500, { error: 'Failed to set bundle categories' });
                    }
                }

                return jsonResponse(200, { success: true });
            }

            // Create a new bundle
            const body = JSON.parse(event.body);
            if (!body.name || !body.slug) {
                return jsonResponse(400, { error: 'Name and slug are required' });
            }

            const { data: bundle, error } = await supabase
                .from('bundles')
                .insert({
                    name: body.name,
                    slug: body.slug,
                    description: body.description || '',
                    discount_percent: parseInt(body.discount_percent) || 0,
                    tag: body.tag || '',
                    is_active: body.is_active !== false,
                    sort_order: body.sort_order || 0
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    return jsonResponse(400, { error: 'A bundle with that slug already exists' });
                }
                return jsonResponse(500, { error: 'Failed to create bundle' });
            }

            return jsonResponse(201, { success: true, bundle });
        }

        // ── PATCH: Update bundle ──
        if (event.httpMethod === 'PATCH') {
            if (!params.id) return jsonResponse(400, { error: 'Bundle ID required' });

            const body = JSON.parse(event.body);
            const updates = {};
            ['name', 'slug', 'description', 'discount_percent', 'tag', 'is_active', 'sort_order'].forEach(f => {
                if (body[f] !== undefined) {
                    updates[f] = ['discount_percent', 'sort_order'].includes(f) ? parseInt(body[f]) || 0 : body[f];
                }
            });

            if (Object.keys(updates).length === 0) {
                return jsonResponse(400, { error: 'No valid fields to update' });
            }

            const { data: bundle, error } = await supabase
                .from('bundles')
                .update(updates)
                .eq('id', params.id)
                .select()
                .single();

            if (error) return jsonResponse(500, { error: 'Failed to update bundle' });
            return jsonResponse(200, { success: true, bundle });
        }

        // ── DELETE: Soft-delete bundle ──
        if (event.httpMethod === 'DELETE') {
            if (!params.id) return jsonResponse(400, { error: 'Bundle ID required' });

            const { data: bundle, error } = await supabase
                .from('bundles')
                .update({ is_active: false })
                .eq('id', params.id)
                .select()
                .single();

            if (error) return jsonResponse(500, { error: 'Failed to deactivate bundle' });
            return jsonResponse(200, { success: true, bundle });
        }

        return jsonResponse(405, { error: 'Method not allowed' });

    } catch (err) {
        console.error('Bundles handler error:', err);
        return jsonResponse(500, { error: 'Internal server error' });
    }
};

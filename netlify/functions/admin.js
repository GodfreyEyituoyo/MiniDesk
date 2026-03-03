const { getSupabaseClient, jsonResponse, handleCors, verifyAdmin } = require('./utils');

/**
 * Admin API (authenticated endpoints)
 *
 * PATCH /api/admin?id=xxx           — Update order status
 * GET   /api/admin?action=stats     — Get dashboard stats
 * DELETE /api/admin?id=xxx          — Cancel an order
 */
exports.handler = async (event) => {
    const cors = handleCors(event);
    if (cors) return cors;

    // All admin routes require auth
    const admin = await verifyAdmin(event);
    if (!admin) {
        return jsonResponse(401, { error: 'Unauthorized — admin login required' });
    }

    const supabase = getSupabaseClient();
    const params = event.queryStringParameters || {};

    try {
        // ── PATCH: Update order ──
        if (event.httpMethod === 'PATCH') {
            if (!params.id) {
                return jsonResponse(400, { error: 'Order ID required' });
            }

            const body = JSON.parse(event.body);
            const allowedFields = ['order_status', 'payment_status'];
            const updates = {};

            for (const field of allowedFields) {
                if (body[field] !== undefined) {
                    updates[field] = body[field];
                }
            }

            if (Object.keys(updates).length === 0) {
                return jsonResponse(400, { error: 'No valid fields to update' });
            }

            const { data: order, error } = await supabase
                .from('orders')
                .update(updates)
                .eq('id', params.id)
                .select()
                .single();

            if (error) {
                console.error('Order update failed:', error);
                return jsonResponse(500, { error: 'Failed to update order' });
            }

            // Log the action
            await supabase.from('admin_activity_log').insert({
                admin_email: admin.email,
                action: 'order_update',
                order_id: params.id,
                details: { updates, previous: body._previous || {} }
            });

            // Send status update email to customer if order_status changed  
            if (updates.order_status) {
                try {
                    await sendStatusUpdateEmail(order, updates.order_status);
                } catch (emailErr) {
                    console.error('Status email failed (non-blocking):', emailErr);
                }
            }

            return jsonResponse(200, { success: true, order });
        }

        // ── GET: Dashboard stats ──
        if (event.httpMethod === 'GET') {
            if (params.action === 'stats') {
                // Total orders
                const { count: totalOrders } = await supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true });

                // Orders by status
                const { data: statusCounts } = await supabase
                    .from('orders')
                    .select('order_status');

                const statusMap = {};
                (statusCounts || []).forEach(o => {
                    statusMap[o.order_status] = (statusMap[o.order_status] || 0) + 1;
                });

                // Revenue (paid orders only)
                const { data: paidOrders } = await supabase
                    .from('orders')
                    .select('total_price')
                    .eq('payment_status', 'paid');

                const totalRevenue = (paidOrders || []).reduce((sum, o) => sum + o.total_price, 0);

                // Recent orders
                const { data: recentOrders } = await supabase
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(10);

                return jsonResponse(200, {
                    stats: {
                        total_orders: totalOrders || 0,
                        total_revenue: totalRevenue,
                        orders_by_status: statusMap,
                        pending_orders: statusMap.pending || 0
                    },
                    recent_orders: recentOrders || []
                });
            }

            return jsonResponse(400, { error: 'Invalid action' });
        }

        // ── DELETE: Cancel order ──
        if (event.httpMethod === 'DELETE') {
            if (!params.id) {
                return jsonResponse(400, { error: 'Order ID required' });
            }

            const { data: order, error } = await supabase
                .from('orders')
                .update({ order_status: 'cancelled' })
                .eq('id', params.id)
                .select()
                .single();

            if (error) {
                console.error('Order cancellation failed:', error);
                return jsonResponse(500, { error: 'Failed to cancel order' });
            }

            // Log the action
            await supabase.from('admin_activity_log').insert({
                admin_email: admin.email,
                action: 'order_cancelled',
                order_id: params.id,
                details: {}
            });

            return jsonResponse(200, { success: true, order });
        }

        return jsonResponse(405, { error: 'Method not allowed' });

    } catch (err) {
        console.error('Admin handler error:', err);
        return jsonResponse(500, { error: 'Internal server error' });
    }
};

/**
 * Send status update email to customer
 */
async function sendStatusUpdateEmail(order, newStatus) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const { Resend } = require('resend');
    const resend = new Resend(apiKey);

    const statusMessages = {
        confirmed: 'Your order has been confirmed! We\'re preparing your bundle.',
        processing: 'Great news — your order is being assembled.',
        shipped: 'Your MiniDesk bundle is on its way! 🚚',
        delivered: 'Your bundle has been delivered. Enjoy your new workstation! 🎉',
        cancelled: 'Your order has been cancelled. If this was unexpected, please contact us.'
    };

    const message = statusMessages[newStatus] || `Your order status has been updated to: ${newStatus}`;

    await resend.emails.send({
        from: 'MiniDesk <orders@minidesk.ng>',
        to: order.customer_email,
        subject: `Order ${order.order_number} — ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h1 style="font-size: 24px; margin-bottom: 8px;">Order Update</h1>
                <p style="color: #666; margin-bottom: 16px;">Hi ${order.customer_name},</p>
                <p>${message}</p>
                <div style="background: #f5f5f7; border-radius: 12px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Order:</strong> ${order.order_number}</p>
                    <p style="margin: 8px 0 0;"><strong>Status:</strong> ${newStatus}</p>
                </div>
                <p style="font-size: 13px; color: #999; margin-top: 24px;">— The MiniDesk Team</p>
            </div>
        `
    });
}

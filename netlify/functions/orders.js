const { getSupabaseClient, jsonResponse, handleCors, verifyAdmin, calculateTotal } = require('./utils');

/**
 * Orders API
 * 
 * POST /api/orders          — Create a new order (public)
 * GET  /api/orders          — List all orders (admin only)
 * GET  /api/orders?id=xxx   — Get order by ID (public, for tracking)
 */
exports.handler = async (event) => {
    // CORS
    const cors = handleCors(event);
    if (cors) return cors;

    const supabase = getSupabaseClient();

    try {
        // ── POST: Create order ──
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);

            // Validate required fields
            const required = ['customer_name', 'customer_email', 'customer_phone', 'delivery_address', 'bundle', 'monitor', 'keyboard'];
            for (const field of required) {
                if (!body[field]) {
                    return jsonResponse(400, { error: `Missing required field: ${field}` });
                }
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(body.customer_email)) {
                return jsonResponse(400, { error: 'Invalid email format' });
            }

            // Server-side price calculation from DB (never trust the frontend)
            let total;
            try {
                // Bundle base already includes all static items (Mac Mini, dongle, mousepad, etc.)
                // Total = bundle base + selected monitor + selected keyboard + any add-ons
                const slugs = [body.bundle, body.monitor, body.keyboard, ...(body.addons || [])];
                const { data: products, error: priceError } = await supabase
                    .from('products')
                    .select('slug, price, is_active')
                    .in('slug', slugs);

                if (priceError || !products) {
                    throw new Error('Failed to fetch product prices');
                }

                const priceMap = {};
                for (const p of products) {
                    if (!p.is_active) {
                        throw new Error(`Product "${p.slug}" is no longer available`);
                    }
                    priceMap[p.slug] = p.price;
                }

                // Validate all selected products exist
                for (const slug of slugs) {
                    if (priceMap[slug] === undefined) {
                        throw new Error(`Unknown product: ${slug}`);
                    }
                }

                total = slugs.reduce((sum, slug) => sum + priceMap[slug], 0);
            } catch (err) {
                return jsonResponse(400, { error: err.message });
            }

            // Generate order number
            const { data: orderNumData, error: orderNumError } = await supabase.rpc('generate_order_number');
            if (orderNumError) {
                console.error('Order number generation failed:', orderNumError);
                return jsonResponse(500, { error: 'Failed to generate order number' });
            }

            // Insert order
            const { data: order, error: insertError } = await supabase
                .from('orders')
                .insert({
                    order_number: orderNumData,
                    customer_name: body.customer_name,
                    customer_email: body.customer_email,
                    customer_phone: body.customer_phone,
                    delivery_address: body.delivery_address,
                    bundle: body.bundle,
                    monitor: body.monitor,
                    keyboard: body.keyboard,
                    addons: body.addons || [],
                    special_requests: body.special_requests || '',
                    total_price: total,
                    payment_status: 'pending',
                    order_status: 'pending'
                })
                .select()
                .single();

            if (insertError) {
                console.error('Order insert failed:', insertError);
                return jsonResponse(500, { error: 'Failed to create order' });
            }

            // Send email notifications (fire-and-forget — don't block the response)
            sendOrderEmails(order).catch(err => console.error('Email failed:', err.message));

            return jsonResponse(201, {
                success: true,
                order: {
                    id: order.id,
                    order_number: order.order_number,
                    total_price: order.total_price,
                    payment_status: order.payment_status,
                    order_status: order.order_status
                }
            });
        }

        // ── GET: List orders or get by ID ──
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};

            // Public: Get single order by ID (for customer tracking)
            if (params.id) {
                const { data: order, error } = await supabase
                    .from('orders')
                    .select('id, order_number, bundle, monitor, keyboard, addons, total_price, payment_status, order_status, created_at')
                    .eq('id', params.id)
                    .single();

                if (error || !order) {
                    return jsonResponse(404, { error: 'Order not found' });
                }

                return jsonResponse(200, { order });
            }

            // Admin: List all orders
            const admin = await verifyAdmin(event);
            if (!admin) {
                return jsonResponse(401, { error: 'Unauthorized — admin login required' });
            }

            let query = supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            // Optional filters
            if (params.status) {
                query = query.eq('order_status', params.status);
            }
            if (params.payment) {
                query = query.eq('payment_status', params.payment);
            }
            if (params.limit) {
                query = query.limit(parseInt(params.limit));
            }

            const { data: orders, error } = await query;

            if (error) {
                console.error('Orders fetch failed:', error);
                return jsonResponse(500, { error: 'Failed to fetch orders' });
            }

            return jsonResponse(200, { orders, count: orders.length });
        }

        return jsonResponse(405, { error: 'Method not allowed' });

    } catch (err) {
        console.error('Orders handler error:', err);
        return jsonResponse(500, { error: 'Internal server error' });
    }
};

async function sendOrderEmails(order) {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
        console.warn('SMTP credentials not set — skipping email');
        return;
    }

    const nodemailer = require('nodemailer');
    const smtpPort = parseInt(process.env.SMTP_PORT || '465');
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
    });

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean);

    // Fetch product names from DB
    const { getSupabaseClient } = require('./utils');
    const supabase = getSupabaseClient();
    const slugs = [order.bundle, order.monitor, order.keyboard, ...(order.addons || [])];
    const { data: products } = await supabase.from('products').select('slug, name').in('slug', slugs);
    const nameMap = {};
    (products || []).forEach(p => nameMap[p.slug] = p.name);

    const bundleName = nameMap[order.bundle] || order.bundle;
    const monitorName = nameMap[order.monitor] || order.monitor;
    const keyboardName = nameMap[order.keyboard] || order.keyboard;
    const addonsText = order.addons && order.addons.length > 0
        ? order.addons.map(a => nameMap[a] || a).join(', ')
        : 'None';

    const fromAddress = `MiniDesk <${smtpUser}>`;

    // Customer confirmation email
    await transporter.sendMail({
        from: fromAddress,
        to: order.customer_email,
        subject: `Order Confirmed — ${order.order_number}`,
        html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h1 style="font-size: 24px; margin-bottom: 8px;">Thank you, ${order.customer_name}! 🎉</h1>
                <p style="color: #666; margin-bottom: 24px;">Your MiniDesk order has been received. We'll reach out shortly with next steps.</p>
                
                <div style="background: #f5f5f7; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
                    <h2 style="font-size: 16px; margin-bottom: 16px;">Order #${order.order_number}</h2>
                    <table style="width: 100%; font-size: 14px;">
                        <tr><td style="padding: 6px 0; color: #666;">Bundle</td><td style="text-align: right;">${bundleName}</td></tr>
                        <tr><td style="padding: 6px 0; color: #666;">Monitor</td><td style="text-align: right;">${monitorName}</td></tr>
                        <tr><td style="padding: 6px 0; color: #666;">Keyboard</td><td style="text-align: right;">${keyboardName}</td></tr>
                        <tr><td style="padding: 6px 0; color: #666;">Includes</td><td style="text-align: right;">Mouse + USB-C Dongle</td></tr>
                        <tr><td style="padding: 6px 0; color: #666;">Add-ons</td><td style="text-align: right;">${addonsText}</td></tr>
                    </table>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 16px 0;">
                    <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 18px;">
                        <span>Total</span>
                        <span style="color: #0071e3;">₦${order.total_price.toLocaleString()}</span>
                    </div>
                </div>
                
                <p style="font-size: 13px; color: #999;">Delivery: ${order.delivery_address}</p>
                <p style="font-size: 13px; color: #999; margin-top: 24px;">— The MiniDesk Team</p>
            </div>
        `
    });

    // Admin notification email
    if (adminEmails.length > 0) {
        await transporter.sendMail({
            from: fromAddress,
            to: adminEmails.join(','),
            subject: `🛒 New Order: ${order.order_number} — ₦${order.total_price.toLocaleString()}`,
            html: `
                <div style="font-family: -apple-system, sans-serif; padding: 24px;">
                    <h2>New MiniDesk Order</h2>
                    <p><strong>Order:</strong> ${order.order_number}</p>
                    <p><strong>Customer:</strong> ${order.customer_name} (${order.customer_email})</p>
                    <p><strong>Phone:</strong> ${order.customer_phone}</p>
                    <p><strong>Address:</strong> ${order.delivery_address}</p>
                    <p><strong>Bundle:</strong> ${bundleName}</p>
                    <p><strong>Monitor:</strong> ${monitorName}</p>
                    <p><strong>Keyboard:</strong> ${keyboardName}</p>
                    <p><strong>Add-ons:</strong> ${addonsText}</p>
                    <p><strong>Special Requests:</strong> ${order.special_requests || 'None'}</p>
                    <h3 style="color: #0071e3;">Total: ₦${order.total_price.toLocaleString()}</h3>
                </div>
            `
        });
    }
}

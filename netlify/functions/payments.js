const { getSupabaseClient, jsonResponse, handleCors, PRODUCT_DATA } = require('./utils');
const crypto = require('crypto');

/**
 * Payments API
 *
 * POST /api/payments   body: { action: 'initialize', order_id, gateway }
 * POST /api/payments   body: { action: 'verify', reference, gateway }
 * POST /api/payments   (webhook from Paystack/Flutterwave)
 */
exports.handler = async (event) => {
    const cors = handleCors(event);
    if (cors) return cors;

    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    const supabase = getSupabaseClient();

    try {
        // Check if this is a webhook (has Paystack or Flutterwave signature)
        if (event.headers['x-paystack-signature']) {
            return handlePaystackWebhook(event, supabase);
        }
        if (event.headers['verif-hash']) {
            return handleFlutterwaveWebhook(event, supabase);
        }

        const body = JSON.parse(event.body);

        switch (body.action) {
            case 'initialize':
                return initializePayment(body, supabase);
            case 'verify':
                return verifyPayment(body, supabase);
            default:
                return jsonResponse(400, { error: 'Invalid action. Use: initialize or verify' });
        }

    } catch (err) {
        console.error('Payments handler error:', err);
        return jsonResponse(500, { error: 'Internal server error' });
    }
};

/**
 * Initialize a payment session
 */
async function initializePayment({ order_id, gateway = 'paystack' }, supabase) {
    if (!order_id) {
        return jsonResponse(400, { error: 'order_id required' });
    }

    // Fetch order
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .single();

    if (error || !order) {
        return jsonResponse(404, { error: 'Order not found' });
    }

    if (order.payment_status === 'paid') {
        return jsonResponse(400, { error: 'Order already paid' });
    }

    const siteUrl = process.env.SITE_URL || 'http://localhost:8888';
    const reference = `MD-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    if (gateway === 'paystack') {
        return initializePaystack(order, reference, siteUrl, supabase);
    } else if (gateway === 'flutterwave') {
        return initializeFlutterwave(order, reference, siteUrl, supabase);
    }

    return jsonResponse(400, { error: 'Invalid gateway. Use: paystack or flutterwave' });
}

/**
 * Initialize Paystack transaction
 */
async function initializePaystack(order, reference, siteUrl, supabase) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
        return jsonResponse(500, { error: 'Paystack not configured' });
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${secretKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: order.customer_email,
            amount: order.total_price * 100, // Paystack uses kobo
            reference,
            currency: 'NGN',
            callback_url: `${siteUrl}/order-success.html?reference=${reference}`,
            metadata: {
                order_id: order.id,
                order_number: order.order_number,
                customer_name: order.customer_name
            }
        })
    });

    const result = await response.json();

    if (!result.status) {
        console.error('Paystack init failed:', result);
        return jsonResponse(500, { error: 'Payment initialization failed' });
    }

    // Store payment reference on the order
    await supabase
        .from('orders')
        .update({ payment_reference: reference, payment_gateway: 'paystack' })
        .eq('id', order.id);

    return jsonResponse(200, {
        success: true,
        authorization_url: result.data.authorization_url,
        reference
    });
}

/**
 * Initialize Flutterwave transaction
 */
async function initializeFlutterwave(order, reference, siteUrl, supabase) {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
        return jsonResponse(500, { error: 'Flutterwave not configured' });
    }

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${secretKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            tx_ref: reference,
            amount: order.total_price,
            currency: 'NGN',
            redirect_url: `${siteUrl}/order-success.html?reference=${reference}`,
            customer: {
                email: order.customer_email,
                name: order.customer_name,
                phonenumber: order.customer_phone
            },
            meta: {
                order_id: order.id,
                order_number: order.order_number
            },
            customizations: {
                title: 'MiniDesk',
                description: `Order ${order.order_number}`
            }
        })
    });

    const result = await response.json();

    if (result.status !== 'success') {
        console.error('Flutterwave init failed:', result);
        return jsonResponse(500, { error: 'Payment initialization failed' });
    }

    // Store payment reference
    await supabase
        .from('orders')
        .update({ payment_reference: reference, payment_gateway: 'flutterwave' })
        .eq('id', order.id);

    return jsonResponse(200, {
        success: true,
        authorization_url: result.data.link,
        reference
    });
}

/**
 * Verify payment status
 */
async function verifyPayment({ reference, gateway = 'paystack' }, supabase) {
    if (!reference) {
        return jsonResponse(400, { error: 'Reference required' });
    }

    // Find the order
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_reference', reference)
        .single();

    if (error || !order) {
        return jsonResponse(404, { error: 'Order not found for reference' });
    }

    if (order.payment_status === 'paid') {
        return jsonResponse(200, { success: true, status: 'paid', order_number: order.order_number });
    }

    // Verify with gateway
    let paid = false;

    if (gateway === 'paystack') {
        const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
        });
        const data = await res.json();
        paid = data.data && data.data.status === 'success';
    } else if (gateway === 'flutterwave') {
        const res = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`, {
            headers: { 'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }
        });
        const data = await res.json();
        paid = data.data && data.data.status === 'successful';
    }

    if (paid) {
        await supabase
            .from('orders')
            .update({ payment_status: 'paid', order_status: 'confirmed' })
            .eq('id', order.id);

        return jsonResponse(200, { success: true, status: 'paid', order_number: order.order_number });
    }

    return jsonResponse(200, { success: false, status: 'pending', order_number: order.order_number });
}

/**
 * Handle Paystack webhook
 */
async function handlePaystackWebhook(event, supabase) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const signature = event.headers['x-paystack-signature'];
    const hash = crypto.createHmac('sha512', secret).update(event.body).digest('hex');

    if (hash !== signature) {
        return jsonResponse(400, { error: 'Invalid signature' });
    }

    const { event: eventType, data } = JSON.parse(event.body);

    if (eventType === 'charge.success') {
        const reference = data.reference;

        await supabase
            .from('orders')
            .update({ payment_status: 'paid', order_status: 'confirmed' })
            .eq('payment_reference', reference);

        console.log(`Paystack webhook: order ${reference} marked as paid`);
    }

    return jsonResponse(200, { received: true });
}

/**
 * Handle Flutterwave webhook
 */
async function handleFlutterwaveWebhook(event, supabase) {
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    const signature = event.headers['verif-hash'];

    if (secretHash && signature !== secretHash) {
        return jsonResponse(400, { error: 'Invalid signature' });
    }

    const { data } = JSON.parse(event.body);

    if (data && data.status === 'successful') {
        const reference = data.tx_ref;

        await supabase
            .from('orders')
            .update({ payment_status: 'paid', order_status: 'confirmed' })
            .eq('payment_reference', reference);

        console.log(`Flutterwave webhook: order ${reference} marked as paid`);
    }

    return jsonResponse(200, { received: true });
}

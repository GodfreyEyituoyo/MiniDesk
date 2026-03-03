const { createClient } = require('@supabase/supabase-js');

/**
 * Create a Supabase client for use in Netlify Functions.
 * Uses the service role key for full access (server-side only).
 */
function getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    }

    return createClient(url, key, {
        auth: { persistSession: false }
    });
}

/**
 * Create a Supabase client with the anon key (for public operations).
 */
function getSupabaseAnonClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    }

    return createClient(url, key, {
        auth: { persistSession: false }
    });
}

/**
 * Standard JSON response helper
 */
function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
        },
        body: JSON.stringify(body)
    };
}

/**
 * Handle CORS preflight
 */
function handleCors(event) {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(200, {});
    }
    return null;
}

/**
 * Verify admin authentication via Supabase JWT
 */
async function verifyAdmin(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseAnonClient();

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        return null;
    }

    return user;
}

/**
 * Product data (shared between frontend and backend for validation)
 */
const PRODUCT_DATA = {
    prices: {
        bundle: { basic: 450000, full: 950000 },
        monitor: { entry: 95000, mid: 185000, top: 380000, creator: 280000 },
        keyboard: { windows: 28000, mac: 72000 },
        addon: { stand: 22000, ssd: 68000 },
        included: 45000
    },
    names: {
        bundle: { basic: 'Basic Work Bundle', full: 'Full Workspace Bundle' },
        monitor: {
            entry: 'Dell SE2726HG (27" FHD 240Hz)',
            mid: 'Dell S2725DS (27" QHD 100Hz)',
            top: 'Dell S2725QS (27" 4K UHD)',
            creator: 'ASUS ProArt PA278CV (27" QHD)'
        },
        keyboard: { windows: 'Windows Keyboard', mac: 'Apple Magic Keyboard' },
        addon: { stand: 'Laptop Stand', ssd: 'SanDisk 1TB Extreme Portable SSD' }
    }
};

/**
 * Calculate the correct total for an order (server-side validation)
 */
function calculateTotal(bundle, monitor, keyboard, addons = []) {
    const p = PRODUCT_DATA.prices;
    let total = 0;

    if (!p.bundle[bundle] || !p.monitor[monitor] || !p.keyboard[keyboard]) {
        throw new Error('Invalid product selection');
    }

    total += p.bundle[bundle];
    total += p.monitor[monitor];
    total += p.keyboard[keyboard];
    total += p.included; // mouse + dongle

    for (const addon of addons) {
        if (!p.addon[addon]) {
            throw new Error(`Invalid addon: ${addon}`);
        }
        total += p.addon[addon];
    }

    return total;
}

module.exports = {
    getSupabaseClient,
    getSupabaseAnonClient,
    jsonResponse,
    handleCors,
    verifyAdmin,
    PRODUCT_DATA,
    calculateTotal
};

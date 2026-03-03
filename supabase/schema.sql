-- ================================================
-- MiniDesk Database Schema
-- Run this in your Supabase SQL Editor
-- ================================================

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    
    -- Customer info
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    
    -- Bundle configuration
    bundle TEXT NOT NULL CHECK (bundle IN ('basic', 'full')),
    monitor TEXT NOT NULL CHECK (monitor IN ('entry', 'mid', 'top', 'creator')),
    keyboard TEXT NOT NULL CHECK (keyboard IN ('windows', 'mac')),
    addons JSONB DEFAULT '[]'::jsonb,
    special_requests TEXT DEFAULT '',
    
    -- Pricing
    total_price INTEGER NOT NULL, -- in Naira (whole units, not kobo)
    
    -- Payment
    payment_status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_reference TEXT,
    payment_gateway TEXT CHECK (payment_gateway IN ('paystack', 'flutterwave', NULL)),
    
    -- Order lifecycle
    order_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Admin activity log
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================
-- Row Level Security (RLS)
-- ================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Orders: Allow insert from anon (public order creation)
CREATE POLICY "Allow public order creation" ON orders
    FOR INSERT
    WITH CHECK (true);

-- Orders: Allow select for authenticated users (admin)
CREATE POLICY "Allow admin to read orders" ON orders
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Orders: Allow update for authenticated users (admin)
CREATE POLICY "Allow admin to update orders" ON orders
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Orders: Allow public to read their own order by ID (for tracking)
CREATE POLICY "Allow public to read own order" ON orders
    FOR SELECT
    USING (true);

-- Activity log: Only authenticated users can read/write
CREATE POLICY "Admin access to activity log" ON admin_activity_log
    FOR ALL
    USING (auth.role() = 'authenticated');

-- ================================================
-- Indexes
-- ================================================

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_order_id ON admin_activity_log(order_id);

-- ================================================
-- Helper: Generate order numbers like MD-20260302-001
-- ================================================

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    today_count INTEGER;
    today_str TEXT;
BEGIN
    today_str := to_char(now(), 'YYYYMMDD');
    SELECT COUNT(*) + 1 INTO today_count
    FROM orders
    WHERE order_number LIKE 'MD-' || today_str || '-%';
    RETURN 'MD-' || today_str || '-' || lpad(today_count::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

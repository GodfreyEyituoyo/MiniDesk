-- ================================================
-- MiniDesk Orders Setup
-- Run this in your Supabase SQL Editor
-- ================================================

-- Helper function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old orders table if it exists with wrong constraints
DROP TABLE IF EXISTS admin_activity_log CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Orders table (with correct keyboard slugs)
CREATE TABLE orders (
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
    keyboard TEXT NOT NULL CHECK (keyboard IN ('mk250', 'pop-icon')),
    addons JSONB DEFAULT '[]'::jsonb,
    special_requests TEXT DEFAULT '',
    
    -- Pricing
    total_price INTEGER NOT NULL,
    
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

-- Auto-update timestamp trigger
CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Admin activity log
CREATE TABLE admin_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================
-- Row Level Security
-- ================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Public can create orders
CREATE POLICY "Allow public order creation" ON orders
    FOR INSERT WITH CHECK (true);

-- Public can read orders (for tracking)
CREATE POLICY "Allow public to read orders" ON orders
    FOR SELECT USING (true);

-- Admin can update orders
CREATE POLICY "Allow admin to update orders" ON orders
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Admin activity log
CREATE POLICY "Admin access to activity log" ON admin_activity_log
    FOR ALL USING (auth.role() = 'authenticated');

-- ================================================
-- Indexes
-- ================================================

CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_order_status ON orders(order_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_activity_log_order_id ON admin_activity_log(order_id);

-- ================================================
-- Generate order numbers like MD-20260311-001
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

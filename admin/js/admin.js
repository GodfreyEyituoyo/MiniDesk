// ── AUTH CHECK ──
const token = localStorage.getItem('minidesk_admin_token');
const adminEmail = localStorage.getItem('minidesk_admin_email');

if (!token) {
    window.location.href = '/admin/login.html';
}

// Show admin email in nav
document.getElementById('admin-email').textContent = adminEmail || '';

// Headers for authenticated requests
const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};

// ── STATE ──
let allOrders = [];
let currentFilter = 'all';

// ── PRODUCT NAMES (for display) ──
const names = {
    bundle: { basic: 'Basic Work Bundle', full: 'Full Workspace Bundle' },
    monitor: {
        entry: 'Dell SE2726HG',
        mid: 'Dell S2725DS',
        top: 'Dell S2725QS',
        creator: 'ASUS ProArt PA278CV'
    },
    keyboard: { windows: 'Windows KB', mac: 'Magic KB' }
};

// ── LOAD DASHBOARD ──
async function loadDashboard() {
    try {
        // Load stats
        const statsRes = await fetch('/api/admin?action=stats', { headers: authHeaders });
        if (statsRes.status === 401) {
            localStorage.removeItem('minidesk_admin_token');
            window.location.href = '/admin/login.html';
            return;
        }
        const statsData = await statsRes.json();
        renderStats(statsData.stats);

        // Load all orders
        const ordersRes = await fetch('/api/orders', { headers: authHeaders });
        const ordersData = await ordersRes.json();
        allOrders = ordersData.orders || [];
        renderOrders(allOrders);

        // Remove loader
        const loader = document.getElementById('admin-loader');
        if (loader) loader.remove();

    } catch (err) {
        console.error('Dashboard load error:', err);
        const loader = document.getElementById('admin-loader');
        if (loader) loader.remove();
        document.getElementById('orders-body').innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state">
                    <span class="icon">❌</span>
                    <p>Failed to load dashboard. <a href="#" onclick="loadDashboard()" style="color:var(--accent);">Retry</a></p>
                </div>
            </td></tr>`;
    }
}

// ── RENDER STATS ──
function renderStats(stats) {
    document.getElementById('stat-total').textContent = stats.total_orders;
    document.getElementById('stat-revenue').textContent = '₦' + stats.total_revenue.toLocaleString();
    document.getElementById('stat-pending').textContent = stats.pending_orders;

    // Count paid orders
    const paidCount = stats.orders_by_status
        ? Object.entries(stats.orders_by_status)
            .filter(([k]) => ['confirmed', 'processing', 'shipped', 'delivered'].includes(k))
            .reduce((sum, [, v]) => sum + v, 0)
        : 0;
    document.getElementById('stat-paid').textContent = paidCount;
}

// ── RENDER ORDERS ──
function renderOrders(orders) {
    const tbody = document.getElementById('orders-body');

    if (!orders || orders.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state">
                    <span class="icon">📭</span>
                    <p>No orders found.</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td><strong>${order.order_number}</strong></td>
            <td>
                <div>${order.customer_name}</div>
                <div style="font-size:0.78rem;color:var(--muted);">${order.customer_email}</div>
            </td>
            <td>
                <div>${names.bundle[order.bundle] || order.bundle}</div>
                <div style="font-size:0.78rem;color:var(--muted);">${names.monitor[order.monitor] || order.monitor}</div>
            </td>
            <td><strong>₦${order.total_price.toLocaleString()}</strong></td>
            <td><span class="badge badge-${order.payment_status}">${order.payment_status}</span></td>
            <td>
                <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value, '${order.order_status}')">
                    ${['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(s =>
        `<option value="${s}" ${s === order.order_status ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
    ).join('')}
                </select>
            </td>
            <td style="color:var(--muted);font-size:0.82rem;">
                ${new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </td>
        </tr>
    `).join('');
}

// ── FILTER ORDERS ──
window.filterOrders = function (status, btn) {
    currentFilter = status;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Filter
    if (status === 'all') {
        renderOrders(allOrders);
    } else {
        renderOrders(allOrders.filter(o => o.order_status === status));
    }
};

// ── UPDATE ORDER STATUS ──
window.updateOrderStatus = async function (orderId, newStatus, previousStatus) {
    try {
        const res = await fetch(`/api/admin?id=${orderId}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({
                order_status: newStatus,
                _previous: { order_status: previousStatus }
            })
        });

        if (!res.ok) {
            throw new Error('Update failed');
        }

        // Update local state
        const orderIdx = allOrders.findIndex(o => o.id === orderId);
        if (orderIdx > -1) {
            allOrders[orderIdx].order_status = newStatus;
        }

        // Refresh stats
        const statsRes = await fetch('/api/admin?action=stats', { headers: authHeaders });
        const statsData = await statsRes.json();
        renderStats(statsData.stats);

    } catch (err) {
        console.error('Status update error:', err);
        alert('Failed to update order status. Please try again.');
        // Reload to reset
        loadDashboard();
    }
};

// ── LOGOUT ──
window.logout = function () {
    localStorage.removeItem('minidesk_admin_token');
    localStorage.removeItem('minidesk_admin_email');
    window.location.href = '/admin/login.html';
};

// ── INIT ──
loadDashboard();

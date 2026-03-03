// ── STATE ──
const state = {
    bundle: null,
    monitor: null,
    keyboard: null,
    addons: []
};

// Default prices (fallback if API unavailable)
const prices = {
    bundle: { basic: 450000, full: 950000 },
    monitor: { entry: 95000, mid: 185000, top: 380000, creator: 280000 },
    keyboard: { windows: 28000, mac: 72000 },
    addon: { stand: 22000, ssd: 68000 },
    included: 45000
};

// Default names (fallback if API unavailable)
const names = {
    bundle: { basic: 'Basic Work Bundle', full: 'Full Workspace Bundle' },
    monitor: { entry: 'Dell SE2726HG (27" FHD 240Hz)', mid: 'Dell S2725DS (27" QHD 100Hz)', top: 'Dell S2725QS (27" 4K UHD)', creator: 'ASUS ProArt PA278CV (27" QHD)' },
    keyboard: { windows: 'Windows Keyboard', mac: 'Apple Magic Keyboard' },
    addon: { stand: 'Laptop Stand', ssd: 'SanDisk 1TB Extreme Portable SSD' }
};

// ── LOAD PRODUCTS FROM DB ──
(async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        if (!res.ok) return;
        const data = await res.json();

        // Rebuild prices and names from DB
        for (const product of data.products || []) {
            const cat = product.category;
            if (cat === 'addon' && product.slug === 'included') {
                prices.included = product.price;
                continue;
            }
            if (!prices[cat]) prices[cat] = {};
            if (!names[cat]) names[cat] = {};
            prices[cat][product.slug] = product.price;
            names[cat][product.slug] = product.name;
        }

        // Update any visible prices on the page
        updateDisplayedPrices(data.products || []);
    } catch (e) {
        // API unavailable (static file mode) — use hardcoded defaults
        console.log('Using default product data (API unavailable)');
    }
})();

// Update card content (prices, names, descriptions, images, tags, emojis) from DB
function updateDisplayedPrices(products) {
    for (const p of products) {
        let card = null;

        if (p.category === 'bundle') {
            card = document.getElementById('card-' + p.slug);
        } else if (p.category === 'monitor') {
            card = document.getElementById('card-monitor-' + p.slug);
        } else if (p.category === 'keyboard') {
            card = document.getElementById('card-kb-' + p.slug);
        } else if (p.category === 'addon' && p.slug !== 'included') {
            card = document.getElementById('card-' + p.slug);
        }

        if (!card) continue;

        // Price
        const priceEl = card.querySelector('.option-price');
        if (priceEl) {
            priceEl.textContent = (p.category === 'bundle' ? 'From ' : '') + '₦' + p.price.toLocaleString();
        }

        // Name
        const nameEl = card.querySelector('.option-name');
        if (nameEl && p.name) nameEl.textContent = p.name;

        // Description
        const descEl = card.querySelector('.option-desc');
        if (descEl && p.description !== undefined && p.description !== null) {
            descEl.textContent = p.description;
        }

        // Image
        const imgTray = card.querySelector('.product-img-tray');
        if (imgTray) {
            const img = imgTray.querySelector('img');
            if (p.image) {
                if (img) {
                    img.src = p.image;
                    img.alt = p.name || '';
                } else {
                    imgTray.innerHTML = `<img src="${p.image}" alt="${p.name || ''}">`;
                }
                imgTray.style.display = '';
            } else {
                // No image in DB — hide the tray
                imgTray.style.display = 'none';
            }
        }

        // Emoji (bundles/keyboards)
        const emojiEl = card.querySelector('.option-emoji');
        if (emojiEl && p.emoji !== undefined) {
            if (p.emoji) {
                emojiEl.textContent = p.emoji;
                emojiEl.style.display = '';
            } else {
                emojiEl.style.display = 'none';
            }
        }

        // Tag
        const tagEl = card.querySelector('.option-tag');
        if (tagEl && p.tag !== undefined) {
            if (p.tag) {
                tagEl.textContent = p.tag;
                tagEl.style.display = '';
            } else {
                tagEl.style.display = 'none';
            }
        }
    }
    // Re-render summary if user has selections
    if (state.bundle || state.monitor) updateSummary();
}

// ── BUNDLE SELECT ──
function selectBundle(val) {
    state.bundle = val;
    document.querySelectorAll('[id^="card-basic"],[id^="card-full"]').forEach(c => c.classList.remove('selected'));
    document.getElementById('card-' + val).classList.add('selected');
    // Show the clear button
    const clearBtn = document.getElementById('clear-bundle-btn');
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    updateSummary();
}

// ── MONITOR SELECT ──
function selectMonitor(val) {
    state.monitor = val;
    ['entry', 'mid', 'top', 'creator'].forEach(m => document.getElementById('card-monitor-' + m).classList.remove('selected'));
    document.getElementById('card-monitor-' + val).classList.add('selected');

    // Show clear button
    const clearMonBtn = document.getElementById('clear-monitor-btn');
    if (clearMonBtn) clearMonBtn.style.display = 'inline-flex';

    // Enable keyboard step
    const step3 = document.getElementById('step3');
    step3.classList.remove('step-disabled');
    const selectMonNote = document.getElementById('kb-select-monitor-note');
    if (selectMonNote) selectMonNote.style.display = 'none';

    // keyboard logic
    const kbAutoNote = document.getElementById('kb-auto-note');
    const kbUpNote = document.getElementById('kb-upgrade-note');
    const kbLockedNote = document.getElementById('kb-locked-note');
    const macCard = document.getElementById('card-kb-mac');

    // All monitors unlock both keyboard options
    macCard.style.opacity = '1';
    macCard.style.pointerEvents = 'auto';
    kbAutoNote.classList.add('hidden');
    kbUpNote.classList.remove('hidden');
    kbLockedNote.classList.add('hidden');
    if (!state.keyboard) selectKeyboard('windows');
    updateSummary();
}

window.clearMonitor = function () {
    state.monitor = null;
    state.keyboard = null;
    ['entry', 'mid', 'top', 'creator'].forEach(m => {
        const c = document.getElementById('card-monitor-' + m);
        if (c) c.classList.remove('selected');
    });
    ['windows', 'mac'].forEach(k => {
        const c = document.getElementById('card-kb-' + k);
        if (c) c.classList.remove('selected');
    });
    // Reset keyboard UI
    const macCard = document.getElementById('card-kb-mac');
    if (macCard) { macCard.style.opacity = '1'; macCard.style.pointerEvents = 'auto'; }
    ['kb-auto-note', 'kb-upgrade-note', 'kb-locked-note'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    // Re-disable keyboard step
    const step3 = document.getElementById('step3');
    step3.classList.add('step-disabled');
    const selectMonNote = document.getElementById('kb-select-monitor-note');
    if (selectMonNote) selectMonNote.style.display = '';
    document.getElementById('clear-monitor-btn').style.display = 'none';
    updateSummary();
};

// ── KEYBOARD SELECT ──
function selectKeyboard(val) {
    // Both keyboards available for all monitors
    state.keyboard = val;
    ['windows', 'mac'].forEach(k => {
        const c = document.getElementById('card-kb-' + k);
        if (c) c.classList.remove('selected');
    });
    const el = document.getElementById('card-kb-' + val);
    if (el) el.classList.add('selected');
    updateSummary();
}

// ── ADDON TOGGLE ──
function toggleAddon(val, cardEl) {
    const idx = state.addons.indexOf(val);
    if (idx > -1) {
        state.addons.splice(idx, 1);
        cardEl.classList.remove('selected');
    } else {
        state.addons.push(val);
        cardEl.classList.add('selected');
    }
    updateSummary();
}

// ── UPDATE SUMMARY ──
function updateSummary() {
    const lines = document.getElementById('summary-lines');
    const totalEl = document.getElementById('summary-total');
    const priceEl = document.getElementById('total-price');

    if (!state.bundle && !state.monitor) {
        lines.innerHTML = '<div style="color:var(--muted);font-size:0.88rem;text-align:center;padding:20px 0;">Select options to see your build here.</div>';
        totalEl.style.display = 'none';
        return;
    }

    let total = 0;
    let html = '';

    if (state.bundle) {
        const p = prices.bundle[state.bundle];
        total += p;
        html += summaryLine(names.bundle[state.bundle], p);
    }
    if (state.monitor) {
        const p = prices.monitor[state.monitor];
        total += p;
        html += summaryLine(names.monitor[state.monitor], p);
    }
    if (state.keyboard) {
        const p = prices.keyboard[state.keyboard];
        total += p;
        html += summaryLine(names.keyboard[state.keyboard], p);
    }
    // Mouse + Dongle always included
    if (state.bundle) {
        total += prices.included;
        html += summaryLine('Mouse + USB-C Dongle', prices.included);
    }
    state.addons.forEach(a => {
        const p = prices.addon[a];
        total += p;
        html += summaryLine(names.addon[a], p);
    });

    lines.innerHTML = html;
    totalEl.style.display = 'flex';
    priceEl.textContent = '₦' + total.toLocaleString();
}

function summaryLine(name, price) {
    return `<div class="summary-line"><span class="item-name">${name}</span><span class="item-price">₦${price.toLocaleString()}</span></div>`;
}

// ── SEND ORDER ──
async function sendOrder() {
    const orderBtn = document.getElementById('order-btn');
    const warning = document.getElementById('order-warning');

    if (!state.bundle || !state.monitor || !state.keyboard) {
        warning.style.display = 'block';
        warning.textContent = '⚠️ Please complete your bundle configuration above first.';
        setTimeout(() => warning.style.display = 'none', 4000);
        return;
    }

    // Validate form fields
    const name = document.getElementById('fname').value.trim();
    const email = document.getElementById('femail').value.trim();
    const phone = document.getElementById('fphone').value.trim();
    const address = document.getElementById('faddress').value.trim();
    const notes = document.getElementById('fnotes').value.trim();

    if (!name || !email || !phone || !address) {
        warning.style.display = 'block';
        warning.textContent = '⚠️ Please fill in all required fields (name, email, phone, address).';
        setTimeout(() => warning.style.display = 'none', 4000);
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        warning.style.display = 'block';
        warning.textContent = '⚠️ Please enter a valid email address.';
        setTimeout(() => warning.style.display = 'none', 4000);
        return;
    }

    // Show loading state
    orderBtn.disabled = true;
    orderBtn.innerHTML = '<span>⏳</span> Processing...';

    try {
        // Step 1: Create the order
        const orderResponse = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_name: name,
                customer_email: email,
                customer_phone: phone,
                delivery_address: address,
                bundle: state.bundle,
                monitor: state.monitor,
                keyboard: state.keyboard,
                addons: state.addons,
                special_requests: notes
            })
        });

        const orderData = await orderResponse.json();

        if (!orderResponse.ok) {
            throw new Error(orderData.error || 'Failed to create order');
        }

        // Step 2: Initialize payment
        orderBtn.innerHTML = '<span>💳</span> Redirecting to payment...';

        const paymentResponse = await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'initialize',
                order_id: orderData.order.id,
                gateway: 'paystack'
            })
        });

        const paymentData = await paymentResponse.json();

        if (paymentResponse.ok && paymentData.authorization_url) {
            // Redirect to payment page
            window.location.href = paymentData.authorization_url;
        } else {
            // Payment init failed — show order success without payment
            // (Order was still created, payment can be done later)
            window.location.href = `/order-success.html?order=${orderData.order.order_number}&status=pending`;
        }

    } catch (err) {
        console.error('Order submission error:', err);
        warning.style.display = 'block';
        warning.textContent = `❌ ${err.message}. Please try again.`;
        setTimeout(() => warning.style.display = 'none', 6000);

        // Reset button
        orderBtn.disabled = false;
        orderBtn.innerHTML = '<span>📧</span> Send My Order';
    }
}

// ── SCROLL ANIMATIONS ──
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal, .step, .contact-section').forEach(el => {
    observer.observe(el);
});

// Stagger steps
document.querySelectorAll('.step').forEach((el, i) => {
    el.style.transitionDelay = (i * 0.1) + 's';
});

// ── HERO SLIDESHOW ──
const slides = document.querySelectorAll('.hero-slideshow .slide');
const dots = document.querySelectorAll('.dot');
let currentSlide = 0;
let isPlaying = true;
let slideshowTimer = null;

const pauseSVG = `<svg id="pp-icon" viewBox="0 0 12 12" width="12" height="12" fill="#fff"><rect x="1" y="0" width="3.5" height="12" rx="1"/><rect x="7.5" y="0" width="3.5" height="12" rx="1"/></svg>`;
const playSVG = `<svg id="pp-icon" viewBox="0 0 12 12" width="12" height="12" fill="#fff"><polygon points="1,0 11,6 1,12"/></svg>`;

window.goToSlide = function (index) {
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    currentSlide = index;
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
};

function advanceSlide() {
    goToSlide((currentSlide + 1) % slides.length);
}

function startAutoPlay() {
    clearInterval(slideshowTimer);
    slideshowTimer = setInterval(advanceSlide, 4000);
}

window.togglePlayPause = function () {
    const btn = document.getElementById('playpause-btn');
    if (isPlaying) {
        clearInterval(slideshowTimer);
        btn.innerHTML = playSVG;
        btn.title = 'Play';
    } else {
        startAutoPlay();
        btn.innerHTML = pauseSVG;
        btn.title = 'Pause';
    }
    isPlaying = !isPlaying;
};

// Start auto-play on load
startAutoPlay();

// ── BUNDLE CLEAR ──
window.clearBundle = function () {
    state.bundle = null;
    ['basic', 'full'].forEach(v => {
        const c = document.getElementById('card-' + v);
        if (c) c.classList.remove('selected');
    });
    document.getElementById('clear-bundle-btn').style.display = 'none';
    updateSummary();
};

// ── THEME TOGGLE ──
let isDark = true;
window.toggleTheme = function () {
    isDark = !isDark;
    const btn = document.getElementById('theme-toggle');
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        btn.textContent = '🌙';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        btn.textContent = '☀️';
    }
};

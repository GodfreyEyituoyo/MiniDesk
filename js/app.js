// ── STATE ──
const state = {
    bundle: null,
    monitor: null,
    keyboard: null,
    addons: []
};

// Product data loaded from API
let productData = {
    bundles: [],
    monitors: [],
    keyboards: [],
    addons: [],
    staticItems: []
};

// Default prices (fallback if API unavailable)
const prices = {
    bundle: { basic: 1138000, full: 1443000 },
    monitor: { entry: 428400, mid: 540400, top: 658000, creator: 658000 },
    keyboard: { windows: 84000, mac: 154000 },
    addon: { stand: 22000, ssd: 68000 }
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
        const products = data.products || [];

        // Categorise products
        productData.bundles = products.filter(p => p.category === 'bundle');
        productData.monitors = products.filter(p => p.category === 'monitor');
        productData.keyboards = products.filter(p => p.category === 'keyboard');
        productData.addons = products.filter(p => p.category === 'addon' && p.role === 'addon');
        productData.staticItems = products.filter(p => p.role === 'static' && p.category !== 'bundle');

        // Rebuild prices and names from DB
        for (const product of products) {
            const cat = product.category;
            if (product.role === 'static' && cat !== 'bundle') continue;
            if (!prices[cat]) prices[cat] = {};
            if (!names[cat]) names[cat] = {};
            prices[cat][product.slug] = product.price;
            names[cat][product.slug] = product.name;
        }

        // Update card content and prices
        updateDisplayedPrices(products);
    } catch (e) {
        console.log('Using default product data (API unavailable)');
        updateBundleRanges();
    }
})();

// ── PRICE RANGE CALCULATION ──
function getBundleRange(bundleSlug) {
    const staticTotal = prices.bundle[bundleSlug] || 0;

    const monitors = productData.monitors.length > 0
        ? productData.monitors.filter(m => !m.bundle_ids || m.bundle_ids.includes(bundleSlug))
        : Object.values(prices.monitor).map(p => ({ price: p }));
    const monitorPrices = monitors.map(m => m.price || 0);

    const keyboards = productData.keyboards.length > 0
        ? productData.keyboards.filter(k => !k.bundle_ids || k.bundle_ids.includes(bundleSlug))
        : Object.values(prices.keyboard).map(p => ({ price: p }));
    const kbPrices = keyboards.map(k => k.price || 0);

    if (monitorPrices.length === 0 || kbPrices.length === 0) {
        return { low: staticTotal, high: staticTotal };
    }

    return {
        low: staticTotal + Math.min(...monitorPrices) + Math.min(...kbPrices),
        high: staticTotal + Math.max(...monitorPrices) + Math.max(...kbPrices)
    };
}

function updateBundleRanges() {
    const bundleSlugs = productData.bundles.length > 0
        ? productData.bundles.map(b => b.slug)
        : ['basic', 'full'];

    for (const slug of bundleSlugs) {
        const card = document.getElementById('card-' + slug);
        if (!card) continue;
        const priceEl = card.querySelector('.option-price');
        if (!priceEl) continue;
        const range = getBundleRange(slug);
        const bundle = productData.bundles.find(b => b.slug === slug);
        const discountBadge = bundle && bundle.discount_percent
            ? ` <span class="discount-badge">${bundle.discount_percent}% OFF</span>`
            : '';
        priceEl.innerHTML = `₦${range.low.toLocaleString()} – ₦${range.high.toLocaleString()}${discountBadge}`;
    }
}

// ── UPDATE CARD CONTENT (Godfrey's dynamic syncing + Apple-style pricing) ──
function updateDisplayedPrices(products) {
    // First: update bundle ranges
    updateBundleRanges();

    // Then: update all card content from DB
    for (const p of products) {
        let card = null;

        if (p.category === 'bundle') {
            card = document.getElementById('card-' + p.slug);
        } else if (p.category === 'monitor') {
            card = document.getElementById('card-monitor-' + p.slug);
        } else if (p.category === 'keyboard') {
            card = document.getElementById('card-kb-' + p.slug);
        } else if (p.category === 'addon' && p.role === 'addon') {
            card = document.getElementById('card-' + p.slug);
        }

        if (!card) continue;

        // Name (from DB)
        const nameEl = card.querySelector('.option-name');
        if (nameEl && p.name) nameEl.textContent = p.name;

        // Description (from DB)
        const descEl = card.querySelector('.option-desc');
        if (descEl && p.description !== undefined && p.description !== null) {
            descEl.textContent = p.description;
        }

        // Image (from DB)
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
                imgTray.style.display = 'none';
            }
        }

        // Emoji (from DB)
        const emojiEl = card.querySelector('.option-emoji');
        if (emojiEl && p.emoji !== undefined) {
            if (p.emoji) {
                emojiEl.textContent = p.emoji;
                emojiEl.style.display = '';
            } else {
                emojiEl.style.display = 'none';
            }
        }

        // Tag (from DB)
        const tagEl = card.querySelector('.option-tag');
        if (tagEl && p.tag !== undefined) {
            if (p.tag) {
                tagEl.textContent = p.tag;
                tagEl.style.display = '';
            } else {
                tagEl.style.display = 'none';
            }
        }

        // Apple-style: hide individual prices on monitors and keyboards
        if (p.category === 'monitor' || p.category === 'keyboard') {
            const priceEl = card.querySelector('.option-price');
            if (priceEl) priceEl.style.display = 'none';
        }

        // Add-ons: show individual prices
        if (p.category === 'addon' && p.role === 'addon') {
            const priceEl = card.querySelector('.option-price');
            if (priceEl) priceEl.textContent = '₦' + p.price.toLocaleString();
        }
    }

    // Hide cards for inactive products (not returned by API)
    ['entry', 'mid', 'top', 'creator'].forEach(slug => {
        const card = document.getElementById('card-monitor-' + slug);
        if (card && !products.find(p => p.category === 'monitor' && p.slug === slug)) {
            card.style.display = 'none';
        }
    });
    ['windows', 'mac'].forEach(slug => {
        const card = document.getElementById('card-kb-' + slug);
        if (card && !products.find(p => p.category === 'keyboard' && p.slug === slug)) {
            card.style.display = 'none';
        }
    });
    ['stand', 'ssd'].forEach(slug => {
        const card = document.getElementById('card-' + slug);
        if (card && !products.find(p => p.slug === slug && p.role === 'addon')) {
            card.style.display = 'none';
        }
    });

    // Re-render summary if user has selections
    if (state.bundle || state.monitor) updateSummary();
}

// ── BUNDLE SELECT ──
function selectBundle(val) {
    state.bundle = val;
    document.querySelectorAll('[id^="card-basic"],[id^="card-full"]').forEach(c => c.classList.remove('selected'));
    document.getElementById('card-' + val).classList.add('selected');
    const clearBtn = document.getElementById('clear-bundle-btn');
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    updateSummary();
}

// ── MONITOR SELECT ──
function selectMonitor(val) {
    state.monitor = val;
    ['entry', 'mid', 'top', 'creator'].forEach(m => {
        const c = document.getElementById('card-monitor-' + m);
        if (c) c.classList.remove('selected');
    });
    document.getElementById('card-monitor-' + val).classList.add('selected');

    const clearMonBtn = document.getElementById('clear-monitor-btn');
    if (clearMonBtn) clearMonBtn.style.display = 'inline-flex';

    // Enable keyboard step
    const step3 = document.getElementById('step3');
    step3.classList.remove('step-disabled');
    const selectMonNote = document.getElementById('kb-select-monitor-note');
    if (selectMonNote) selectMonNote.style.display = 'none';

    // All keyboards unlocked (no tier locking)
    const kbAutoNote = document.getElementById('kb-auto-note');
    const kbUpNote = document.getElementById('kb-upgrade-note');
    const kbLockedNote = document.getElementById('kb-locked-note');
    const macCard = document.getElementById('card-kb-mac');

    if (kbAutoNote) kbAutoNote.classList.add('hidden');
    if (kbUpNote) kbUpNote.classList.remove('hidden');
    if (kbLockedNote) kbLockedNote.classList.add('hidden');
    if (macCard) { macCard.style.opacity = '1'; macCard.style.pointerEvents = 'auto'; }

    // Don't auto-select keyboard — let user pick manually
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
    const macCard = document.getElementById('card-kb-mac');
    if (macCard) { macCard.style.opacity = '1'; macCard.style.pointerEvents = 'auto'; }
    ['kb-auto-note', 'kb-upgrade-note', 'kb-locked-note'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const step3 = document.getElementById('step3');
    step3.classList.add('step-disabled');
    const selectMonNote = document.getElementById('kb-select-monitor-note');
    if (selectMonNote) selectMonNote.style.display = '';
    document.getElementById('clear-monitor-btn').style.display = 'none';
    updateSummary();
};

// ── KEYBOARD SELECT ──
function selectKeyboard(val) {
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

// ── UPDATE SUMMARY (Apple-style: item names, no individual prices, just total) ──
function updateSummary() {
    const lines = document.getElementById('summary-lines');
    const totalEl = document.getElementById('summary-total');
    const priceEl = document.getElementById('total-price');
    const proceedBtn = document.getElementById('proceed-btn');

    if (!state.bundle && !state.monitor) {
        lines.innerHTML = '<div style="color:var(--muted);font-size:0.88rem;text-align:center;padding:20px 0;">Select options to see your build here.</div>';
        totalEl.style.display = 'none';
        if (proceedBtn) { proceedBtn.style.opacity = '0.4'; proceedBtn.style.pointerEvents = 'none'; }
        return;
    }

    const configComplete = state.bundle && state.monitor && state.keyboard;
    let total = 0;
    let html = '';

    if (state.bundle) {
        total += prices.bundle[state.bundle] || 0;
        html += summaryItem(names.bundle[state.bundle] || state.bundle);
    }
    if (state.monitor) {
        total += prices.monitor[state.monitor] || 0;
        html += summaryItem(names.monitor[state.monitor] || state.monitor);
    }
    if (state.keyboard) {
        total += prices.keyboard[state.keyboard] || 0;
        html += summaryItem(names.keyboard[state.keyboard] || state.keyboard);
    }
    // Add-ons show WITH price
    state.addons.forEach(a => {
        const p = prices.addon[a] || 0;
        total += p;
        html += summaryLine(names.addon[a] || a, p);
    });

    lines.innerHTML = html;

    // Only show total and enable button when all 3 are selected
    if (configComplete) {
        totalEl.style.display = 'flex';
        const bundle = productData.bundles.find(b => b.slug === state.bundle);
        const discountPercent = bundle ? bundle.discount_percent : 20;
        if (discountPercent > 0) {
            priceEl.innerHTML = `₦${total.toLocaleString()} <span class="discount-badge" style="margin-left:8px;">${discountPercent}% OFF</span>`;
        } else {
            priceEl.textContent = '₦' + total.toLocaleString();
        }
        if (proceedBtn) { proceedBtn.style.opacity = '1'; proceedBtn.style.pointerEvents = 'auto'; }
    } else {
        totalEl.style.display = 'none';
        if (proceedBtn) { proceedBtn.style.opacity = '0.4'; proceedBtn.style.pointerEvents = 'none'; }
    }
}

// Summary line without price (for bundle items — Apple-style)
function summaryItem(name) {
    return `<div class="summary-line"><span class="item-name">${name}</span><span class="item-price" style="color:var(--muted);font-size:0.8rem;">✓</span></div>`;
}

// Summary line with price (for add-ons)
function summaryLine(name, price) {
    return `<div class="summary-line"><span class="item-name">${name}</span><span class="item-price">+ ₦${price.toLocaleString()}</span></div>`;
}

// ── FORM VALIDATION ──
function validateField(input, rules) {
    const val = input.value.trim();
    let error = '';

    if (rules.required && !val) {
        error = 'This field is required';
    } else if (val) {
        if (rules.type === 'name') {
            if (!/^[a-zA-ZÀ-ÿ\s'\-]+$/.test(val)) error = 'Letters, spaces, and hyphens only';
            else if (val.length < 2) error = 'At least 2 characters';
        }
        if (rules.type === 'email') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) error = 'Enter a valid email address';
        }
        if (rules.type === 'phone') {
            const cleaned = val.replace(/[\s\-()]/g, '');
            if (!/^[+0]\d{9,14}$/.test(cleaned)) error = 'Enter a valid phone number (start with + or 0, 10-15 digits)';
        }
        if (rules.type === 'address') {
            if (val.length < 5) error = 'Enter a full delivery address';
        }
    }

    let errEl = input.parentElement.querySelector('.field-error');
    if (error) {
        input.style.borderColor = '#ff453a';
        if (!errEl) {
            errEl = document.createElement('div');
            errEl.className = 'field-error';
            errEl.style.cssText = 'color:#ff453a;font-size:0.75rem;margin-top:4px;';
            input.parentElement.appendChild(errEl);
        }
        errEl.textContent = error;
    } else {
        input.style.borderColor = '';
        if (errEl) errEl.remove();
    }

    return !error;
}

// Set up real-time validation
document.addEventListener('DOMContentLoaded', () => {
    const fields = [
        { id: 'fname', rules: { required: true, type: 'name' } },
        { id: 'femail', rules: { required: true, type: 'email' } },
        { id: 'fphone', rules: { required: true, type: 'phone' } },
        { id: 'faddress', rules: { required: true, type: 'address' } }
    ];

    for (const field of fields) {
        const input = document.getElementById(field.id);
        if (!input) continue;
        input.addEventListener('blur', () => validateField(input, field.rules));
        input.addEventListener('input', () => {
            const errEl = input.parentElement.querySelector('.field-error');
            if (errEl) { errEl.remove(); input.style.borderColor = ''; }
        });
    }
});

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

    // Validate all form fields
    const nameInput = document.getElementById('fname');
    const emailInput = document.getElementById('femail');
    const phoneInput = document.getElementById('fphone');
    const addressInput = document.getElementById('faddress');

    const validations = [
        validateField(nameInput, { required: true, type: 'name' }),
        validateField(emailInput, { required: true, type: 'email' }),
        validateField(phoneInput, { required: true, type: 'phone' }),
        validateField(addressInput, { required: true, type: 'address' })
    ];

    if (validations.some(v => !v)) {
        warning.style.display = 'block';
        warning.textContent = '⚠️ Please fix the errors in the form above.';
        setTimeout(() => warning.style.display = 'none', 4000);
        return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const address = addressInput.value.trim();
    const notes = document.getElementById('fnotes').value.trim();

    orderBtn.disabled = true;
    orderBtn.innerHTML = '<span>⏳</span> Processing...';

    try {
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
            window.location.href = paymentData.authorization_url;
        } else {
            window.location.href = `/order-success.html?order=${orderData.order.order_number}&status=pending`;
        }

    } catch (err) {
        console.error('Order submission error:', err);
        warning.style.display = 'block';
        warning.textContent = `❌ ${err.message}. Please try again.`;
        setTimeout(() => warning.style.display = 'none', 6000);

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

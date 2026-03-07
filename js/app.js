// ── STATE ──
const state = {
    bundle: null,
    monitor: null,
    keyboard: null,
    keyboardColor: null,
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
    keyboard: { 'pop-icon': 154000, mk250: 84000 },
    addon: { stand: 22000, ssd: 68000 }
};

// Default names (fallback if API unavailable)
const names = {
    bundle: { basic: 'Basic Work Bundle', full: 'Full Workspace Bundle' },
    monitor: { entry: 'Dell SE2726HG (27" FHD 240Hz)', mid: 'Dell S2725DS (27" QHD 100Hz)', top: 'Dell S2725QS (27" 4K UHD)', creator: 'ASUS ProArt PA278CV (27" QHD)' },
    keyboard: { 'pop-icon': 'Logitech POP Icon Combo', mk250: 'Logitech MK250 Compact' },
    addon: { stand: 'Laptop Stand', ssd: 'SanDisk 1TB Extreme Portable SSD' }
};

// ── KEYBOARD COLOR DATA ──
const keyboardColors = {
    'pop-icon': [
        { name: 'Graphite & White', slug: 'graphite-white', hex: '#555555', hex2: '#ffffff', img: 'images/keyboards/pop-icon-graphite-white-1.jpg', img2: 'images/keyboards/pop-icon-graphite-white-2.jpg' },
        { name: 'Rose & Off White', slug: 'rose-offwhite', hex: '#d4848a', hex2: '#f5f0eb', img: 'images/keyboards/pop-icon-rose-offwhite-1.jpg', img2: 'images/keyboards/pop-icon-rose-offwhite-2.jpg' },
        { name: 'Off White & Orange', slug: 'offwhite-orange', hex: '#f5f0eb', hex2: '#e67e22', img: 'images/keyboards/pop-icon-offwhite-orange-1.jpg', img2: 'images/keyboards/pop-icon-offwhite-orange-2.jpg' },
        { name: 'Graphite & Green', slug: 'graphite-green', hex: '#555555', hex2: '#6ab04c', img: 'images/keyboards/pop-icon-graphite-green-1.jpg', img2: 'images/keyboards/pop-icon-graphite-green-2.jpg' },
        { name: 'Lilac & Off White', slug: 'lilac-offwhite', hex: '#b48dc7', hex2: '#f5f0eb', img: 'images/keyboards/pop-icon-lilac-offwhite-1.jpg', img2: 'images/keyboards/pop-icon-lilac-offwhite-2.jpg' }
    ],
    mk250: [
        { name: 'Graphite', slug: 'graphite', hex: '#555555', img: 'images/keyboards/mk250-graphite-1.jpg', img2: 'images/keyboards/mk250-graphite-2.jpg' },
        { name: 'Off-white', slug: 'offwhite', hex: '#f5f0eb', img: 'images/keyboards/mk250-offwhite-1.jpg', img2: 'images/keyboards/mk250-offwhite-2.jpg' },
        { name: 'Rose', slug: 'rose', hex: '#d4848a', img: 'images/keyboards/mk250-rose-1.jpg', img2: 'images/keyboards/mk250-rose-2.jpg' }
    ]
};

// ── MONITOR IMAGE MAP ──
const monitorImages = {
    entry: 'images/monitor-entry.png',
    mid: 'images/monitor-mid.png',
    top: 'images/monitor-top.png',
    creator: 'images/monitor-creator.png'
};

// ── BUNDLE CONTENTS (static items per bundle) ──
const bundleContents = {
    basic: ['Mac Mini M4', 'USB-C Hub (10-in-1)', 'Wireless Mouse'],
    full: ['Mac Mini M4', 'USB-C Hub (10-in-1)', 'Wireless Mouse', 'Workstation Table', 'Ergonomic Chair', 'Keyboard Mat', 'Side Light']
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
        const priceEl = document.getElementById('price-' + slug);
        if (!priceEl) continue;
        const range = getBundleRange(slug);
        priceEl.textContent = `₦${range.low.toLocaleString()} – ₦${range.high.toLocaleString()}`;
    }
}

// ── UPDATE CARD CONTENT FROM DB ──
function updateDisplayedPrices(products) {
    updateBundleRanges();

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

        // Name
        const nameEl = card.querySelector('.apple-option-name');
        if (nameEl && p.name) nameEl.textContent = p.name;

        // Description
        const descEl = card.querySelector('.apple-option-desc');
        if (descEl && p.description !== undefined && p.description !== null) {
            descEl.textContent = p.description;
        }

        // Thumb image
        const thumbEl = card.querySelector('.apple-option-thumb img');
        if (thumbEl && p.image) {
            thumbEl.src = p.image;
            thumbEl.alt = p.name || '';
        }

        // Tag
        const tagEl = card.querySelector('.apple-option-tag');
        if (tagEl && p.tag !== undefined) {
            if (p.tag) {
                tagEl.textContent = p.tag;
                tagEl.style.display = '';
            } else {
                tagEl.style.display = 'none';
            }
        }

        // Add-ons: show prices
        if (p.category === 'addon' && p.role === 'addon') {
            const priceEl = card.querySelector('.apple-option-price');
            if (priceEl) priceEl.textContent = '₦' + p.price.toLocaleString();
        }
    }

    if (state.bundle || state.monitor) updateSummary();
}

// ── IMAGE CROSS-FADE ──
function showConfigImage(imgId) {
    document.querySelectorAll('.config-img').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(imgId);
    if (target) target.classList.add('active');

    // Update dots
    document.querySelectorAll('.img-dot').forEach(d => d.classList.remove('active'));
    const dotMap = ['img-bundle', 'img-monitor', 'img-keyboard', 'img-addons'];
    const idx = dotMap.indexOf(imgId);
    const dots = document.querySelectorAll('.img-dot');
    if (idx >= 0 && dots[idx]) dots[idx].classList.add('active');
}

// ── INTERSECTION OBSERVER (auto-switch image on scroll) ──
function setupStepObserver() {
    const steps = document.querySelectorAll('.config-step[data-img]');
    const stepObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const imgId = entry.target.getAttribute('data-img');
                if (imgId) showConfigImage(imgId);
            }
        });
    }, { threshold: 0.4, rootMargin: '-20% 0px -20% 0px' });

    steps.forEach(step => stepObserver.observe(step));
}

// ── AUTO-SCROLL TO NEXT STEP ──
function scrollToNextStep(currentStepId) {
    const steps = ['step-bundle', 'step-monitor', 'step-keyboard', 'step-addons', 'step-summary'];
    const idx = steps.indexOf(currentStepId);
    if (idx >= 0 && idx < steps.length - 1) {
        const nextEl = document.getElementById(steps[idx + 1]);
        if (nextEl) {
            setTimeout(() => {
                nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 350);
        }
    }
}

// ── BUNDLE SELECT ──
function selectBundle(val) {
    state.bundle = val;
    document.querySelectorAll('#card-basic, #card-full').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById('card-' + val);
    if (card) card.classList.add('selected');

    // Show bundle contents chips
    const contentsEl = document.getElementById('bundle-contents');
    const grid = document.getElementById('bundle-contents-grid');
    if (contentsEl && grid) {
        const items = bundleContents[val] || [];
        if (items.length > 0) {
            grid.innerHTML = items.map(item =>
                `<div class="bundle-item-chip"><span class="chip-check">✓</span> ${item}</div>`
            ).join('');
            contentsEl.style.display = 'block';
        } else {
            contentsEl.style.display = 'none';
        }
    }

    updateSummary();
    scrollToNextStep('step-bundle');
}

// ── MONITOR SELECT ──
function selectMonitor(val) {
    state.monitor = val;
    ['entry', 'mid', 'top', 'creator'].forEach(m => {
        const c = document.getElementById('card-monitor-' + m);
        if (c) c.classList.remove('selected');
    });
    document.getElementById('card-monitor-' + val).classList.add('selected');

    // Update left panel image
    const monitorImg = document.querySelector('#img-monitor img');
    if (monitorImg && monitorImages[val]) {
        monitorImg.src = monitorImages[val];
    }
    showConfigImage('img-monitor');

    updateSummary();
    scrollToNextStep('step-monitor');
}

// ── KEYBOARD SELECT ──
function selectKeyboard(val) {
    state.keyboard = val;
    state.keyboardColor = null;
    ['pop-icon', 'mk250'].forEach(k => {
        const c = document.getElementById('card-kb-' + k);
        if (c) c.classList.remove('selected');
    });
    const el = document.getElementById('card-kb-' + val);
    if (el) el.classList.add('selected');

    // Show color swatches
    renderColorSwatches(val);

    // Select first color by default
    const colors = keyboardColors[val];
    if (colors && colors.length > 0) {
        selectColor(val, colors[0]);
    }

    showConfigImage('img-keyboard');
    updateSummary();
    scrollToNextStep('step-keyboard');
}

// ── COLOR SWATCHES ──
function renderColorSwatches(keyboardSlug) {
    const selector = document.getElementById('color-selector');
    const swatchContainer = document.getElementById('color-swatches');
    const colors = keyboardColors[keyboardSlug];

    if (!colors || !selector || !swatchContainer) return;

    let html = '';
    colors.forEach((color, i) => {
        // Create gradient swatch for two-tone colors
        const bg = color.hex2
            ? `background: linear-gradient(135deg, ${color.hex} 50%, ${color.hex2} 50%);`
            : `background: ${color.hex};`;
        html += `<button class="color-swatch${i === 0 ? ' active' : ''}" style="${bg}" 
                    onclick="selectColor('${keyboardSlug}', keyboardColors['${keyboardSlug}'][${i}])" 
                    title="${color.name}"></button>`;
    });

    swatchContainer.innerHTML = html;
    selector.style.display = 'block';
}

function selectColor(keyboardSlug, colorObj) {
    state.keyboardColor = colorObj.name;

    // Update color name label
    const nameEl = document.getElementById('color-name');
    if (nameEl) nameEl.textContent = colorObj.name;

    // Update active swatch
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    const colors = keyboardColors[keyboardSlug];
    const idx = colors.findIndex(c => c.slug === colorObj.slug);
    const swatches = document.querySelectorAll('.color-swatch');
    if (idx >= 0 && swatches[idx]) swatches[idx].classList.add('active');

    // Update left panel keyboard image
    const kbImg = document.querySelector('#img-keyboard img');
    if (kbImg && colorObj.img) {
        kbImg.src = colorObj.img;
    }

    // Update thumbnail in the keyboard option card
    const thumbImg = document.querySelector('#card-kb-' + keyboardSlug + ' .apple-option-thumb img');
    if (thumbImg && colorObj.img) {
        thumbImg.src = colorObj.img;
    }

    updateSummary();
}

// Make selectColor globally accessible
window.selectColor = selectColor;

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

    // Update left panel image to show selected add-on
    if (state.addons.length > 0) {
        const lastAddon = state.addons[state.addons.length - 1];
        const addonImgMap = { stand: 'images/addon-stand.png', ssd: 'images/addon-ssd.png' };
        const addImg = document.querySelector('#img-addons img');
        if (addImg && addonImgMap[lastAddon]) {
            addImg.src = addonImgMap[lastAddon];
        }
    }

    updateSummary();
}

// ── UPDATE SUMMARY ──
function updateSummary() {
    const lines = document.getElementById('summary-lines');
    const totalEl = document.getElementById('summary-total');
    const priceEl = document.getElementById('total-price');
    const proceedBtn = document.getElementById('proceed-btn');

    if (!state.bundle && !state.monitor) {
        lines.innerHTML = '<div class="summary-empty">Select your bundle to start building.</div>';
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
        let kbName = names.keyboard[state.keyboard] || state.keyboard;
        if (state.keyboardColor) kbName += ' — ' + state.keyboardColor;
        html += summaryItem(kbName);
    }
    // Add-ons show WITH price
    state.addons.forEach(a => {
        const p = prices.addon[a] || 0;
        total += p;
        html += summaryLine(names.addon[a] || a, p);
    });

    lines.innerHTML = html;

    // Only show total and enable proceed when all 3 are selected
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

// Summary line without price (Apple-style checkmark)
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

    // Set up IntersectionObserver for image switching
    setupStepObserver();
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
                keyboard_color: state.keyboardColor,
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

document.querySelectorAll('.reveal, .config-step, .contact-section').forEach(el => {
    observer.observe(el);
});

// ── HERO SLIDESHOW ──
const slides = document.querySelectorAll('.hero-slideshow .slide');
const dots = document.querySelectorAll('.slideshow-dots .dot');
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
    const contentsEl = document.getElementById('bundle-contents');
    if (contentsEl) contentsEl.style.display = 'none';
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

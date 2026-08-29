// DOM ready hote hi preloader hide (fast)
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        var preloader = document.getElementById('preloader');
        if (preloader) preloader.classList.add('hide');
    }, 500);
});

window.addEventListener('load', () => {
    setTimeout(() => preloader.classList.add('hide'), 500);
});

// FALLBACK: Agar sections hide rahein to 2 sec baad dikha do
setTimeout(function() {
    document.querySelectorAll('.reveal').forEach(function(el) {
        el.classList.add('in-view');
    });
}, 2000);

// Header shrink on scroll
const headerEl = document.querySelector('header');
window.addEventListener('scroll', () => {
    headerEl.classList.toggle('scrolled', window.scrollY > 40);
});

// Mobile nav
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');
navToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
    navToggle.classList.toggle('open');
});
function closeNav() { mainNav.classList.remove('open'); navToggle.classList.remove('open'); }

// Hero slider
const slides = document.querySelectorAll('.hero-slide-bg');
const dotsWrap = document.getElementById('slideDots');
let currentSlide = 0;
slides.forEach((_, i) => {
    const dot = document.createElement('button');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(i));
    dotsWrap.appendChild(dot);
});
function goToSlide(i) {
    slides[currentSlide].classList.remove('active');
    dotsWrap.children[currentSlide].classList.remove('active');
    currentSlide = i;
    slides[currentSlide].classList.add('active');
    dotsWrap.children[currentSlide].classList.add('active');
}
function nextSlide() { const next = (currentSlide + 1) % slides.length; goToSlide(next); }
setInterval(nextSlide, 4500);

// Recharge modal
function openRechargeModal() {
    document.getElementById('rechargeModalOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
}
function closeRechargeModal() {
    document.getElementById('rechargeModalOverlay').classList.remove('show');
    document.body.style.overflow = '';
    resetRechargeModal();
}
function closeRechargeModalOnOverlay(e) {
    if (e.target.id === 'rechargeModalOverlay') closeRechargeModal();
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeRechargeModal(); }
});

// Recharge & Check Plan data
const CUSTOMER_DATA_URL = 'https://script.google.com/macros/s/AKfycbyzWRsnhYnVX_o9L1eRptc14-cZ3I6_oBbMlug6xspzL7Op_tskH9iXCSVH3XYeAMkYvw/exec';
const planCatalog = {
    lite:  { name: "Lite Plan",  speed: "30 Mbps",  amount: 599 },
    pro:   { name: "Pro Plan",   speed: "50 Mbps",  amount: 799 },
    boost: { name: "Boost Plan", speed: "100 Mbps", amount: 1150 }
};
let activeRechargeCustomer = null;

function setFetchButtonLoading(isLoading) {
    const btn = document.getElementById('rechargeFetchBtn');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? '<i class="fas fa-spinner fa-spin"></i> Fetching...' : '<i class="fas fa-magnifying-glass"></i> Fetch';
}

function fetchUserDetails() {
    const idInput = document.getElementById('rechargeUserId').value.trim().toUpperCase();
    const mobileInput = document.getElementById('rechargeMobile').value.trim();
    const errorBox = document.getElementById('rechargeLoginError');
    errorBox.style.display = 'none';
    if (!idInput || !mobileInput) {
        errorBox.innerHTML = '<i class="fas fa-circle-exclamation"></i> Please enter both User ID and Mobile Number.';
        errorBox.style.display = 'block';
        return;
    }
    setFetchButtonLoading(true);
    fetch(CUSTOMER_DATA_URL + '?action=customer&userId=' + encodeURIComponent(idInput))
        .then(res => res.json())
        .then(record => {
            setFetchButtonLoading(false);
            if (!record || record.error) {
                errorBox.innerHTML = '<i class="fas fa-circle-exclamation"></i> Server se sahi response nahi mila (' + (record && record.error ? record.error : 'unknown error') + '). Apps Script deployment check karein.';
                errorBox.style.display = 'block';
                return;
            }
            if (!record.found || String(record.mobile).trim() !== mobileInput) {
                errorBox.innerHTML = '<i class="fas fa-circle-exclamation"></i> User ID / Mobile number match nahi hua. Dobara check karein ya support ko call karein.';
                errorBox.style.display = 'block';
                return;
            }
            activeRechargeCustomer = Object.assign({ id: idInput }, record);
            renderUserDetailsAndPlans();
            document.getElementById('rechargeLoginStep').style.display = 'none';
            document.getElementById('rechargeHeaderSub').textContent = 'Hi ' + record.name.split(' ')[0] + ', here are your details.';
            document.getElementById('rechargePlanList').style.display = '';
        })
        .catch(err => {
            setFetchButtonLoading(false);
            errorBox.innerHTML = '<i class="fas fa-circle-exclamation"></i> Data fetch nahi ho paya. Internet check karein ya thodi der me try karein.';
            errorBox.style.display = 'block';
            console.error('Customer fetch failed:', err);
        });
}

function buildPlanCardHtml(planKey, plan, isCurrent) {
    const nameLabel = isCurrent ? plan.name + ' <span class="rpb-tag">Current Plan</span>' : plan.name;
    return '<div class="recharge-plan-btn' + (isCurrent ? ' featured' : '') + '">' +
            '<div class="rpb-left">' +
                '<div class="rpb-name">' + nameLabel + '</div>' +
                '<div class="rpb-speed">' + plan.speed + '</div>' +
            '</div>' +
            '<div class="rpb-right">' +
                '<div class="rpb-price">₹' + plan.amount + '</div>' +
                '<button type="button" class="upi-pay-btn" onclick="showUpiQr(\'' + plan.name + '\',\'' + plan.speed + '\',' + plan.amount + ')"><i class="fas fa-bolt"></i> Pay Now</button>' +
            '</div>' +
        '</div>';
}

function renderUserDetailsAndPlans() {
    const currentKey = activeRechargeCustomer.plan;
    const current = planCatalog[currentKey];
    const today = new Date();
    today.setHours(0,0,0,0);
    const expiryDate = new Date(activeRechargeCustomer.expiry + 'T00:00:00');
    const daysLeft = Math.round((expiryDate - today) / 86400000);
    let badgeClass, badgeText;
    if (daysLeft < 0) { badgeClass = 'expired'; badgeText = 'Expired'; }
    else if (daysLeft <= 5) { badgeClass = 'soon'; badgeText = 'Expiring Soon'; }
    else { badgeClass = 'active'; badgeText = 'Active'; }
    const formattedExpiry = expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const daysText = daysLeft < 0 ? Math.abs(daysLeft) + ' days ago' : daysLeft + ' days left';
    document.getElementById('rechargeUserDetailsCard').innerHTML = `
        <div class="cpr-card" style="margin-bottom:18px;">
            <div class="cpr-row"><span class="cpr-label">Customer</span><span class="cpr-value">${activeRechargeCustomer.name}</span></div>
            <div class="cpr-row"><span class="cpr-label">User ID</span><span class="cpr-value">${activeRechargeCustomer.id}</span></div>
            <div class="cpr-row"><span class="cpr-label">Current Plan</span><span class="cpr-value">${current.name} - ${current.speed}</span></div>
            <div class="cpr-row"><span class="cpr-label">Expiry Date</span><span class="cpr-value">${formattedExpiry}</span></div>
            <div class="cpr-row"><span class="cpr-label">Status</span><span class="cpr-badge ${badgeClass}">${badgeText} · ${daysText}</span></div>
        </div>`;
    const allKeys = Object.keys(planCatalog);
    document.getElementById('rechargeAllPlans').innerHTML = allKeys.map(k => buildPlanCardHtml(k, planCatalog[k], k === currentKey)).join('');
}

function resetRechargeModal() {
    document.getElementById('upiQrView').classList.remove('show');
    document.getElementById('rechargePlanList').style.display = 'none';
    document.getElementById('rechargeModalFooter').style.display = '';
    document.getElementById('rechargeLoginStep').style.display = '';
    document.getElementById('rechargeHeaderSub').textContent = 'Enter your User ID & Mobile Number to continue.';
    document.getElementById('rechargeUserId').value = '';
    document.getElementById('rechargeMobile').value = '';
    document.getElementById('rechargeLoginError').style.display = 'none';
    activeRechargeCustomer = null;
}
function copyUpiId() {
    const id = document.getElementById('upiIdText2').textContent.trim();
    const btn = document.getElementById('upiCopyBtn2');
    navigator.clipboard.writeText(id).then(() => {
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.classList.add('copied');
        setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; btn.classList.remove('copied'); }, 1800);
    }).catch(() => { alert('UPI ID: ' + id); });
}
const UPI_ID = '9984389923@ybl';
const UPI_PAYEE = 'Shan Zone Broadband';
let currentUpiPlan = { name: '', speed: '', amount: 0 };
function switchUpiTab(tab) {
    const qrBtn = document.getElementById('upiTabBtnQr');
    const idBtn = document.getElementById('upiTabBtnId');
    const qrPanel = document.getElementById('upiTabQr');
    const idPanel = document.getElementById('upiTabId');
    if (tab === 'qr') { qrBtn.classList.add('active'); idBtn.classList.remove('active'); qrPanel.classList.add('show'); idPanel.classList.remove('show'); }
    else { idBtn.classList.add('active'); qrBtn.classList.remove('active'); idPanel.classList.add('show'); qrPanel.classList.remove('show'); }
}
function updateUpiPaymentLinks() {
    const custId = document.getElementById('upiCustId').value.trim();
    let note = currentUpiPlan.name + ' Recharge';
    if (custId) note += ' - ID ' + custId;
    const upiLink = 'upi://pay?pa=' + encodeURIComponent(UPI_ID) + '&pn=' + encodeURIComponent(UPI_PAYEE) + '&am=' + currentUpiPlan.amount + '&cu=INR&tn=' + encodeURIComponent(note);
    document.getElementById('upiOpenAppBtn').href = upiLink;
    const canvasWrap = document.getElementById('upiQrCanvas');
    canvasWrap.innerHTML = '';
    if (window.QRCode) {
        new QRCode(canvasWrap, { text: upiLink, width: 168, height: 168, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    } else {
        canvasWrap.innerHTML = '<span style="color:#333;font-size:11px;padding:10px;display:block;">QR unavailable — use Open in UPI App button below</span>';
    }
}
function showUpiQr(planName, speed, amount) {
    currentUpiPlan = { name: planName, speed: speed, amount: amount };
    document.getElementById('upiQrPlanName').textContent = planName + ' · ' + speed;
    document.getElementById('upiQrAmount').textContent = '₹' + amount;
    document.getElementById('upiTabIdAmount').textContent = '₹' + amount;
    document.getElementById('upiCustId').value = '';
    switchUpiTab('qr');
    updateUpiPaymentLinks();
    const ivePaidBtn = document.getElementById('ivePaidBtn');
    ivePaidBtn.disabled = false;
    ivePaidBtn.innerHTML = '<i class="fas fa-circle-check"></i> I\'ve Paid';
    const ivePaidMsg = document.getElementById('ivePaidMessage');
    ivePaidMsg.textContent = '';
    ivePaidMsg.className = 'ive-paid-message';
    document.getElementById('rechargePlanList').style.display = 'none';
    document.getElementById('rechargeModalFooter').style.display = 'none';
    document.getElementById('upiQrView').classList.add('show');
}
function submitPaymentClaim() {
    const btn = document.getElementById('ivePaidBtn');
    const msg = document.getElementById('ivePaidMessage');
    const custId = document.getElementById('upiCustId').value.trim();
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    msg.textContent = '';
    msg.className = 'ive-paid-message';
    const payload = {
        userId: (activeRechargeCustomer && activeRechargeCustomer.id) || custId || 'UNKNOWN',
        name: (activeRechargeCustomer && activeRechargeCustomer.name) || '',
        plan: currentUpiPlan.name,
        amount: currentUpiPlan.amount
    };
    fetch(CUSTOMER_DATA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    }).then(res => res.json()).then(result => {
        if (result && result.status === 'duplicate') {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-check"></i> Already Submitted';
            msg.textContent = 'Ye claim already submit ho chuka hai — verify hone ka wait karein.';
            msg.classList.add('success');
            return;
        }
        btn.innerHTML = '<i class="fas fa-circle-check"></i> Claim Submitted';
        msg.textContent = 'Dhanyawad! Aapki payment verify hone ke baad plan activate ho jayega.';
        msg.classList.add('success');
    }).catch(err => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-circle-check"></i> I\'ve Paid';
        msg.textContent = 'Submit nahi ho paya. Internet check karke dobara try karein, ya seedha call kar dein.';
        msg.classList.add('error');
        console.error('Payment claim failed:', err);
    });
}
function backToPlanList() {
    document.getElementById('upiQrView').classList.remove('show');
    document.getElementById('rechargePlanList').style.display = '';
    document.getElementById('rechargeModalFooter').style.display = '';
}

// Magnetic buttons
document.querySelectorAll('.btn-quote, .btn-ghost-light, .btn-whatsapp-green').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.35}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'translate(0,0)'; });
});

// Cursor spotlight
const heroSpotlight = document.getElementById('heroSpotlight');
const heroSection = document.querySelector('.hero');
heroSection.addEventListener('mousemove', (e) => {
    const rect = heroSection.getBoundingClientRect();
    heroSpotlight.style.left = (e.clientX - rect.left) + 'px';
    heroSpotlight.style.top = (e.clientY - rect.top) + 'px';
});

// 3D tilt on pricing cards
document.querySelectorAll('.price-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotateX = ((y / rect.height) - 0.5) * -8;
        const rotateY = ((x / rect.width) - 0.5) * 8;
        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
});

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });
revealEls.forEach(el => observer.observe(el));

// Scroll progress bar
const progressBar = document.getElementById('scrollProgress');
window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = pct + '%';
});

// Back to top
const backToTop = document.getElementById('backToTop');
window.addEventListener('scroll', () => {
    backToTop.classList.toggle('show', window.scrollY > 500);
});
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Count-up stats
const countEls = document.querySelectorAll('[data-count-to]');
const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            const target = parseInt(el.getAttribute('data-count-to'), 10);
            const suffix = el.getAttribute('data-suffix') || '';
            const duration = 1400;
            const startTime = performance.now();
            function step(now) {
                const progress = Math.min((now - startTime) / duration, 1);
                const value = Math.floor(progress * target);
                el.textContent = value + suffix;
                if (progress < 1) requestAnimationFrame(step);
                else el.textContent = target + suffix;
            }
            requestAnimationFrame(step);
            countObserver.unobserve(el);
        }
    });
}, { threshold: 0.6 });
countEls.forEach(el => countObserver.observe(el));

// Contact form
function handlePremiumContact() {
    var n = document.getElementById('pname').value;
    var e = document.getElementById('pemail').value;
    var p = document.getElementById('pphone').value;
    var m = document.getElementById('pmessage').value;
    if (!n || !p || !m) return alert("Kripya sahi jankari bharein!");
    var text = `New Connection Request:%0aName: ${n}%0aEmail: ${e}%0aPhone: ${p}%0aMessage: ${m}`;
    window.open("https://wa.me/916391224488?text=" + text);
}

function sendToWhatsapp(plan) {
    window.open("https://wa.me/916391224488?text=I am interested in " + plan);
}

function submitLeadCard() {
    var n = document.getElementById('leadName').value;
    var p = document.getElementById('leadPhone').value;
    var a = document.getElementById('leadArea').value;
    if (!n || !p || !a) return alert("Kripya sahi jankari bharein!");
    var text = `Check Availability Request:%0aName: ${n}%0aPhone: ${p}%0aArea: ${a}`;
    window.open("https://wa.me/916391224488?text=" + text);
}

// Area toggle + autocomplete (data.js provides LOCAL_AREA_DATA, CENSUS_VILLAGES, BLOCK_DATA, DISTRICT_NAMES)
let areaMode = 'village';
function setAreaMode(mode) {
    areaMode = mode;
    document.querySelectorAll('.area-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    const input = document.getElementById('leadArea');
    const inputWrap = document.querySelector('.area-input-wrap');
    const blockWrap = document.getElementById('blockSelectWrap');
    document.getElementById('areaSuggestions').classList.remove('show');
    if (mode === 'block') {
        inputWrap.style.display = 'none';
        blockWrap.style.display = 'flex';
        return;
    }
    inputWrap.style.display = 'block';
    blockWrap.style.display = 'none';
    input.value = '';
    if (mode === 'pin') {
        input.placeholder = 'Enter 6-digit PIN code';
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('maxlength', '6');
    } else {
        input.placeholder = 'Type village name (min 2 letters)';
        input.removeAttribute('inputmode');
        input.removeAttribute('maxlength');
    }
}
function onBlockDistrictChange() {
    const dist = document.getElementById('blockDistrictSelect').value;
    const blockSelect = document.getElementById('blockNameSelect');
    blockSelect.innerHTML = '<option value="">Select Block</option>';
    if (!dist) { blockSelect.disabled = true; return; }
    BLOCK_DATA[dist].forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        blockSelect.appendChild(opt);
    });
    blockSelect.disabled = false;
}
function onBlockSelect() {
    const dist = document.getElementById('blockDistrictSelect').value;
    const block = document.getElementById('blockNameSelect').value;
    if (!dist || !block) return;
    document.getElementById('leadArea').value = `${block} Block, ${DISTRICT_NAMES[dist]}`;
}
function handleAreaInput() {
    const query = document.getElementById('leadArea').value.trim();
    const box = document.getElementById('areaSuggestions');
    if (areaMode === 'village') {
        if (query.length < 2) { box.classList.remove('show'); return; }
        searchLocalVillage(query);
    } else {
        if (!query.length) { box.classList.remove('show'); return; }
        searchLocalPin(query);
    }
}
function renderAreaResults(list) {
    const box = document.getElementById('areaSuggestions');
    if (!list.length) {
        box.innerHTML = '<div class="area-suggestion-empty">No matches in Maharajganj, Kushinagar or Gorakhpur — try another spelling</div>';
        box.classList.add('show');
        return;
    }
    box.innerHTML = list.slice(0, 8).map(p => {
        const isPin = /^\d{6}$/.test(p[1]);
        const districtName = DISTRICT_NAMES[p[2]];
        const value = isPin ? `${p[0]} - ${p[1]}` : `${p[0]} (${p[1]} Tehsil), ${districtName}`;
        const subtitle = isPin ? `${districtName}, Uttar Pradesh — PIN ${p[1]}` : `${p[1]} Tehsil, ${districtName} — no individual PIN listed`;
        return `<div class="area-suggestion-item" onclick="selectArea('${value.replace(/'/g, "\\'")}')">
            ${p[0]}
            <small>${subtitle}</small>
        </div>`;
    }).join('');
    box.classList.add('show');
}
function searchLocalVillage(query) {
    const q = query.toLowerCase();
    const pinMatches = LOCAL_AREA_DATA.filter(p => p[0].toLowerCase().includes(q));
    const censusMatches = CENSUS_VILLAGES.filter(p => p[0].toLowerCase().includes(q));
    renderAreaResults([...pinMatches, ...censusMatches]);
}
function searchLocalPin(query) {
    const matches = LOCAL_AREA_DATA.filter(p => p[1].startsWith(query));
    renderAreaResults(matches);
}
function selectArea(value) {
    document.getElementById('leadArea').value = value;
    document.getElementById('areaSuggestions').classList.remove('show');
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('.area-input-wrap') && !e.target.closest('.area-toggle')) {
        const box = document.getElementById('areaSuggestions');
        if (box) box.classList.remove('show');
    }
});

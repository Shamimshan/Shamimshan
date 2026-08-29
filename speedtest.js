// ================================================
// SPEEDTEST.JS — Real Speed Test using Cloudflare
// ================================================

// Constants
const GAUGE_ARC_LENGTH = 401.4;
const GAUGE_TICKS = [0, 5, 10, 50, 100, 250, 500, 750, 1000];
const GAUGE_ANGLES = [-125, -93.75, -62.5, -31.25, 0, 31.25, 62.5, 93.75, 125];
const DOWNLOAD_URL = "https://speed.cloudflare.com/__down?bytes=26214400";
const UPLOAD_URL = "https://speed.cloudflare.com/__up";
const PING_ENDPOINT = "https://speed.cloudflare.com/__down?bytes=0";
const DOWNLOAD_CONCURRENCY = 6;
const UPLOAD_CONCURRENCY = 4;
const WARMUP_MS = 700;
const MEASURE_MS = 4000;
const UPLOAD_MEASURE_MS = 3500;

function valueToGaugeAngle(mbps) {
    const v = Math.max(0, Math.min(mbps, 1000));
    for (let i = 0; i < GAUGE_TICKS.length - 1; i++) {
        if (v >= GAUGE_TICKS[i] && v <= GAUGE_TICKS[i + 1]) {
            const t = (v - GAUGE_TICKS[i]) / (GAUGE_TICKS[i + 1] - GAUGE_TICKS[i]);
            return GAUGE_ANGLES[i] + t * (GAUGE_ANGLES[i + 1] - GAUGE_ANGLES[i]);
        }
    }
    return GAUGE_ANGLES[GAUGE_ANGLES.length - 1];
}

function setGauge(mbps) {
    const angle = valueToGaugeAngle(mbps);
    const pct = (angle - GAUGE_ANGLES[0]) / (GAUGE_ANGLES[GAUGE_ANGLES.length - 1] - GAUGE_ANGLES[0]);
    document.getElementById('gaugeFill').style.strokeDashoffset = GAUGE_ARC_LENGTH - pct * GAUGE_ARC_LENGTH;
    document.getElementById('gaugeNeedle').style.transform = `rotate(${angle}deg)`;
    document.getElementById('gaugeCenterVal').textContent = mbps.toFixed(mbps < 10 ? 2 : 1);
}

async function measurePingAndJitter() {
    const samples = [];
    for (let i = 0; i < 7; i++) {
        const t0 = performance.now();
        try {
            await fetch(PING_ENDPOINT + '&cb=' + Math.random() + Date.now(), { mode: 'cors', cache: 'no-store' });
        } catch (e) { /* ignore */ }
        samples.push(performance.now() - t0);
    }
    samples.shift();
    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    let jitterSum = 0;
    for (let i = 1; i < samples.length; i++) jitterSum += Math.abs(samples[i] - samples[i - 1]);
    const jitter = jitterSum / (samples.length - 1);
    return { ping: Math.round(median), jitter: jitter.toFixed(1) };
}

async function fetchIspInfo() {
    try {
        const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
        const data = await res.json();
        document.getElementById('stIsp').textContent = data.org || 'Unknown';
        document.getElementById('stIp').textContent = data.ip || '—';
        document.getElementById('stLoc').textContent = [data.city, data.region].filter(Boolean).join(', ') || '—';
        document.getElementById('stIspRow').style.display = 'flex';
    } catch (e) {
        document.getElementById('stIspRow').style.display = 'none';
    }
}

async function measureThroughput(kind, updateEl, concurrency, measureMs) {
    const testStart = performance.now();
    const warmupEndsAt = testStart + WARMUP_MS;
    const testEndsAt = warmupEndsAt + measureMs;

    let measuredBytes = 0;
    let measuredStart = null;
    let switchedToMeasuring = false;
    let finalMbps = 0;

    let gaugeRafScheduled = false;
    let gaugePendingValue = 0;
    let gaugeSmoothedValue = 0;
    function scheduleGaugeUpdate(mbps) {
        gaugePendingValue = mbps;
        if (gaugeRafScheduled) return;
        gaugeRafScheduled = true;
        requestAnimationFrame(() => {
            gaugeRafScheduled = false;
            gaugeSmoothedValue = gaugeSmoothedValue === 0
                ? gaugePendingValue
                : gaugeSmoothedValue * 0.65 + gaugePendingValue * 0.35;
            setGauge(gaugeSmoothedValue);
        });
    }

    function onChunk(len) {
        if (kind === 'download') {
            window.__stTotalBytes = (window.__stTotalBytes || 0) + len;
            document.getElementById('stData').textContent = (window.__stTotalBytes / 1e6).toFixed(1);
        }
        const now = performance.now();
        if (now < warmupEndsAt) return;
        if (!switchedToMeasuring) { switchedToMeasuring = true; measuredStart = now; }
        measuredBytes += len;
        const elapsedSec = (now - measuredStart) / 1000;
        if (elapsedSec > 0.05) {
            finalMbps = ((measuredBytes * 8) / 1e6) / elapsedSec;
            updateEl.textContent = finalMbps.toFixed(1);
            scheduleGaugeUpdate(finalMbps);
        }
    }

    async function downloadWorker() {
        while (performance.now() < testEndsAt) {
            try {
                const res = await fetch(DOWNLOAD_URL + '&cb=' + Math.random() + Date.now(), { cache: 'no-store', mode: 'cors' });
                if (!res.body) { const blob = await res.blob(); onChunk(blob.size); continue; }
                const reader = res.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    onChunk(value.length);
                    if (performance.now() >= testEndsAt) { reader.cancel(); break; }
                }
            } catch (e) { break; }
        }
    }

    async function uploadWorker() {
        const payload = new Blob([new Uint8Array(1_000_000)]);
        while (performance.now() < testEndsAt) {
            try {
                await fetch(UPLOAD_URL, { method: 'POST', body: payload, cache: 'no-store', mode: 'cors' });
                onChunk(payload.size);
            } catch (e) { break; }
        }
    }

    const worker = kind === 'download' ? downloadWorker : uploadWorker;
    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    const finalElapsedSec = measuredStart ? (performance.now() - measuredStart) / 1000 : 0;
    finalMbps = finalElapsedSec > 0 ? ((measuredBytes * 8) / 1e6) / finalElapsedSec : finalMbps;
    updateEl.textContent = finalMbps.toFixed(1);
    setGauge(finalMbps);
    return finalMbps;
}

function updateCategoryRatings(downloadMbps, uploadMbps, ping) {
    const ratings = {
        catBrowsing: downloadMbps >= 25 ? 5 : downloadMbps >= 10 ? 4 : downloadMbps >= 3 ? 3 : downloadMbps >= 1 ? 2 : 1,
        catGaming: (ping <= 30 && downloadMbps >= 15) ? 5 : (ping <= 60 && downloadMbps >= 8) ? 4 : (ping <= 100) ? 3 : 2,
        catStreaming: downloadMbps >= 50 ? 5 : downloadMbps >= 25 ? 4 : downloadMbps >= 10 ? 3 : downloadMbps >= 5 ? 2 : 1,
        catVideoChat: (uploadMbps >= 5 && downloadMbps >= 5) ? 5 : (uploadMbps >= 2 && downloadMbps >= 2) ? 4 : (uploadMbps >= 1) ? 3 : 2
    };
    Object.entries(ratings).forEach(([id, score]) => {
        const dotsWrap = document.querySelector(`#${id} .st-dots`);
        dotsWrap.innerHTML = Array.from({ length: 5 }, (_, i) =>
            `<span class="${i < score ? 'filled' : ''}"></span>`
        ).join('');
    });
}

async function runSpeedTest() {
    const btn = document.getElementById('stStartBtn');
    const downloadEl = document.getElementById('stDownload');
    const uploadEl = document.getElementById('stUpload');
    const pingEl = document.getElementById('stPing');
    const jitterEl = document.getElementById('stJitter');
    const dataEl = document.getElementById('stData');
    const statusEl = document.getElementById('stStatus');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
    downloadEl.textContent = '0';
    uploadEl.textContent = '0';
    dataEl.textContent = '0';
    pingEl.textContent = '--';
    jitterEl.textContent = '--';
    window.__stTotalBytes = 0;
    document.getElementById('gaugeWrap').classList.remove('gauge-hidden');
    document.getElementById('gaugeResultState').classList.remove('show');
    setGauge(0);

    fetchIspInfo();

    try {
        statusEl.textContent = 'Measuring ping & jitter...';
        const { ping, jitter } = await measurePingAndJitter();
        pingEl.textContent = ping;
        jitterEl.textContent = jitter;

        statusEl.textContent = 'Measuring download speed...';
        const downloadMbps = await measureThroughput('download', downloadEl, DOWNLOAD_CONCURRENCY, MEASURE_MS);

        statusEl.textContent = 'Measuring upload speed...';
        setGauge(0);
        const uploadMbps = await measureThroughput('upload', uploadEl, UPLOAD_CONCURRENCY, UPLOAD_MEASURE_MS);

        updateCategoryRatings(downloadMbps, uploadMbps, ping);
        statusEl.textContent = 'Test complete — run again anytime';

        document.getElementById('gaugeWrap').classList.add('gauge-hidden');
        document.getElementById('gaugeResultState').classList.add('show');
    } catch (err) {
        statusEl.textContent = 'Could not complete test. Check your connection and try again.';
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-gauge-high"></i> Test Again';
}

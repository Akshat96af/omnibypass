// ==UserScript==
// @name         Universal Link Bypass & Ad Cleaner (v10)
// @namespace    universal-bypass-final
// @version      10.0.0
// @description  Smart timer speedup with Cloudflare safety, configurable speed, auto-retry on errors.
// @author       You
// @match        *://*/*
// @exclude      *://www.google.*/*
// @exclude      *://www.youtube.com/*
// @exclude      *://github.com/*
// @exclude      *://mail.google.com/*
// @exclude      *://docs.google.com/*
// @exclude      *://drive.google.com/*
// @exclude      *://stackoverflow.com/*
// @exclude      *://chat.openai.com/*
// @exclude      *://chatgpt.com/*
// @exclude      *://claude.ai/*
// @exclude      *://web.whatsapp.com/*
// @exclude      *://*.instagram.com/*
// @exclude      *://twitter.com/*
// @exclude      *://x.com/*
// @exclude      *://*.reddit.com/*
// @exclude      *://*.amazon.*/*
// @exclude      *://*.flipkart.com/*
// @exclude      *://accounts.google.com/*
// @exclude      *://login.microsoftonline.com/*
// @exclude      *://*.netflix.com/*
// @exclude      *://open.spotify.com/*
// @exclude      *://challenges.cloudflare.com/*
// @exclude      *://challenge.cloudflare.com/*
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    //  CORE SETUP
    // ═══════════════════════════════════════════════════════════

    const isTopFrame = (window === window.top);
    const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    const CONFIG = {
        timerSpeedup: GM_getValue('om_bypass_timer', false),
        autoScroll: GM_getValue('om_bypass_scroll', false),
        autoClick: GM_getValue('om_bypass_click', false),
        adBlocker: GM_getValue('om_bypass_adblock', true),
        speed: GM_getValue('om_bypass_speed', 5)
    };

    let SPEED = CONFIG.timerSpeedup ? CONFIG.speed : 1;
    let cfDetected = false;

    // ── Store originals BEFORE any patching ──
    const _st = w.setTimeout;
    const _si = w.setInterval;
    const _ci = w.clearInterval;
    const _alert = w.alert;

    // ═══════════════════════════════════════════════════════════
    //  CLOUDFLARE SAFETY
    //  • Exits immediately on CF challenge pages
    //  • Detects Turnstile widgets and disables timer speedup
    //  • Does NOT patch Date.now / Date / performance.now
    // ═══════════════════════════════════════════════════════════

    const CF_HOSTS = ['challenges.cloudflare.com', 'challenge.cloudflare.com'];
    if (CF_HOSTS.some(h => location.hostname === h || location.hostname.endsWith('.' + h))) {
        return; // exit script entirely on CF challenge pages
    }

    const CF_SELECTORS = [
        '.cf-turnstile',
        '[data-turnstile-callback]',
        '[data-sitekey]',
        'iframe[src*="challenges.cloudflare.com"]',
        'iframe[src*="turnstile"]',
        '#cf-challenge-running',
        '#challenge-running',
        '.challenge-form',
        '#challenge-form',
        'iframe[src*="cloudflare.com/cdn-cgi/challenge"]',
        '#turnstile-wrapper',
        '.g-recaptcha',
        '.h-captcha',
        'iframe[src*="hcaptcha.com"]',
        'iframe[src*="recaptcha"]'
    ].join(', ');

    function checkCloudflare() {
        if (cfDetected) return true;
        try {
            if (document.querySelector(CF_SELECTORS)) {
                cfDetected = true;
                updateStatus('🛡️ CAPTCHA detected — timer paused');
                return true;
            }
        } catch (e) { }
        return false;
    }

    // Watch for CAPTCHAs that load dynamically after page start
    const cfObserver = new MutationObserver(() => { checkCloudflare(); });
    if (document.documentElement) {
        cfObserver.observe(document.documentElement, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            cfObserver.observe(document.documentElement, { childList: true, subtree: true });
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  TIMER PATCHING  (Cloudflare-safe)
    //
    //  KEY FIXES vs v9:
    //  1. Only patches setTimeout/setInterval — Date.now, Date
    //     constructor, and performance.now are LEFT UNTOUCHED.
    //     Those three are what Cloudflare/hCaptcha/reCAPTCHA
    //     fingerprint to detect tampering.
    //  2. Only speeds up delays >= 900ms. Countdown timers use
    //     1000ms; CAPTCHA internals use ~50–200ms.
    //  3. Checks cfDetected flag DYNAMICALLY on every call, so
    //     if a CAPTCHA appears mid-page the speedup stops.
    //  4. Minimum resulting delay is 50ms, not 1ms (prevents
    //     CPU burn from recursive setTimeout chains).
    // ═══════════════════════════════════════════════════════════

    try {
        w.setTimeout = function (fn, delay, ...args) {
            if (!cfDetected && typeof delay === 'number' && delay >= 900 && SPEED > 1) {
                delay = Math.max(Math.floor(delay / SPEED), 50);
            }
            return _st.call(this, fn, delay, ...args);
        };
        w.setInterval = function (fn, delay, ...args) {
            if (!cfDetected && typeof delay === 'number' && delay >= 900 && SPEED > 1) {
                delay = Math.max(Math.floor(delay / SPEED), 50);
            }
            return _si.call(this, fn, delay, ...args);
        };
    } catch (e) { }

    // ═══════════════════════════════════════════════════════════
    //  "BAD REQUEST" SUPPRESSION & AUTO-RETRY
    //
    //  When tpi.li (or similar) shows alert("Bad Request."),
    //  the script suppresses it and re-clicks the button after
    //  a progressive delay so the server-side timer expires.
    // ═══════════════════════════════════════════════════════════

    let lastClickedBtn = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    const BAD_PATTERNS = ['bad request', 'too fast', 'try again', 'please wait', 'invalid request'];

    try {
        w.alert = function (msg) {
            const msgLower = String(msg).toLowerCase();
            if (BAD_PATTERNS.some(p => msgLower.includes(p))) {
                console.log('[OmniBypass] Suppressed alert:', msg);

                if (lastClickedBtn && retryCount < MAX_RETRIES) {
                    retryCount++;
                    // Progressive: 4s → 6s → 9s → 12s → 15s
                    const delay = Math.min(2000 + retryCount * 2500, 15000);
                    updateStatus(`🔄 Retry ${retryCount}/${MAX_RETRIES} in ${(delay / 1000).toFixed(0)}s…`);

                    _st.call(w, () => {
                        if (lastClickedBtn) {
                            updateStatus(`🔄 Clicking — attempt ${retryCount}…`);
                            lastClickedBtn.click();
                        }
                    }, delay);
                } else if (retryCount >= MAX_RETRIES) {
                    updateStatus('❌ Max retries — click manually');
                    retryCount = 0;
                    _alert.call(this, msg); // show original alert
                }
                return;
            }
            return _alert.call(this, msg);
        };
    } catch (e) { }

    // ═══════════════════════════════════════════════════════════
    //  AD DOMAINS & BUTTON SELECTORS
    // ═══════════════════════════════════════════════════════════

    const AD_DOMAINS = [
        'crn77.com', 'network-loop.com', 'netpub.media', 'fstatic.netpub.media',
        'rkv1.com', 'ashrafidoria.com', 'madurird.com', 'jomtingi.net',
        'tmearn.net', 'clfrms.com', 'glizauvo.net', 'odsjrv.com',
        'tsyndicate.com', 'doubleclick.net', 'popads.net', 'popcash.net',
        'propellerads.com', 'mgid.com', 'exoclick.com', 'juicyads.com',
        'clickadu.com', 'hilltopads.net', 'trafficjunky.com', 'adsterra.com',
        'a-ads.com', 'ad-maven.com', 'adcash.com', 'richpush.com',
        'evadav.com', 'pushground.com', 'rollerads.com', 'monetag.com',
        'profitablegatecpm.com', 'highperformancegate.com',
        'highcpmrevenuegate.com', 'highperformanceformat.com',
        'highrevenuegate.com', 'highcpmgate.com',
        'highcpmcreativeformat.com', 'surfrfrr.com',
        'acscdn.com', 'acsbapp.com'
    ];

    const BTN_SELECTORS = [
        '#getnewlink', '#getmylink', '#gotolink', '#countingbtn',
        '#btn-main', '#getLink', '#dlink', '#download',
        '#submitFree', '#final_redirect', '#download-button',
        '#surl', '#glink', '#downloadbtn', '#btnproceedsubmit',
        '.get-link', '.skip', '.btn-lg.get-link',
        '.btn-captcha', '.download_button', '.wp2continuelink',
        '.gotlink', '#startButton', 'a[href*="continue"]'
    ];

    // ═══════════════════════════════════════════════════════════
    //  POPUP BLOCKING (window.open)
    // ═══════════════════════════════════════════════════════════

    const _open = w.open;
    const fakeWin = () => ({
        closed: false, close() { this.closed = true; }, focus() { }, blur() { },
        document: { write() { }, close() { }, open() { } }, location: { href: '' }
    });

    w.open = function (url, ...args) {
        if (!url) return fakeWin();
        if (CONFIG.adBlocker && AD_DOMAINS.some(d => String(url).toLowerCase().includes(d))) return fakeWin();
        return _open.call(this, url, ...args);
    };

    // ═══════════════════════════════════════════════════════════
    //  AD BLOCKER CSS
    // ═══════════════════════════════════════════════════════════

    const adBlockCSS = `
        #AdbModel, .adb-overlay, .adb-popup,
        [class*="fkgpk"], [id*="chp_ads_blocker"],
        #adblock-detector, .adblock-overlay, .adblock-modal,
        .adblock-notice, .ad-blocker-popup, [id*="adblock"],
        .detectModal, #detectModal {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            height: 0 !important;
            width: 0 !important;
        }
        ins[class*="adv-"], ins.adsbygoogle { display: none !important; }
        body, html {
            overflow: auto !important;
            user-select: auto !important;
            -webkit-user-select: auto !important;
        }
    `;

    const adStyle = document.createElement('style');
    adStyle.id = 'om-shield-css';

    function updateAdblockCSS() {
        if (CONFIG.adBlocker) {
            if (!document.getElementById('om-shield-css')) {
                adStyle.textContent = adBlockCSS;
                (document.head || document.documentElement).appendChild(adStyle);
            }
        } else {
            const s = document.getElementById('om-shield-css');
            if (s) s.remove();
        }
    }
    updateAdblockCSS();

    // ═══════════════════════════════════════════════════════════
    //  STATUS UPDATER (writes into the panel)
    // ═══════════════════════════════════════════════════════════

    function updateStatus(msg) {
        const el = document.getElementById('om-status-text');
        if (el) {
            el.textContent = msg;
            el.style.color = '#00e676';
            _st.call(w, () => { if (el) el.style.color = '#666'; }, 4000);
        }
        console.log('[OmniBypass]', msg);
    }

    // ═══════════════════════════════════════════════════════════
    //  UI — injected in the top frame only
    // ═══════════════════════════════════════════════════════════

    function injectUI() {
        if (!isTopFrame) return;
        if (!document.body || document.getElementById('om-bypass-ui-container')) return;

        const sp = CONFIG.speed;

        const ui = document.createElement('div');
        ui.id = 'om-bypass-ui-container';
        ui.innerHTML = `
<style>
  #om-bypass-panel *, #om-ui-minimized * { box-sizing: border-box; }
  #om-bypass-panel { transition: opacity .25s ease, transform .25s ease; }
  .om-row { display:flex; align-items:center; margin-bottom:10px; cursor:pointer; font-size:13px; user-select:none; color:#ccc; }
  .om-row input[type="checkbox"] { margin-right:8px; cursor:pointer; accent-color:#00e676; width:15px; height:15px; flex-shrink:0; }
  .om-speed-btn { width:28px; height:28px; border:1px solid #444; background:#2a2a3e; color:#fff; border-radius:6px; cursor:pointer; font-size:15px; display:flex; align-items:center; justify-content:center; transition:background .15s, transform .1s; line-height:1; }
  .om-speed-btn:hover { background:#4a4a6e; }
  .om-speed-btn:active { transform:scale(.92); }
</style>
<div id="om-bypass-panel" style="position:fixed; bottom:20px; right:20px; background:rgba(18,18,32,0.95); color:#eee; padding:16px 18px; border-radius:14px; z-index:2147483647; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; box-shadow:0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07); width:230px; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);">

    <!-- Header -->
    <div style="font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#00e676; margin-bottom:14px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
        ⚡ OmniBypass <span style="font-weight:400;color:#555;letter-spacing:0;">v10</span>
        <span id="om-close-btn" title="Minimize" style="cursor:pointer; color:#555; font-size:20px; line-height:1; transition:color .2s;">&times;</span>
    </div>

    <!-- [1] Timer Speed + Speed controls -->
    <div style="margin-bottom:12px;">
        <label class="om-row" style="margin-bottom:6px;">
            <input type="checkbox" id="om-toggle-timer" ${CONFIG.timerSpeedup ? 'checked' : ''}>
            [1] Timer Speed
        </label>
        <div id="om-speed-control" style="display:${CONFIG.timerSpeedup ? 'flex' : 'none'}; align-items:center; gap:8px; margin-left:24px;">
            <button class="om-speed-btn" id="om-speed-down" title="Decrease speed">−</button>
            <span id="om-speed-display" style="font-size:15px; font-weight:700; color:#00e676; min-width:36px; text-align:center;">${sp}x</span>
            <button class="om-speed-btn" id="om-speed-up" title="Increase speed">+</button>
        </div>
    </div>

    <!-- [2] Auto Scroll -->
    <label class="om-row">
        <input type="checkbox" id="om-toggle-scroll" ${CONFIG.autoScroll ? 'checked' : ''}>
        [2] Auto Scroll
    </label>

    <!-- [3] Auto Click -->
    <label class="om-row">
        <input type="checkbox" id="om-toggle-click" ${CONFIG.autoClick ? 'checked' : ''}>
        [3] Auto Click
    </label>

    <!-- [4] Ad Blocker -->
    <label class="om-row" style="margin-bottom:0;">
        <input type="checkbox" id="om-toggle-shield" ${CONFIG.adBlocker ? 'checked' : ''}>
        [4] Ad Blocker
    </label>

    <!-- Status Bar -->
    <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06);">
        <span id="om-status-text" style="font-size:11px; color:#666; transition:color .3s; display:block; line-height:1.4;">Ready</span>
    </div>

    <!-- Final Link Display -->
    <div id="om-final-link-container" style="display:none; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); font-size:11px; word-break:break-all;">
        <span style="color:#777;">🎯 Target Found (Press 5):</span><br>
        <a id="om-final-link" href="#" target="_blank" style="color:#00e676; text-decoration:none; font-weight:600; display:block; margin-top:4px; line-height:1.3; font-size:12px;"></a>
    </div>
</div>

<!-- Minimized Pill -->
<div id="om-ui-minimized" style="display:none; position:fixed; bottom:20px; right:20px; background:rgba(18,18,32,0.95); color:#00e676; border-radius:50%; z-index:2147483647; box-shadow:0 6px 20px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.07); cursor:pointer; width:46px; height:46px; justify-content:center; align-items:center; font-size:18px; transition:transform .2s; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);">
    ⚡
</div>`;

        document.body.appendChild(ui);

        // ── Panel minimize / restore ──
        const panel = document.getElementById('om-bypass-panel');
        const mini = document.getElementById('om-ui-minimized');

        document.getElementById('om-close-btn').addEventListener('click', () => {
            panel.style.display = 'none';
            mini.style.display = 'flex';
        });
        mini.addEventListener('click', () => {
            mini.style.display = 'none';
            panel.style.display = 'block';
        });

        // ── Timer toggle ──
        document.getElementById('om-toggle-timer').addEventListener('change', (e) => {
            CONFIG.timerSpeedup = e.target.checked;
            GM_setValue('om_bypass_timer', e.target.checked);
            SPEED = e.target.checked ? CONFIG.speed : 1;
            document.getElementById('om-speed-control').style.display = e.target.checked ? 'flex' : 'none';
            updateStatus(e.target.checked ? `Timer ${CONFIG.speed}x ON` : 'Timer OFF');
        });

        // ── Speed ± buttons ──
        document.getElementById('om-speed-down').addEventListener('click', () => {
            if (CONFIG.speed > 2) {
                CONFIG.speed--;
                GM_setValue('om_bypass_speed', CONFIG.speed);
                if (CONFIG.timerSpeedup) SPEED = CONFIG.speed;
                document.getElementById('om-speed-display').textContent = CONFIG.speed + 'x';
                updateStatus('Speed → ' + CONFIG.speed + 'x');
            }
        });
        document.getElementById('om-speed-up').addEventListener('click', () => {
            if (CONFIG.speed < 50) {
                CONFIG.speed++;
                GM_setValue('om_bypass_speed', CONFIG.speed);
                if (CONFIG.timerSpeedup) SPEED = CONFIG.speed;
                document.getElementById('om-speed-display').textContent = CONFIG.speed + 'x';
                updateStatus('Speed → ' + CONFIG.speed + 'x');
            }
        });

        // ── Other toggles ──
        document.getElementById('om-toggle-scroll').addEventListener('change', (e) => {
            CONFIG.autoScroll = e.target.checked;
            GM_setValue('om_bypass_scroll', e.target.checked);
            updateStatus(e.target.checked ? 'Auto Scroll ON' : 'Auto Scroll OFF');
        });
        document.getElementById('om-toggle-click').addEventListener('change', (e) => {
            CONFIG.autoClick = e.target.checked;
            GM_setValue('om_bypass_click', e.target.checked);
            updateStatus(e.target.checked ? 'Auto Click ON' : 'Auto Click OFF');
        });
        document.getElementById('om-toggle-shield').addEventListener('change', (e) => {
            CONFIG.adBlocker = e.target.checked;
            GM_setValue('om_bypass_adblock', e.target.checked);
            updateAdblockCSS();
            updateStatus(e.target.checked ? 'Ad Blocker ON' : 'Ad Blocker OFF');
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  KEYBOARD SHORTCUTS
    // ═══════════════════════════════════════════════════════════

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (e.key === '1') { const el = document.getElementById('om-toggle-timer'); if (el) el.click(); }
        else if (e.key === '2') { const el = document.getElementById('om-toggle-scroll'); if (el) el.click(); }
        else if (e.key === '3') { const el = document.getElementById('om-toggle-click'); if (el) el.click(); }
        else if (e.key === '4') { const el = document.getElementById('om-toggle-shield'); if (el) el.click(); }
        else if (e.key === '5') {
            const fl = document.getElementById('om-final-link');
            if (fl && fl.getAttribute('href') !== '#') fl.click();
        }
    });

    // ═══════════════════════════════════════════════════════════
    //  UTILITY
    // ═══════════════════════════════════════════════════════════

    function isVisible(el) {
        if (!el) return false;
        try {
            const r = el.getBoundingClientRect();
            const c = window.getComputedStyle(el);
            return (
                r.width > 0 && r.height > 0 &&
                c.display !== 'none' &&
                c.visibility !== 'hidden' &&
                c.opacity !== '0' &&
                !el.classList.contains('hidden')
            );
        } catch (e) { return false; }
    }

    // ═══════════════════════════════════════════════════════════
    //  STRIP POPUP onclick HANDLERS
    // ═══════════════════════════════════════════════════════════

    function stripPopups() {
        if (!CONFIG.adBlocker) return;
        document.querySelectorAll('[onclick]').forEach(el => {
            const oc = el.getAttribute('onclick') || '';
            if (/window\.open/i.test(oc)) {
                if (
                    AD_DOMAINS.some(d => oc.includes(d)) ||
                    (el.hasAttribute('href') && el.getAttribute('href') !== '#' && !el.getAttribute('href').startsWith('javascript:')) ||
                    (el.tagName === 'BUTTON' && el.closest('form'))
                ) {
                    el.removeAttribute('onclick');
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  AUTO ACTION  (Click + Scroll)
    //
    //  FIX: Uses a Map<element, timestamp> instead of a WeakSet.
    //  Entries expire after CLICK_RETRY_MS so buttons that were
    //  initially disabled/hidden get a second chance.
    //  FIX: scrolled flag uses a cooldown timestamp instead of a
    //  permanent boolean.
    // ═══════════════════════════════════════════════════════════

    const clickedMap = new Map();
    const CLICK_RETRY_MS = 3000; // re-attempt after 3 s — needed so buttons that change text ("Getting link..." → "Direct Download Link") get re-evaluated quickly
    let lastScrollTime = 0;

    function autoAction() {
        if (!CONFIG.autoClick && !CONFIG.autoScroll) return;

        const now = Date.now();
        let targetEl = null;

        if (CONFIG.autoClick) {
            // ── Main button scan ──
            const allBtns = document.querySelectorAll(
                BTN_SELECTORS.join(', ') + ', a, button, div.btn'
            );

            for (const btn of allBtns) {
                const lastTime = clickedMap.get(btn);
                if (lastTime && (now - lastTime) < CLICK_RETRY_MS) continue;

                const href = btn.getAttribute('href') || '';
                const hasRealRef = href.startsWith('http') || href.startsWith('//');
                const text = (btn.textContent || '').toLowerCase().trim();

                if (hasRealRef && AD_DOMAINS.some(d => href.includes(d))) continue;
                // NOTE: Do NOT skip buttons whose text includes 'getting' —
                // the site reuses the same element: it starts as "Getting link..."
                // (disabled) and then becomes "Direct Download Link" (enabled).
                // The disabled/loading check below already prevents premature clicks.

                const matchSel = BTN_SELECTORS.some(s => {
                    try { return btn.matches(s); } catch (_) { return false; }
                });
                const matchTxt = (
                    text === 'direct download link' ||
                    text.includes('direct download') ||
                    text.includes('click here to continue') ||
                    text === 'continue' ||
                    text === 'get link' ||
                    text === 'download' ||
                    text === 'download now' ||
                    text.includes('get my link') ||
                    text.includes('get new link')
                );

                if (!matchSel && !matchTxt) continue;

                // Skip if still in a loading/waiting/disabled state
                const isLoading = (
                    btn.hasAttribute('disabled') ||
                    btn.classList.contains('disabled') ||
                    btn.classList.contains('loading') ||
                    text.includes('getting link') ||
                    text.includes('please wait') ||
                    text.includes('loading')
                );
                if (!hasRealRef && isLoading) continue;

                if (isVisible(btn)) {
                    targetEl = btn;
                    clickedMap.set(btn, now);
                    lastClickedBtn = btn;
                    retryCount = 0; // reset retries for new button
                    _st.call(w, () => btn.click(), 500);
                    updateStatus('🖱️ Clicked: ' + text.slice(0, 28));
                    break; // one click per cycle
                }
            }

            // ── Retry buttons ──
            for (const btn of document.querySelectorAll('button')) {
                const lastTime = clickedMap.get(btn);
                if (lastTime && (now - lastTime) < CLICK_RETRY_MS) continue;
                if (btn.textContent.trim().toLowerCase() === 'retry' && isVisible(btn)) {
                    clickedMap.set(btn, now);
                    _st.call(w, () => btn.click(), 1000);
                }
            }

            // ── Form submissions ──
            for (const form of document.querySelectorAll('form')) {
                const lastTime = clickedMap.get(form);
                if (lastTime && (now - lastTime) < CLICK_RETRY_MS) continue;
                if (
                    (form.querySelector('input[name="token"]') ||
                        form.querySelector('input[name="alias"]')) &&
                    isVisible(form)
                ) {
                    targetEl = form;
                    clickedMap.set(form, now);
                    _st.call(w, () => {
                        const sbtn = form.querySelector(
                            'button[type="submit"], input[type="submit"], .get-link'
                        );
                        if (sbtn && !sbtn.hasAttribute('disabled') && !sbtn.classList.contains('disabled')) {
                            lastClickedBtn = sbtn;
                            retryCount = 0;
                            sbtn.click();
                        } else if (!sbtn) {
                            form.submit();
                        }
                    }, 500);
                }
            }
        }

        // ── Auto scroll (resets after 5 s cooldown) ──
        if (CONFIG.autoScroll && (now - lastScrollTime) > 5000) {
            const scrollTarget = targetEl || document.querySelector(
                '#myTimer, #newtimer, #myTimerDiv, .timer, .countdown, #countdown'
            );
            if (scrollTarget && isVisible(scrollTarget)) {
                const rect = scrollTarget.getBoundingClientRect();
                if (rect.top > window.innerHeight || rect.bottom < 0) {
                    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    lastScrollTime = now;
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  DOM AD REMOVAL  (throttled to every 2 s)
    // ═══════════════════════════════════════════════════════════

    let lastAdClean = 0;

    function removeDomAds() {
        if (!CONFIG.adBlocker) return;
        const now = Date.now();
        if (now - lastAdClean < 2000) return;
        lastAdClean = now;

        const removeSelectors = [
            '#AdbModel', '.adb-overlay', '.adb-popup',
            '[class*="fkgpk"]', '[id*="chp_ads_blocker"]',
            '#adblock-detector', '.adblock-overlay', '.adblock-modal'
        ];
        removeSelectors.forEach(s => {
            document.querySelectorAll(s).forEach(e => e.remove());
        });

        document.querySelectorAll('div, section, aside').forEach(el => {
            try {
                const cs = window.getComputedStyle(el);
                if (cs.position === 'fixed' || cs.position === 'absolute') {
                    const t = (el.innerText || '').toLowerCase();
                    if (
                        t.includes('blocker detected') ||
                        t.includes('disable your ad blocker') ||
                        t.includes('block ads') ||
                        t.includes('brave browser')
                    ) el.remove();
                }
            } catch (_) { }
        });

        document.querySelectorAll('script[src], iframe[src]').forEach(el => {
            if (AD_DOMAINS.some(d => el.src.includes(d))) el.remove();
        });

        if (document.body) {
            ['oncontextmenu', 'onselectstart', 'ondragstart', 'oncopy', 'oncut', 'onpaste'].forEach(e => {
                document.body[e] = null;
                document[e] = null;
            });
            document.body.removeAttribute('unselectable');
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  FINAL LINK SCANNER
    //  Finds the real download destination from:
    //  1. Known download-domain anchors (OlaMovies, GDrive, etc.)
    //  2. The green "Direct Download Link" button href
    //  3. Any visible <a> pointing to a file extension
    // ═══════════════════════════════════════════════════════════

    const FINAL_LINK_DOMAINS = [
        'drive.olamovies.download',
        'drive.google.com',
        'mega.nz',
        'mediafire.com',
        'pixeldrain.com',
        'gofile.io',
        'send.cm',
        'upstream.to',
        'dood.watch',
        'streamtape.com'
    ];
    const FINAL_FILE_EXTS = /\.(mkv|mp4|avi|zip|rar|pdf|apk|exe|iso)(\?|$)/i;

    function scanForFinalLink() {
        let finalHref = null;

        // 1. Preferred: known download domains
        for (const domain of FINAL_LINK_DOMAINS) {
            const el = document.querySelector(`a[href*="${domain}"]`);
            if (el) { finalHref = el.getAttribute('href'); break; }
        }

        // 2. Fallback: "Direct Download Link" button/anchor by text
        if (!finalHref) {
            document.querySelectorAll('a, button').forEach(el => {
                if (finalHref) return;
                const t = (el.textContent || '').toLowerCase().trim();
                if (t.includes('direct download') && el.getAttribute('href') && el.getAttribute('href') !== '#') {
                    finalHref = el.getAttribute('href');
                }
            });
        }

        // 3. Fallback: any visible anchor pointing to a file extension
        if (!finalHref) {
            document.querySelectorAll('a[href]').forEach(el => {
                if (finalHref) return;
                const h = el.getAttribute('href') || '';
                if (FINAL_FILE_EXTS.test(h) && isVisible(el)) {
                    finalHref = h;
                }
            });
        }

        if (finalHref) {
            const container = document.getElementById('om-final-link-container');
            const linkDisplay = document.getElementById('om-final-link');
            if (container && linkDisplay && linkDisplay.getAttribute('href') !== finalHref) {
                linkDisplay.setAttribute('href', finalHref);
                linkDisplay.textContent = finalHref;
                container.style.display = 'block';
                updateStatus('🎯 Target link found!');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  MAIN LOOP
    //  Uses the ORIGINAL setInterval so the loop itself does
    //  not accelerate (the old code used the patched version,
    //  which made it run at 100ms when speed=5x).
    // ═══════════════════════════════════════════════════════════

    function run() {
        checkCloudflare();
        injectUI();
        stripPopups();
        removeDomAds();
        autoAction();
        scanForFinalLink();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }

    _si.call(w, run, 600);

})();

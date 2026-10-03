// ==UserScript==
// @name         OmniBypass: Link Bypass & Ad Cleaner
// @namespace    universal-bypass-final
// @version      12.0.0
// @description  Speeds up shortlink timers, auto-clicks continue buttons, blocks popups and ad overlays, and surfaces the final download link.
// @author       OmniBypass
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
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const VERSION = '12.0.0';
    const isTopFrame = (window === window.top);
    const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    const loadSetting = (key, fallback) => {
        const v = GM_getValue(key, fallback);
        if (typeof v !== typeof fallback || (typeof v === 'number' && !Number.isFinite(v))) return fallback;
        return v;
    };

    const CONFIG = {
        timerSpeedup: loadSetting('om_bypass_timer', false),
        autoScroll:   loadSetting('om_bypass_scroll', false),
        autoClick:    loadSetting('om_bypass_click', false),
        adBlocker:    loadSetting('om_bypass_adblock', true),
        speed:        Math.min(50, Math.max(2, Math.round(loadSetting('om_bypass_speed', 5)))),
        animKiller:   loadSetting('om_bypass_anim', false)
    };

    let SPEED = CONFIG.timerSpeedup ? CONFIG.speed : 1;
    let cfDetected = false;

    const _st = w.setTimeout;
    const _si = w.setInterval;
    const _alert = w.alert;
    const _ci = w.clearInterval;
    const _Date = w.Date;
    const _dateNow = _Date.now.bind(_Date);
    const _perf = w.performance;
    const _perfNow = _perf.now.bind(_perf);
    const _raf = w.requestAnimationFrame.bind(w);

    let halted = false;
    const undo = [];

    const Logger = {
        _fmt: (lvl, args) => {
            const t = new _Date().toLocaleTimeString('en-US', { hour12: false });
            const ctx = isTopFrame ? 'top' : 'iframe';
            return [`[OmniBypass v${VERSION}] ${t} [${ctx}] ${lvl}:`, ...args];
        },
        debug: (...a) => console.debug(...Logger._fmt('DEBUG', a)),
        info:  (...a) => console.info(...Logger._fmt('INFO', a)),
        warn:  (...a) => console.warn(...Logger._fmt('WARN', a)),
        error: (...a) => console.error(...Logger._fmt('ERROR', a))
    };

    const CF_HOSTS = ['challenges.cloudflare.com', 'challenge.cloudflare.com'];
    if (CF_HOSTS.some(h => location.hostname === h || location.hostname.endsWith('.' + h)) ||
        /[?&]__cf_chl_/.test(location.search)) {
        return;
    }

    const CAPTCHA_SAFE_DOMAINS = [
        'google.com/recaptcha', 'gstatic.com/recaptcha', 'recaptcha.net',
        'hcaptcha.com', 'newassets.hcaptcha.com',
        'challenges.cloudflare.com', 'cloudflare.com/cdn-cgi',
        'turnstile', 'js.stripe.com'
    ];

    function isCaptchaSrc(src) {
        if (!src) return false;
        var low = String(src).toLowerCase();
        return CAPTCHA_SAFE_DOMAINS.some(function(d) { return low.includes(d); });
    }

    const CAPTCHA_CONTAINER_SEL = '.g-recaptcha, .h-captcha, .cf-turnstile, #turnstile-wrapper, [data-sitekey], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare"]';

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

    const CHALLENGE_SELECTORS = [
        '#challenge-running', '#challenge-stage', '#challenge-form', '#cf-challenge-running',
        '.cf-browser-verification',
        'script[src*="/cdn-cgi/challenge-platform/"][src*="/orchestrate/"]'
    ].join(', ');
    const CHALLENGE_TITLE = /^(just a moment|checking your browser|verifying you are human|performing security verification)/i;
    const CHALLENGE_TEXT = /performing security verification|checking if the site connection is secure|verifying you are human/i;

    function isChallengePage() {
        try {
            if (w._cf_chl_opt) return true;
            if (document.querySelector(CHALLENGE_SELECTORS)) return true;
            if (CHALLENGE_TITLE.test(document.title)) return true;
            const b = document.body;
            return !!b && b.childElementCount < 12 && CHALLENGE_TEXT.test(b.textContent.slice(0, 3000));
        } catch (_) { return false; }
    }

    function haltForChallenge() {
        if (halted) return;
        halted = true;
        cfDetected = true;
        undo.forEach((fn) => { try { fn(); } catch (_) { } });
        undo.length = 0;
        cfObserver.disconnect();
        if (mainObserver) mainObserver.disconnect();
        if (mainTimer) _ci.call(w, mainTimer);
        ['om-shield-css', 'om-anim-killer', 'om-bypass-ui-container'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        Logger.info('Cloudflare challenge detected, script halted');
    }

    function checkCloudflare() {
        if (halted) return true;
        if (isChallengePage()) {
            haltForChallenge();
            return true;
        }
        if (cfDetected) return true;
        try {
            if (document.querySelector(CF_SELECTORS)) {
                cfDetected = true;
                cfObserver.disconnect();
                updateStatus('CAPTCHA detected, timer paused');
                return true;
            }
        } catch (e) { }
        return false;
    }

    const cfObserver = new MutationObserver(() => { checkCloudflare(); });
    if (document.documentElement) {
        cfObserver.observe(document.documentElement, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            cfObserver.observe(document.documentElement, { childList: true, subtree: true });
        });
    }

    const clock = (() => {
        let scale = 1;
        let baseReal = _dateNow();
        let baseVirtual = baseReal;
        let basePerfReal = _perfNow();
        let basePerfVirtual = basePerfReal;

        const sync = () => {
            const next = cfDetected ? 1 : SPEED;
            if (next === scale) return;
            const d = _dateNow();
            const p = _perfNow();
            baseVirtual += (d - baseReal) * scale;
            baseReal = d;
            basePerfVirtual += (p - basePerfReal) * scale;
            basePerfReal = p;
            scale = next;
        };

        return {
            date: () => { sync(); return baseVirtual + (_dateNow() - baseReal) * scale; },
            perf: () => { sync(); return basePerfVirtual + (_perfNow() - basePerfReal) * scale; },
            perfFrom: (ts) => { sync(); return basePerfVirtual + (ts - basePerfReal) * scale; }
        };
    })();

    const scaleDelay = (delay) => {
        const d = Number(delay);
        if (cfDetected || SPEED <= 1 || !(d >= 50)) return delay;
        return Math.max(Math.floor(d / SPEED), 10);
    };

    try {
        w.setTimeout = function (fn, delay, ...args) {
            return _st.call(this, fn, scaleDelay(delay), ...args);
        };
        w.setInterval = function (fn, delay, ...args) {
            return _si.call(this, fn, scaleDelay(delay), ...args);
        };
        w.setTimeout.toString = function() { return _st.toString(); };
        w.setInterval.toString = function() { return _si.toString(); };
        undo.push(() => { w.setTimeout = _st; w.setInterval = _si; });
    } catch (e) { }

    let clockPatched = false;

    function patchClock() {
        if (clockPatched || halted) return;
        clockPatched = true;

        try {
            const dateNow = function now() { return Math.floor(clock.date()); };
            const VirtualDate = new Proxy(_Date, {
                construct(target, args, newTarget) {
                    return Reflect.construct(target, args.length ? args : [clock.date()], newTarget);
                },
                apply(target) {
                    return new target(clock.date()).toString();
                },
                get(target, prop) {
                    return prop === 'now' ? dateNow : Reflect.get(target, prop, target);
                }
            });
            w.Date = VirtualDate;
            _Date.prototype.constructor = VirtualDate;
            undo.push(() => { w.Date = _Date; _Date.prototype.constructor = _Date; });
        } catch (e) { }

        try {
            _perf.now = function now() { return clock.perf(); };
            undo.push(() => { delete _perf.now; });
        } catch (e) { }

        try {
            w.requestAnimationFrame = function (cb) {
                return typeof cb === 'function' ? _raf((ts) => cb(clock.perfFrom(ts))) : _raf(cb);
            };
            undo.push(() => { w.requestAnimationFrame = _raf; });
        } catch (e) { }
    }

    if (CONFIG.timerSpeedup) patchClock();

    let audioCtx = null;

    function playErrorBeep() {
        if (!CONFIG.adBlocker) return;
        try {
            if (!audioCtx) audioCtx = new (w.AudioContext || w.webkitAudioContext)();
            [0, 0.25].forEach((offset, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(i === 0 ? 800 : 600, audioCtx.currentTime + offset);
                gain.gain.setValueAtTime(0.25, audioCtx.currentTime + offset);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + offset + 0.2);
                osc.start(audioCtx.currentTime + offset);
                osc.stop(audioCtx.currentTime + offset + 0.2);
            });
        } catch (e) { Logger.warn('Audio playback failed:', e); }
    }

    let lastClickedBtn = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    const BAD_PATTERNS = ['bad request', 'too fast', 'try again', 'please wait', 'invalid request'];

    try {
        w.alert = function (msg) {
            if (cfDetected) return _alert.call(this, msg);

            const msgLower = String(msg).toLowerCase();
            if (lastClickedBtn && BAD_PATTERNS.some(p => msgLower.includes(p))) {
                Logger.info('Suppressed alert:', msg);

                if (lastClickedBtn && retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = Math.min(2000 + retryCount * 2500, 15000);
                    updateStatus(`Retry ${retryCount}/${MAX_RETRIES} in ${(delay / 1000).toFixed(0)}s`);

                    _st.call(w, () => {
                        if (lastClickedBtn) {
                            updateStatus(`Clicking, attempt ${retryCount}`);
                            simulateClick(lastClickedBtn);
                        }
                    }, delay);
                } else if (retryCount >= MAX_RETRIES) {
                    updateStatus('Max retries reached, click manually');
                    playErrorBeep();
                    retryCount = 0;
                    _alert.call(this, msg);
                }
                return;
            }
            return _alert.call(this, msg);
        };
        w.alert.toString = function() { return _alert.toString(); };
        undo.push(() => { w.alert = _alert; });
    } catch (e) { }

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
        'acscdn.com', 'acsbapp.com', 'links.ol-am.top'
    ];

    function isAdUrl(u) {
        try {
            const h = new URL(u, location.href).hostname;
            return AD_DOMAINS.some(d => h === d || h.endsWith('.' + d));
        } catch (_) { return false; }
    }

    const BTN_SELECTORS = [
        '#getnewlink', '#getmylink', '#gotolink', '#countingbtn',
        '#btn-main', '#getLink', '#dlink', '#download',
        '#submitFree', '#final_redirect', '#download-button',
        '#surl', '#glink', '#downloadbtn', '#btnproceedsubmit',
        '.get-link', '.skip', '.btn-lg.get-link',
        '.btn-captcha', '.download_button', '.wp2continuelink',
        '.gotlink', '#startButton', 'a[href*="continue"]'
    ];

    const _open = w.open;
    const fakeWin = () => ({
        closed: false, close() { this.closed = true; }, focus() { }, blur() { },
        document: { write() { }, close() { }, open() { } }, location: { href: '' }
    });

    w.open = function (url, ...args) {
        if (cfDetected || !CONFIG.adBlocker) return _open.call(this, url, ...args);

        const urlStr = String(url).toLowerCase();

        if (isCaptchaSrc(urlStr)) return _open.call(this, url, ...args);

        if (!url || urlStr === 'about:blank' || isAdUrl(urlStr)) {
            Logger.debug('Blocked popup:', urlStr);
            return fakeWin();
        }

        if (!args[1]) args[0] = '_self';
        return _open.call(this, url, ...args);
    };
    w.open.toString = function() { return _open.toString(); };
    undo.push(() => { w.open = _open; });

    function killIfAd(node) {
        if (node.tagName !== 'SCRIPT' && node.tagName !== 'IFRAME') return;
        const src = (node.src || node.getAttribute('src') || '').toLowerCase();
        if (isCaptchaSrc(src) || !isAdUrl(src)) return;
        node.type = 'javascript/blocked';
        node.src = '';
        node.remove();
        Logger.debug('Removed ad node:', src);
    }

    if (w.MutationObserver) {
        const adScriptObserver = new w.MutationObserver((mutations) => {
            if (!CONFIG.adBlocker || cfDetected) return;
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    killIfAd(node);
                    if (node.querySelectorAll) node.querySelectorAll('script, iframe').forEach(killIfAd);
                }
            }
        });
        adScriptObserver.observe(document.documentElement || document, { childList: true, subtree: true });
        undo.push(() => adScriptObserver.disconnect());
    }

    w.addEventListener('click', (e) => {
        if (!CONFIG.adBlocker || cfDetected) return;
        const target = e.target;
        if (!target || !target.style) return;

        try {
            if (target.closest('#om-bypass-ui-container')) return;
            if (target.closest(CAPTCHA_CONTAINER_SEL)) return;
            if (target.tagName === 'IFRAME') return;

            const cs = w.getComputedStyle(target);
            const isOverlay = (cs.position === 'absolute' || cs.position === 'fixed') &&
                              (parseInt(cs.zIndex) >= 9000 || parseInt(cs.width) >= w.innerWidth * 0.9);

            if (isOverlay && target.tagName !== 'BUTTON' && target.tagName !== 'A' &&
                target.tagName !== 'INPUT' && target.tagName !== 'LABEL') {
                Logger.debug('Blocked click on ad overlay');
                e.stopPropagation();
                e.preventDefault();
                target.remove();
            }
        } catch (_) { }
    }, true);

    let sameTabApplied = false;

    function applySameTab() {
        if (!CONFIG.adBlocker || sameTabApplied) return;
        sameTabApplied = true;
        document.addEventListener('click', (e) => {
            if (!CONFIG.adBlocker || cfDetected || e.ctrlKey || e.metaKey || e.shiftKey) return;
            const link = e.target.closest('a');
            if (link && link.href && !link.href.startsWith('javascript:') &&
                !link.closest('#om-bypass-ui-container')) {
                
                const target = (link.getAttribute('target') || '').toLowerCase();
                if (target === '_blank') {
                    e.preventDefault();
                    location.href = link.href;
                    Logger.info('Same-tab redirect:', link.href);
                }
            }
        }, true);
    }

    function applyAnimKiller() {
        if (!CONFIG.animKiller) return;
        if (document.getElementById('om-anim-killer')) return;
        const style = document.createElement('style');
        style.id = 'om-anim-killer';
        style.textContent = `
            * {
                animation-duration: 0s !important;
                animation-delay: 0s !important;
                transition-duration: 0s !important;
                transition-delay: 0s !important;
            }
            canvas:not(#om-bypass-ui-container canvas),
            [class*="particles"], [id*="particles"] {
                display: none !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
        document.querySelectorAll('canvas, [class*="particles-js"], [id*="particles"]').forEach(el => {
            if (!el.closest('#om-bypass-ui-container')) el.remove();
        });
        Logger.info('Animation killer active');
    }

    function removeAnimKiller() {
        const el = document.getElementById('om-anim-killer');
        if (el) el.remove();
    }

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

    const processing = new WeakSet();

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

    function simulateClick(el) {
        if (!el) return;
        el.removeAttribute('disabled');
        el.removeAttribute('target');
        ['mousemove', 'touchstart'].forEach(function(type) {
            document.dispatchEvent(new Event(type, { bubbles: true }));
        });
        ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(function(type) {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: w }));
        });
    }

    function setButtonFeedback(btn, state) {
        if (!btn) return;
        if (!btn.dataset.omOrigOutline) {
            btn.dataset.omOrigOutline = btn.style.outline || '';
        }
        var styles = {
            clicking: '2px solid orange',
            done:     '2px solid #00e676',
            error:    '2px solid #ff5252'
        };
        btn.style.outline = styles[state] || styles.error;
    }

    function restoreButton(btn, delay) {
        delay = delay || 3000;
        if (!btn || !btn.dataset) return;
        _st.call(w, function() {
            btn.style.outline = btn.dataset.omOrigOutline || '';
            delete btn.dataset.omOrigOutline;
        }, delay);
    }

    var b64Scanned = new WeakSet();
    function tryDecodeBase64Links() {
        var scripts = document.querySelectorAll('script:not([src])');
        for (var s = 0; s < scripts.length; s++) {
            if (b64Scanned.has(scripts[s])) continue;
            b64Scanned.add(scripts[s]);
            var text = scripts[s].textContent || '';
            var matches = text.match(/atob\s*\(\s*['"]([A-Za-z0-9+/=]{20,})['"]\s*\)/g);
            if (!matches) continue;
            for (var i = 0; i < matches.length; i++) {
                var b64 = matches[i].match(/['"]([A-Za-z0-9+/=]{20,})['"]/);
                if (!b64) continue;
                try {
                    var decoded = atob(b64[1]);
                    if (/^[A-Za-z0-9+/=]{20,}$/.test(decoded)) {
                        try { decoded = atob(decoded); } catch (_) { }
                    }
                    if (/^https?:\/\//i.test(decoded)) return decoded;
                } catch (_) { }
            }
        }
        return null;
    }

    const statusHistory = [];
    const MAX_STATUS_ENTRIES = 5;
    let shadow = null;
    const $ = (id) => (shadow ? shadow.getElementById(id) : null);

    const svg = (body) => '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
    const BOLT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z"/></svg>';
    const ICON_RESET = svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>');
    const ICON_MIN = svg('<path d="M5 12h14"/>');
    const ICON_PLUS = svg('<path d="M12 5v14M5 12h14"/>');

    function renderStatus() {
        const el = $('om-status-log');
        if (!el) return;
        el.replaceChildren(...statusHistory.map((s, i) => {
            const row = document.createElement('div');
            row.className = 'log-row';
            row.style.opacity = String(Math.max(1 - i * 0.18, 0.35));
            const ts = document.createElement('time');
            ts.textContent = s.t;
            const msg = document.createElement('span');
            msg.textContent = s.msg;
            row.append(ts, msg);
            return row;
        }));
    }

    function updateStatus(msg) {
        const t = new _Date().toLocaleTimeString('en-US', { hour12: false });
        statusHistory.unshift({ t, msg });
        if (statusHistory.length > MAX_STATUS_ENTRIES) statusHistory.pop();
        renderStatus();
        Logger.info(msg);
    }

    function resetConfig() {
        [
            'om_bypass_timer', 'om_bypass_scroll', 'om_bypass_click',
            'om_bypass_adblock', 'om_bypass_speed', 'om_bypass_anim', 'om_bypass_min'
        ].forEach((k) => GM_deleteValue(k));
        Logger.info('Config reset, reloading');
        location.reload();
    }

    const UI_CSS = `
        :host { all: initial; }
        *, *::before, *::after { box-sizing: border-box; }
        [hidden] { display: none !important; }
        .wrap {
            position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
            font: 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            color: #eceef4; -webkit-font-smoothing: antialiased; pointer-events: none;
        }
        .panel, .fab { pointer-events: auto; }
        .panel {
            width: 272px; padding: 14px; border-radius: 18px;
            background: rgba(15, 17, 25, 0.88);
            -webkit-backdrop-filter: blur(20px) saturate(140%); backdrop-filter: blur(20px) saturate(140%);
            border: 1px solid rgba(255, 255, 255, 0.09);
            box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
            transform-origin: bottom right;
            transition: opacity .18s ease, transform .18s ease, visibility 0s;
        }
        .fab {
            position: absolute; right: 0; bottom: 0; width: 48px; height: 48px; padding: 0;
            display: grid; place-items: center; border-radius: 50%; cursor: pointer;
            color: #34d399; background: rgba(15, 17, 25, 0.88);
            -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
            transition: opacity .18s ease, transform .18s ease, visibility 0s;
        }
        .fab:hover { transform: scale(1.06); }
        .fab-dot {
            position: absolute; top: 2px; right: 2px; width: 12px; height: 12px; border-radius: 50%;
            background: #34d399; border: 2px solid #0f1119;
        }
        .wrap.min .panel {
            opacity: 0; visibility: hidden; transform: scale(.96); pointer-events: none;
            transition: opacity .18s ease, transform .18s ease, visibility 0s linear .18s;
        }
        .wrap:not(.min) .fab {
            opacity: 0; visibility: hidden; transform: scale(.8); pointer-events: none;
            transition: opacity .18s ease, transform .18s ease, visibility 0s linear .18s;
        }
        .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .brand { display: flex; align-items: center; gap: 8px; }
        .mark {
            width: 28px; height: 28px; display: grid; place-items: center; border-radius: 9px;
            color: #04130d; background: linear-gradient(135deg, #6ee7b7, #10b981);
        }
        .name { font-weight: 650; font-size: 14px; letter-spacing: .1px; }
        .ver { font-size: 11px; color: #8d96a8; }
        .actions { display: flex; gap: 2px; }
        button { font: inherit; }
        .icon, .step button {
            display: grid; place-items: center; border: 0; cursor: pointer; color: #a0a8ba;
            background: transparent; transition: background .15s ease, color .15s ease, transform .1s ease;
        }
        .icon { width: 34px; height: 34px; border-radius: 10px; }
        .icon:hover, .step button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); color: #fff; }
        .icon:active, .step button:active:not(:disabled) { transform: scale(.92); }
        .icon.armed { color: #fca5a5; background: rgba(248, 113, 113, 0.16); }
        .row {
            display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 6px;
            border-radius: 10px; cursor: pointer; user-select: none; transition: background .15s ease;
        }
        .row:hover { background: rgba(255, 255, 255, 0.04); }
        .txt { flex: 1; }
        kbd {
            min-width: 20px; padding: 1px 6px; text-align: center; border-radius: 6px;
            font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            color: #b4bccb; background: rgba(255, 255, 255, 0.07);
        }
        .sw {
            appearance: none; -webkit-appearance: none; flex: none; margin: 0; width: 36px; height: 20px;
            border-radius: 999px; background: #596075; position: relative; cursor: pointer;
            transition: background .16s ease;
        }
        .sw::after {
            content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
            border-radius: 50%; background: #fff; transition: transform .16s ease;
        }
        .sw:checked { background: #10b981; }
        .sw:checked::after { transform: translateX(16px); }
        .sw:focus-visible, .icon:focus-visible, .step button:focus-visible, .fab:focus-visible,
        .ghost:focus-visible, .found a:focus-visible {
            outline: 2px solid #6ee7b7; outline-offset: 2px;
        }
        .stepper {
            display: flex; align-items: center; justify-content: space-between;
            margin: 2px 0 6px; padding: 4px 4px 4px 12px; border-radius: 12px;
            background: rgba(255, 255, 255, 0.04); transition: opacity .16s ease;
        }
        .stepper .txt { color: #a0a8ba; font-size: 12px; }
        .stepper[data-off] { opacity: .45; }
        .step { display: flex; align-items: center; gap: 2px; }
        .step button { width: 32px; height: 32px; border-radius: 9px; }
        .step button:disabled { cursor: not-allowed; opacity: .5; }
        .step output { min-width: 40px; text-align: center; font-weight: 700; color: #34d399; font-variant-numeric: tabular-nums; }
        .log {
            margin-top: 10px; padding: 10px 4px 0; min-height: 108px; max-height: 108px; overflow-y: auto;
            scrollbar-width: thin; scrollbar-color: #596075 transparent;
            border-top: 1px solid rgba(255, 255, 255, 0.07); font-size: 12px; color: #c4cad8;
        }
        .log-row { display: flex; gap: 8px; margin-bottom: 3px; }
        .log-row time { flex: none; color: #7d8699; font: 11px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        .found {
            margin-top: 10px; padding: 10px 12px; border-radius: 12px;
            background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(52, 211, 153, 0.35);
        }
        .found-h { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #6ee7b7; font-size: 12px; }
        .found-h kbd { margin-left: auto; }
        .found a {
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
            margin: 6px 0 8px; color: #eceef4; font-size: 12px; text-decoration: none; word-break: break-all;
        }
        .found a:hover { text-decoration: underline; }
        .ghost {
            padding: 5px 12px; border-radius: 8px; cursor: pointer; color: #eceef4;
            background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12);
            transition: background .15s ease;
        }
        .ghost:hover { background: rgba(255, 255, 255, 0.14); }
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; }
        }
    `;

    const UI_HTML = `
        <div class="wrap" id="om-root">
            <section class="panel" aria-label="OmniBypass controls">
                <header class="head">
                    <div class="brand">
                        <span class="mark">${BOLT}</span>
                        <span class="name">OmniBypass</span>
                        <span class="ver">v${VERSION}</span>
                    </div>
                    <div class="actions">
                        <button class="icon" id="om-reset-btn" type="button" aria-label="Reset all settings" title="Reset all settings">${ICON_RESET}</button>
                        <button class="icon" id="om-close-btn" type="button" aria-label="Minimize panel" title="Minimize">${ICON_MIN}</button>
                    </div>
                </header>
                <div>
                    <label class="row"><span class="txt">Timer speed</span><kbd>1</kbd><input class="sw" id="om-toggle-timer" type="checkbox" role="switch"></label>
                    <div class="stepper" id="om-speed-control">
                        <span class="txt">Multiplier</span>
                        <div class="step">
                            <button id="om-speed-down" type="button" aria-label="Decrease speed">${ICON_MIN}</button>
                            <output id="om-speed-display" aria-live="polite"></output>
                            <button id="om-speed-up" type="button" aria-label="Increase speed">${ICON_PLUS}</button>
                        </div>
                    </div>
                    <label class="row"><span class="txt">Auto scroll</span><kbd>2</kbd><input class="sw" id="om-toggle-scroll" type="checkbox" role="switch"></label>
                    <label class="row"><span class="txt">Auto click</span><kbd>3</kbd><input class="sw" id="om-toggle-click" type="checkbox" role="switch"></label>
                    <label class="row"><span class="txt">Ad blocker</span><kbd>4</kbd><input class="sw" id="om-toggle-shield" type="checkbox" role="switch"></label>
                    <label class="row"><span class="txt">Kill animations</span><kbd>5</kbd><input class="sw" id="om-toggle-anim" type="checkbox" role="switch"></label>
                </div>
                <div class="log" id="om-status-log" role="log" aria-live="polite" aria-label="Activity"></div>
                <div class="found" id="om-final-link-container" hidden>
                    <div class="found-h"><span>Target found</span><kbd title="Press 6 to open">6</kbd></div>
                    <a id="om-final-link" href="#" target="_blank" rel="noopener noreferrer"></a>
                    <button class="ghost" id="om-copy-btn" type="button">Copy link</button>
                </div>
            </section>
            <button class="fab" id="om-ui-minimized" type="button" aria-label="Open OmniBypass" title="Open OmniBypass">
                ${BOLT}<span class="fab-dot" id="om-fab-dot" hidden></span>
            </button>
        </div>
    `;

    function injectUI() {
        if (!isTopFrame || !document.body || document.getElementById('om-bypass-ui-container')) return;

        const host = document.createElement('div');
        host.id = 'om-bypass-ui-container';
        shadow = host.attachShadow({ mode: 'closed' });
        shadow.innerHTML = '<style>' + UI_CSS + '</style>' + UI_HTML;
        document.body.appendChild(host);

        const root = $('om-root');
        const fab = $('om-ui-minimized');
        const closeBtn = $('om-close-btn');
        const stepper = $('om-speed-control');
        const speedDown = $('om-speed-down');
        const speedUp = $('om-speed-up');

        const setMin = (min, focus) => {
            root.classList.toggle('min', min);
            GM_setValue('om_bypass_min', min);
            if (focus) requestAnimationFrame(() => (min ? fab : closeBtn).focus());
        };
        setMin(loadSetting('om_bypass_min', false), false);
        closeBtn.addEventListener('click', () => setMin(true, true));
        fab.addEventListener('click', () => setMin(false, true));

        const syncStepper = () => {
            $('om-speed-display').textContent = CONFIG.speed + 'x';
            stepper.toggleAttribute('data-off', !CONFIG.timerSpeedup);
            speedDown.disabled = !CONFIG.timerSpeedup || CONFIG.speed <= 2;
            speedUp.disabled = !CONFIG.timerSpeedup || CONFIG.speed >= 50;
        };

        const bindToggle = (id, key, prop, label, after) => {
            const el = $(id);
            el.checked = CONFIG[prop];
            el.addEventListener('change', () => {
                CONFIG[prop] = el.checked;
                GM_setValue(key, el.checked);
                if (after) after(el.checked);
                updateStatus(label + (el.checked ? ' on' : ' off'));
            });
        };

        bindToggle('om-toggle-timer', 'om_bypass_timer', 'timerSpeedup', 'Timer speed', (on) => {
            SPEED = on ? CONFIG.speed : 1;
            if (on) patchClock();
            syncStepper();
        });
        bindToggle('om-toggle-scroll', 'om_bypass_scroll', 'autoScroll', 'Auto scroll');
        bindToggle('om-toggle-click', 'om_bypass_click', 'autoClick', 'Auto click');
        bindToggle('om-toggle-shield', 'om_bypass_adblock', 'adBlocker', 'Ad blocker', (on) => {
            updateAdblockCSS();
            if (on) applySameTab();
        });
        bindToggle('om-toggle-anim', 'om_bypass_anim', 'animKiller', 'Animation killer', (on) => {
            if (on) applyAnimKiller(); else removeAnimKiller();
        });

        const setSpeed = (delta) => {
            const next = CONFIG.speed + delta;
            if (next < 2 || next > 50) return;
            CONFIG.speed = next;
            GM_setValue('om_bypass_speed', next);
            if (CONFIG.timerSpeedup) SPEED = next;
            syncStepper();
            updateStatus('Speed set to ' + next + 'x');
        };
        speedDown.addEventListener('click', () => setSpeed(-1));
        speedUp.addEventListener('click', () => setSpeed(1));
        syncStepper();

        const resetBtn = $('om-reset-btn');
        let armed = false;
        resetBtn.addEventListener('click', () => {
            if (armed) { resetConfig(); return; }
            armed = true;
            resetBtn.classList.add('armed');
            updateStatus('Press reset again to restore defaults');
            _st.call(w, () => { armed = false; resetBtn.classList.remove('armed'); }, 3500);
        });

        $('om-copy-btn').addEventListener('click', () => {
            const href = $('om-final-link').getAttribute('href');
            if (!href || href === '#') return;
            navigator.clipboard.writeText(href)
                .then(() => updateStatus('Link copied'))
                .catch(() => updateStatus('Copy blocked by the browser'));
        });

        if (!statusHistory.length) updateStatus('Ready'); else renderStatus();
    }

    const SHORTCUTS = {
        '1': 'om-toggle-timer',
        '2': 'om-toggle-scroll',
        '3': 'om-toggle-click',
        '4': 'om-toggle-shield',
        '5': 'om-toggle-anim'
    };

    document.addEventListener('keydown', (e) => {
        if (halted || e.ctrlKey || e.metaKey || e.altKey || e.target.isContentEditable ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (SHORTCUTS[e.key]) {
            const el = $(SHORTCUTS[e.key]);
            if (el) el.click();
        } else if (e.key === '6') {
            const link = $('om-final-link');
            if (link && link.getAttribute('href') !== '#') link.click();
        }
    });

    function stripPopups() {
        if (!CONFIG.adBlocker) return;
        document.querySelectorAll('[onclick]').forEach(function(el) {
            var oc = el.getAttribute('onclick') || '';
            if (/window\.open/i.test(oc)) {
                if (
                    AD_DOMAINS.some(function(d) { return oc.includes(d); }) ||
                    (el.hasAttribute('href') && el.getAttribute('href') !== '#' && !el.getAttribute('href').startsWith('javascript:')) ||
                    (el.tagName === 'BUTTON' && el.closest('form'))
                ) {
                    el.removeAttribute('onclick');
                }
            }
        });
    }

    var clickedMap = new WeakMap();
    var CLICK_RETRY_MS = 3000;
    var lastScrollTime = 0;

    function autoAction() {
        if (!CONFIG.autoClick && !CONFIG.autoScroll) return;

        var now = _dateNow();
        var targetEl = null;

        if (CONFIG.autoClick) {
            var allBtns = document.querySelectorAll(
                BTN_SELECTORS.join(', ') + ', a, button, div.btn'
            );

            for (var b = 0; b < allBtns.length; b++) {
                var btn = allBtns[b];
                if (processing.has(btn)) continue;
                var lastTime = clickedMap.get(btn);
                if (lastTime && (now - lastTime) < CLICK_RETRY_MS) continue;

                var href = btn.getAttribute('href') || '';
                var hasRealRef = href.startsWith('http') || href.startsWith('//');
                var text = (btn.textContent || '').toLowerCase().trim();

                if (hasRealRef && isAdUrl(href)) continue;

                var matchSel = BTN_SELECTORS.some(function(s) {
                    try { return btn.matches(s); } catch (_) { return false; }
                });
                var matchTxt = (
                    text === 'direct download link' ||
                    text.includes('direct download') ||
                    text.includes('direct cloud link') ||
                    text.includes('transfer to drive') ||
                    text.includes('click here to continue') ||
                    text === 'continue' ||
                    text === 'get link' ||
                    text === 'download' ||
                    text === 'download now' ||
                    text.includes('get my link') ||
                    text.includes('get new link')
                );

                if (!matchSel && !matchTxt) continue;

                var isLoading = (
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
                    processing.add(btn);
                    lastClickedBtn = btn;
                    retryCount = 0;
                    setButtonFeedback(btn, 'clicking');
                    (function(b) {
                        _st.call(w, function() {
                            simulateClick(b);
                            setButtonFeedback(b, 'done');
                            restoreButton(b);
                            processing.delete(b);
                        }, 500);
                    })(btn);
                    updateStatus('Clicked: ' + text.slice(0, 28));
                    break;
                }
            }

            var retryBtns = document.querySelectorAll('button');
            for (var r = 0; r < retryBtns.length; r++) {
                if (processing.has(retryBtns[r])) continue;
                var lt = clickedMap.get(retryBtns[r]);
                if (lt && (now - lt) < CLICK_RETRY_MS) continue;
                if (retryBtns[r].textContent.trim().toLowerCase() === 'retry' && isVisible(retryBtns[r])) {
                    clickedMap.set(retryBtns[r], now);
                    (function(rb) { _st.call(w, function() { simulateClick(rb); }, 1000); })(retryBtns[r]);
                }
            }

            var forms = document.querySelectorAll('form');
            for (var f = 0; f < forms.length; f++) {
                var form = forms[f];
                if (processing.has(form)) continue;
                var flt = clickedMap.get(form);
                if (flt && (now - flt) < CLICK_RETRY_MS) continue;
                if (
                    (form.querySelector('input[name="token"]') ||
                        form.querySelector('input[name="alias"]')) &&
                    isVisible(form)
                ) {
                    targetEl = form;
                    clickedMap.set(form, now);
                    processing.add(form);
                    (function(fm) {
                        _st.call(w, function() {
                            var sbtn = fm.querySelector(
                                'button[type="submit"], input[type="submit"], .get-link'
                            );
                            if (sbtn && !sbtn.hasAttribute('disabled') && !sbtn.classList.contains('disabled')) {
                                lastClickedBtn = sbtn;
                                retryCount = 0;
                                simulateClick(sbtn);
                            } else if (!sbtn) {
                                fm.submit();
                            }
                            processing.delete(fm);
                        }, 500);
                    })(form);
                }
            }
        }

        if (CONFIG.autoScroll && (now - lastScrollTime) > 5000) {
            var scrollTarget = targetEl || document.querySelector(
                '#myTimer, #newtimer, #myTimerDiv, .timer, .countdown, #countdown'
            );
            if (scrollTarget && isVisible(scrollTarget)) {
                var rect = scrollTarget.getBoundingClientRect();
                if (rect.top > window.innerHeight || rect.bottom < 0) {
                    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    lastScrollTime = now;
                }
            }
        }
    }

    var lastAdClean = 0;
    var rightClickRestored = false;

    function removeDomAds() {
        if (!CONFIG.adBlocker) return;
        var now = _dateNow();
        if (now - lastAdClean < 2000) return;
        lastAdClean = now;

        var removeSelectors = [
            '#AdbModel', '.adb-overlay', '.adb-popup',
            '[class*="fkgpk"]', '[id*="chp_ads_blocker"]',
            '#adblock-detector', '.adblock-overlay', '.adblock-modal'
        ];
        removeSelectors.forEach(function(s) {
            document.querySelectorAll(s).forEach(function(e) { e.remove(); });
        });

        document.querySelectorAll('div, section, aside').forEach(function(el) {
            try {
                var cs = window.getComputedStyle(el);
                if (cs.position === 'fixed' || cs.position === 'absolute') {
                    var t = (el.innerText || '').toLowerCase();
                    if (t.length < 400 && (
                        t.includes('blocker detected') ||
                        t.includes('disable your ad blocker') ||
                        t.includes('block ads') ||
                        t.includes('brave browser')
                    )) el.remove();
                }
            } catch (_) { }
        });

        document.querySelectorAll('script[src], iframe[src]').forEach(function(el) {
            if (isAdUrl(el.src)) el.remove();
        });

        if (document.body && !cfDetected) {
            var evts = ['oncontextmenu', 'onselectstart', 'ondragstart', 'oncopy', 'oncut', 'onpaste', 'onselect', 'ondrop'];
            evts.forEach(function(e) {
                document.body[e] = null;
                document[e] = null;
            });
            document.body.removeAttribute('unselectable');

            if (!rightClickRestored) {
                rightClickRestored = true;
                ['contextmenu', 'copy', 'cut', 'paste', 'select', 'selectstart', 'dragstart'].forEach(function(evtName) {
                    document.addEventListener(evtName, function(e) {
                        if (cfDetected) return;
                        if (e.target && e.target.closest && e.target.closest(CAPTCHA_CONTAINER_SEL)) return;
                        if (e.target && e.target.tagName === 'IFRAME') return;
                        if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
                        e.stopPropagation();
                    }, true);
                });
            }
        }
    }

    var FINAL_LINK_DOMAINS = [
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
    var FINAL_FILE_EXTS = /\.(mkv|mp4|avi|zip|rar|pdf|apk|exe|iso)(\?|$)/i;

    function scanForFinalLink() {
        var finalHref = null;

        for (var d = 0; d < FINAL_LINK_DOMAINS.length; d++) {
            var el = document.querySelector('a[href*="' + FINAL_LINK_DOMAINS[d] + '"]');
            if (el) { finalHref = el.getAttribute('href'); break; }
        }

        if (!finalHref) {
            var links = document.querySelectorAll('a, button');
            for (var i = 0; i < links.length; i++) {
                var t = (links[i].textContent || '').toLowerCase().trim();
                if (t.includes('direct download') && links[i].getAttribute('href') && links[i].getAttribute('href') !== '#') {
                    finalHref = links[i].getAttribute('href');
                    break;
                }
            }
        }

        if (!finalHref) {
            var anchors = document.querySelectorAll('a[href]');
            for (var j = 0; j < anchors.length; j++) {
                var h = anchors[j].getAttribute('href') || '';
                if (FINAL_FILE_EXTS.test(h) && isVisible(anchors[j])) {
                    finalHref = h;
                    break;
                }
            }
        }

        if (!finalHref) {
            finalHref = tryDecodeBase64Links();
        }

        if (finalHref) {
            try {
                var abs = new URL(finalHref, location.href);
                if (!/^https?:$/.test(abs.protocol)) return;
                finalHref = abs.href;
            } catch (_) { return; }
            var container = $('om-final-link-container');
            var linkDisplay = $('om-final-link');
            if (container && linkDisplay && linkDisplay.getAttribute('href') !== finalHref) {
                linkDisplay.setAttribute('href', finalHref);
                linkDisplay.textContent = finalHref;
                linkDisplay.title = finalHref;
                container.hidden = false;
                $('om-fab-dot').hidden = false;
                updateStatus('Target link found');
            }
        }
    }

    var domUpdateTimeout = null;

    function run() {
        checkCloudflare();
        if (halted) return;
        injectUI();
        stripPopups();
        removeDomAds();
        autoAction();
        scanForFinalLink();
        if (CONFIG.animKiller) applyAnimKiller();
        if (CONFIG.adBlocker) applySameTab();
    }

    function debouncedRun() {
        if (domUpdateTimeout) return;
        domUpdateTimeout = _st.call(w, function() {
            domUpdateTimeout = null;
            run();
        }, 150);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }

    if (halted) return;

    var mainObserver = new MutationObserver(debouncedRun);
    var startObserver = function() {
        if (document.body) {
            mainObserver.observe(document.body, { childList: true, subtree: true });
        }
    };
    if (document.body) {
        startObserver();
    } else {
        document.addEventListener('DOMContentLoaded', startObserver);
    }

    var mainTimer = _si.call(w, run, 3000);

    var lastUrl = location.href;

    function onNavigate() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            Logger.info('SPA navigation detected:', lastUrl);
            run();
        }
    }

    var _pushState = history.pushState;
    var _replaceState = history.replaceState;

    history.pushState = function () {
        _pushState.apply(this, arguments);
        onNavigate();
    };
    history.replaceState = function () {
        _replaceState.apply(this, arguments);
        onNavigate();
    };
    w.addEventListener('popstate', onNavigate);
    undo.push(() => {
        delete history.pushState;
        delete history.replaceState;
        w.removeEventListener('popstate', onNavigate);
    });

})();

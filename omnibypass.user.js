// ==UserScript==
// @name         Universal Link Bypass & Ad Cleaner (Final)
// @namespace    universal-bypass-final
// @version      9.0.0
// @description  Global memory toggles, Ad Blocker, OlaMovies link extractor. Clean version.
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
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        timerSpeedup: GM_getValue('om_bypass_timer', false),
        autoScroll: GM_getValue('om_bypass_scroll', false),
        autoClick: GM_getValue('om_bypass_click', false),
        adBlocker: GM_getValue('om_bypass_adblock', true)
    };
    
    let SPEED = CONFIG.timerSpeedup ? 5 : 1;
    const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    
    const AD_DOMAINS = [
        'crn77.com','network-loop.com','netpub.media','fstatic.netpub.media',
        'rkv1.com','ashrafidoria.com','madurird.com','jomtingi.net',
        'tmearn.net','clfrms.com','glizauvo.net','odsjrv.com',
        'tsyndicate.com','doubleclick.net','popads.net','popcash.net',
        'propellerads.com','mgid.com','exoclick.com','juicyads.com',
        'clickadu.com','hilltopads.net','trafficjunky.com','adsterra.com',
        'a-ads.com','ad-maven.com','adcash.com','richpush.com',
        'evadav.com','pushground.com','rollerads.com','monetag.com',
        'profitablegatecpm.com','highperformancegate.com',
        'highcpmrevenuegate.com','highperformanceformat.com',
        'highrevenuegate.com','highcpmgate.com',
        'highcpmcreativeformat.com','surfrfrr.com',
        'acscdn.com','acsbapp.com'
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

    function injectUI() {
        if (!document.body || document.getElementById('om-bypass-ui-container')) return;
        
        const ui = document.createElement('div');
        ui.id = 'om-bypass-ui-container';
        ui.innerHTML = `
            <div id="om-bypass-panel" style="position:fixed; bottom:20px; right:20px; background:#1e1e1e; color:#eee; padding:15px; border-radius:10px; z-index:2147483647; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-shadow:0 8px 24px rgba(0,0,0,0.6); border:1px solid #333; width: 200px;">
                <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#00e676; margin-bottom:12px; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                    Bypass Controls
                    <span id="om-close-btn" title="Minimize" style="cursor:pointer; color:#888; font-size:18px; line-height:1;">&times;</span>
                </div>
                <label style="display:flex; align-items:center; margin-bottom:10px; cursor:pointer; font-size:13px; user-select:none;">
                    <input type="checkbox" id="om-toggle-timer" ${CONFIG.timerSpeedup ? 'checked' : ''} style="margin-right:10px; cursor:pointer; accent-color:#00e676; width:16px; height:16px;">
                    [1] 5x Timer
                </label>
                <label style="display:flex; align-items:center; margin-bottom:10px; cursor:pointer; font-size:13px; user-select:none;">
                    <input type="checkbox" id="om-toggle-scroll" ${CONFIG.autoScroll ? 'checked' : ''} style="margin-right:10px; cursor:pointer; accent-color:#00e676; width:16px; height:16px;">
                    [2] Auto Scroll
                </label>
                <label style="display:flex; align-items:center; margin-bottom:10px; cursor:pointer; font-size:13px; user-select:none;">
                    <input type="checkbox" id="om-toggle-click" ${CONFIG.autoClick ? 'checked' : ''} style="margin-right:10px; cursor:pointer; accent-color:#00e676; width:16px; height:16px;">
                    [3] Auto Click
                </label>
                <label style="display:flex; align-items:center; margin-bottom:0; cursor:pointer; font-size:13px; user-select:none;">
                    <input type="checkbox" id="om-toggle-shield" ${CONFIG.adBlocker ? 'checked' : ''} style="margin-right:10px; cursor:pointer; accent-color:#00e676; width:16px; height:16px;">
                    [4] Ad Blocker
                </label>
                <div id="om-final-link-container" style="display:none; margin-top:15px; padding-top:10px; border-top:1px solid #444; font-size:12px; word-break:break-all;">
                    <span style="color:#aaa;">Target Found (Press 5):</span><br>
                    <a id="om-final-link" href="#" target="_blank" style="color:#00e676; text-decoration:none; font-weight:bold; display:block; margin-top:5px; line-height:1.2;"></a>
                </div>
            </div>
            <div id="om-ui-minimized" style="display:none; position:fixed; bottom:20px; right:20px; background:#1e1e1e; color:#00e676; padding:0; border-radius:50%; z-index:2147483647; box-shadow:0 4px 12px rgba(0,0,0,0.5); cursor:pointer; border:1px solid #333; width:45px; height:45px; justify-content:center; align-items:center; font-weight:bold; font-family:sans-serif; font-size:14px;">
                OM
            </div>
        `;

        document.body.appendChild(ui);
        
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

        document.getElementById('om-toggle-timer').addEventListener('change', (e) => {
            CONFIG.timerSpeedup = e.target.checked;
            GM_setValue('om_bypass_timer', e.target.checked);
            SPEED = e.target.checked ? 5 : 1;
        });

        document.getElementById('om-toggle-scroll').addEventListener('change', (e) => {
            CONFIG.autoScroll = e.target.checked;
            GM_setValue('om_bypass_scroll', e.target.checked);
        });

        document.getElementById('om-toggle-click').addEventListener('change', (e) => {
            CONFIG.autoClick = e.target.checked;
            GM_setValue('om_bypass_click', e.target.checked);
        });

        document.getElementById('om-toggle-shield').addEventListener('change', (e) => {
            CONFIG.adBlocker = e.target.checked;
            GM_setValue('om_bypass_adblock', e.target.checked);
            if (typeof updateAdblockCSS === 'function') updateAdblockCSS();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (e.key === '1') { const el = document.getElementById('om-toggle-timer'); if (el) el.click(); }
        else if (e.key === '2') { const el = document.getElementById('om-toggle-scroll'); if (el) el.click(); }
        else if (e.key === '3') { const el = document.getElementById('om-toggle-click'); if (el) el.click(); }
        else if (e.key === '4') { const el = document.getElementById('om-toggle-shield'); if (el) el.click(); }
        else if (e.key === '5') {
            const finalLink = document.getElementById('om-final-link');
            if (finalLink && finalLink.getAttribute('href') !== '#') finalLink.click();
        }
    });

    try {
        const _st = w.setTimeout;
        const _si = w.setInterval;
        w.setTimeout = function(fn, delay, ...args) {
            if (typeof delay === 'number' && delay >= 500 && SPEED > 1) delay = Math.max(Math.floor(delay / SPEED), 1);
            return _st.call(this, fn, delay, ...args);
        };
        w.setInterval = function(fn, delay, ...args) {
            if (typeof delay === 'number' && delay >= 500 && SPEED > 1) delay = Math.max(Math.floor(delay / SPEED), 1);
            return _si.call(this, fn, delay, ...args);
        };
        
        const _DateNow = w.Date.now;
        const startReal = _DateNow();
        w.Date.now = function() {
            if (SPEED <= 1) return _DateNow();
            return startReal + ((_DateNow() - startReal) * SPEED);
        };

        const _Date = w.Date;
        w.Date = new Proxy(_Date, {
            construct(target, args) {
                if (args.length === 0) {
                    if (SPEED <= 1) return new target();
                    return new target(startReal + ((_DateNow() - startReal) * SPEED));
                }
                return new target(...args);
            }
        });

        if (w.performance && w.performance.now) {
            const _perfNow = w.performance.now;
            w.performance.now = function() {
                if (SPEED <= 1) return _perfNow.call(w.performance);
                return _perfNow.call(w.performance) * SPEED;
            };
        }
    } catch(e) {}

    const style = document.createElement('style');
    style.id = 'om-shield-css';
    const css = `
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
    
    function updateAdblockCSS() {
        if (CONFIG.adBlocker) {
            if (!document.getElementById('om-shield-css')) {
                style.textContent = css;
                (document.head || document.documentElement).appendChild(style);
            }
        } else {
            const s = document.getElementById('om-shield-css');
            if (s) s.remove();
        }
    }
    updateAdblockCSS();

    const _open = w.open;
    const fakeWin = () => ({
        closed:false, close(){this.closed=true}, focus(){}, blur(){},
        document:{write(){},close(){},open(){}}, location:{href:''}
    });

    w.open = function(url, ...args) {
        if (!url) return fakeWin();
        if (CONFIG.adBlocker && AD_DOMAINS.some(d => String(url).toLowerCase().includes(d))) return fakeWin();
        return _open.call(this, url, ...args);
    };

    function isVisible(el) {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const c = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden' && c.opacity !== '0' && !el.classList.contains('hidden');
    }

    function stripPopups() {
        if (!CONFIG.adBlocker) return;
        document.querySelectorAll('[onclick]').forEach(el => {
            const oc = el.getAttribute('onclick') || '';
            if (/window\.open/i.test(oc)) {
                if (AD_DOMAINS.some(d => oc.includes(d)) || (el.hasAttribute('href') && el.getAttribute('href') !== '#' && !el.getAttribute('href').startsWith('javascript:')) || (el.tagName === 'BUTTON' && el.closest('form'))) {
                    el.removeAttribute('onclick');
                }
            }
        });
    }

    const clicked = new WeakSet();
    let scrolled = false;

    function autoAction() {
        let targetEl = null;

        if (CONFIG.autoClick) {
            document.querySelectorAll(BTN_SELECTORS.join(', ') + ', a, button, div.btn').forEach(btn => {
                if (clicked.has(btn)) return;
                const href = btn.getAttribute('href') || '';
                const hasRealHref = href.startsWith('http') || href.startsWith('//');
                const text = (btn.textContent || '').toLowerCase().trim();
                
                if (hasRealHref && AD_DOMAINS.some(d => href.includes(d))) return;
                if (text.includes('getting')) return;
                
                const matchSel = BTN_SELECTORS.some(s => btn.matches(s));
                const matchTxt = text === 'direct download link' || text.includes('click here to continue') || text === 'continue' || text === 'get link' || text === 'download' || text === 'download now';
                
                if (!matchSel && !matchTxt) return;
                if (!hasRealHref && (text.includes('wait') || text.includes('loading') || btn.hasAttribute('disabled') || btn.classList.contains('disabled'))) return;

                if (isVisible(btn)) {
                    targetEl = btn;
                    clicked.add(btn);
                    setTimeout(() => btn.click(), 500);
                }
            });
            
            document.querySelectorAll('button').forEach(btn => {
                if (clicked.has(btn)) return;
                if (btn.textContent.trim().toLowerCase() === 'retry' && isVisible(btn)) {
                    clicked.add(btn);
                    setTimeout(() => btn.click(), 1000);
                }
            });

            document.querySelectorAll('form').forEach(form => {
                if (clicked.has(form)) return;
                if ((form.querySelector('input[name="token"]') || form.querySelector('input[name="alias"]')) && isVisible(form)) {
                    targetEl = form;
                    clicked.add(form);
                    setTimeout(() => {
                        const btn = form.querySelector('button[type="submit"], input[type="submit"], .get-link');
                        if (btn && !btn.hasAttribute('disabled') && !btn.classList.contains('disabled')) btn.click();
                        else if (!btn) form.submit();
                    }, 500);
                }
            });
        }

        if (CONFIG.autoScroll && !scrolled) {
            const target = targetEl || document.querySelector('#myTimer, #newtimer, #myTimerDiv, .timer');
            if (target && isVisible(target)) {
                const rect = target.getBoundingClientRect();
                if (rect.top > window.innerHeight || rect.bottom < 0) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    scrolled = true;
                }
            }
        }
    }

    function removeDomAds() {
        if (!CONFIG.adBlocker) return;
        ['#AdbModel', '.adb-overlay', '.adb-popup', '[class*="fkgpk"]', '[id*="chp_ads_blocker"]', '#adblock-detector', '.adblock-overlay', '.adblock-modal'].forEach(s => {
            document.querySelectorAll(s).forEach(e => e.remove());
        });
        
        document.querySelectorAll('div, section, aside').forEach(el => {
            const cs = window.getComputedStyle(el);
            if (cs.position === 'fixed' || cs.position === 'absolute') {
                const t = (el.innerText || '').toLowerCase();
                if (t.includes('blocker detected') || t.includes('disable your ad blocker') || t.includes('block ads') || t.includes('brave browser')) el.remove();
            }
        });

        document.querySelectorAll('script[src], iframe[src]').forEach(el => {
            if (AD_DOMAINS.some(d => el.src.includes(d))) el.remove();
        });
        
        if (document.body) {
            ['oncontextmenu','onselectstart','ondragstart','oncopy','oncut','onpaste'].forEach(e => {
                document.body[e] = null;
                document[e] = null;
            });
            document.body.removeAttribute('unselectable');
        }
    }
    
    function scanForFinalLink() {
        const linkEl = document.querySelector('a[href^="https://drive.olamovies.download/file"]');
        if (linkEl) {
            const finalHref = linkEl.getAttribute('href');
            const container = document.getElementById('om-final-link-container');
            const linkDisplay = document.getElementById('om-final-link');
            if (container && linkDisplay && linkDisplay.getAttribute('href') !== finalHref) {
                linkDisplay.setAttribute('href', finalHref);
                linkDisplay.textContent = finalHref;
                container.style.display = 'block';
            }
        }
    }

    function run() {
        injectUI();
        stripPopups();
        removeDomAds();
        autoAction();
        scanForFinalLink();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();

    setInterval(run, 500);

})();

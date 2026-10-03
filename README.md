# OmniBypass

A Tampermonkey script for shortlink and download pages. It speeds up the "wait 15 seconds" timers, blocks the pop-ups and fake overlays, clicks Continue or Download when the button becomes usable, and shows you the real destination link once the page exposes it.

I built it after one too many five-page detours for a single file. It runs on every site except a short list I never want it touching (see below).

## Install

The quickest way is the [setup page](https://akshat96af.github.io/omnibypass/). If you would rather do it by hand:

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your desktop browser.
2. Open the Tampermonkey dashboard and click the + tab to add a new script.
3. Replace the editor contents with the full text of `omnibypass.user.js` from this repository.
4. Save with Ctrl+S.

## What it does

### Timer speed

Off by default. When it is on, countdowns finish sooner by a multiplier you set (5x to start, adjustable from 2x to 50x). It scales `setTimeout`, `setInterval`, `Date`, `performance.now` and `requestAnimationFrame` together, so countdowns that count ticks and countdowns that compare against an end time both speed up. The page still sees time pass normally; it just arrives faster.

Changing the multiplier affects timers started afterwards, so reload the page if a countdown is already running. Timers inside Web Workers can't be reached from a userscript, and a site whose server enforces the wait will still reject a link requested too early.

### Ad blocker

On by default. It blocks pop-ups to known ad domains, removes ad scripts and iframes from those domains, clears invisible click-catching overlays and "disable your ad blocker" walls, and gives you back right click and copy on pages that disable them. Links that try to open a new tab open in the current one instead. Ctrl, Cmd or Shift plus click still opens a new tab, and pop-ups that ask for a specific window size (login and payment windows) are left alone.

### Auto click and auto scroll

Both are off by default. Auto click presses buttons such as Get Link, Continue and Download as soon as they stop looking disabled, and submits token forms. If the site answers with a "too fast" or "bad request" alert, it waits and retries up to five times, then hands control back to you. Auto scroll brings the countdown or the active button into view.

### Target link finder

The script looks for the final link on the page: known file hosts such as Google Drive, Mega, MediaFire, Pixeldrain and Gofile, "direct download" buttons, links to files like .zip or .mkv, and links hidden in base64 inside inline scripts. Only http and https links are accepted. When it finds one, the panel shows a card with the link and a Copy link button, and the minimized button gets a green dot.

### Kill animations

Off by default. Turns off CSS animations and transitions and removes canvas and particle effects. Some pages use a canvas for real content, so turn this off if something looks broken.

## Cloudflare and CAPTCHAs

On a Cloudflare "Verify you are human" or "Just a moment" page, the script stops completely: it puts back every browser function it changed, shuts off its observers and removes its panel, so the check runs untouched. When the check passes, the site reloads and the script starts normally on the real page. On pages that only embed a CAPTCHA widget (reCAPTCHA, hCaptcha, Turnstile), it pauses timer speed and pop-up blocking and keeps working otherwise.

Cloudflare changes its pages from time to time. If a check keeps reloading on some site, add an `@exclude` line for that site in the script header, for example `// @exclude *://example.com/*`, and open an issue so I can improve the detection.

## The panel

The panel sits at the bottom right. The minus button shrinks it to a round button, and it remembers that choice between visits. The reset button restores every setting to its default; click it twice within a few seconds to confirm. Settings are stored by Tampermonkey.

## Hotkeys

Press a number key to flip a feature without opening the panel.

| Key | Toggles |
| :---: | :--- |
| 1 | Timer speed |
| 2 | Auto scroll |
| 3 | Auto click |
| 4 | Ad blocker |
| 5 | Kill animations |
| 6 | Opens the target link, once one is found |

The keys are ignored while you are typing in a text field, a search box, a dropdown or an editable area, and when Ctrl, Cmd or Alt is held.

## Sites it leaves alone

It stays off on Google (including Gmail, Docs and Drive), YouTube, GitHub, Stack Overflow, ChatGPT, Claude, WhatsApp Web, Instagram, X and Twitter, Reddit, Amazon, Flipkart, Microsoft login, Netflix and Spotify, so your normal logins and browsing don't break. The list is in the `@exclude` lines at the top of the script, and you can add your own.

## A note on use

OmniBypass only changes what happens in your own browser. Use it on pages you are allowed to use, and respect the sites you visit.

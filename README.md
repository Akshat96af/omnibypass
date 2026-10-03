# OmniBypass

![Version](https://img.shields.io/badge/version-12.0.0-10b981) ![Userscript](https://img.shields.io/badge/userscript-Tampermonkey-1f2937) ![Platform](https://img.shields.io/badge/browser-desktop-1f2937)

Shorter waits, fewer pop-ups, and the real download link on your screen.

OmniBypass is a Tampermonkey script for shortlink and download pages. It speeds up the "wait 15 seconds" timers, blocks the pop-ups and fake overlays, clicks Continue or Download when the button becomes usable, and shows you the real destination link once the page exposes it.

I built it after one too many five-page detours for a single file. It runs on every site except a short list I never want it touching (see below).

## At a glance

| Feature | Default | Key | What it does |
| :--- | :---: | :---: | :--- |
| Timer speed | Off | 1 | Countdowns finish sooner by a multiplier from 2x to 50x |
| Auto scroll | Off | 2 | Brings the countdown or active button into view |
| Auto click | Off | 3 | Presses Get Link, Continue and Download when they are ready |
| Ad blocker | On | 4 | Blocks ad pop-ups, overlays and anti-adblock walls |
| Kill animations | Off | 5 | Turns off CSS animations and removes canvas and particle effects |
| Target link | Always | 6 | Finds the real link and opens it when you press 6 |

## Install

The quickest way is the [setup page](https://akshat96af.github.io/omnibypass/). If you would rather do it by hand:

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your desktop browser.
2. Open the Tampermonkey dashboard and click the + tab to add a new script.
3. Replace the editor contents with the full text of `omnibypass.user.js` from this repository.
4. Save with Ctrl+S.

## Features

### Timer speed

When it is on, countdowns finish sooner by a multiplier you set (5x to start). It scales `setTimeout`, `setInterval`, `Date`, `performance.now` and `requestAnimationFrame` together, so countdowns that count ticks and countdowns that compare against an end time both speed up. The page still sees time pass normally; it just arrives faster.

Changing the multiplier affects timers started afterwards, so reload the page if a countdown is already running. Timers inside Web Workers can't be reached from a userscript, and a site whose server enforces the wait will still reject a link requested too early.

### Ad blocker

It blocks pop-ups to known ad domains, removes ad scripts and iframes from those domains, clears invisible click-catching overlays and "disable your ad blocker" walls, and gives you back right click and copy on pages that disable them. Links that try to open a new tab open in the current one instead. Ctrl, Cmd or Shift plus click still opens a new tab, and pop-ups that ask for a specific window size (login and payment windows) are left alone.

### Auto click and auto scroll

Auto click presses buttons such as Get Link, Continue and Download as soon as they stop looking disabled, and submits token forms. If the site answers with a "too fast" or "bad request" alert, it waits and retries up to five times, then hands control back to you. Auto scroll brings the countdown or the active button into view.

### Target link finder

The script looks for the final link on the page: known file hosts such as Google Drive, Mega, MediaFire, Pixeldrain and Gofile, "direct download" buttons, links to files like .zip or .mkv, and links hidden in base64 inside inline scripts. Only http and https links are accepted. When it finds one, the panel shows a card with the link and a Copy link button, and the minimized button gets a green dot.

### Kill animations

Turns off CSS animations and transitions and removes canvas and particle effects. Some pages use a canvas for real content, so turn this off if something looks broken.

## Cloudflare and CAPTCHAs

On a Cloudflare "Verify you are human" or "Just a moment" page, the script stops completely: it puts back every browser function it changed, shuts off its observers and removes its panel, so the check runs untouched. When the check passes, the site reloads and the script starts normally on the real page. On pages that only embed a CAPTCHA widget (reCAPTCHA, hCaptcha, Turnstile), it pauses timer speed and pop-up blocking and keeps working otherwise.

Cloudflare changes its pages from time to time. If a check keeps reloading on some site, use Disable on this site (below), or add an `@exclude` line for it in the script header, for example `// @exclude *://example.com/*`, and open an issue so I can improve the detection.

## The panel

The panel sits at the bottom right. The minus button shrinks it to a round button, and it remembers that choice between visits. The reset button restores every setting to its default; click it twice within a few seconds to confirm. It does not clear your list of disabled sites. Settings are stored by Tampermonkey.

Press a number key to flip a feature without opening the panel. The keys are ignored while you are typing in a text field, a search box, a dropdown or an editable area, and when Ctrl, Cmd or Alt is held. The key for each feature is in the table at the top.

## Sites it leaves alone

It stays off on Google (including Gmail, Docs and Drive), YouTube, GitHub, Stack Overflow, ChatGPT, Claude, WhatsApp Web, Instagram, X and Twitter, Reddit, Amazon, Flipkart, Microsoft login, Netflix and Spotify, so your normal logins and browsing don't break. That list is in the `@exclude` lines at the top of the script.

To turn it off on any other site, click Disable on this site at the bottom of the panel (it asks you to click twice). The script then does nothing on that site and its subdomains, with no panel and no changes to the page. Sites you disable this way are saved by Tampermonkey. Because the panel is gone on a disabled site, you turn it back on from the Tampermonkey menu: click the Tampermonkey icon and choose "OmniBypass: enable on" followed by the site name. The same menu has a "disable on" entry for the site you are on, which is handy when the panel is minimized.

## Troubleshooting

| What you see | What to try |
| :--- | :--- |
| A countdown still runs at normal speed | Reload the page after changing the multiplier. If the site checks the wait on its server, it can't be sped up from here. |
| A page looks or behaves wrong | Turn off Kill animations first, then the Ad blocker. If it persists, use Disable on this site. |
| A verification check keeps reloading | Use Disable on this site, or add an `@exclude` line for it. |
| The panel is missing | The site may be disabled (use the Tampermonkey menu to enable it), or it may be on the excluded list above. The panel also stays hidden on Cloudflare check pages. |
| Copy link does nothing | Your browser blocked clipboard access. Select the link in the panel and copy it by hand. |

## A note on use

OmniBypass only changes what happens in your own browser. Use it on pages you are allowed to use, and respect the sites you visit.

# OmniBypass Pro ⚡

Tired of seeing constant pop-up ads, "Wait 15 seconds to continue" timers, and annoying redirect loops just to get a simple download link? OmniBypass Pro is a custom Tampermonkey user script designed to completely cut through that junk and save you time. 

It speeds up countdown clocks, sweeps away aggressive ad pop-ups, and auto-clicks "Continue" or "Download" buttons the second they are ready.

---

## 💎 What It Does

* **⚡ Kills Countdown Timers:** Speeds up `setTimeout` and `setInterval` clocks on shortener pages by 5x so you don't have to sit around waiting.
* **🚫 Aggressive Ad & Overlay Blocker:** Instantly wipes out pop-ups, invisible click-jacking layers, and annoying anti-adblock blocker warnings.
* **🤖 Auto Scroll & Click:** Automatically hunts down the active timer on the page, scrolls it into view, and clicks the "Get Link", "Continue", or "Download" button for you.
* **🎯 Target Link Grabber:** Scans the page background, extracts the final destination file link, and drops it right into your on-screen panel.
* **🔒 Safe Domain Exclusions:** Automatically turns completely off on important sites like Google, GitHub, WhatsApp, Netflix, and social media so your normal browsing and sign-ins never break.

---

## 🚀 One-Click Installation

If you already have a browser user script manager extension active, just click the link below to load and install the script instantly:

👉 [Install OmniBypass Pro Script](https://raw.githubusercontent.com/akshat96af/YOUR_REPOSITORY_NAME/main/omnibypass.user.js)

*(Note: Don't forget to swap out `YOUR_REPOSITORY_NAME` with your actual GitHub repository name after you push your code!)*

---

## 🛠️ Manual Installation Guide

If the link above doesn't trigger automatically, follow these simple steps:

### Step 1: Install Tampermonkey
You need a script manager extension installed on your desktop browser to run this file:
* [Get Tampermonkey for your Browser](https://www.tampermonkey.net/)

### Step 2: Add the Code
1. Open your browser, click the Tampermonkey extension icon, and select **Dashboard**.
2. Click the **+ (Add Script)** tab or go to **Utilities**.
3. Copy the entire raw code inside the `omnibypass.user.js` file from this repository.
4. Paste it entirely into the text editor box inside Tampermonkey.
5. Click **File -> Save** (or hit `Ctrl + S`).

---

## 🎛️ Keyboard Shortcuts

While browsing, you don't even need to open the visual UI panel to change settings—you can hit these numbers on your keyboard to toggle features on the fly:

| Key | Action |
| :---: | :--- |
| **`1`** | Toggle **5x Fast-Forward Timer** |
| **`2`** | Toggle **Auto Scroll** directly to active timers |
| **`3`** | Toggle **Auto Click** for ready links/buttons |
| **`4`** | Toggle **Ad Blocker Shield** |
| **`5`** | Instantly open the extracted target download link |

*Note: Shortcuts automatically pause whenever you are typing inside search boxes, text forms, or input windows so you can type normally.*

---

## 🛠️ Running the Premium Interactive Page

If you want to view or host the animated, high-end 3D background page (`index.html`) locally on your computer to show off the setup process, open your terminal inside the project folder and spin up a quick local web server:

```bash
# Using Python
python -m http.server 8080

# OmniBypass Pro ⚡

Ever get stuck clicking through endless pop-up ads, staring at "Wait 15 seconds to continue" timers, or trapped in crazy redirect loops just to get a single download link? Same. That's exactly why I built OmniBypass Pro. 

It’s a straightforward Tampermonkey script that cuts straight through the garbage. It fast-forwards countdown clocks, blocks annoying ad pop-ups, and clicks "Continue" or "Download" buttons the exact second they are ready.

---

## 💎 What it actually does

* **⚡ Fast-Forwards Countdown Timers:** Speeds up boring `setTimeout` and `setInterval` loops by 5x so pages load instantly.
* **🚫 Blocks Aggressive Ads & Pop-ups:** Wipes out invisible overlays, shady link opens, and annoying "Disable your Adblocker" warnings.
* **🤖 Handles Scrolling & Clicking:** Automatically tracks down the timer, scrolls it into view, and clicks "Get Link" or "Download" when it's ready.
* **🎯 Grabs Hidden Destination Links:** Scans the background to pull the actual download link directly onto your screen.
* **🔒 Leaves Normal Sites Alone:** Automatically stays completely off on major sites like Google, GitHub, WhatsApp, Netflix, and social media so your regular logins and browsing never break.

---

## 🚀 Easy 1-Click Install

To get everything running, just head over to the interactive setup page and hit the install button:

👉 [Go to the Setup Page & Install](https://akshat96af.github.io/omnibypass/)

---

## 🛠️ Doing it manually?

If you prefer to add the code yourself, just follow these quick steps:

### Step 1: Grab Tampermonkey
You'll need a script manager extension installed on your desktop browser first:
* [Get Tampermonkey here](https://www.tampermonkey.net/)

### Step 2: Paste the Code
1. Click the Tampermonkey icon in your browser bar and open your **Dashboard**.
2. Click the **+ (Add Script)** tab (or head over to **Utilities**).
3. Copy all the raw code from the `omnibypass.user.js` file in this repository.
4. Paste it completely into the Tampermonkey code editor.
5. Hit `Ctrl + S` (or click **File -> Save**).

---

## 🎛️ Hotkeys

You don't even have to open the control panel while browsing—you can just tap these numbers on your keyboard to switch things on and off on the fly:

| Key | What it toggles |
| :---: | :--- |
| **`1`** | **5x Fast-Forward Timer** |
| **`2`** | **Auto Scroll** straight to the active counter |
| **`3`** | **Auto Click** for links/buttons |
| **`4`** | **Ad Blocker Shield** |
| **`5`** | Open the extracted **target download link** right away |

*Note: The script is smart enough to pause these shortcuts automatically whenever you're actively typing in a search box, comment area, or text field.*

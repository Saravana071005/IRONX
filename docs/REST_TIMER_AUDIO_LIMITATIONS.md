# IRONX — Rest Timer Audio & Background Music Platform Architecture

## Overview

This document details the architecture, capabilities, and platform-level constraints regarding background audio playback and workout rest timer completion alerts in IRONX across iOS Safari, Installed iOS PWAs, Android browsers, and Desktop environments.

---

## 1. Requirement & User Intent

In IRONX, when a lifter finishes a set, the rest timer starts countdown (e.g., 90 seconds). Lifters often train while listening to music via streaming services (Spotify, Apple Music, YouTube Music, etc.).

A desired behavior is often to:
1. Automatically pause external music when a set completes and the rest timer starts.
2. Automatically resume that same external music when the rest timer reaches `0:00`.

---

## 2. Platform Investigation & Technical Findings

### 2.1 Cross-Platform Support Matrix

| Platform / Environment | External Music Detection | External Music Pause | External Music Resume | Genuine Support Status |
| :--- | :---: | :---: | :---: | :---: |
| **iPhone Safari** | ❌ No | ⚠️ One-way interruption only | ❌ No | **UNSUPPORTED** |
| **Installed iPhone PWA** | ❌ No | ⚠️ One-way interruption only | ❌ No | **UNSUPPORTED** |
| **Android Chrome / Browser** | ❌ No | ⚠️ Transient audio focus ducking | ❌ No | **UNSUPPORTED** |
| **Desktop Browsers (Mac / Win)** | ❌ No | ❌ No | ❌ No | **UNSUPPORTED** |

**Technical Conclusion:** **No unprivileged web application or PWA on any current consumer operating system legitimately supports querying, pausing, and resuming external background audio.**

---

## 3. Underlying Architectural & Sandbox Barriers

### 3.1 W3C Media Session API Scope
The [W3C Media Session Standard](https://www.w3.org/TR/mediasession/) (`navigator.mediaSession`) is designed strictly to expose metadata for media created by the **current document** (`<audio>`, `<video>`, `AudioContext`) to the OS lock screen, notification shade, or system media transport controls:
- The API allows web apps to handle media keys when the page's own media is playing.
- It **does not** provide access to inspect or control external applications.
- There are no methods such as `navigator.mediaSession.pauseOtherApps()` or `navigator.mediaSession.resume()`.
- Browser security models enforce this sandbox boundary to prevent untrusted web pages from spying on user media consumption, capturing DRM streams, or hijacking OS audio routing.

### 3.2 iOS WebKit Audio Session (`AVAudioSession`)
On iOS (both Mobile Safari and Home Screen Installed PWAs):
- **Interruption without Auto-Resume:** WebKit interacts with iOS CoreAudio's `AVAudioSession`. When a web app plays an audible sound, iOS can interrupt/pause external audio (such as Spotify). However, when the web audio stops, iOS **does not** automatically resume the external app. The external app remains paused until the user manually presses Play in Control Center or inside the native music app.
- **Entitlement Limitations:** WebKit lacks the native entitlement (`AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation`) to reactivate the session of an external third-party native app.
- **Silent Audio Looping Hazards:** Simulating pause by looping silent audio during rest disrupts Bluetooth audio codecs, drains battery, and permanently stops Spotify without any way to resume it at `0:00`. Furthermore, iOS aggressively terminates background PWA processes when the screen locks.

### 3.3 Android Audio Focus (`AudioManager`)
- Web pages on Android can request transient audio focus via HTML5 media elements, causing external music to duck or pause.
- However, web pages cannot dispatch synthetic `ACTION_MEDIA_BUTTON` or `KEYCODE_MEDIA_PLAY` intents across app boundaries. Media controller access is restricted to native system-level services or apps holding `android.permission.MEDIA_CONTENT_CONTROL`.

### 3.4 Desktop Operating Systems
- Browser sandboxes isolate web tabs from native desktop processes. DOM keyboard events cannot escape to the OS or trigger global media key shortcuts for Spotify Desktop or Apple Music Desktop without external native helper daemons.

---

## 4. IRONX Rest Timer & Alert Architecture

Because external music cannot be safely or legitimately paused and resumed via web/PWA APIs, IRONX provides an independent, robust rest timer and audible alert system that coexists cleanly with background playback:

1. **Independent Timer Operation:**
   - The rest timer operates cleanly in `frontend/src/store/useUI.js`.
   - Supports custom rest durations, manual pause, +30s extensions, skipping, and auto-dismissal.
   - Screen wake lock is maintained during active workouts (`frontend/src/lib/wakelock.js`).

2. **Web Audio Alert Synthesis (`frontend/src/lib/sound.js`):**
   - Rest completion alert is synthesized in real time via the Web Audio API (`AudioContext`).
   - Uses a dynamic range compressor (`DynamicsCompressorNode`) to maximize perceived loudness and ensure clear audibility over background gym music without clipping.
   - Provides 5 selectable alarm tones in **Settings**:
     - **Power Alarm** (Default): Multi-frequency urgent workout chime.
     - **Triple Boxing Bell**: Authentic resonant gym bell strike.
     - **Digital Siren**: Ascending dual-tone sweep.
     - **Heavy Gym Gong**: Deep low-frequency resonant bell.
     - **Melodic Chime**: Harmonic 4-tone sequence.
   - Adjustable volume slider (0% to 100%) stored in user preferences (`S.restAlertVolume`).

3. **Haptics & Visual Notifications:**
   - Multi-pulse vibration pattern (`[300, 150, 300, 150, 500]`) on supported mobile devices.
   - High-visibility banner and toast: `"REST COMPLETED — START NEXT SET"`.
   - Browser notification fallback via standard Notifications API.

4. **No Deceptive UI:**
   - No fake playback detection or simulated play/pause buttons are shown.
   - No private developer credentials or multi-user OAuth tokens are used.

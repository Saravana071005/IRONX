# IRONX

<div align="center">

<img src="frontend/public/ironx-logo.png" alt="IRONX" width="420">

<br/>

**Elite Strength, Conditioning & Health Intelligence**

Plan your training, run guided gym workouts, track sets with progressive overload guidance, log nutrition with zero-hallucination staple macros, and analyze transformation trends — 100% offline-first with background cloud sync.

<br/>

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-a3e635?style=flat-square)](LICENSE)
![PWA](https://img.shields.io/badge/PWA-installable-a78bfa?style=flat-square)
![React](https://img.shields.io/badge/React-19-38bdf8?style=flat-square&logo=react&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-22.x-22c55e?style=flat-square&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Zero-Telemetry](https://img.shields.io/badge/telemetry-none-f472b6?style=flat-square)

</div>

---

## What is IRONX?

IRONX is a high-performance, mobile-first progressive web application (PWA) designed for serious lifters and athletes. Built for gym environments with intermittent or zero cellular connectivity, IRONX offers instant 0ms cached launch, non-blocking background synchronization, and a complete suite of health and strength intelligence tools.

### Key Capabilities

1. **Gym-Optimized Workout Tracking:**
   - Pre-loaded routines and custom weekly training splits.
   - Interactive set logging with automatic Rest Timer and WebAudio / Haptic alerts.
   - Gym Stealth Mode: ultra-high contrast dark interface designed for intense training sessions.
   - Live 1RM estimates using Brzycki / Epley formulas and Progressive Overload recommendations.

2. **Fitness Intelligence & Transformation:**
   - 7-day bodyweight exponential moving average (EMA) trend analysis.
   - Muscle Balance Body Map: interactive front and back SVG anatomical heatmaps tracking weekly training volume by muscle group.
   - Weekly Fitness Intelligence Reports with volume trends and recovery analysis.

3. **Gamification & Consistency:**
   - Athletic Level & Tier system with dynamic XP awards for workouts, set milestones, and logging consistency.
   - Automatic Personal Record (PR) Vault tracking all-time heaviest weights and volume records.
   - Non-punitive consistency streaks based on weekly targets.

4. **Zero-Hallucination AI Nutrition Engine:**
   - Verified local SQLite staple food database (`STAPLE:oats`, `STAPLE:banana`, `STAPLE:almond`, etc.) with 100% mathematically deterministic macro scaling.
   - Daily Health Log tracking calories, macronutrients, water intake, cardio, and strength training.
   - Exportable daily PDF health reports with automated analysis prompts.

5. **Infallible Offline-First Architecture:**
   - Service Worker v4.0 with Cache-First navigation and Stale-While-Revalidate asset updates.
   - Synchronous Zustand local hydration from IndexedDB / localStorage for instant 0ms launch on iPhone Safari and standalone PWA.
   - Background offline action queue automatically draining pending set updates upon reconnection.

---

## Quick Start (Development)

### Prerequisites

- Node.js 22.x or 20.x
- npm 10+
- MongoDB (local or MongoDB Atlas connection string)

### Installation

```bash
# Clone the repository
git clone https://github.com/Saravana071005/IRONX.git
cd IRONX

# Install all dependencies (root, backend, and frontend)
npm install
npm --prefix frontend install

# Start development servers
# Frontend: http://localhost:5173
npm --prefix frontend run dev

# Backend API: http://localhost:3000
npm start
```

### Production Build & Test

```bash
# Run all unit and integration tests (350 frontend + 104 backend)
npm test

# Build frontend production bundle with code-splitting
npm run build
```

---

## Deployment (Render)

IRONX is architected for continuous zero-downtime deployment on Render:

- **Frontend Static Site:**
  - Build Command: `npm install && npm --prefix frontend run build`
  - Publish Directory: `frontend/dist`
  - Rewrite Rule: `/* -> /index.html`
- **Backend Web Service:**
  - Build Command: `npm install`
  - Start Command: `npm start`
  - Health Check: `/api/health`

---

## License

AGPL-3.0 License. See [LICENSE](LICENSE) for details.

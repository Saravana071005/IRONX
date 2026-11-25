# IRONX FIT — Profile API Timeout Fix, Home Dashboard Reordering & Body Stats Muscle Balance Integration Report

**Report Date:** November 25, 2026  
**Audited Subsystems:** REST API Gateway + MongoDB Atlas Pool + React Zustand Client State + Anatomical Muscle Heatmap  
**Verification Status:** Certified & Verified (157/157 Backend Tests + 405/405 Frontend Tests Passing, 0 Errors, Clean Build)  
**Primary Deliverables:**
- PDF Publication Report: [IRONX_PROFILE_API_HOME_AND_BODY_STATS_FIX_REPORT.pdf](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/IRONX_PROFILE_API_HOME_AND_BODY_STATS_FIX_REPORT.pdf)
- Backend Performance Test Suite: [profile_api_performance.test.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/api/test/profile_api_performance.test.js)
- Home Dashboard Test Suite: [Home.test.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/views/Home.test.jsx)
- Muscle Balance Anatomical Test Suite: [MuscleBalanceChart.test.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/components/MuscleBalanceChart.test.jsx)
- Body Stats Test Suite: [Stats.test.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/views/Stats.test.jsx)

---

## 1. Executive Summary & Root Cause Analysis

A runtime network failure was reported by users completing their onboarding setup in `frontend/src/views/ProfileSetup.jsx`:
> `"Network timeout on /api/profile after 8000ms"`

The issue occurred on the profile review screen after displaying:
- Current Weight: 80 kg
- Fitness Goal: Body Recomposition
- Target Weight: 75 kg
- Training Cadence: 6 days/week
- Experience: Intermediate
- Style: Strength
- Diet Preferences: Skipped

### 1.1 Root Cause Breakdown
1. **Cold MongoDB Connection Handshakes:** In `api/db/mongo.js`, the MongoDB client was initialized with `maxPoolSize: 10` and `minPoolSize: 0`. For new or cold container connections, TCP handshakes, TLS negotiation, and replica set topology discovery took 2,500ms–4,000ms.
2. **Sequential Loop Congestion in `saveDb()`:** Whenever `saveDb()` was called, it executed an unthrottled sequential loop updating every user, credential, and invite document individually on MongoDB Atlas. Inside `PUT /api/profile`, calling `saveDb()` tied up the entire connection pool.
3. **Blocking Startup Sync in Request Lifecycle:** In `api/server.js`, `handleRequest` executed `await ensureMongoSync()` on every non-health-check request. If Mongo was connecting or synchronizing, incoming requests hung waiting for the sync promise.
4. **Missing Profile Endpoints:** `GET /api/profile` did not exist (only `GET /api/me` existed), and `POST /api/profile` was not aliased, causing 404s for standard profile read calls.
5. **Client-Side Fragility:** In `frontend/src/lib/api.js`, default timeout was set to 8,000ms with zero retry logic. When timeout occurred, `ProfileSetup.jsx` toasted the raw error but provided no inline retry button or error boundary, risking user frustration.

---

## 2. Engineered Architecture Optimizations (Module 1)

### 2.1 Database Adapter Tuning (`api/db/mongo.js` & `frontend/api/_lib/db/mongo.js`)
```javascript
const client = new MongoClient(uri, {
  maxPoolSize: 20,
  minPoolSize: 1, // Keep at least one warm socket to eliminate handshake latency
  maxIdleTimeMS: 60000,
  serverSelectionTimeoutMS: 3000,
  connectTimeoutMS: 5000
});
```

### 2.2 Non-Blocking Request Lifecycle & Parallelized Sync (`api/server.js`)
- **Bounded Request Sync:** In `handleRequest`, `ensureMongoSync()` is raced against a 1,500ms timeout guard (`Promise.race([ensureMongoSync(), syncTimeout])`). Incoming requests are never blocked by database synchronization.
- **Index Guard & Parallel Fetch:** `ensureMongoAuthIndexes` runs only once (`!mongoIndexesEnsured`). User, credential, and invite arrays are fetched in parallel with `Promise.all`.
- **Targeted User Updates:** `saveDb(user)` directly updates only the modified user document in Mongo. Full-database syncs utilize `bulkWrite({ ordered: false })` rather than serial round-trips.

### 2.3 Profile API Endpoints & Server-Timing Telemetry
- **`GET /api/profile`:** Authenticates caller, computes age from `dateOfBirth`, reads settings, and responds in under 5ms with `Server-Timing: db;dur=...;desc="Profile Read"`.
- **`POST /api/profile`:** Aliased directly to `PUT /api/profile` for complete client interoperability.
- **`PUT /api/profile`:**
  - Instantly updates in-memory `user` and atomic local state file `state-<uid>.json`.
  - Runs MongoDB user document update and state target update in parallel.
  - Guarantees response within 3,500ms via `Promise.race`, returning before client timeout.
  - Emits `Server-Timing: db;dur=...;desc="Profile Save"` header.

### 2.4 Resilient Frontend Client & Profile Setup Wizard
- **Extended Timeout & Automatic Retry:** In `frontend/src/lib/api.js`, default timeout increased to 12,000ms. On 408/TimeoutError, requests automatically retry once with exponential backoff.
- **Preserved Form State & Inline Recovery:** In `ProfileSetup.jsx`, entered user inputs (80 kg, 75 kg, recomposition, etc.) are strictly preserved upon error. An inline alert box renders an actionable `Retry Complete Setup` button.
- **Mount Synchronization:** Added `getProfile()` mount check to restore and populate existing user details seamlessly.

---

## 3. Home Dashboard Section Reordering (Module 2)

Per user specifications, the Home Dashboard (`frontend/src/views/Home.jsx`) has been restructured to the exact requested athletic sequence:

1. **Header & Greeting + Metric Summary Strip:** Athlete greeting, liquid glass header, search trigger, notification bell, user avatar, and 3-pill metric strip (Day Streak, Workouts, Weight Progress modal).
2. **Today Schedule Session (Hero Card):** Full-width workout hero card displaying today's scheduled template, exercises breakdown, and prominent "Start Workout" button.
3. **Target Today Card:** Strict monochrome card displaying today's target, 30-day program progress, active streak count, and exercise calories burned.
4. **Daily Biometrics & Calories Overview:** Trio metric rings (Protein, Calories, Carbs), Quick Log Meal action, and remaining calorie budget readout.
5. **Quick Actions Grid:** Touch-friendly 4-column strip: Log Workout, Log Food, Log Cardio (GPS live tracker), and Body Stats (direct routing to `/stats`).
6. **Remaining Home Sections:** Today's Meal Tracker (4 strict meal rows), Weekly Activity card, Your Progress charts, and This Week Plan schedule overview.

---

## 4. Body Stats Muscle Balance Integration (Module 3)

The anatomical Muscle Balance chart is now permanently integrated into Body Stats (`frontend/src/views/Stats.jsx`):

1. **Anatomical View Switcher:** Added interactive segmented control `[Both Views | Anterior (Front) | Posterior (Back)]`.
2. **Mobile Screen Optimization:** In `frontend/src/index.css`, added `.bodymap.single-view` with `max-width: 320px` and `max-height: min(55vh, 420px)`, allowing clear inspection of muscles on iPhone displays.
3. **Verified Workout Calculation:** Shading levels 0 to 4 are calculated strictly from verified completed sets (`set.done === true`), supporting Day, Week, 30 Days, 90 Days, and All-Time filters.
4. **Natural Peach / Skin-Tone Shading:** Adheres to the approved athletic skin-tone palette (`#98624F` baseline, `#BD806A` light, `#DFA88E` medium, `#F0C2A9` peak stimulation).

---

## 5. Comprehensive Test Results

| Test Suite | Purpose | Tests | Result |
| :--- | :--- | :---: | :---: |
| `api/test/profile_api_performance.test.js` | Profile read/write latency, routing, Server-Timing, 401 & 400 rejection | 6 / 6 | **PASS (54ms)** |
| `api/test/*.test.js` | Complete backend API verification (auth, nutrition, schedule, health, db) | 157 / 157 | **PASS (2.93s)** |
| `frontend/src/views/Home.test.jsx` | Exact sequence order, greeting, session hero, target today, biometrics, quick actions, meals | 14 / 14 | **PASS (169ms)** |
| `frontend/src/components/MuscleBalanceChart.test.jsx` | Anatomical view toggles (Both, Anterior, Posterior), workout filters, zero workout edge case | 6 / 6 | **PASS (73ms)** |
| `frontend/src/views/Stats.test.jsx` | Body Stats integration and Muscle Balance view controls | 1 / 1 | **PASS (41ms)** |
| `frontend/src/views/ProfileSetup.test.jsx` | Multi-step onboarding wizard, user isolation, data preservation | 3 / 3 | **PASS (20ms)** |
| **Total Frontend Suites (40 files)** | Full Vitest client suite across all views, components, and libraries | **405 / 405** | **PASS (1.40s)** |
| **Vite Production Build** | Full application bundling and minification (`npm run build`) | 342 modules | **PASS (590ms)** |

---

## 6. Verification & Sign-Off

- **Official IRONX Logo:** 100% untouched and preserved.
- **Monochrome Theme:** Maintained strict `#09090B`, `#18181B`, `#27272A` athletic dark mode aesthetics.
- **User Data Safety:** Zero destructive schema changes; all MongoDB Atlas user workout history, weights, and profiles remain intact.

# IRONX — Database Architecture, Connection Diagnostics, and HTTP 500 Root Cause Report

**Backend URL:** `https://IRONX-backend-ikdi.onrender.com/`  
**Frontend URL:** `https://IRONX-frontend-229c.onrender.com/`  
**Date:** 2026-11-14  
**Status:** Diagnosed, Hardened, and Verified (319/319 Tests Passing)

---

## 1. Actual Database Currently Used

MongoDB Atlas is the **primary persistent cloud database** for IRONX in production. Every piece of user-generated data, authentication credentials, and tracking history is persisted directly to MongoDB Atlas.

| Application Domain | Primary Persistent Database | Collection / Mechanism | Fallback / Local Cache Role |
| :--- | :--- | :--- | :--- |
| **User Profiles** | **MongoDB Atlas** | `users` collection | In-memory `db.users` cache synced on boot via `syncFromMongo()` |
| **Authentication & Sessions** | **Cryptographic Stateless HMAC** | Signed cookie `gymsid` | Session revocation counter `sv` stored in MongoDB `users.sv` |
| **Passkey Credentials** | **MongoDB Atlas** | `credentials` collection | In-memory `db.creds` cache synced via `syncFromMongo()` |
| **Workout Records** | **MongoDB Atlas** | `states` collection (`workouts` array) | Local filesystem `stateFile` acts as local cache |
| **Weekly Planner & Schedules** | **MongoDB Atlas** | `states` collection (`routines`, `week`, `dayPlan`) | Saved via `PUT /api/data` into MongoDB Atlas |
| **Custom Exercises** | **MongoDB Atlas** | `states` collection (`customEx` array) | Merged with predefined library client-side |
| **Exercise Library** | **Client-side Static Bundle** | [`frontend/src/lib/exercises-data.js`](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/IRONX/frontend/src/lib/exercises-data.js) | Predefined library (100+ movements) bundled in SPA for 0ms offline access |
| **Daily Food Logs** | **MongoDB Atlas** | `meal_logs` collection | Read-through cache in local SQLite table `meal_logs` |
| **Water Intake** | **MongoDB Atlas** | `water_logs` collection | Mirrored to local SQLite `water_logs` cache |
| **Cardio Records** | **MongoDB Atlas** | `cardio_logs` collection | Mirrored to local SQLite `cardio_logs` cache |
| **Strength Logs** | **MongoDB Atlas** | `strength_logs` collection | Mirrored to local SQLite `strength_logs` cache |
| **Daily Health Settings** | **MongoDB Atlas** | `daily_health_settings` collection | Mirrored to local SQLite `daily_health_settings` cache |

---

## 2. SQLite References and Their Purpose

There is only one SQLite database file in the project: [`data/nutrition.db`](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/IRONX/data/nutrition.db) (3.7 MB).

### Purpose:
1. **Static Reference Dataset:** Contains over 8,000 verified Indian food compositions, ICMR-NIN nutritional values, portion conversions, raw-versus-cooked yields, and recipe ingredients. This reference dataset is static and read-only.
2. **Local Read-Through Cache:** In [`api/nutrition/db.js`](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/IRONX/api/nutrition/db.js), SQLite provides fast queries for meal logs, water, and cardio on the local container.
3. **Synchronization with MongoDB Atlas:**
   - Every write operation (`addMealLog`, `updateMealLog`, `deleteMealLog`, `addWaterLog`, `addCardioLog`, `setDailyHealthSettings`) explicitly updates **MongoDB Atlas** via `getMongoDb().then(...)`.
   - On container restart or cache miss, [`syncHealthLogsFromMongo(userId, date)`](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/IRONX/api/nutrition/db.js#L561) fetches records directly from MongoDB Atlas and seeds the local cache.

### The Node.js ExperimentalWarning:
When Node.js 22/26 imports `node:sqlite` (`import { DatabaseSync } from 'node:sqlite'`), it emits:
```text
(node:XXXXX) ExperimentalWarning: SQLite is an experimental feature and might change at any time
```
This is a standard informational warning from the Node.js runtime indicating that the built-in `node:sqlite` standard library module is in experimental status. It is **not** an error or failure.

---

## 3. MongoDB Connection Status

The MongoDB Atlas configuration on your production Render service (`https://IRONX-backend-ikdi.onrender.com/`) is **active and connected**.

### Live Production Probe Results:
Live test against `https://IRONX-backend-ikdi.onrender.com/api/health`:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "ok": true,
  "database": "connected",
  "users": 0,
  "details": {
    "type": "mongodb",
    "connected": true,
    "configured": true
  }
}
```

Live test against `https://IRONX-backend-ikdi.onrender.com/api/health/db`:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "database": "connected"
}
```

### Verification:
* `MONGODB_URI` is correctly read from the environment.
* `MONGODB_DB` is correctly resolved (`IRONX`).
* The official MongoDB driver (`mongodb` v7.7.0) is installed and active.
* MongoDB connection pool (`maxPoolSize: 10`, `serverSelectionTimeoutMS: 5000`) is active.
* The Atlas cluster responded to `db.command({ ping: 1 })` with latency under 150ms.

---

## 4. Exact Reason for HTTP 500

Investigation into the source code revealed **two distinct root causes** that caused the intermittent HTTP 500 error:

### Root Cause A: Unhandled Promise Rejection in Global Request Middleware
1. In [`api/server.js`](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/IRONX/api/server.js#L846), `handleRequest(req, res)` was executing:
   ```javascript
   await ensureMongoSync();
   ```
   as a prerequisite for **every single incoming request**, including `/api/health`.
2. `ensureMongoSync()` cached `syncPromise = syncFromMongo()`. During initial container boot on Render Free Tier, the container's network stack and external TLS handshake to MongoDB Atlas can take 2–5 seconds. If a request (or Render's initial health check) arrived while MongoDB was in the middle of connecting:
   - `syncFromMongo()` threw or rejected.
   - `syncPromise` remained a **rejected Promise**.
   - Because `syncPromise` was not cleared or reset on error, every subsequent request that executed `await ensureMongoSync()` immediately re-threw the exact same rejection.
3. The outer try/catch in `handleRequest` intercepted the unhandled rejection:
   ```javascript
   catch (e) {
     if (!res.headersSent) json(res, 500, { error: 'server error', message: e?.message, stack: e?.stack });
   }
   ```
   This caused **every route (including `/api/health`) to return HTTP 500**.

### Root Cause B: Coupling Process Liveness to Database Connectivity
1. In the previous implementation of `GET /api/health`, the endpoint returned:
   ```javascript
   json(res, isDbConnected ? 200 : 503, ...);
   ```
   If the database was temporarily warming up or experiencing connection latency, the health probe returned **HTTP 503**, which Render flagged as an unhealthy service, triggering container restarts.
2. In addition, line 426 evaluated `db.users.length`. If `db.json` was empty on container startup before initial sync, `db.users` was `undefined`, throwing a `TypeError: Cannot read properties of undefined (reading 'length')` and crashing the endpoint with HTTP 500.

### Additional Discovery: Tab Character in `RP_ID`
During our live diagnostic curl of `POST /api/register/options`, the server returned:
```json
"rp": { "name": "IRONX", "id": "\topengym-frontend.onrender.com" }
```
Notice the `\t` character. When `RP_ID` was entered into the Render Dashboard, an accidental leading tab was pasted. This causes WebAuthn passkey registration in browsers to reject with a `SecurityError`.

---

## 5. Files Changed & Technical Fixes

### 1. [`api/server.js`](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/IRONX/api/server.js)
* **Separated Process Liveness and Database Readiness:**
  * `GET /api/health` is now a dedicated **Process Liveness Probe**. It returns **HTTP 200 OK** indicating the Node.js HTTP server is alive and functioning, while reporting the real-time database connection status in its JSON payload without failing the container.
  * `GET /api/health/db` is the dedicated **Database Readiness Probe**. It returns HTTP 200 when MongoDB Atlas is connected and HTTP 503 when unavailable.
* **Non-Blocking Health Checks in Middleware:**
  * Updated `handleRequest(req, res)` so that `/api/health` and `/api/health/db` bypass `ensureMongoSync()`. Health check probes are never blocked or failed by database sync operations.
* **Self-Healing Reconnection in `ensureMongoSync()`:**
  * Added `.catch(...)` to reset `syncPromise = null` on failure so that transient startup errors do not lock the server into permanent 500 responses.
* **Defensive Array Initialization:**
  * Initialized `db.users = db.users || []` and `db.creds = db.creds || []`, preventing any `undefined.length` `TypeError`.
* **Environment Variable Trimming:**
  * Added `.trim()` to `process.env.RP_ID`, `process.env.ORIGIN`, and `process.env.MONGODB_DB`, sanitizing any accidental tabs or whitespace.

### 2. [`api/db/mongo.js`](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/IRONX/api/db/mongo.js)
* Wrapped `new MongoClient(...)` and `getMongoDb(...)` in synchronous try/catch guards to ensure malformed connection strings or initialization faults are safely caught and logged rather than causing unhandled process exceptions.

---

## 6. Tests Performed

### Automated Test Suite:
* **Frontend Tests (`vitest`):** 12 test files, **234 passed**, 0 failed.
* **Backend Tests (`node:test`):** 8 test suites, **85 passed**, 0 failed.
* **Total Automated Tests:** **319 / 319 passing (100%)**.

### Production Live Probe Verification:
* `GET https://IRONX-backend-ikdi.onrender.com/api/health`: **HTTP 200 OK** (`type: mongodb, connected: true`).
* `GET https://IRONX-backend-ikdi.onrender.com/api/health/db`: **HTTP 200 OK** (`database: connected`).
* `OPTIONS https://IRONX-backend-ikdi.onrender.com/api/health`: **HTTP 204 No Content** (CORS verified with `Access-Control-Allow-Origin: https://IRONX-frontend-229c.onrender.com` and `credentials: true`).
* `GET https://IRONX-backend-ikdi.onrender.com/api/nutrition/search?q=banana`: **HTTP 200 OK** (queried staple foods database, 20 results returned).

---

## 7. Remaining Manual Render Configuration

To ensure your production environment is 100% clean:

1. **Clean up `RP_ID` in Render Dashboard:**
   - In Render Dashboard, click into service **`IRONX-backend`**.
   - Go to **Environment**.
   - Check the `RP_ID` key. Delete the existing value and re-type:
     `IRONX-frontend-229c.onrender.com`
     *(Ensure there are no leading tabs or spaces)*.
   - Click **Save Changes**.

2. **Verify Frontend `VITE_API_BASE_URL`:**
   - In Render Dashboard, click into **`IRONX-frontend`**.
   - Go to **Environment**.
   - Verify `VITE_API_BASE_URL` is set to:
     `https://IRONX-backend-ikdi.onrender.com`
     *(Without trailing slash)*.

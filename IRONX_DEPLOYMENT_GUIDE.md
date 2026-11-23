# IRONX — Complete Deployment & Production Operations Guide

This guide provides end-to-end instructions for running, testing, building, and deploying the IRONX application locally and to production platforms (Vercel + MongoDB Atlas or Docker Compose).

---

## 1. Project Architecture

IRONX is a self-hosted, privacy-first fitness and nutrition tracking platform built with a modern decoupled full-stack architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                                CLIENT                                  │
│                                                                        │
│  React 19 + Vite (SPA)                                                 │
│  ├── Router: React Router v7 (Home, Planner, Library, Log, Stats, PDF)  │
│  ├── State Store: Zustand (User session, routines, week, workouts)     │
│  ├── PDF Engine: jsPDF + AutoTable (ChatGPT Nutritional Analysis)      │
│  └── Passkey Auth: WebAuthn (@simplewebauthn/browser)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON API (/api/*)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                                BACKEND                                 │
│                                                                        │
│  Node.js (>=22.0.0) — Serverless Functions & Native HTTP Server        │
│  ├── Passkey Verification: @simplewebauthn/server                      │
│  ├── Signed Cookies & Auth: HMAC-SHA256 session tokens                 │
│  ├── Daily Health Log API: Food, water, cardio, strength, targets      │
│  └── AI Coach: Local CLI Agent (Claude Agent SDK / OpenAI Codex)       │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼ (Fallback / Local)              ▼ (Production / Cloud)
┌─────────────────────────────────────┐  ┌───────────────────────────────┐
│         LOCAL STORAGE (JSON)        │  │     MONGODB ATLAS CLUSTER     │
│                                     │  │                               │
│  ./data/db.json (Users, Creds)      │  │  Collections:                 │
│  ./data/state-<uid>.json (Routines) │  │  ├── users                    │
│  ./data/nutrition.db (SQLite)       │  │  ├── credentials              │
│  ./data/secret (Cookie secret)      │  │  ├── states                   │
│                                     │  │  ├── meal_logs                │
│                                     │  │  ├── water_logs               │
│                                     │  │  ├── cardio_logs              │
│                                     │  │  └── strength_logs            │
└─────────────────────────────────────┘  └───────────────────────────────┘
```

- **Frontend:** Single Page Application (React 19 + Vite + Zustand) located in `frontend/`. Bundles into static assets in `frontend/dist`.
- **Backend:** Node.js native HTTP server (`api/server.js`) and Vercel serverless functions (`api/index.js`, `api/[...path].js`).
- **Database Layer:** Dual storage architecture:
  - **Local/Self-hosted:** JSON state files in `data/` and local SQLite in `data/nutrition.db`.
  - **Cloud/Serverless:** MongoDB Atlas for serverless persistence across ephemeral lambdas.

---

## 2. Required Dependencies & System Requirements

- **Node.js:** `>= 22.0.0` (Required for native SQLite `DatabaseSync` support and modern Web APIs).
- **npm:** `>= 10.0.0`.
- **Operating System:** Windows, macOS, or Linux.
- **Docker & Docker Compose:** *(Optional, only if using containerized deployment)*.
- **MongoDB Atlas:** Free M0 cluster or higher *(Required for multi-instance / Vercel deployment)*.

---

## 3. Local Setup Commands

To set up the project on your development machine from scratch:

```bash
# 1. Clone repository
git clone https://github.com/Saravana071005/ironx.git
cd ironx

# 2. Copy environment file
cp .env.example .env

# 3. Install root and frontend dependencies
npm install

# 4. Verify test suite
npm test
```

---

## 4. Environment Variables Reference

Create a `.env` file in the project root:

| Variable | Purpose | Development Default | Production Example (Vercel) | Required |
| :--- | :--- | :--- | :--- | :--- |
| `RP_ID` | Hostname passkeys are bound to | `localhost` | `ironx-g3m5.vercel.app` | **Yes** |
| `ORIGIN` | Allowed web origin for CORS and auth | `http://localhost:8080` | `https://ironx-g3m5.vercel.app` | **Yes** |
| `RP_NAME` | Display name in WebAuthn prompt | `IRONX` | `IRONX` | No |
| `PORT` | Local backend HTTP port | `3000` | *(Auto-assigned by host)* | No |
| `SECRET` | HMAC-SHA256 session cookie signing key | *(Auto-generated)* | `484391a82f3...64hex` | **Yes** in cloud |
| `MONGODB_URI` | MongoDB Atlas connection string | *(Optional for local)* | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` | **Yes** on Vercel |
| `MONGODB_DB` | Database name in MongoDB Atlas | `IRONX` | `IRONX` | No |
| `SESSION_DAYS` | Session lifetime in days | `90` | `90` | No |
| `ADMIN_UIDS` | User IDs with admin dashboard access | *(None)* | `admin_uid_1,admin_uid_2` | No |
| `INVITE_ONLY` | Gate user signups behind invite codes | `0` | `0` (or `1` for private) | No |
| `COACH_DISABLED`| Disable AI Coach feature flag | `0` | `0` | No |

> [!NOTE]
> For WebAuthn passkeys to work, `RP_ID` must match the exact domain hostname in your browser (e.g. `ironx-g3m5.vercel.app` without `https://` or trailing slashes). `ORIGIN` must include protocol (e.g. `https://ironx-g3m5.vercel.app`).

---

## 5. MongoDB Atlas Configuration

For serverless deployments (such as Vercel) where local files in `/tmp` are ephemeral:

1. **Create an Atlas Cluster:**
   - Log in to [MongoDB Atlas](https://cloud.mongodb.com).
   - Create a free **M0 Shared Cluster** (e.g., in AWS `us-east-1` or region nearest to your users).
2. **Database Access (User):**
   - In Atlas, navigate to **Security** → **Database Access**.
   - Click **Add New Database User**.
   - Authentication Method: **Password**.
   - Role: **Read and write to any database** (or specific database `opengym`).
   - Save username and password.
3. **Network Access (IP Whitelist):**
   - Navigate to **Security** → **Network Access**.
   - Click **Add IP Address**.
   - Add `0.0.0.0/0` (Allow Access from Anywhere) so Vercel's dynamic serverless IP pool can reach the database.
4. **Connection String:**
   - Click **Database** → **Connect** → **Drivers** (Node.js).
   - Copy connection URI:
     `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
   - Set as `MONGODB_URI` in Vercel Environment Variables.

---

## 6. Backend Startup Instructions

### Running Local Development Backend:

```bash
# Run server directly on port 3000
npm start
# Output: gym-api on :3000 (rpID=localhost, origin=http://localhost:8080)
```

The server automatically reads `.env`, connects to MongoDB if configured (or falls back to `./data`), and listens on `http://localhost:3000`.

---

## 7. Frontend Startup Instructions

### Running Frontend with Vite Dev Server:

```bash
# Navigate to frontend directory and start Vite
npm --prefix frontend run dev
# Output: VITE v8.1.5 ready in 250ms at http://localhost:5173/
```

Vite proxies `/api` calls directly to the local backend port (`http://localhost:3000`).

---

## 8. Production Build Commands

```bash
# Run the complete test suite
npm test

# Build the production frontend bundle
npm run build
```

The built output is saved in `frontend/dist` with minified CSS, JavaScript chunks, localized strings, and static assets.

---

## 9. GitHub Setup & Hygiene

To push your project cleanly to GitHub:

1. Verify `.gitignore` ignores sensitive files:
   - `.env`, `.env.local`
   - `data/`
   - `node_modules/`
   - `frontend/dist/`
2. Check working tree status:
   ```bash
   git status
   ```
3. Commit and push:
   ```bash
   git add .
   git commit -m "Update IRONX project and improve application functionality"
   git push origin main
   ```

---

## 10. Fresh Vercel Deployment Instructions

Follow these exact steps when creating or redeploying the project on Vercel:

### Step 1: Import Project
1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Select your repository `Saravana071005/ironx`.

### Step 2: Configure Project Settings (CRITICAL)
- **Framework Preset:** `Other` (or `Vite`).
- **Root Directory:** `./` *(DO NOT set to `frontend`! It must be the repository root `./` so `/api` serverless functions and root dependencies are loaded).*
- **Build Command:** `npm run build` *(Leave default or toggle override with `npm run build`)*.
- **Output Directory:** `frontend/dist`.
- **Install Command:** `npm install`.
- **Node.js Version:** In **Project Settings** → **General**, ensure Node.js is set to **`22.x`**.

### Step 3: Configure Production Environment Variables
In Vercel **Project Settings** → **Environment Variables**, add:

| Name | Value |
| :--- | :--- |
| `RP_ID` | `<your-app-domain>` (e.g. `ironx-g3m5.vercel.app`) |
| `ORIGIN` | `https://<your-app-domain>` (e.g. `https://ironx-g3m5.vercel.app`) |
| `RP_NAME` | `IRONX` |
| `SECRET` | *(Random 64-character hex string)* |
| `MONGODB_URI` | `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority` |
| `MONGODB_DB` | `IRONX` |

### Step 4: Deploy
Click **Deploy**. Vercel will:
1. Run `npm install` for root and frontend workspaces.
2. Build the frontend into `frontend/dist`.
3. Package serverless functions under `/api`.
4. Deploy the production application.

---

## 11. Production Verification Checklist

After deployment, perform these tests in your production browser:

- [ ] **Health Endpoint:** Navigate to `https://<your-domain>/api/health`. Expected JSON: `{"ok":true,"database":"connected",...}`.
- [ ] **Simple DB Health Endpoint:** Navigate to `https://<your-domain>/api/health/db`. Expected JSON: `{"database":"connected"}`.
- [ ] **Homepage & Navigation:** Verify responsive UI loads with Header, Today's Progress ring, Weekly Activity strip, and Navigation bar.
- [ ] **Passkey Registration:** Tap "Create Profile", enter athlete name, and register passkey (Face ID/Fingerprint/Security Key). Verify redirect to dashboard.
- [ ] **Weekly Workout Planner:** Navigate to `/planner`. Verify Monday–Sunday cards with the default 6-day split (4 Strength, 2 Cardio, 1 Rest).
- [ ] **Exercise Library:** Navigate to `/exercise-library`. Verify 8 categories and 54 sample exercises load. Search and test adding a custom exercise.
- [ ] **Daily Health Log:** Navigate to `/nutrition`. Log a food entry, log water intake (watch the progress ring update), log cardio activity, and log a strength session.
- [ ] **PDF Generation:** In Daily Health Log, click "Export Daily Report PDF". Verify the PDF downloads with clean typography, tables, and the prompt for ChatGPT.
- [ ] **Data Persistence Test:** Refresh the page or open in a private window and sign back in with your passkey; verify all logged meals, workouts, and planner settings persist from MongoDB Atlas.

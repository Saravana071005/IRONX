# IRONX — Render Free Tier Deployment Guide
## Complete Step-by-Step Operator Manual for Zero-Cost Production Hosting

This guide outlines how to deploy IRONX to **Render** using exclusively the **Free Tier**. It covers database network access, automated Blueprint deployment, environment variable configuration, operational expectations (cold starts), verification procedures, and zero-downtime rollback to Vercel.

---

## 1. Prerequisites Checklist

Before beginning deployment, ensure you have:
1. A **Render account** (free to create at [render.com](https://render.com) — no credit card required for free services).
2. Connected your **GitHub account** to Render with access to repository [Saravana071005/ironx](https://github.com/Saravana071005/ironx).
3. Access to your existing **MongoDB Atlas** account holding the IRONX cluster.
4. Your existing MongoDB Atlas connection URI (`mongodb+srv://...`).

---

## 2. Step 1: Configure MongoDB Atlas Network Access

Because Render Free Web Services use **dynamic outbound IPs** that rotate between deployments and restarts, MongoDB Atlas must be configured to permit traffic from any cloud IP.

### Configuration Steps:
1. Log in to [MongoDB Atlas Console](https://cloud.mongodb.com/).
2. In the left navigation sidebar under **Security**, click **Network Access**.
3. Click the green **+ Add IP Address** button.
4. Click **ALLOW ACCESS FROM ANYWHERE** (this populates IP Address with `0.0.0.0/0`).
5. In the Comment field, enter `Render Free Tier Dynamic Cloud IP`.
6. Click **Confirm**. Wait ~30 seconds for the status to show **Active**.

> [!NOTE]
> **Security Posture:** Even with `0.0.0.0/0`, your MongoDB Atlas cluster is protected by:
> - TLS 1.3 encrypted transport on port 27017.
> - SCRAM-SHA-256 database authentication requiring your complex username and password.
> - Role-based scoping (ensure your database user only has `readWrite` permission on the `IRONX` database).

---

## 3. Step 2: Deploy Using Render Blueprint (`render.yaml`) — Recommended

IRONX includes a committed `render.yaml` Blueprint file that configures both the Backend Web Service and Frontend Static Site with zero manual guesswork.

### Blueprint Steps:
1. Go to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** in the top navigation bar and select **Blueprint**.
3. Select your repository: `Saravana071005/ironx`.
4. Branch: select `main`.
5. Render will detect `render.yaml` and display two services:
   - **`IRONX-backend`** (Web Service, Node runtime, Free plan)
   - **`IRONX-frontend`** (Static Site, Static runtime, Free plan)
6. Under **Environment Variables**, fill in the required prompt:
   - `MONGODB_URI`: Paste your full MongoDB Atlas connection string (e.g. `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/opengym?retryWrites=true&w=majority`).
7. Click **Apply**.
8. Render will initiate the initial builds for both services.

---

## 4. Step 3: Link Frontend & Backend Subdomains

Once Render creates both services, they will each receive an `*.onrender.com` URL:
- Backend: `https://IRONX-backend.onrender.com` (or similar)
- Frontend: `https://IRONX-frontend.onrender.com` (or similar)

To finalize cross-service communication:

### A. Update Frontend Environment Variable:
1. In Render Dashboard, click into the **`IRONX-frontend`** Static Site.
2. Go to **Environment** in the left menu.
3. Click **Add Environment Variable**:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://IRONX-backend.onrender.com` (use your actual backend URL from step 8, without trailing slash).
4. Click **Save Changes**. This triggers an automatic rebuild of the static site.

### B. Update Backend Environment Variables:
1. In Render Dashboard, click into the **`IRONX-backend`** Web Service.
2. Go to **Environment** in the left menu.
3. Verify or add the following keys:
   - `ORIGIN`: `https://IRONX-frontend.onrender.com` (your frontend URL).
   - `RP_ID`: `IRONX-frontend.onrender.com` (your frontend hostname, no `https://`).
   - `ORIGINS`: `https://IRONX-frontend.onrender.com`
4. Click **Save Changes**. The backend service will restart automatically with the updated config.

---

## 5. Alternative: Manual Service Creation (If Not Using Blueprint)

If you prefer to configure the services manually via the Render UI:

### Service 1: Backend API (Render Web Service)
| Field | Value |
| :--- | :--- |
| **Service Type** | Web Service |
| **Name** | `IRONX-backend` |
| **Region** | Oregon (US West) or Frankfurt |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** ($0/month) |
| **Health Check Path** | `/api/health` |

#### Backend Environment Variables:
| Variable Name | Required | Value / Description |
| :--- | :---: | :--- |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Auto | (Set automatically by Render, usually `10000`) |
| `MONGODB_URI` | Yes | `mongodb+srv://<user>:<password>@cluster0.xxxx.mongodb.net/opengym` |
| `MONGODB_DB` | Yes | `IRONX` |
| `SECRET` | Yes | 64-character random hex string (or click "Generate") |
| `RP_NAME` | Yes | `IRONX` |
| `RP_ID` | Yes | `IRONX-frontend.onrender.com` |
| `ORIGIN` | Yes | `https://IRONX-frontend.onrender.com` |
| `ORIGINS` | Yes | `https://IRONX-frontend.onrender.com` |
| `DATA_DIR` | Yes | `/tmp/IRONX-data` |

---

### Service 2: Frontend Client (Render Static Site)
| Field | Value |
| :--- | :--- |
| **Service Type** | Static Site |
| **Name** | `IRONX-frontend` |
| **Region** | Global CDN (automatically served globally; no region required) |
| **Branch** | `main` |
| **Build Command** | `npm install && npm --prefix frontend run build` |
| **Publish Directory** | `frontend/dist` |
| **Routing / Rewrites** | Add Rule: Type `Rewrite`, Source `/*`, Destination `/index.html` |

#### Frontend Environment Variables:
| Variable Name | Required | Value / Description |
| :--- | :---: | :--- |
| `VITE_API_BASE_URL` | Yes | `https://IRONX-backend.onrender.com` |

---

## 6. Render Free Tier Operational Realities & Recommendations

### 6.1 Cold Starts (Spin Down on Inactivity)
- **Behavior:** Render Free Web Services spin down to 0 instances after **15 minutes of inactivity**.
- **Wake-up Latency:** When a user visits after the service has spun down, the first API request (`/api/config` or `/api/health`) will take **30 to 50 seconds** to boot.
- **Client Handling:** The IRONX frontend handles offline/slow states gracefully and displays standard connection status.
- **Free Keep-Alive Optimization (Optional):**
  If you want to prevent cold starts during waking hours without paying:
  1. Create a free account on [UptimeRobot](https://uptimerobot.com/) or [cron-job.org](https://cron-job.org/).
  2. Create an HTTP monitor that pings `https://IRONX-backend.onrender.com/api/health` once every **10 minutes**.
  3. *Note on Quotas:* Render Free tier provides **750 free instance hours per month** across all free web services. Running 1 web service continuously (24/7 for 31 days) consumes ~744 hours, staying just within the 750-hour monthly limit.

### 6.2 Ephemeral Container Filesystem
- Render Free Web Services run in ephemeral containers. Any files written locally to disk (e.g. `/tmp`) are discarded on restarts.
- Because IRONX persists all user state, workouts, passkeys, invites, and daily health logs to **MongoDB Atlas**, no data is lost during restarts.

---

## 7. Post-Deployment Verification Checklist

Once both services show **Live** in Render:

1. **Verify Backend Health:**
   Visit: `https://<backend-url>/api/health`
   Expected response:
   ```json
   {
     "ok": true,
     "database": "connected",
     "users": 1,
     "details": {
       "type": "mongodb",
       "connected": true,
       "configured": true
     }
   }
   ```

2. **Verify Database Probe:**
   Visit: `https://<backend-url>/api/health/db`
   Expected response:
   ```json
   {
     "database": "connected"
   }
   ```

3. **Verify Frontend Access:**
   Visit: `https://<frontend-url>`
   - The IRONX UI loads with responsive styling.
   - SPA page navigation (e.g. `#/planner`, `#/nutrition`, `#/history`) works without 404s.

4. **Verify Authentication & Passkeys:**
   - Sign in with an existing passkey (or register a new user).
   - Verify that your profile loads your workout history and routines from MongoDB Atlas.
   - Inspect browser dev tools Application > Cookies to confirm cookie `gymsid` is stored with `SameSite=None; Secure`.

5. **Verify Weekly Planner:**
   - Navigate to **Weekly Workout Planner**.
   - Modify workout types / exercises for Monday-Sunday.
   - Reload page and verify custom schedule is preserved.

6. **Verify Daily Health Log & PDF Export:**
   - Log a food item, water intake (e.g. 500ml), or cardio session.
   - Verify macros calculate against daily 1,900 kcal target.
   - Click **Download PDF Report** and confirm clean PDF generation.

---

## 8. Zero-Downtime Rollback Procedure (Back to Vercel)

If at any point you wish to revert to Vercel:

1. Your existing Vercel project has **not** been modified or deleted.
2. The repository still retains `vercel.json` and the `/api` serverless handler adapters (`api/index.js`, `api/[...path].js`).
3. To switch traffic back:
   - If using custom domains (e.g. `IRONX.app`): Update DNS CNAME record from Render (`<app>.onrender.com`) back to Vercel (`cname.vercel-dns.com`).
   - If using platform domains: Users can immediately access the active Vercel deployment at `https://ironx-g3m5.vercel.app/`.
4. Because all data is stored centrally in MongoDB Atlas, both Vercel and Render share the exact same database with zero synchronization gap.

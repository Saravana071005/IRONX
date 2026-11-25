# IRONX FIT — Adaptive Nutrition Intelligence & Database Error Fix Report

**Report Date:** November 25, 2026  
**Audited Subsystems:** SQLite (WAL) + MongoDB Atlas + Mifflin-St Jeor Deterministic Engine + React Zustand Client State  
**Verification Status:** Certified & Verified (151/151 Backend Tests + 404/404 Frontend Tests Passing, 0 Errors)  
**Primary Deliverables:**
- PDF Publication Report: [IRONX_ADAPTIVE_NUTRITION_AND_DATABASE_FIX_REPORT.pdf](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/IRONX_ADAPTIVE_NUTRITION_AND_DATABASE_FIX_REPORT.pdf)
- Backend Test Suite: [user_targets_and_adaptive_nutrition.test.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/api/test/user_targets_and_adaptive_nutrition.test.js)
- Frontend Test Suite: [AdaptiveNutritionComponents.test.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/views/AdaptiveNutritionComponents.test.jsx)

---

## 1. Executive Summary & Root Cause Analysis

A runtime database failure was reported by users attempting to update their Daily Calorie Goal from 2,000 kcal to 1,900 kcal in the Daily Health Log:
> `"Error updating calorie goal: no such table: user_targets"`

### 1.1 Root Cause
In a previous iteration of the nutrition module, query abstractions (`getCanonicalUserNutritionGoals` and `saveCanonicalCalorieGoal`) in `api/nutrition/db.js` were modified to query and write to a table named `user_targets`. However, `getDb()` initialization lacked a `CREATE TABLE IF NOT EXISTS user_targets` statement. Consequently:
1. When a user edited the calorie goal in the UI to 1,900 kcal, `api('/api/nutrition/daily-goal')` executed `INSERT INTO user_targets ...`.
2. SQLite threw a fatal exception (`no such table: user_targets`).
3. The API returned HTTP 500, which the frontend displayed in an error toast.
4. The calorie target remained out-of-sync across Today's Plan (2,000 kcal), Home Dashboard, and Daily Health Log.

### 1.2 Permanent Architecture Fix
1. **Schema & Versioned Migrations:** Created `user_targets` with comprehensive user scoping, biometric attributes, and indexed lookups. Added `user_target_history` to log historical target changes with audit trails.
2. **Backfill Migration:** Safe startup migration checks `user_nutrition_targets` and backfills `user_targets` for existing users so zero data is lost.
3. **Synchronous Multi-Store Reconciliation:** `saveCanonicalCalorieGoal` and `setUserTargets` update `user_targets`, `daily_health_settings`, `user_nutrition_targets`, and async sync to MongoDB Atlas.

---

## 2. Deterministic BMR & TDEE Calculation Engine (Modules 2, 3, 4)

The application relies strictly on deterministic scientific formulas without external AI or LLM hallucination:

### 2.1 Mifflin-St Jeor Equations
```
Male BMR   = 10 x Weight(kg) + 6.25 x Height(cm) - 5 x Age + 5
Female BMR = 10 x Weight(kg) + 6.25 x Height(cm) - 5 x Age - 161
```

### 2.2 Physical Activity Level (PAL) Multipliers
Non-overlapping activity coefficients prevent double counting:
- **Sedentary (desk job, little exercise):** $1.20$
- **Lightly Active (1–3 training sessions/wk):** $1.375$
- **Moderately Active (3–5 training sessions/wk):** $1.55$
- **Very Active (6–7 intense sessions/wk):** $1.725$
- **Extremely Active (athletes / 2x daily training):** $1.90$

$\text{TDEE} = \text{BMR} \times \text{PAL Multiplier}$

### 2.3 Fitness Goal Calorie Offsets
- **Fat Loss:** $\text{TDEE} - 400\text{ to }500\text{ kcal/day}$ (sustainable fat loss of $0.35$–$0.5\text{ kg/wk}$).
- **Muscle Building:** $\text{TDEE} + 250\text{ to }350\text{ kcal/day}$ (gradual surplus targeting lean hypertrophy).
- **Body Recomposition:** $\text{TDEE} - 100\text{ kcal/day}$ with elevated protein intake.
- **Maintenance:** $\text{TDEE} + 0\text{ kcal/day}$.

### 2.4 Macronutrient Distribution Reconciliation
- **Protein:** Based on fitness goal: $2.0\text{ g/kg}$ for fat loss/recomp, $1.8\text{ g/kg}$ for muscle building, $1.6\text{ g/kg}$ for maintenance.
- **Fat:** $20\%$ to $25\%$ of target calories divided by $9\text{ kcal/g}$.
- **Carbohydrates:** Remaining calories divided by $4\text{ kcal/g}$.
- **Dietary Fiber:** $14\text{g} \text{ per } 1000\text{ kcal}$ (standard clinical recommendation, bounded $25$–$40\text{g}$).
- **Energy Balance Equation:** $\sum (4P + 4C + 9F) = \text{Target Calories}$ within $\pm 2\text{ kcal}$ rounding.

---

## 3. Daily Body-Weight Tracking (Module 6)

A high-fidelity body weight logging system was introduced:
- **Table:** `weight_logs (id, user_id, date, weight_kg, notes, created_at)` with `UNIQUE(user_id, date)`.
- **Decimal Precision:** Body weights are stored as `REAL` and rounded to two decimals (e.g. `78.45 kg`).
- **7-Day Rolling Average:** Smooths out daily fluid shifts, sodium consumption, and bowel movement fluctuations.
- **Weekly Rate of Change ($\Delta W$):** Compares the current 7-day average against the previous 7-day average (days 8–14).

---

## 4. Adaptive Nutrition Intelligence & Weekly Review (Modules 7, 8, 9)

Located in `api/nutrition/adaptive.js`, the deterministic weekly review engine assesses 14–21 day metabolic trends:

```mermaid
flowchart TD
    A[Start 14-Day Weekly Review] --> B{Sufficient Data?}
    B -- "<4 weigh-ins OR <4 meal days" --> C[Status: DATA_GATHERING<br/>Adjustment: 0 kcal<br/>Guidance: Log consistently]
    B -- ">=4 weigh-ins AND >=4 meal days" --> D{Primary Goal?}
    
    D -- Fat Loss --> E{Weekly Rate of Weight Loss}
    E -- "-0.35 to -0.75 kg/wk" --> F[Status: ON_TRACK<br/>Adjustment: 0 kcal]
    E -- "> -0.20 kg/wk stalled" --> G{Adherence >= 85%?}
    G -- Yes --> H[Status: PLATEAU<br/>Recommended Adjustment: -100 kcal]
    G -- No --> I[Status: INCONSISTENT_INTAKE<br/>Adjustment: 0 kcal<br/>Focus on hitting target]
    E -- "< -0.90 kg/wk excessive" --> J[Status: RAPID_LOSS<br/>Recommended Adjustment: +100 to +150 kcal]

    D -- Muscle Gain --> K{Weekly Rate of Weight Gain}
    K -- "+0.15 to +0.35 kg/wk" --> L[Status: ON_TRACK<br/>Adjustment: 0 kcal]
    K -- "< +0.10 kg/wk stalled" --> M[Status: SURPLUS_STALLED<br/>Recommended Adjustment: +100 kcal]
    K -- "> +0.50 kg/wk excessive" --> N[Status: RAPID_GAIN<br/>Recommended Adjustment: -100 kcal]

    H --> O{Safety Floor Check}
    M --> O
    O -- "Result < 1200 F / 1500 M" --> P[Clamp to Safety Floor]
    O -- Valid --> Q[Save Review & Offer 1-Click Apply]
```

### 4.1 Strict Scientific Guardrails
1. **Safety Floors:** Female calories never drop below **1,200 kcal**; male calories never drop below **1,500 kcal**.
2. **Bounded Steps:** Individual adjustments are bounded between **-150 kcal** and **+150 kcal** to prevent metabolic shock.
3. **Data Quality Gate:** Adjustments are never recommended if the user has fewer than 4 weigh-ins or fewer than 4 logged meal days in the 14-day window.
4. **Missing Days vs Zero Calories:** Unlogged days are counted as absent data, never falsely averaged in as starvation days.

---

## 5. UI Implementation & Visual Design (Module 10)

Implemented in `frontend/src/views/Nutrition.jsx` and `frontend/src/views/AdaptiveNutritionComponents.jsx`:
- **Daily Calorie Goal Card:** Shows Daily Calorie Goal, consumed vs remaining calories, BMR and TDEE badges, macro distribution breakdown (Protein, Carbs, Fat, Fiber), and inline Edit button with quick presets (1800, 1900, 2000, 2200, 2500 kcal).
- **Body Weight Tracking Card:** Displays Latest Weight, 7-Day Average, Weekly Change ($\Delta W$), and "+ Log Weight" button opening a decimal-supported modal with recent history and delete action.
- **Weekly Review Card:** Displays metabolic status badge (e.g. `ON TRACK`, `METABOLIC PLATEAU`), 14-day metrics, scientific rationale, and a 1-click `Apply Adjustment` button.
- **Design Tokens:** Background `#09090B`, cards `#141417`, borders `#2E2E36`, tabular numerals. Official IRONX logo remains untouched.

---

## 6. Test Suite Certification

| Test Suite | Total Tests | Passed | Failed | Status |
| :--- | :---: | :---: | :---: | :---: |
| `api/test/user_targets_and_adaptive_nutrition.test.js` | 8 | 8 | 0 | **100% PASSED** |
| `frontend/src/views/AdaptiveNutritionComponents.test.jsx` | 4 | 4 | 0 | **100% PASSED** |
| Complete Backend Suite (`node --test api/test/*.test.js`) | 151 | 151 | 0 | **100% PASSED** |
| Complete Frontend Suite (`npm test`) | 404 | 404 | 0 | **100% PASSED** |
| Frontend Production Build (`npm run build`) | 342 modules | 342 | 0 | **BUILT (815ms)** |

---

## 7. API Route Reference

- `GET /api/nutrition/canonical-goal` — Returns canonical user targets and profile.
- `POST /api/nutrition/daily-goal` — Updates daily calorie goal across all subsystems.
- `POST /api/nutrition/goals/onboarding` — Deterministically calculates BMR, TDEE, macros, saves profile to `user_targets`, and initializes body weight.
- `GET /api/nutrition/weight-logs?limit=30` — Retrieves historical weigh-ins and rolling stats.
- `POST /api/nutrition/weight-logs` — Logs or updates a daily body weight entry.
- `POST /api/nutrition/weight-logs/delete` — Deletes a weight entry by ID or date.
- `GET /api/nutrition/weekly-review?window_days=14` — Evaluates metabolic trend and produces adaptive review.
- `POST /api/nutrition/weekly-review/apply` — Applies recommended adjustment to `user_targets` with history logging.

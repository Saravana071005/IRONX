# IRONX FIT — Unified Daily Calorie Goal & Home Dashboard Bug Fix Report

**Report Date:** November 24–25, 2026  
**Audited Engine:** SQLite (WAL) + MongoDB Atlas + Zustand Client State  
**Status:** Certified & Verified (143/143 Backend Tests + 387/387 Frontend Tests Passing)  
**Primary Artifacts:**
- PDF Report: [IRONX_CALORIE_GOAL_AND_HOME_BUG_FIX_REPORT.pdf](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/IRONX_CALORIE_GOAL_AND_HOME_BUG_FIX_REPORT.pdf)
- Test Suite: [UnifiedCalorieGoalAndHomeFix.test.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/views/UnifiedCalorieGoalAndHomeFix.test.jsx)

---

## 1. Executive Summary

Based on user screen-recording evidence, two critical application defects were investigated:
1. **Calorie Target Discrepancies:** Different calorie targets appeared across modules (e.g. 2,000 kcal in Today's Plan versus 1,800–1,900 kcal in Daily Health Log and Home Tracker).
2. **Home Dashboard Fatal Crash:** Navigating to the Home Dashboard crashed into the root ErrorBoundary (*"Something went wrong / Reload IRONX"*).

Both issues have been permanently fixed. The application now implements a strict **Single Source of Truth (SSOT)** for daily calorie goals, provides an inline goal editor directly on the Daily Health Log card, and features defensive parsing and card-level error isolation across the Home Dashboard.

---

## 2. Calorie Target Discrepancy Root Causes

| Previous Location | Stored Target / Default | Behavior / Mechanism |
| :--- | :--- | :--- |
| `daily_health_settings` (SQLite) | `1,900 kcal` default | Read by Daily Health Log and Daily Report PDF. Overwritten only when user accessed legacy settings modal. |
| `user_nutrition_goals` (SQLite) | `2,000 kcal` default / BMR formula | Stored `custom_targets` or `calculated_targets`. Consumed by Today's Plan and Planner engine. |
| `user_targets` & MongoDB `states` | `1,900–2,000 kcal` drift | Hydrated into Zustand `S.nutritionTargets`. Could fall out of sync with SQLite records. |
| `HomeMealTracker.jsx` | `2,000 kcal` local state | Maintained detached local state `const [targetCalories, setTargetCalories] = useState(2000)`. |
| `exportDailyReportPdf.js` | `1,900 kcal` hardcoded | Hardcoded `1,900 kcal target` in both header display text and ChatGPT prompt analysis template. |

---

## 3. Canonical Goal Architecture (Single Source of Truth)

### Authoritative Reconciliation: `getCanonicalUserNutritionGoals(userId)`
Located in [api/nutrition/db.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/api/nutrition/db.js) and mirrored in [frontend/api/_lib/nutrition/db.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/api/_lib/nutrition/db.js):
- **Priority 1:** `user_nutrition_goals.custom_targets.calorie_target`
- **Priority 2:** `daily_health_settings.calorie_target`
- **Priority 3:** `user_targets.calorie_target` / `user_nutrition_goals.calculated_targets`
- **Fallback:** Canonical standard `2,000 kcal`
- Reconciles timestamps so the user's most recent explicit change takes precedence.

### Synchronized Mutation: `saveCanonicalCalorieGoal(userId, newCalorieTarget)`
- Validates target range strictly between **500 kcal** and **10,000 kcal**.
- Atomic write to SQLite `daily_health_settings`, `user_targets`, and `user_nutrition_goals` (recording history audit log).
- Asynchronously persists to MongoDB collections (`daily_health_settings`, `user_nutrition_goals`, and `states.state.nutritionTargets`).
- Updates Zustand store via `setCalorieTarget(val)` with zero reload required.

---

## 4. Module 2: Daily Health Log Dedicated Calorie Goal Control

Located in [Nutrition.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/views/Nutrition.jsx):
- **Header Placement:** Displays `Daily Calorie Goal` with an inline `[Edit]` button on the top Daily Health Log summary card.
- **Inline Editing Form:** Expandable edit form with numeric validation and `Saving...` feedback.
- **Quick Preset Chips:** 5 touch-friendly presets (`1,800`, `1,900`, `2,000`, `2,200`, and `2,500 kcal`).
- **Data Safety:** Changing target updates the remaining balance and progress percentage only; **historical consumed foods and logs are never altered**.

---

## 5. Home Dashboard Crash Investigation & Fixes

Located in [Home.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/views/Home.jsx):

1. **Missing `setsDone` Import:**
   - *Problem:* Line 1009 called `setsDone(todayWorkout)`, but `setsDone` was omitted from `import { ... } from '../lib/history.js'`. Threw `ReferenceError: setsDone is not defined` whenever a completed workout existed for today.
   - *Fix:* Added `setsDone` to `../lib/history.js` import.
2. **Unsafe `.slice` on Numeric Timestamps:**
   - *Problem:* Lines 246 & 286 called `(c.createdAt && c.createdAt.slice(0, 10) === iso)`. When `createdAt` was an epoch timestamp number (e.g. `Date.now()`), threw `TypeError: c.createdAt.slice is not a function`.
   - *Fix:* Added helper `isCardioOnDay(c, targetIso)` handling strings, numbers (`new Date(c.createdAt).toISOString()`), and null safely.
3. **Card-Level Error Boundaries:**
   - *Problem:* Top header and 3-pill metric strip were rendered outside any error boundary.
   - *Fix:* Wrapped inside `<WidgetBoundary title="Dashboard Overview">` so isolated rendering errors never crash the entire page.
4. **HomeMealTracker API Key & Status Fix:**
   - *Problem:* Sent `mealType` instead of `meal_type` to `/api/nutrition/daily-plan/toggle-status`, causing 400 Bad Request.
   - *Fix:* Updated payload to `meal_type` and handled object status payloads properly.

---

## 6. Verified User Scenario: 1,836 kcal Consumed / 2,000 kcal Target

Reproduced from the user's video recording:
- **Breakfast:** Oats & Berries (100g) — 380 kcal | 18g P | 60g C | 6g F
- **Lunch:** Grilled Chicken & Rice (350g) — 750 kcal | 65g P | 85g C | 16g F
- **Dinner:** Salmon & Steamed Veg (300g) — 706 kcal | 52g P | 25g C | 42g F
- **Total Consumed:** **1,836 kcal** | 135g Protein | 170g Carbs | 64g Fat

### Adherence Results:
- **At Canonical 2,000 kcal Goal:** Consumed: `1,836 kcal` | Remaining: `164 kcal` (Displayed identically on Home Dashboard, Daily Health Log, and Today's Plan).
- **At 1,900 kcal Goal:** Consumed: `1,836 kcal` | Remaining: `64 kcal` (Exact match with user's video).
- **At 2,200 kcal Goal:** Consumed: `1,836 kcal` | Remaining: `364 kcal` (Immediate reactive update).

---

## 7. Automated Test Suite & Production Build Verification

```
Test Suites:
✓ Backend Node.js Tests:      143 / 143 passed (api/test/*.test.js)
✓ Frontend Vitest Suite:       38 /  38 files passed (387 / 387 tests)
✓ UnifiedCalorieGoal Suite:      5 /   5 tests passed (UnifiedCalorieGoalAndHomeFix.test.jsx)
✓ Production Client Build:     Vite v8.1.5 build succeeded (340 modules compiled in 621ms)
```

### Verified Test Cases in `UnifiedCalorieGoalAndHomeFix.test.jsx`:
1. `Module 1 & 3`: Home Dashboard, Daily Health Log, and Today Plan share exact canonical goal (2,000 kcal goal, 1,836 kcal consumed, 164 kcal remaining).
2. `Module 2`: Updating Daily Calorie Goal updates all sections immediately without altering consumed calories (1,900 -> 2,200 kcal with 64 -> 364 kcal remaining).
3. `Module 5`: Home Dashboard renders completed workout hero card without crashing when `todayWorkout` exists (verifies `setsDone` import).
4. `Module 5`: Home Dashboard handles cardio logs with numeric timestamps without throwing `TypeError: c.createdAt.slice is not a function`.
5. `Module 6`: `HomeMealTracker` renders adherence, connects to canonical goal, and handles meal toggles properly.

---

## 8. Modified Files Summary

- [api/nutrition/db.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/api/nutrition/db.js)
- [api/nutrition/routes.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/api/nutrition/routes.js)
- [api/nutrition/planner.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/api/nutrition/planner.js)
- [api/server.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/api/server.js)
- [frontend/api/_lib/nutrition/db.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/api/_lib/nutrition/db.js)
- [frontend/api/_lib/nutrition/routes.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/api/_lib/nutrition/routes.js)
- [frontend/api/_lib/nutrition/planner.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/api/_lib/nutrition/planner.js)
- [frontend/api/_lib/server.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/api/_lib/server.js)
- [frontend/src/store/useStore.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/store/useStore.js)
- [frontend/src/views/Home.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/views/Home.jsx)
- [frontend/src/views/Nutrition.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/views/Nutrition.jsx)
- [frontend/src/components/HomeMealTracker.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/components/HomeMealTracker.jsx)
- [frontend/src/components/DailyMealTracker.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/components/DailyMealTracker.jsx)
- [frontend/src/lib/exportDailyReportPdf.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/lib/exportDailyReportPdf.js)
- [frontend/src/views/UnifiedCalorieGoalAndHomeFix.test.jsx](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/opengym/frontend/src/views/UnifiedCalorieGoalAndHomeFix.test.jsx)

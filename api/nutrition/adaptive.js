/**
 * IRONX Adaptive Nutrition Intelligence Engine
 *
 * Deterministic weekly review and metabolic adaptation service based on:
 * 1. 14-21 day rolling daily bodyweight logs and 7-day average trend
 * 2. Actual daily calorie and protein consumption from verified meal logs
 * 3. Actual completed strength workouts and cardio sessions
 * 4. User primary fitness goal (Fat Loss, Muscle Building, Body Recomposition)
 *
 * Follows strict scientific guardrails:
 * - Minimum 4 weigh-ins and 4 meal logging days required to trigger recommendations
 * - Small bounded adjustments (+/- 50 to 150 kcal)
 * - Minimum calorie safety floor (1200 kcal female, 1500 kcal male)
 * - Single-day anomalies or noise never trigger adjustments
 * - Missing days are distinguished from zero consumption
 */

import { getDb, getCanonicalUserNutritionGoals, saveCanonicalCalorieGoal, getWeightLogs, saveWeeklyNutritionReview, getLatestWeeklyNutritionReview } from './db.js';

export function analyzeWeeklyNutritionProgress(userId, windowDays = 14) {
  if (!userId) throw new Error('User ID is required');

  const canonical = getCanonicalUserNutritionGoals(userId);
  const goalType = String(canonical.goal_type || 'maintenance').toLowerCase();
  const currentTarget = Math.round(Number(canonical.calorie_target) || 2000);
  const proteinTarget = Math.round(Number(canonical.protein_target) || 140);
  const sex = String(canonical.sex || 'male').toLowerCase();
  const minSafetyFloor = sex === 'female' ? 1200 : 1500;

  const d = getDb();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const windowStartDateObj = new Date(now.getTime() - (windowDays - 1) * 86400000);
  const windowStartStr = windowStartDateObj.toISOString().slice(0, 10);

  // 1. Fetch Weight Logs
  const weightLogs = getWeightLogs(userId, windowDays + 7);
  const sortedWeights = [...weightLogs].sort((a, b) => a.date.localeCompare(b.date));

  // Determine current week (last 7 days: days 0-6) and previous week (days 7-13)
  const midpointDateObj = new Date(now.getTime() - 7 * 86400000);
  const midpointStr = midpointDateObj.toISOString().slice(0, 10);

  const currentWeekWeights = sortedWeights.filter(w => w.date > midpointStr && w.date <= todayStr);
  const previousWeekWeights = sortedWeights.filter(w => w.date <= midpointStr && w.date >= windowStartStr);

  const currentAvgWeight = currentWeekWeights.length
    ? Math.round((currentWeekWeights.reduce((s, w) => s + w.weight_kg, 0) / currentWeekWeights.length) * 100) / 100
    : (sortedWeights.length ? sortedWeights[sortedWeights.length - 1].weight_kg : null);

  const previousAvgWeight = previousWeekWeights.length
    ? Math.round((previousWeekWeights.reduce((s, w) => s + w.weight_kg, 0) / previousWeekWeights.length) * 100) / 100
    : null;

  const weightChangeKg = (currentAvgWeight != null && previousAvgWeight != null)
    ? Math.round((currentAvgWeight - previousAvgWeight) * 100) / 100
    : 0;

  // 2. Fetch Actual Food Logs
  let mealLogs = [];
  try {
    mealLogs = d.prepare(`
      SELECT date, SUM(energy_kcal) as daily_calories, SUM(protein_g) as daily_protein
      FROM meal_logs
      WHERE user_id = ? AND date >= ? AND date <= ?
      GROUP BY date
    `).all(userId, windowStartStr, todayStr);
  } catch (e) {
    mealLogs = [];
  }

  const daysLogged = mealLogs.length;
  const avgCaloriesConsumed = daysLogged
    ? Math.round(mealLogs.reduce((s, m) => s + (Number(m.daily_calories) || 0), 0) / daysLogged)
    : 0;

  const avgProteinConsumed = daysLogged
    ? Math.round((mealLogs.reduce((s, m) => s + (Number(m.daily_protein) || 0), 0) / daysLogged) * 10) / 10
    : 0;

  // Adherence: % of logged days within +/- 15% of calorie target
  const adherentDays = mealLogs.filter(m => {
    const c = Number(m.daily_calories) || 0;
    return c >= currentTarget * 0.85 && c <= currentTarget * 1.15;
  }).length;
  const adherenceRatePct = daysLogged ? Math.round((adherentDays / daysLogged) * 100) : 0;

  // 3. Fetch Completed Strength and Cardio Logs
  let workoutsCompleted = 0;
  try {
    const sRows = d.prepare(`
      SELECT COUNT(DISTINCT date) as count
      FROM strength_logs
      WHERE user_id = ? AND date >= ? AND date <= ?
    `).get(userId, windowStartStr, todayStr);
    workoutsCompleted = sRows?.count || 0;
  } catch {}

  let cardioSessions = 0;
  let cardioDurationTotal = 0;
  try {
    const cRows = d.prepare(`
      SELECT COUNT(*) as count, SUM(duration_min) as total_min
      FROM cardio_logs
      WHERE user_id = ? AND date >= ? AND date <= ?
    `).get(userId, windowStartStr, todayStr);
    cardioSessions = cRows?.count || 0;
    cardioDurationTotal = Math.round(cRows?.total_min || 0);
  } catch {}

  // 4. Deterministic Adaptive Analysis
  let status = 'ON_TRACK';
  let adjustmentKcal = 0;
  let reasoning = '';
  let requiresConfirmation = false;

  // Guard 1: Insufficient weight data
  if (sortedWeights.length < 4) {
    status = 'INSUFFICIENT_DATA';
    adjustmentKcal = 0;
    reasoning = `Insufficient weight data (${sortedWeights.length}/4 weigh-ins logged). Log your weight at least 4 times across a 14-day window to activate adaptive target reviews.`;
  }
  // Guard 2: Insufficient meal tracking data
  else if (daysLogged < 4) {
    status = 'INSUFFICIENT_DATA';
    adjustmentKcal = 0;
    reasoning = `Insufficient food tracking (${daysLogged}/4 days logged). Reliable adaptive adjustments require consistent meal logging for at least 4 days.`;
  }
  // Data is sufficient — Evaluate by goal
  else {
    const weeklyRate = previousAvgWeight != null ? weightChangeKg : 0;

    if (goalType === 'fat_loss') {
      if (weeklyRate <= -0.3 && weeklyRate >= -0.85) {
        status = 'ON_TRACK';
        adjustmentKcal = 0;
        reasoning = `Your weight trend is decreasing at a healthy, sustainable rate (${weeklyRate} kg/wk). Keep your current target of ${currentTarget} kcal.`;
      } else if (weeklyRate > -0.15) {
        // Plateau
        if (adherenceRatePct >= 70) {
          status = 'PLATEAU';
          adjustmentKcal = -100;
          reasoning = `Your weight trend has remained stable (${weeklyRate >= 0 ? '+' : ''}${weeklyRate} kg/wk) despite consistent adherence (${adherenceRatePct}%). A small adjustment of -100 kcal is recommended to resume fat loss.`;
        } else {
          status = 'ADHERENCE_NEEDED';
          adjustmentKcal = 0;
          reasoning = `Weight progress is plateaued, but average calorie intake (${avgCaloriesConsumed} kcal vs ${currentTarget} kcal target) shows variance. Focus on hitting your current target consistently before lowering calories.`;
        }
      } else if (weeklyRate < -0.9) {
        // Dropping too fast
        status = 'RAPID_LOSS';
        adjustmentKcal = 150;
        requiresConfirmation = true;
        reasoning = `Your weight is decreasing faster than recommended (${weeklyRate} kg/wk). Increasing your target by +150 kcal is advised to preserve lean muscle and support recovery.`;
      } else {
        status = 'ON_TRACK';
        adjustmentKcal = 0;
        reasoning = `Progress is steady (${weeklyRate} kg/wk). Continue with your current daily goal.`;
      }
    } else if (goalType === 'muscle_building' || goalType === 'muscle_gain') {
      if (weeklyRate >= 0.15 && weeklyRate <= 0.40) {
        status = 'ON_TRACK';
        adjustmentKcal = 0;
        reasoning = `Weight is progressing at an optimal rate for lean muscle growth (+${weeklyRate} kg/wk) with ${workoutsCompleted} completed workouts. Maintain your current target.`;
      } else if (weeklyRate < 0.05) {
        // Stalled
        status = 'STALLED_GAIN';
        adjustmentKcal = 100;
        reasoning = `Weight has remained flat (+${weeklyRate} kg/wk) over the past 2 weeks. A small increase of +100 kcal is recommended to support muscle hypertrophy.`;
      } else if (weeklyRate > 0.55) {
        // Gaining too fast
        status = 'RAPID_GAIN';
        adjustmentKcal = -100;
        reasoning = `Weight is increasing faster than optimal for lean muscle (+${weeklyRate} kg/wk). Moderating by -100 kcal helps minimize unnecessary body fat accumulation.`;
      } else {
        status = 'ON_TRACK';
        adjustmentKcal = 0;
        reasoning = `Gradual mass progress is on track (+${weeklyRate} kg/wk). Maintain your current target.`;
      }
    } else if (goalType === 'recomposition') {
      if (Math.abs(weeklyRate) <= 0.25) {
        status = 'ON_TRACK';
        adjustmentKcal = 0;
        reasoning = `Body weight is stable (${weeklyRate >= 0 ? '+' : ''}${weeklyRate} kg/wk) while training consistency is strong (${workoutsCompleted} sessions). Body recomposition is progressing as intended.`;
      } else if (weeklyRate > 0.4) {
        status = 'ADJUSTMENT_RECOMMENDED';
        adjustmentKcal = -100;
        reasoning = `Weight is trending upward (+${weeklyRate} kg/wk). A slight deficit reduction of -100 kcal is recommended to encourage fat mobilization.`;
      } else if (weeklyRate < -0.6) {
        status = 'ADJUSTMENT_RECOMMENDED';
        adjustmentKcal = 100;
        reasoning = `Weight is dropping faster than intended for recomposition (${weeklyRate} kg/wk). Increasing by +100 kcal will better support muscle protein synthesis.`;
      } else {
        status = 'ON_TRACK';
        adjustmentKcal = 0;
        reasoning = `Weight is stable (${weeklyRate >= 0 ? '+' : ''}${weeklyRate} kg/wk) and protein intake averages ${avgProteinConsumed}g/day. Maintain current target.`;
      }
    } else {
      // Maintenance
      if (Math.abs(weeklyRate) <= 0.3) {
        status = 'ON_TRACK';
        adjustmentKcal = 0;
        reasoning = `Weight is stable within normal daily fluctuation bounds (${weeklyRate >= 0 ? '+' : ''}${weeklyRate} kg/wk). Keep current target.`;
      } else if (weeklyRate > 0.4) {
        status = 'ADJUSTMENT_RECOMMENDED';
        adjustmentKcal = -100;
        reasoning = `Weight is drifting upward (+${weeklyRate} kg/wk). Adjusting by -100 kcal will restore energy balance.`;
      } else {
        status = 'ADJUSTMENT_RECOMMENDED';
        adjustmentKcal = 100;
        reasoning = `Weight is drifting downward (${weeklyRate} kg/wk). Increasing by +100 kcal will restore energy balance.`;
      }
    }
  }

  // Ensure adjustment does not violate minimum safety floors
  let recommendedTarget = currentTarget + adjustmentKcal;
  if (recommendedTarget < minSafetyFloor) {
    recommendedTarget = minSafetyFloor;
    adjustmentKcal = minSafetyFloor - currentTarget;
  }

  // Bounded adjustment check
  adjustmentKcal = Math.max(-150, Math.min(150, adjustmentKcal));
  recommendedTarget = currentTarget + adjustmentKcal;

  const statusKey = status === 'INSUFFICIENT_DATA' ? 'gathering_data' : status.toLowerCase();
  const reviewRecord = {
    id: 'wnr_' + userId + '_' + todayStr,
    user_id: userId,
    week_start_date: windowStartStr,
    week_end_date: todayStr,
    starting_avg_weight: previousAvgWeight,
    ending_avg_weight: currentAvgWeight,
    weight_change_kg: weightChangeKg,
    total_weigh_ins: sortedWeights.length,
    days_logged: daysLogged,
    avg_calories_consumed: avgCaloriesConsumed,
    avg_protein_consumed: avgProteinConsumed,
    adherence_rate_pct: adherenceRatePct,
    target_calories: currentTarget,
    target_protein: proteinTarget,
    workouts_completed: workoutsCompleted,
    cardio_sessions_completed: cardioSessions,
    cardio_duration_total_min: cardioDurationTotal,
    goal_type: goalType,
    status: statusKey,
    status_code: status,
    status_label: status.replace(/_/g, ' '),
    is_actionable: status !== 'INSUFFICIENT_DATA' && adjustmentKcal !== 0,
    calorie_adjustment: adjustmentKcal,
    adjustment_kcal: adjustmentKcal,
    recommended_calorie_target: recommendedTarget,
    requires_confirmation: requiresConfirmation,
    applied: false,
    reasoning,
    explanation: reasoning,
    metrics: {
      avg_calories_consumed: avgCaloriesConsumed,
      calorie_adherence_pct: adherenceRatePct,
      avg_protein_g: avgProteinConsumed,
      protein_adherence_pct: Math.round((avgProteinConsumed / Math.max(1, proteinTarget)) * 100),
      weight_change_kg: weightChangeKg,
      weigh_in_count: sortedWeights.length,
      days_logged: daysLogged,
      strength_workouts_count: workoutsCompleted,
      cardio_sessions_count: cardioSessions,
      cardio_duration_min: cardioDurationTotal
    },
    created_at: now.toISOString()
  };

  // Save to database
  saveWeeklyNutritionReview(userId, reviewRecord);

  return reviewRecord;
}

export function applyWeeklyNutritionReview(userId, reviewId = null) {
  if (!userId) throw new Error('User ID is required');

  const latest = getLatestWeeklyNutritionReview(userId);
  if (!latest) throw new Error('No active weekly nutrition review found to apply');

  if (latest.applied) {
    return { ok: true, already_applied: true, canonical_goals: getCanonicalUserNutritionGoals(userId) };
  }

  const newTarget = Math.round(Number(latest.recommended_calorie_target));
  if (!newTarget || isNaN(newTarget) || newTarget < 500) {
    throw new Error('Invalid recommended target in review');
  }

  // Apply new target
  const updatedCanonical = saveCanonicalCalorieGoal(userId, newTarget);

  // Mark review as applied
  const d = getDb();
  if (d) {
    try {
      d.prepare("UPDATE weekly_nutrition_reviews SET applied = 1 WHERE user_id = ? AND id = ?").run(userId, latest.id);
    } catch {}
  }

  return {
    ok: true,
    applied: true,
    previous_target: latest.target_calories,
    new_target: newTarget,
    adjustment_kcal: latest.adjustment_kcal,
    canonical_goals: updatedCanonical
  };
}

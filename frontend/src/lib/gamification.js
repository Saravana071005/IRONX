/**
 * Iron House - Gamification & Motivation Engine
 *
 * Implements XP awards, Level 1–50 progression with athletic tiers,
 * Personal Record (PR) Vault detection, and non-punitive weekly consistency streaks.
 */

import { EXIDX } from './exercises.js'
import { calcEpley1RM } from './overload.js'
import { weekKey, todayISO } from './format.js'
import { modeOf } from './history.js'

export const XP_REWARDS = {
  WORKOUT_COMPLETE: 100,
  WEEKLY_TARGET: 50,
  NEW_PR: 75,
  WEIGHT_LOGGED: 15,
  CARDIO_TARGET: 50
}

export const ATHLETIC_TIERS = [
  { minLevel: 1, maxLevel: 10, name: 'Bronze Iron', color: '#cd7f32', badge: 'medal' },
  { minLevel: 11, maxLevel: 20, name: 'Silver Steel', color: '#94a3b8', badge: 'shield' },
  { minLevel: 21, maxLevel: 35, name: 'Titanium', color: '#38bdf8', badge: 'bolt' },
  { minLevel: 36, maxLevel: 50, name: 'Master Elite', color: '#f59e0b', badge: 'crown' }
]

/**
 * Calculates XP required to step from level L to L+1:
 * Step XP = Math.floor(250 * L^1.4)
 */
export function xpForLevelStep(level) {
  if (level < 1) return 0
  return Math.floor(250 * Math.pow(level, 1.4))
}

/**
 * Pre-computes cumulative XP thresholds up to Level 50.
 */
const CUMULATIVE_XP_THRESHOLDS = (() => {
  const arr = [0] // Level 1 starts at 0 XP
  let total = 0
  for (let lvl = 1; lvl <= 50; lvl++) {
    total += xpForLevelStep(lvl)
    arr.push(total)
  }
  return arr
})()

/**
 * Computes level, athletic tier, and level progress bar metrics from total XP.
 */
export function levelFromXP(totalXP = 0) {
  const xp = Math.max(0, Math.floor(totalXP))
  let lvl = 1

  while (lvl < 50 && xp >= CUMULATIVE_XP_THRESHOLDS[lvl]) {
    lvl++
  }

  const tier = ATHLETIC_TIERS.find(t => lvl >= t.minLevel && lvl <= t.maxLevel) || ATHLETIC_TIERS[0]
  const baseXP = CUMULATIVE_XP_THRESHOLDS[lvl - 1] || 0
  const nextXP = CUMULATIVE_XP_THRESHOLDS[lvl] || baseXP + 10000
  const progressInLevel = Math.max(0, xp - baseXP)
  const span = Math.max(1, nextXP - baseXP)
  const progressPercent = lvl >= 50 ? 100 : Math.min(100, Math.round((progressInLevel / span) * 100))

  return {
    level: lvl,
    tier: tier.name,
    tierColor: tier.color,
    tierBadge: tier.badge,
    totalXP: xp,
    baseXP,
    nextXP,
    progressInLevel,
    neededForNext: lvl >= 50 ? 0 : Math.max(0, nextXP - xp),
    progressPercent
  }
}

/**
 * Idempotently awards XP for an event if not already present in the history log.
 * Returns { awarded: boolean, newTotal: number, entry: object | null }
 */
export function awardXPEvent(currentXP = 0, history = [], eventId, rewardType, customXP = null, desc = '') {
  const xpAmt = customXP != null ? Number(customXP) : (XP_REWARDS[rewardType] || 0)
  if (xpAmt <= 0) return { awarded: false, newTotal: currentXP, entry: null, history }

  const alreadyAwarded = history.some(item => item.eventId === eventId)
  if (alreadyAwarded) {
    return { awarded: false, newTotal: currentXP, entry: null, history }
  }

  const entry = {
    id: 'xp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    eventId,
    type: rewardType,
    xp: xpAmt,
    desc,
    date: todayISO(),
    ts: Date.now()
  }

  const nextHistory = [...history, entry]
  const newTotal = currentXP + xpAmt

  return {
    awarded: true,
    newTotal,
    entry,
    history: nextHistory
  }
}

/**
 * Detects and evaluates verified Personal Records (PRs) from completed workouts.
 * Scans for:
 * 1. Max absolute weight (kg/lb)
 * 2. Max reps at working weight
 * 3. Max estimated 1RM (Epley)
 * 4. Max cardio duration / speed
 */
export function detectPersonalRecords(workouts = [], existingVault = []) {
  const prMap = new Map() // key: exId + '_' + metric -> record

  // Initialize with existing verified vault entries
  for (const pr of existingVault) {
    const key = pr.exId + '_' + pr.metric
    prMap.set(key, { ...pr })
  }

  const newRecordsFound = []

  // Traverse finished workouts chronologically
  const sorted = [...workouts].sort((a, b) => (a.d < b.d ? -1 : 1))

  for (const w of sorted) {
    for (const en of (w.entries || [])) {
      const ex = EXIDX[en.id]
      const exName = ex ? ex.n : (en.name || 'Exercise')
      const mode = modeOf({ ...en, id: en.id })
      const doneSets = (en.sets || []).filter(s => s.done && !s.warmup)
      if (!doneSets.length) continue

      if (mode === 'reps') {
        // Metric 1: Max Weight
        for (const s of doneSets) {
          const weight = Number(s.w) || 0
          const reps = Number(s.r) || 0
          if (weight <= 0) continue

          // Max weight
          const wKey = en.id + '_max_weight'
          const curBestW = prMap.get(wKey)
          if (!curBestW || weight > curBestW.value) {
            const rec = {
              id: 'pr_' + en.id + '_w_' + weight + '_' + w.d,
              exId: en.id,
              exName,
              metric: 'max_weight',
              label: 'Max Weight',
              value: weight,
              reps,
              prevValue: curBestW ? curBestW.value : null,
              date: w.d,
              workoutId: w.id || w.d
            }
            prMap.set(wKey, rec)
            newRecordsFound.push(rec)
          }

          // Max Estimated 1RM
          if (reps >= 1 && reps <= 20) {
            const e1rm = calcEpley1RM(weight, reps)
            const e1Key = en.id + '_e1rm'
            const curBest1RM = prMap.get(e1Key)
            if (!curBest1RM || e1rm > curBest1RM.value) {
              const rec = {
                id: 'pr_' + en.id + '_e1rm_' + e1rm + '_' + w.d,
                exId: en.id,
                exName,
                metric: 'e1rm',
                label: 'Best Estimated 1RM',
                value: e1rm,
                weight,
                reps,
                prevValue: curBest1RM ? curBest1RM.value : null,
                date: w.d,
                workoutId: w.id || w.d
              }
              prMap.set(e1Key, rec)
              newRecordsFound.push(rec)
            }
          }
        }
      } else if (mode === 'cardio' || mode === 'time') {
        for (const s of doneSets) {
          const dur = Number(s.sec) || 0
          if (dur <= 0) continue
          const tKey = en.id + '_duration'
          const curBestDur = prMap.get(tKey)
          if (!curBestDur || dur > curBestDur.value) {
            const rec = {
              id: 'pr_' + en.id + '_dur_' + dur + '_' + w.d,
              exId: en.id,
              exName,
              metric: 'duration',
              label: 'Longest Duration',
              value: dur,
              prevValue: curBestDur ? curBestDur.value : null,
              date: w.d,
              workoutId: w.id || w.d
            }
            prMap.set(tKey, rec)
            newRecordsFound.push(rec)
          }
        }
      }
    }
  }

  return {
    vault: Array.from(prMap.values()),
    newRecords: newRecordsFound
  }
}

/**
 * Calculates non-punitive weekly workout consistency.
 * Respects rest days and avoids shame-based penalties.
 */
export function calcWeeklyConsistency(workouts = [], weeklyTarget = 4, targetDate = todayISO()) {
  const currentWeek = weekKey(targetDate)
  const inWeek = workouts.filter(w => weekKey(w.d) === currentWeek)
  const completed = inWeek.length
  const target = Math.max(1, Number(weeklyTarget) || 4)
  const percent = Math.min(100, Math.round((completed / target) * 100))
  const remaining = Math.max(0, target - completed)
  const isTargetMet = completed >= target

  // Compare to previous week
  const prevDate = new Date(new Date(targetDate).getTime() - 7 * 86400000).toISOString().slice(0, 10)
  const prevWeek = weekKey(prevDate)
  const prevWeekCompleted = workouts.filter(w => weekKey(w.d) === prevWeek).length

  return {
    completed,
    target,
    percent,
    remaining,
    isTargetMet,
    currentWeek,
    prevWeekCompleted,
    weekDelta: completed - prevWeekCompleted
  }
}

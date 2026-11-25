import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import {
  BodyWeightCard,
  LogWeightModal,
  WeeklyNutritionReviewCard,
  fmtWeight
} from './AdaptiveNutritionComponents.jsx'

describe('IRONX — Adaptive Nutrition Components & UI Verification', () => {
  it('1. fmtWeight formats decimals and integers cleanly', () => {
    expect(fmtWeight(78.45)).toBe('78.45')
    expect(fmtWeight(78.0)).toBe('78.0')
    expect(fmtWeight(80)).toBe('80.0')
    expect(fmtWeight(null)).toBe('—')
    expect(fmtWeight(undefined)).toBe('—')
  })

  it('2. BodyWeightCard renders latest weight, 7-day average and weekly change', () => {
    const mockStats = {
      latest: { weight_kg: 78.45, date: '2026-11-25' },
      rolling_7day_avg: 78.60,
      weekly_change: -0.35,
      count_14d: 6
    }

    const html = renderToString(
      <BodyWeightCard
        weightStats={mockStats}
        onOpenLogModal={() => {}}
        t={(k) => k}
      />
    )

    expect(html).toContain('Body Weight Tracking')
    expect(html).toContain('78.45')
    expect(html).toContain('78.60')
    expect(html).toContain('-0.35')
    expect(html).toContain('logs in window')
  })

  it('3. LogWeightModal renders input supporting decimals and recent logs list', () => {
    const mockLogs = [
      { id: '1', date: '2026-11-25', weight_kg: 78.45, notes: 'Morning fasted' },
      { id: '2', date: '2026-11-24', weight_kg: 78.60, notes: '' }
    ]

    const html = renderToString(
      <LogWeightModal
        defaultDate="2026-11-25"
        currentWeight={78.45}
        weightLogs={mockLogs}
        onSaveWeight={() => {}}
        onDeleteWeight={() => {}}
        close={() => {}}
        t={(k) => k}
      />
    )

    expect(html).toContain('Log Body Weight')
    expect(html).toContain('78.45')
    expect(html).toContain('Morning fasted')
    expect(html).toContain('2026-11-24')
    expect(html).toContain('Save Weight Entry')
  })

  it('4. WeeklyNutritionReviewCard renders status badge, metrics and recommended adjustment', () => {
    const mockReview = {
      id: 'wnr_123',
      status: 'plateau',
      status_label: 'Metabolic Plateau',
      is_actionable: true,
      current_calorie_target: 2000,
      recommended_calorie_target: 1900,
      calorie_adjustment: -100,
      explanation: 'Over the past 14 days, weight change has stalled despite 97% calorie adherence.',
      metrics: {
        avg_calories_consumed: 1940,
        calorie_adherence_pct: 97,
        avg_protein_g: 152,
        protein_adherence_pct: 108,
        weight_change_kg: -0.05,
        weigh_in_count: 12,
        strength_workouts_count: 8,
        cardio_sessions_count: 4
      }
    }

    const html = renderToString(
      <WeeklyNutritionReviewCard
        review={mockReview}
        canonicalGoals={{ calorie_target: 2000 }}
        onApplyAdjustment={() => {}}
        onOpenGoals={() => {}}
        t={(k) => k}
      />
    )

    expect(html).toContain('Adaptive Nutrition Review')
    expect(html).toContain('Metabolic Plateau')
    expect(html).toContain('2,000')
    expect(html).toContain('1,900')
    expect(html).toContain('-100')
    expect(html).toContain('Apply Adjustment')
    expect(html).toContain('Over the past 14 days, weight change has stalled')
  })
})

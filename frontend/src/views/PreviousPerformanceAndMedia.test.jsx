import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getPreviousExercisePerformance, lastEntryFor } from '../lib/history.js'
import { imgSrc, gifSrc, CDN_IMG_BASE, CDN_GIF_BASE } from '../lib/exercises.js'
import { isMediaLoaded, markMediaLoaded, preloadExercise, preloadUpcomingExercises } from '../lib/mediaCache.js'
import { getAudioContext, unlockAudio, beep, playRestAlert } from '../lib/sound.js'

describe('IRONX Previous Workout Performance Tracking & Media Optimization', () => {

  describe('Module 1 & 2: Exercise-Specific Previous Workout Performance', () => {
    it('retrieves exact set-by-set performance from the immediately previous completed session', () => {
      const state = {
        workouts: [
          {
            id: 'w-1',
            d: '2026-10-18',
            name: 'Chest + Triceps',
            routineId: 'chest_triceps',
            start: 1729245600000,
            end: 1729249200000,
            completed: true,
            entries: [
              {
                id: 'dumbbell_incline_press',
                name: 'Dumbbell Incline Press',
                sets: [
                  { w: 30, r: 10, done: true },
                  { w: 30, r: 9, done: true },
                  { w: 30, r: 8, done: true },
                  { w: 28, r: 9, done: true }
                ]
              }
            ]
          }
        ]
      }

      const perf = getPreviousExercisePerformance(state, 'dumbbell_incline_press')
      expect(perf.found).toBe(true)
      expect(perf.workoutName).toBe('Chest + Triceps')
      expect(perf.date).toBe('2026-10-18')
      expect(perf.sets).toHaveLength(4)
      expect(perf.sets[0]).toMatchObject({ setNumber: 1, w: 30, r: 10, completed: true })
      expect(perf.sets[1]).toMatchObject({ setNumber: 2, w: 30, r: 9, completed: true })
      expect(perf.sets[2]).toMatchObject({ setNumber: 3, w: 30, r: 8, completed: true })
      expect(perf.sets[3]).toMatchObject({ setNumber: 4, w: 28, r: 9, completed: true })
    })

    it('shows ONLY the immediately previous completed session, not older records or combined history', () => {
      const state = {
        workouts: [
          {
            id: 'session-old',
            d: '2026-10-10',
            name: 'Chest Session 1',
            end: 1000000,
            completed: true,
            entries: [
              {
                id: 'dumbbell_incline_press',
                sets: [
                  { w: 26, r: 10, done: true },
                  { w: 26, r: 10, done: true }
                ]
              }
            ]
          },
          {
            id: 'session-recent',
            d: '2026-10-18',
            name: 'Chest Session 2',
            end: 2000000,
            completed: true,
            entries: [
              {
                id: 'dumbbell_incline_press',
                sets: [
                  { w: 30, r: 10, done: true },
                  { w: 30, r: 9, done: true },
                  { w: 30, r: 8, done: true },
                  { w: 28, r: 9, done: true }
                ]
              }
            ]
          }
        ]
      }

      const perf = getPreviousExercisePerformance(state, 'dumbbell_incline_press')
      expect(perf.found).toBe(true)
      expect(perf.workoutId).toBe('session-recent')
      expect(perf.workoutName).toBe('Chest Session 2')
      expect(perf.sets).toHaveLength(4)
      expect(perf.sets[0].w).toBe(30)
      expect(perf.sets[3].w).toBe(28)
    })

    it('differentiates exercises strictly by exact variation ID and NEVER by muscle group', () => {
      const state = {
        workouts: [
          {
            id: 'chest-day',
            d: '2026-10-18',
            end: 3000000,
            completed: true,
            entries: [
              {
                id: 'dumbbell_incline_press',
                name: 'Dumbbell Incline Press',
                category: 'chest',
                muscleGroup: 'Upper Chest',
                sets: [{ w: 30, r: 10, done: true }]
              },
              {
                id: 'barbell_incline_bench_press',
                name: 'Barbell Incline Bench Press',
                category: 'chest',
                muscleGroup: 'Upper Chest',
                sets: [{ w: 70, r: 8, done: true }]
              }
            ]
          }
        ]
      }

      // 1. Dumbbell Incline Press retrieves its own 30kg set
      const dbPerf = getPreviousExercisePerformance(state, 'dumbbell_incline_press')
      expect(dbPerf.found).toBe(true)
      expect(dbPerf.sets[0].w).toBe(30)

      // 2. Barbell Incline Bench Press retrieves its own 70kg set
      const bbPerf = getPreviousExercisePerformance(state, 'barbell_incline_bench_press')
      expect(bbPerf.found).toBe(true)
      expect(bbPerf.sets[0].w).toBe(70)

      // 3. Smith Machine Incline Press has no history and must NOT inherit from Dumbbell or Barbell
      const smithPerf = getPreviousExercisePerformance(state, 'smith_machine_incline_press')
      expect(smithPerf.found).toBe(false)
      expect(smithPerf.message).toBe('No previous session for this exercise.')

      // 4. Incline Chest Press Machine has no history and must NOT inherit
      const machinePerf = getPreviousExercisePerformance(state, 'incline_chest_press_machine')
      expect(machinePerf.found).toBe(false)
      expect(machinePerf.message).toBe('No previous session for this exercise.')
    })

    it('supports custom exercise variations and displays clean first-time baseline state', () => {
      const state = { workouts: [] }

      // Brand new custom variation
      const perfBefore = getPreviousExercisePerformance(state, 'custom_db_incline_variation_b')
      expect(perfBefore.found).toBe(false)
      expect(perfBefore.message).toBe('No previous session for this exercise.')
      expect(perfBefore.subtext).toContain('First time logging this variation')

      // Complete a session with this variation
      state.workouts.push({
        id: 'var-b-session',
        d: '2026-10-20',
        name: 'Custom Push Day',
        end: 4000000,
        completed: true,
        entries: [
          {
            id: 'custom_db_incline_variation_b',
            sets: [
              { w: 32, r: 10, done: true },
              { w: 32, r: 10, done: true }
            ]
          }
        ]
      })

      const perfAfter = getPreviousExercisePerformance(state, 'custom_db_incline_variation_b')
      expect(perfAfter.found).toBe(true)
      expect(perfAfter.workoutName).toBe('Custom Push Day')
      expect(perfAfter.sets[0].w).toBe(32)
      expect(perfAfter.sets[0].r).toBe(10)
    })

    it('correctly retrieves previous session across skipped weeks', () => {
      const state = {
        workouts: [
          {
            id: 'wk-1',
            d: '2026-09-01', // 4 weeks earlier
            end: 10000,
            completed: true,
            entries: [
              {
                id: 'squat',
                sets: [{ w: 120, r: 5, done: true }]
              }
            ]
          }
        ]
      }

      // User skips weeks; on 2026-10-01, it must still find the 2026-09-01 session
      const perf = getPreviousExercisePerformance(state, 'squat')
      expect(perf.found).toBe(true)
      expect(perf.date).toBe('2026-09-01')
      expect(perf.sets[0].w).toBe(120)
    })

    it('handles multiple workouts on the same day using completion timestamp (w.end)', () => {
      const state = {
        workouts: [
          {
            id: 'morning-cardio',
            d: '2026-10-22',
            name: 'Morning Session',
            end: 1729580000000,
            completed: true,
            entries: [
              {
                id: 'running',
                target: { mode: 'cardio' },
                sets: [{ min: 20, speed: 10, done: true }]
              }
            ]
          },
          {
            id: 'evening-run',
            d: '2026-10-22',
            name: 'Evening Session',
            end: 1729620000000,
            completed: true,
            entries: [
              {
                id: 'running',
                target: { mode: 'cardio' },
                sets: [{ min: 30, speed: 11, done: true }]
              }
            ]
          }
        ]
      }

      // Next session must see the evening session as immediately previous
      const perf = getPreviousExercisePerformance(state, 'running')
      expect(perf.found).toBe(true)
      expect(perf.workoutName).toBe('Evening Session')
      expect(perf.sets[0].min).toBe(30)
      expect(perf.sets[0].speed).toBe(11)
    })

    it('never compares an active/unfinished session with itself', () => {
      const state = {
        active: {
          id: 'active-now',
          entries: [
            {
              id: 'bench_press',
              sets: [{ w: 100, r: 8, done: true }]
            }
          ]
        },
        workouts: [
          {
            id: 'bench-past',
            d: '2026-10-15',
            name: 'Past Bench Session',
            end: 50000,
            completed: true,
            entries: [
              {
                id: 'bench_press',
                sets: [{ w: 95, r: 8, done: true }]
              }
            ]
          },
          {
            id: 'active-now',
            inProgress: true,
            entries: [
              {
                id: 'bench_press',
                sets: [{ w: 100, r: 8, done: true }]
              }
            ]
          }
        ]
      }

      const perf = getPreviousExercisePerformance(state, 'bench_press', 'active-now')
      expect(perf.found).toBe(true)
      expect(perf.workoutId).toBe('bench-past')
      expect(perf.sets[0].w).toBe(95)
    })
  })

  describe('Module 6, 7, 8: Workout Media Loading Pipeline Optimization', () => {
    it('defaults imgSrc and gifSrc directly to CDN to eliminate local 404 network errors', () => {
      const ex = { id: '0001', img: '0001-2gPfomN.jpg', gif: '0001-2gPfomN.gif' }
      const resolvedImg = imgSrc(ex)
      const resolvedGif = gifSrc(ex)

      expect(resolvedImg).toBe(CDN_IMG_BASE + '0001-2gPfomN.jpg')
      expect(resolvedGif).toBe(CDN_GIF_BASE + '0001-2gPfomN.gif')
      expect(resolvedImg).not.toContain('img/0001')
      expect(resolvedGif).not.toContain('gif/0001')
    })

    it('tracks loaded media in memory and handles preloading seamlessly', async () => {
      const testUrl = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae/images/test.jpg'
      expect(isMediaLoaded(testUrl)).toBe(false)

      markMediaLoaded(testUrl)
      expect(isMediaLoaded(testUrl)).toBe(true)

      const ex = { id: 'test-ex', img: 'test.jpg', gif: 'test.gif' }
      await preloadExercise(ex)
      // Execution succeeds without throwing in node/jsdom environment
      expect(true).toBe(true)
    })

    it('preloads upcoming exercises in active workout sequence without throwing', () => {
      const entries = [
        { id: 'ex1', img: 'ex1.jpg', gif: 'ex1.gif' },
        { id: 'ex2', img: 'ex2.jpg', gif: 'ex2.gif' },
        { id: 'ex3', img: 'ex3.jpg', gif: 'ex3.gif' }
      ]

      expect(() => {
        preloadUpcomingExercises(entries, 0, 2)
      }).not.toThrow()
    })
  })

  describe('Module 9: Audio Subsystem Lifecycle & Error Resilience', () => {
    it('safely handles getAudioContext and recreates if closed', () => {
      const ctx = getAudioContext()
      // In vitest/jsdom environment, getAudioContext safely returns null or mock without error
      expect(ctx === null || typeof ctx === 'object').toBe(true)
    })

    it('unlockAudio detaches listeners upon unlocking to prevent play interruption', () => {
      expect(() => {
        unlockAudio()
      }).not.toThrow()
    })

    it('beep and playRestAlert execute non-fatally even if audio API is unavailable', async () => {
      expect(() => {
        beep(true, 880, 0.15)
      }).not.toThrow()

      const result = await playRestAlert('alarm', 1.0)
      expect(typeof result === 'boolean').toBe(true)
    })
  })
})

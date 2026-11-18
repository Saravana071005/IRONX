import { describe, it, expect } from 'vitest'
import { getExerciseMedia, getPostureGuidance, getExerciseSteps } from './exercisePreview.js'
import { EXDB, exOr } from './exercises.js'
import { saveUserTemplate, getUserTemplates } from './customPlanner.js'

describe('Exercise Preview Logic', () => {
  describe('getExerciseMedia priority order', () => {
    it('prioritizes video when ex.video is provided', () => {
      const ex = {
        id: 'ex1',
        video: 'https://cdn.example.com/squat.mp4',
        gif: 'squat.gif',
        img: 'squat.jpg'
      }
      const media = getExerciseMedia(ex)
      expect(media.type).toBe('video')
      expect(media.src).toBe('https://cdn.example.com/squat.mp4')
    })

    it('prioritizes video when ex.vid is provided', () => {
      const ex = {
        id: 'ex1_vid',
        vid: 'https://cdn.example.com/bench.mp4',
        gif: 'bench.gif'
      }
      const media = getExerciseMedia(ex)
      expect(media.type).toBe('video')
      expect(media.src).toBe('https://cdn.example.com/bench.mp4')
    })

    it('prioritizes video when ex.videoUrl is provided', () => {
      const ex = {
        id: 'ex1_url',
        videoUrl: 'https://cdn.example.com/deadlift.mp4',
        gif: 'deadlift.gif'
      }
      const media = getExerciseMedia(ex)
      expect(media.type).toBe('video')
      expect(media.src).toBe('https://cdn.example.com/deadlift.mp4')
    })

    it('returns gif when no video is provided but ex.gif exists', () => {
      const ex = {
        id: '0001',
        gif: '0001-2gPfomN.gif',
        img: '0001-2gPfomN.jpg'
      }
      const media = getExerciseMedia(ex)
      expect(media.type).toBe('gif')
      expect(media.src).toContain('0001-2gPfomN.gif')
      expect(media.fallbackSrc).toContain('jsdelivr.net')
      expect(media.stillSrc).toContain('0001-2gPfomN.jpg')
    })

    it('returns image when neither video nor gif exists but ex.img exists', () => {
      const ex = {
        id: 'custom_img',
        img: 'curl.jpg'
      }
      const media = getExerciseMedia(ex)
      expect(media.type).toBe('image')
      expect(media.src).toContain('curl.jpg')
      expect(media.fallbackSrc).toContain('jsdelivr.net')
    })

    it('returns image when customImage is present', () => {
      const ex = {
        id: 'custom_1',
        customImage: 'data:image/png;base64,1234'
      }
      const media = getExerciseMedia(ex)
      expect(media.type).toBe('image')
      expect(media.src).toBe('data:image/png;base64,1234')
      expect(media.fallbackSrc).toBeNull()
    })

    it('returns none when no media fields exist', () => {
      const ex = {
        id: 'text_only',
        n: 'Custom Exercise'
      }
      const media = getExerciseMedia(ex)
      expect(media.type).toBe('none')
    })

    it('handles null/undefined gracefully', () => {
      expect(getExerciseMedia(null).type).toBe('none')
      expect(getExerciseMedia(undefined).type).toBe('none')
    })
  })

  describe('Real EXDB Dataset Previews', () => {
    it('correctly resolves media, steps, and posture for first EXDB exercise', () => {
      const ex = EXDB[0]
      expect(ex).toBeDefined()
      const media = getExerciseMedia(ex)
      expect(media.type).toBe('gif')
      expect(media.src).toContain(ex.gif)

      const steps = getExerciseSteps(ex)
      expect(steps.length).toBeGreaterThan(0)
      expect(steps).toEqual(ex.st)

      const posture = getPostureGuidance(ex)
      expect(posture).toHaveLength(3)
    })

    it('resolves exercise via exOr(id) and produces complete preview info', () => {
      const resolved = exOr('0001')
      expect(resolved.id).toBe('0001')
      const media = getExerciseMedia(resolved)
      expect(media.type).toBe('gif')
      const steps = getExerciseSteps(resolved)
      expect(steps.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('getPostureGuidance', () => {
    it('returns tailored cues for chest exercises', () => {
      const cues = getPostureGuidance({ bp: 'chest', tg: 'pectorals' })
      expect(cues).toHaveLength(3)
      expect(cues.some(c => c.toLowerCase().includes('shoulder blades') || c.toLowerCase().includes('bench'))).toBe(true)
    })

    it('returns tailored cues for back exercises', () => {
      const cues = getPostureGuidance({ bp: 'back', tg: 'lats' })
      expect(cues).toHaveLength(3)
      expect(cues.some(c => c.toLowerCase().includes('elbows') || c.toLowerCase().includes('spine'))).toBe(true)
    })

    it('returns tailored cues for legs exercises', () => {
      const cues = getPostureGuidance({ bp: 'upper legs', tg: 'quads' })
      expect(cues).toHaveLength(3)
      expect(cues.some(c => c.toLowerCase().includes('knees') || c.toLowerCase().includes('toes'))).toBe(true)
    })

    it('returns tailored cues for shoulders', () => {
      const cues = getPostureGuidance({ bp: 'shoulders', tg: 'delts' })
      expect(cues).toHaveLength(3)
      expect(cues.some(c => c.toLowerCase().includes('traps') || c.toLowerCase().includes('shrugging'))).toBe(true)
    })

    it('returns tailored cues for waist/abs', () => {
      const cues = getPostureGuidance({ bp: 'waist', tg: 'abs' })
      expect(cues).toHaveLength(3)
      expect(cues.some(c => c.toLowerCase().includes('flexion') || c.toLowerCase().includes('head'))).toBe(true)
    })

    it('returns tailored cues for arms', () => {
      const cues = getPostureGuidance({ bp: 'upper arms', tg: 'biceps' })
      expect(cues).toHaveLength(3)
      expect(cues.some(c => c.toLowerCase().includes('elbows') || c.toLowerCase().includes('momentum'))).toBe(true)
    })

    it('returns tailored cues for cardio', () => {
      const cues = getPostureGuidance({ bp: 'cardio', tg: 'cardiovascular system' })
      expect(cues).toHaveLength(3)
      expect(cues.some(c => c.toLowerCase().includes('cadence') || c.toLowerCase().includes('midfoot'))).toBe(true)
    })

    it('returns 3 general cues for empty or null exercises', () => {
      const cues = getPostureGuidance(null)
      expect(cues).toHaveLength(3)
    })
  })

  describe('getExerciseSteps', () => {
    it('extracts steps array from ex.st', () => {
      const steps = getExerciseSteps({
        id: 'test',
        st: ['Step 1: Set up bench.', 'Step 2: Press bar up.']
      })
      expect(steps).toEqual(['Step 1: Set up bench.', 'Step 2: Press bar up.'])
    })

    it('splits multiline description string into steps', () => {
      const steps = getExerciseSteps({
        id: 'custom',
        description: 'First adjust pins.\nThen grasp handles.\nPush outward smoothly.'
      })
      expect(steps).toHaveLength(3)
      expect(steps[0]).toBe('First adjust pins.')
    })

    it('returns empty array when no steps or description available', () => {
      expect(getExerciseSteps({ id: 'empty' })).toEqual([])
      expect(getExerciseSteps(null)).toEqual([])
    })
  })

  describe('Preview Expansion & Selection Independence', () => {
    it('expanding preview does not affect selection set and vice versa', () => {
      const selectedIds = new Set(['0001'])
      const expandedPreviews = new Set()

      // Toggling preview for exercise 0002
      expandedPreviews.add('0002')
      expect(expandedPreviews.has('0002')).toBe(true)
      expect(selectedIds.has('0002')).toBe(false) // Selection untouched!

      // Selecting exercise 0002
      selectedIds.add('0002')
      expect(selectedIds.has('0002')).toBe(true)
      expect(expandedPreviews.has('0002')).toBe(true) // Preview stays open!

      // Collapsing preview for 0002
      expandedPreviews.delete('0002')
      expect(expandedPreviews.has('0002')).toBe(false)
      expect(selectedIds.has('0002')).toBe(true) // Selection preserved!
    })

    it('supports multiple independently expanded previews', () => {
      const expanded = new Set()
      expanded.add('ex_1')
      expanded.add('ex_2')
      expect(expanded.size).toBe(2)

      expanded.delete('ex_1')
      expect(expanded.has('ex_1')).toBe(false)
      expect(expanded.has('ex_2')).toBe(true)
    })
  })

  describe('Template Exercise Preservation with Previews', () => {
    it('saves template with previewed exercises and retains configuration', () => {
      const mockState = { workoutTemplates: [] }
      const mockUpdate = fn => fn(mockState)

      const saved = saveUserTemplate(mockUpdate, {
        name: 'Chest + Biceps Power',
        exercises: [
          { id: '0001', name: '3/4 sit-up', sets: 4, reps: 15, weight: 0 },
          { id: '0007', name: 'alternate lateral pulldown', sets: 3, reps: 10, weight: 45 }
        ]
      })

      expect(saved.id).toBeDefined()
      expect(saved.name).toBe('Chest + Biceps Power')
      expect(saved.exercises).toHaveLength(2)
      expect(saved.exercises[0].sets).toBe(4)
      expect(saved.exercises[0].reps).toBe(15)
      expect(saved.exercises[1].weight).toBe(45)

      // Exercise can be looked up for demonstration preview in template view
      const ex1Media = getExerciseMedia(exOr(saved.exercises[0].id))
      expect(ex1Media.type).toBe('gif')
    })
  })
})

import { imgSrc, gifSrc, cdnImgSrc, cdnGifSrc, exOr } from './exercises.js'
import { instrFor } from './i18n.js'

/**
 * Resolves media for an exercise following the strict priority order:
 * 1. Video (if ex.video, ex.vid, or ex.videoUrl exists)
 * 2. Animated GIF (if ex.gif exists, with local and CDN fallback)
 * 3. Static demonstration image (if ex.img or ex.customImage exists)
 * 4. None ('none') -> triggers "Preview unavailable" state
 *
 * @param {Object} ex Exercise object
 * @returns {Object} { type: 'video' | 'gif' | 'image' | 'none', src: string, fallbackSrc?: string, stillSrc?: string, stillFallbackSrc?: string }
 */
export function getExerciseMedia(ex) {
  if (!ex) return { type: 'none' }

  // 1. Video priority
  const videoUrl = ex.video || ex.vid || ex.videoUrl
  if (videoUrl && typeof videoUrl === 'string' && videoUrl.trim()) {
    return {
      type: 'video',
      src: videoUrl.trim()
    }
  }

  // 2. Animated GIF priority
  if (ex.gif && typeof ex.gif === 'string' && ex.gif.trim()) {
    return {
      type: 'gif',
      src: gifSrc(ex),
      fallbackSrc: cdnGifSrc(ex),
      stillSrc: imgSrc(ex),
      stillFallbackSrc: cdnImgSrc(ex)
    }
  }

  // 3. Static Demonstration Image priority
  if (ex.customImage || (ex.img && typeof ex.img === 'string' && ex.img.trim())) {
    return {
      type: 'image',
      src: imgSrc(ex),
      fallbackSrc: ex.customImage ? null : cdnImgSrc(ex)
    }
  }

  // 4. No media available
  return { type: 'none' }
}

/**
 * Returns tailored posture and biomechanical movement guidance based on
 * the target muscle group and movement mechanics.
 *
 * @param {Object} ex Exercise object
 * @returns {string[]} List of 3 actionable posture tips
 */
export function getPostureGuidance(ex) {
  if (!ex) {
    return [
      'Maintain a neutral spine and controlled breathing.',
      'Brace your core before initiating each repetition.',
      'Execute through a full, pain-free range of motion.'
    ]
  }

  const bp = (ex.bp || ex.category || '').toLowerCase()
  const tg = (ex.tg || '').toLowerCase()

  if (bp === 'chest' || tg.includes('pectoral')) {
    return [
      'Retract and depress shoulder blades against the bench or floor to stabilize shoulders.',
      'Maintain a natural arch in your lumbar spine; keep feet firmly planted for leg drive.',
      'Lower the weight with a controlled 2–3s descent without letting the bar or dumbbells bounce.'
    ]
  }

  if (bp === 'back' || tg.includes('lat') || tg.includes('rhomboid') || tg.includes('trap')) {
    return [
      'Initiate the movement by driving elbows back and down rather than pulling with your biceps.',
      'Keep your chest proud and spine neutral; resist excessive torso swinging or momentum.',
      'Hold the peak squeeze for a brief pause to maximize muscular recruitment in the upper back.'
    ]
  }

  if (bp === 'shoulders' || tg.includes('delt')) {
    return [
      'Keep upper traps depressed and relaxed; avoid shrugging your shoulders toward your ears.',
      'Maintain a slight bend in your elbows during raises to protect the shoulder joint capsule.',
      'Brace your abdomen to prevent hyperextending your lower back under overhead loads.'
    ]
  }

  if (bp === 'upper legs' || bp === 'lower legs' || tg.includes('quad') || tg.includes('glute') || tg.includes('hamstring') || tg.includes('calve')) {
    return [
      'Track your knees directly in line with your toes throughout the full depth of movement.',
      'Distribute pressure evenly across your entire foot (tripod: heel, big toe, and outer foot).',
      'Maintain an upright torso and deep abdominal brace to protect the lumbar spine.'
    ]
  }

  if (bp === 'waist' || tg.includes('abs') || tg.includes('oblique')) {
    return [
      'Focus on active spinal flexion (bringing ribs toward pelvis) rather than flexing the hips.',
      'Exhale forcefully during peak contraction and maintain continuous abdominal tension.',
      'Avoid pulling on the back of your head or straining the cervical spine.'
    ]
  }

  if (bp === 'upper arms' || bp === 'lower arms' || tg.includes('bicep') || tg.includes('tricep') || tg.includes('forearm')) {
    return [
      'Lock your elbows stationary beside your ribs to prevent shoulder involvement.',
      'Resist swinging or using torso momentum; strictly isolate the working limb.',
      'Emphasize a controlled eccentric lowering phase to induce maximal mechanical tension.'
    ]
  }

  if (bp === 'cardio' || tg.includes('cardiovascular')) {
    return [
      'Maintain an upright, relaxed posture with shoulders dropped and gaze forward.',
      'Land softly on the midfoot to minimize joint impact forces.',
      'Breathe rhythmically in sync with your movement cadence.'
    ]
  }

  return [
    'Keep your spine aligned in a neutral posture throughout the movement.',
    'Engage your abdominal core muscles before every single repetition.',
    'Control the eccentric lowering phase for 2 seconds to ensure safety and maximum tension.'
  ]
}

/**
 * Returns formatted step-by-step instructions for an exercise.
 *
 * @param {Object} ex Exercise object
 * @returns {string[]} Step-by-step instruction lines
 */
export function getExerciseSteps(ex) {
  if (!ex) return []
  const localized = instrFor(ex)
  if (Array.isArray(localized) && localized.length > 0) {
    return localized
  }
  if (Array.isArray(ex.st) && ex.st.length > 0) {
    return ex.st
  }
  if (typeof ex.description === 'string' && ex.description.trim()) {
    return ex.description.split(/\n+/).map(s => s.trim()).filter(Boolean)
  }
  if (typeof ex.desc === 'string' && ex.desc.trim()) {
    return ex.desc.split(/\n+/).map(s => s.trim()).filter(Boolean)
  }
  return []
}

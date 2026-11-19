import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { updateProfile } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button, TextField, NumberField } from '../components/ui.jsx'

function computeAge(dobString) {
  if (!dobString || typeof dobString !== 'string') return null
  const parts = dobString.split('-')
  if (parts.length !== 3) return null
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null
  const birth = new Date(y, m - 1, d)
  if (isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const mDiff = now.getMonth() - birth.getMonth()
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

const FITNESS_GOALS = [
  { id: 'fat_loss', name: 'Fat Loss', icon: 'flame', desc: 'Burn body fat while preserving lean muscle mass' },
  { id: 'weight_loss', name: 'Weight Loss', icon: 'scale', desc: 'Consistent calorie deficit to reduce overall weight' },
  { id: 'muscle_gain', name: 'Muscle Gain', icon: 'dumbbell', desc: 'Hypertrophy focused training for muscular growth' },
  { id: 'weight_gain', name: 'Weight Gain', icon: 'arrowTrendingUp', desc: 'Nutrient surplus to build mass and power' },
  { id: 'recomposition', name: 'Body Recomposition', icon: 'target', desc: 'Simultaneously build muscle and shed fat' },
  { id: 'general_fitness', name: 'General Fitness', icon: 'heartPulse', desc: 'Cardiovascular health, mobility, and stamina' },
  { id: 'maintenance', name: 'Maintenance', icon: 'sparkles', desc: 'Maintain current strength and physique baseline' }
]

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', sub: 'Desk job, minimal daily movement' },
  { id: 'lightly_active', label: 'Lightly Active', sub: '1–3 days exercise or light movement' },
  { id: 'moderately_active', label: 'Moderately Active', sub: '3–5 days active workout training' },
  { id: 'very_active', label: 'Very Active', sub: '6–7 days hard physical training' },
  { id: 'extra_active', label: 'Extra Active', sub: 'Athlete or strenuous physical job' }
]

const FITNESS_EXPERIENCES = [
  { id: 'beginner', label: 'Beginner', sub: 'Under 1 year of consistent gym training' },
  { id: 'intermediate', label: 'Intermediate', sub: '1 to 3 years of structured workouts' },
  { id: 'advanced', label: 'Advanced', sub: '3+ years of progressive strength training' }
]

const WORKOUT_TYPES = [
  { id: 'strength', label: 'Strength & Powerlifting', icon: 'dumbbell' },
  { id: 'hypertrophy', label: 'Hypertrophy & Bodybuilding', icon: 'flame' },
  { id: 'functional', label: 'Cardio & Functional', icon: 'figureRun' },
  { id: 'calisthenics', label: 'Calisthenics & Bodyweight', icon: 'sparkles' },
  { id: 'mixed', label: 'Mixed Hybrid Training', icon: 'target' }
]

const PRESET_MEALS = {
  breakfast: ['Oatmeal & Whey', 'Whole Eggs & Toast', 'Greek Yogurt & Berries', 'Avocado & Boiled Eggs', 'Banana Protein Smoothie'],
  lunch: ['Chicken Breast & White Rice', 'Salmon & Sweet Potato', 'Tofu & Vegetable Quinoa', 'Tuna Salad Wrap', 'Lean Ground Beef & Rice'],
  dinner: ['Steak & Steamed Veggies', 'Paneer Stir-Fry & Rice', 'Grilled Chicken Salad', 'Turkey Burger Bowl', 'Lentils & Mixed Greens']
}

export default function ProfileSetup() {
  const navigate = useNavigate()
  const user = useStore(s => s.user)
  const setUser = useStore(s => s.setUser)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)

  const existing = user?.profile || {}
  const isExistingCompleted = !!user?.profile?.completed

  // Multi-step Wizard State: 1 to 5
  const [step, setStep] = useState(1)

  // Step 1: Personal Information
  const [fullName, setFullName] = useState(existing.fullName || user?.name || '')
  const [dateOfBirth, setDateOfBirth] = useState(existing.dateOfBirth || '1998-05-15')
  const [sex, setSex] = useState(existing.sex || 'male')
  const [heightCm, setHeightCm] = useState(existing.heightCm || 175)
  const [currentWeightKg, setCurrentWeightKg] = useState(existing.currentWeightKg || 75.0)

  // Step 2: Fitness Goal
  const [fitnessGoal, setFitnessGoal] = useState(existing.fitnessGoal || 'muscle_gain')
  const [targetWeightKg, setTargetWeightKg] = useState(
    existing.targetWeightKg !== undefined && existing.targetWeightKg !== null
      ? existing.targetWeightKg
      : 75.0
  )

  // Step 3: Daily Activity and Fitness Preferences
  const [activityLevel, setActivityLevel] = useState(existing.activityLevel || 'moderately_active')
  const [fitnessExperience, setFitnessExperience] = useState(existing.fitnessExperience || 'intermediate')
  const [workoutFrequency, setWorkoutFrequency] = useState(existing.preferredWorkoutDays?.length || 4)
  const [workoutType, setWorkoutType] = useState(existing.workoutType || 'strength')

  // Step 4: Diet and Meal Preferences (Can be skipped)
  const [dietSkipped, setDietSkipped] = useState(false)
  const [breakfastItems, setBreakfastItems] = useState(existing.dietPreferences?.breakfast || [])
  const [lunchItems, setLunchItems] = useState(existing.dietPreferences?.lunch || [])
  const [dinnerItems, setDinnerItems] = useState(existing.dietPreferences?.dinner || [])
  const [customFoodInput, setCustomFoodInput] = useState({ breakfast: '', lunch: '', dinner: '' })

  const [saving, setSaving] = useState(false)

  const calculatedAge = useMemo(() => computeAge(dateOfBirth), [dateOfBirth])

  // Weight Delta Calculation
  const weightDiff = useMemo(() => {
    const cur = Number(currentWeightKg) || 0
    const tgt = Number(targetWeightKg) || 0
    if (!tgt || isNaN(tgt)) return 0
    return Math.round((tgt - cur) * 10) / 10
  }, [currentWeightKg, targetWeightKg])

  // Food tag helper
  const addFood = (mealType, foodName) => {
    const trimmed = (foodName || '').trim()
    if (!trimmed) return
    if (mealType === 'breakfast' && !breakfastItems.includes(trimmed)) {
      setBreakfastItems([...breakfastItems, trimmed])
    } else if (mealType === 'lunch' && !lunchItems.includes(trimmed)) {
      setLunchItems([...lunchItems, trimmed])
    } else if (mealType === 'dinner' && !dinnerItems.includes(trimmed)) {
      setDinnerItems([...dinnerItems, trimmed])
    }
  }

  const removeFood = (mealType, idx) => {
    if (mealType === 'breakfast') setBreakfastItems(breakfastItems.filter((_, i) => i !== idx))
    if (mealType === 'lunch') setLunchItems(lunchItems.filter((_, i) => i !== idx))
    if (mealType === 'dinner') setDinnerItems(dinnerItems.filter((_, i) => i !== idx))
  }

  // Navigation handlers
  const handleNext = () => {
    if (step === 1) {
      if (!fullName.trim()) { toast(t('Full name is required')); return }
      if (!dateOfBirth || calculatedAge === null) { toast(t('Valid date of birth required')); return }
      if (calculatedAge < 13 || calculatedAge > 120) { toast(t('Age must be between 13 and 120 years')); return }
      if (!heightCm || heightCm < 50 || heightCm > 260) { toast(t('Height must be between 50 and 260 cm')); return }
      if (!currentWeightKg || currentWeightKg < 20 || currentWeightKg > 400) { toast(t('Current weight must be between 20 and 400 kg')); return }
    }
    if (step === 2) {
      if (!fitnessGoal) { toast(t('Please select a fitness goal')); return }
      if (targetWeightKg && (targetWeightKg < 20 || targetWeightKg > 400)) {
        toast(t('Target weight must be between 20 and 400 kg'))
        return
      }
    }
    setStep(prev => Math.min(5, prev + 1))
  }

  const handleBack = () => {
    setStep(prev => Math.max(1, prev - 1))
  }

  const handleSkipDiet = () => {
    setDietSkipped(true)
    setStep(5)
  }

  const handleCompleteSetup = async () => {
    setSaving(true)
    try {
      const preferredDaysMap = {
        3: [1, 3, 5],
        4: [1, 2, 4, 5],
        5: [1, 2, 3, 5, 6],
        6: [1, 2, 3, 4, 5, 6]
      }

      const payload = {
        fullName: fullName.trim(),
        dateOfBirth,
        sex,
        heightCm: Number(heightCm),
        currentWeightKg: Number(currentWeightKg),
        targetWeightKg: targetWeightKg ? Number(targetWeightKg) : null,
        fitnessGoal,
        activityLevel,
        fitnessExperience,
        workoutType,
        preferredWorkoutDays: preferredDaysMap[workoutFrequency] || [1, 2, 4, 5],
        dietPreferences: dietSkipped ? null : {
          breakfast: breakfastItems,
          lunch: lunchItems,
          dinner: dinnerItems
        }
      }

      const res = await updateProfile(payload)
      if (res?.user) {
        setUser(res.user)
      }

      // Sync target weight in local store state without creating fake daily logs
      update(s => {
        s.bodyweight = s.bodyweight || []
        if (targetWeightKg) {
          s.targetW = Number(targetWeightKg)
        }
      })

      toast(t('Profile setup complete! Welcome to OpenGym.'))
      navigate('/home', { replace: true })
    } catch (err) {
      toast(err.message || t('Failed to save profile'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 80px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        {isExistingCompleted ? (
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'transparent', border: 'none', color: 'var(--label)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}
          >
            <Icon name="chevronLeft" size={18} />
            <span>{t('Back')}</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, color: 'var(--theme-accent, #E8B477)' }}>⚡</span>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--theme-accent, #E8B477)' }}>
              {t('OpenGym Onboarding')}
            </span>
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-2)' }}>
          {t('Step {0} of 5', step)}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: 6, background: 'var(--surface-2)', borderRadius: 99, marginBottom: 26, overflow: 'hidden' }}>
        <div
          style={{
            width: `${(step / 5) * 100}%`,
            height: '100%',
            background: 'var(--theme-accent-gradient, linear-gradient(135deg, #FFD09A 0%, #E8B477 100%))',
            borderRadius: 99,
            transition: 'width 0.3s ease'
          }}
        />
      </div>

      {/* Step Container Card */}
      <div
        className="card"
        style={{
          background: 'var(--surface)',
          padding: '28px 22px',
          borderRadius: 22,
          boxShadow: 'var(--card-shadow)',
          border: '1px solid var(--sep)'
        }}
      >
        {/* ==================== STEP 1: PERSONAL INFO ==================== */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px 0', color: 'var(--label)' }}>
              {t('Personal Information')}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--label-2)', margin: '0 0 24px 0', lineHeight: 1.45 }}>
              {t('Let’s set up your personal physical baseline for accurate workout and nutrition recommendations.')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 6 }}>
                  {t('Full Name')}
                </label>
                <TextField
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder={t('Your name')}
                  maxLength={60}
                />
              </div>

              {/* Date of Birth & Calculated Age */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 6 }}>
                    {t('Date of Birth')}
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--sep)', color: 'var(--label)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 6 }}>
                    {t('Calculated Age')}
                  </label>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--sep)',
                      fontSize: 14,
                      fontWeight: 700,
                      color: calculatedAge ? 'var(--theme-accent, #E8B477)' : 'var(--label-2)'
                    }}
                  >
                    {calculatedAge !== null ? `${calculatedAge} ${t('years old')}` : t('Enter birth date')}
                  </div>
                </div>
              </div>

              {/* Sex */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 8 }}>
                  {t('Biological Sex')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { id: 'male', label: t('Male') },
                    { id: 'female', label: t('Female') },
                    { id: 'other', label: t('Other') }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSex(opt.id)}
                      style={{
                        padding: '12px',
                        borderRadius: 12,
                        background: sex === opt.id ? 'var(--surface-3)' : 'var(--surface-2)',
                        border: sex === opt.id ? '1.5px solid var(--theme-accent, #E8B477)' : '1px solid var(--sep)',
                        color: sex === opt.id ? 'var(--theme-accent, #E8B477)' : 'var(--label)',
                        fontWeight: sex === opt.id ? 800 : 600,
                        cursor: 'pointer'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Height & Weight */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 6 }}>
                    {t('Height (cm)')}
                  </label>
                  <NumberField
                    value={heightCm}
                    onChange={v => setHeightCm(v)}
                    decimal={false}
                    placeholder="175"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 6 }}>
                    {t('Current Weight (kg)')}
                  </label>
                  <NumberField
                    value={currentWeightKg}
                    onChange={v => {
                      setCurrentWeightKg(v)
                      if (!targetWeightKg) setTargetWeightKg(v)
                    }}
                    decimal={true}
                    placeholder="75.0"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 2: FITNESS GOAL ==================== */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px 0', color: 'var(--label)' }}>
              {t('What is your primary fitness goal?')}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--label-2)', margin: '0 0 20px 0', lineHeight: 1.45 }}>
              {t('Select your main focus so OpenGym can customize your calorie targets and workout progression.')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {FITNESS_GOALS.map(g => {
                const isSelected = fitnessGoal === g.id
                return (
                  <div
                    key={g.id}
                    onClick={() => setFitnessGoal(g.id)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 14,
                      background: isSelected ? 'var(--surface-3)' : 'var(--surface-2)',
                      border: isSelected ? '1.5px solid var(--theme-accent, #E8B477)' : '1px solid var(--sep)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: isSelected ? 'var(--theme-accent-gradient)' : 'var(--surface)',
                        color: isSelected ? '#12100E' : 'var(--theme-accent, #E8B477)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icon name={g.icon} size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: isSelected ? 800 : 700, color: 'var(--label)' }}>
                        {t(g.name)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 2 }}>
                        {t(g.desc)}
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{ color: 'var(--theme-accent, #E8B477)', fontWeight: 800, fontSize: 18 }}>
                        ✓
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Target Weight & Difference */}
            <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: 16, border: '1px solid var(--sep)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 6 }}>
                    {t('Target Weight (kg)')}
                  </label>
                  <NumberField
                    value={targetWeightKg}
                    onChange={v => setTargetWeightKg(v)}
                    decimal={true}
                    placeholder="70.0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 6 }}>
                    {t('Planned Weight Change')}
                  </label>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'var(--surface)',
                      border: '1px solid var(--sep)',
                      fontSize: 14,
                      fontWeight: 800,
                      color: weightDiff < 0 ? '#EF4444' : (weightDiff > 0 ? 'var(--mint)' : 'var(--theme-accent, #E8B477)')
                    }}
                  >
                    {weightDiff < 0
                      ? `${weightDiff} kg (${t('Weight Loss')})`
                      : (weightDiff > 0
                          ? `+${weightDiff} kg (${t('Weight Gain')})`
                          : `0.0 kg (${t('Maintenance')})`)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 3: ACTIVITY & WORKOUT PREFERENCES ==================== */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px 0', color: 'var(--label)' }}>
              {t('Activity & Fitness Preferences')}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--label-2)', margin: '0 0 20px 0', lineHeight: 1.45 }}>
              {t('Help us schedule your weekly workout cadence and calibrate your daily expenditure.')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Activity Level */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 8 }}>
                  {t('Daily Activity Level')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ACTIVITY_LEVELS.map(act => {
                    const isSel = activityLevel === act.id
                    return (
                      <div
                        key={act.id}
                        onClick={() => setActivityLevel(act.id)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: isSel ? 'var(--surface-3)' : 'var(--surface-2)',
                          border: isSel ? '1.5px solid var(--theme-accent, #E8B477)' : '1px solid var(--sep)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: isSel ? 800 : 700, color: 'var(--label)' }}>{t(act.label)}</div>
                          <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 2 }}>{t(act.sub)}</div>
                        </div>
                        {isSel && <span style={{ color: 'var(--theme-accent, #E8B477)', fontWeight: 800 }}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Workout Experience */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 8 }}>
                  {t('Workout Experience')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {FITNESS_EXPERIENCES.map(exp => (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => setFitnessExperience(exp.id)}
                      style={{
                        padding: '12px 10px',
                        borderRadius: 12,
                        background: fitnessExperience === exp.id ? 'var(--surface-3)' : 'var(--surface-2)',
                        border: fitnessExperience === exp.id ? '1.5px solid var(--theme-accent, #E8B477)' : '1px solid var(--sep)',
                        color: fitnessExperience === exp.id ? 'var(--theme-accent, #E8B477)' : 'var(--label)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{t(exp.label)}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Workout Frequency */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 8 }}>
                  {t('Preferred Workout Frequency')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[3, 4, 5, 6].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setWorkoutFrequency(days)}
                      style={{
                        padding: '14px 10px',
                        borderRadius: 12,
                        background: workoutFrequency === days ? 'var(--surface-3)' : 'var(--surface-2)',
                        border: workoutFrequency === days ? '1.5px solid var(--theme-accent, #E8B477)' : '1px solid var(--sep)',
                        color: workoutFrequency === days ? 'var(--theme-accent, #E8B477)' : 'var(--label)',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {days} {t('days')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Workout Type */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', marginBottom: 8 }}>
                  {t('Preferred Workout Style')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                  {WORKOUT_TYPES.map(wt => (
                    <button
                      key={wt.id}
                      type="button"
                      onClick={() => setWorkoutType(wt.id)}
                      style={{
                        padding: '12px 10px',
                        borderRadius: 12,
                        background: workoutType === wt.id ? 'var(--surface-3)' : 'var(--surface-2)',
                        border: workoutType === wt.id ? '1.5px solid var(--theme-accent, #E8B477)' : '1px solid var(--sep)',
                        color: workoutType === wt.id ? 'var(--theme-accent, #E8B477)' : 'var(--label)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      <Icon name={wt.icon} size={15} />
                      <span style={{ fontSize: 12 }}>{t(wt.label)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 4: DIET PREFERENCES (WITH CLEAR SKIP) ==================== */}
        {step === 4 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--label)' }}>
                  {t('What do you usually eat?')}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--label-2)', margin: '6px 0 0 0', lineHeight: 1.45 }}>
                  {t('Optionally list your typical daily meals. You can also skip this and log meals anytime.')}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSkipDiet}
                style={{ flexShrink: 0, color: 'var(--theme-accent, #E8B477)', fontWeight: 700 }}
              >
                {t('Skip this step →')}
              </Button>
            </div>

            {/* Prominent Skip Notice Card */}
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--surface-2)',
                borderRadius: 14,
                border: '1px dashed var(--theme-accent, #E8B477)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                margin: '18px 0 24px 0'
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--label-2)' }}>
                {t('Don’t follow a fixed meal plan? You can log custom foods dynamically in the Nutrition section.')}
              </div>
              <Button size="sm" variant="tinted" onClick={handleSkipDiet}>
                {t('Skip')}
              </Button>
            </div>

            {/* Breakfast / Lunch / Dinner Builders */}
            {['breakfast', 'lunch', 'dinner'].map(mType => {
              const currentList = mType === 'breakfast' ? breakfastItems : (mType === 'lunch' ? lunchItems : dinnerItems)
              const presetList = PRESET_MEALS[mType] || []
              return (
                <div key={mType} style={{ marginBottom: 24, padding: '16px', background: 'var(--surface-2)', borderRadius: 16, border: '1px solid var(--sep)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, textTransform: 'capitalize', color: 'var(--label)', marginBottom: 8 }}>
                    {t(mType)}
                  </div>

                  {/* Added Food Items Tags */}
                  {currentList.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {currentList.map((food, fIdx) => (
                        <span
                          key={fIdx}
                          style={{
                            padding: '4px 10px',
                            background: 'var(--surface)',
                            borderRadius: 99,
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--label)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            border: '1px solid var(--sep)'
                          }}
                        >
                          <span>{food}</span>
                          <span
                            onClick={() => removeFood(mType, fIdx)}
                            style={{ cursor: 'pointer', color: '#EF4444', fontWeight: 900 }}
                          >
                            ×
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Suggestions Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {presetList.map((preset, pIdx) => {
                      const isAdded = currentList.includes(preset)
                      if (isAdded) return null
                      return (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => addFood(mType, preset)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: 'var(--surface)',
                            border: '1px solid var(--sep)',
                            color: 'var(--label-2)',
                            cursor: 'pointer'
                          }}
                        >
                          + {preset}
                        </button>
                      )
                    })}
                  </div>

                  {/* Custom food entry */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="input"
                      placeholder={t('Add other {0} item...', t(mType))}
                      value={customFoodInput[mType]}
                      onChange={e => setCustomFoodInput({ ...customFoodInput, [mType]: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addFood(mType, customFoodInput[mType])
                          setCustomFoodInput({ ...customFoodInput, [mType]: '' })
                        }
                      }}
                      style={{ flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--sep)', color: 'var(--label)' }}
                    />
                    <Button
                      size="sm"
                      variant="tinted"
                      onClick={() => {
                        addFood(mType, customFoodInput[mType])
                        setCustomFoodInput({ ...customFoodInput, [mType]: '' })
                      }}
                    >
                      {t('Add')}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ==================== STEP 5: REVIEW & COMPLETE ==================== */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px 0', color: 'var(--label)' }}>
              {t('Review & Complete Setup')}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--label-2)', margin: '0 0 20px 0', lineHeight: 1.45 }}>
              {t('Confirm your profile details below. You can update any information anytime in Settings.')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 26 }}>
              {/* Profile Card */}
              <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: 16, border: '1px solid var(--sep)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--theme-accent, #E8B477)' }}>
                    {t('Personal Info')}
                  </span>
                  <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--theme-accent, #E8B477)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {t('Edit')}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--label-2)' }}>{t('Name')}:</span> <strong style={{ color: 'var(--label)' }}>{fullName}</strong></div>
                  <div><span style={{ color: 'var(--label-2)' }}>{t('Age')}:</span> <strong style={{ color: 'var(--label)' }}>{calculatedAge} yrs ({sex})</strong></div>
                  <div><span style={{ color: 'var(--label-2)' }}>{t('Height')}:</span> <strong style={{ color: 'var(--label)' }}>{heightCm} cm</strong></div>
                  <div><span style={{ color: 'var(--label-2)' }}>{t('Current Weight')}:</span> <strong style={{ color: 'var(--label)' }}>{currentWeightKg} kg</strong></div>
                </div>
              </div>

              {/* Goal Card */}
              <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: 16, border: '1px solid var(--sep)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--theme-accent, #E8B477)' }}>
                    {t('Fitness Goal & Target')}
                  </span>
                  <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'var(--theme-accent, #E8B477)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {t('Edit')}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--label-2)' }}>{t('Goal')}:</span> <strong style={{ color: 'var(--label)' }}>{t(FITNESS_GOALS.find(g => g.id === fitnessGoal)?.name || fitnessGoal)}</strong></div>
                  <div><span style={{ color: 'var(--label-2)' }}>{t('Target Weight')}:</span> <strong style={{ color: 'var(--label)' }}>{targetWeightKg} kg</strong></div>
                  <div>
                    <span style={{ color: 'var(--label-2)' }}>{t('Change')}:</span>{' '}
                    <strong style={{ color: weightDiff < 0 ? '#EF4444' : (weightDiff > 0 ? 'var(--mint)' : 'var(--theme-accent, #E8B477)') }}>
                      {weightDiff < 0 ? `${weightDiff} kg` : (weightDiff > 0 ? `+${weightDiff} kg` : `0.0 kg`)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Training Preferences Card */}
              <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: 16, border: '1px solid var(--sep)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--theme-accent, #E8B477)' }}>
                    {t('Training Cadence')}
                  </span>
                  <button onClick={() => setStep(3)} style={{ background: 'none', border: 'none', color: 'var(--theme-accent, #E8B477)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {t('Edit')}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--label-2)' }}>{t('Frequency')}:</span> <strong style={{ color: 'var(--label)' }}>{workoutFrequency} {t('days / week')}</strong></div>
                  <div><span style={{ color: 'var(--label-2)' }}>{t('Experience')}:</span> <strong style={{ color: 'var(--label)' }}>{t(fitnessExperience)}</strong></div>
                  <div><span style={{ color: 'var(--label-2)' }}>{t('Style')}:</span> <strong style={{ color: 'var(--label)' }}>{t(workoutType)}</strong></div>
                </div>
              </div>

              {/* Diet Preferences Card */}
              <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: 16, border: '1px solid var(--sep)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--theme-accent, #E8B477)' }}>
                    {t('Diet Preferences')}
                  </span>
                  <button onClick={() => setStep(4)} style={{ background: 'none', border: 'none', color: 'var(--theme-accent, #E8B477)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {t('Edit')}
                  </button>
                </div>
                {dietSkipped || (!breakfastItems.length && !lunchItems.length && !dinnerItems.length) ? (
                  <div style={{ fontSize: 13, color: 'var(--label-2)', fontStyle: 'italic' }}>
                    {t('Skipped — meal logging will be done individually.')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                    {breakfastItems.length > 0 && <div><span style={{ color: 'var(--label-2)' }}>{t('Breakfast')}:</span> <strong style={{ color: 'var(--label)' }}>{breakfastItems.join(', ')}</strong></div>}
                    {lunchItems.length > 0 && <div><span style={{ color: 'var(--label-2)' }}>{t('Lunch')}:</span> <strong style={{ color: 'var(--label)' }}>{lunchItems.join(', ')}</strong></div>}
                    {dinnerItems.length > 0 && <div><span style={{ color: 'var(--label-2)' }}>{t('Dinner')}:</span> <strong style={{ color: 'var(--label)' }}>{dinnerItems.join(', ')}</strong></div>}
                  </div>
                )}
              </div>
            </div>

            {/* Complete Setup Action */}
            <Button
              size="lg"
              variant="primary"
              disabled={saving}
              onClick={handleCompleteSetup}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: 16,
                fontWeight: 800,
                borderRadius: 14,
                background: 'var(--theme-accent-gradient, linear-gradient(135deg, #FFD09A 0%, #E8B477 100%))',
                color: '#12100E',
                boxShadow: '0 8px 24px var(--theme-accent-glow, rgba(232, 180, 119, 0.35))'
              }}
            >
              {saving ? t('Setting up your profile...') : t('Complete Setup & Start Training →')}
            </Button>
          </div>
        )}

        {/* Wizard Footer Navigation (Steps 1 to 4) */}
        {step < 5 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--sep)' }}>
            {step > 1 ? (
              <Button size="md" variant="ghost" onClick={handleBack}>
                ← {t('Back')}
              </Button>
            ) : <div />}

            <Button
              size="md"
              variant="primary"
              onClick={handleNext}
              style={{
                padding: '10px 22px',
                borderRadius: 12,
                background: 'var(--theme-accent-gradient)',
                color: '#12100E',
                fontWeight: 800
              }}
            >
              {t('Continue')} →
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

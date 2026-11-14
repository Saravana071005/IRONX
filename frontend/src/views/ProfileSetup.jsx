import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { updateProfile } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Section, Row, SelectRow, Segmented, Button, TextField, NumberField, TextArea } from '../components/ui.jsx'

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
  { value: 'build_muscle', label: 'Build Muscle (Hypertrophy)' },
  { value: 'lose_fat', label: 'Lose Fat & Weight' },
  { value: 'strength', label: 'Increase Strength' },
  { value: 'endurance', label: 'Improve Endurance' },
  { value: 'general_health', label: 'General Health & Mobility' },
  { value: 'athletic_performance', label: 'Athletic Performance' }
]

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary (desk job, minimal movement)' },
  { value: 'lightly_active', label: 'Lightly Active (1-3 days exercise)' },
  { value: 'moderately_active', label: 'Moderately Active (3-5 days exercise)' },
  { value: 'very_active', label: 'Very Active (6-7 days hard exercise)' },
  { value: 'extra_active', label: 'Extra Active (athlete or physical job)' }
]

const FITNESS_EXPERIENCES = [
  { value: 'beginner', label: 'Beginner (< 1 year)' },
  { value: 'intermediate', label: 'Intermediate (1 - 3 years)' },
  { value: 'advanced', label: 'Advanced (3+ years)' }
]

const DAYS_OF_WEEK = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 7, label: 'Sun' }
]

export default function ProfileSetup() {
  const navigate = useNavigate()
  const user = useStore(s => s.user)
  const setUser = useStore(s => s.setUser)
  const toast = useUI(s => s.toast)

  const existing = user?.profile || {}

  const [fullName, setFullName] = useState(existing.fullName || user?.name || '')
  const [dateOfBirth, setDateOfBirth] = useState(existing.dateOfBirth || '1995-01-01')
  const [sex, setSex] = useState(existing.sex || 'male')
  const [heightCm, setHeightCm] = useState(existing.heightCm || 175)
  const [currentWeightKg, setCurrentWeightKg] = useState(existing.currentWeightKg || 70)
  const [targetWeightKg, setTargetWeightKg] = useState(existing.targetWeightKg || '')
  const [fitnessGoal, setFitnessGoal] = useState(existing.fitnessGoal || 'build_muscle')
  const [activityLevel, setActivityLevel] = useState(existing.activityLevel || 'moderately_active')
  const [fitnessExperience, setFitnessExperience] = useState(existing.fitnessExperience || 'intermediate')
  const [preferredDays, setPreferredDays] = useState(existing.preferredWorkoutDays || [1, 2, 3, 4, 5, 6])
  const [preferences, setPreferences] = useState(existing.preferences || '')
  const [saving, setSaving] = useState(false)

  const calculatedAge = useMemo(() => computeAge(dateOfBirth), [dateOfBirth])

  const toggleDay = dayNum => {
    setPreferredDays(prev => {
      if (prev.includes(dayNum)) {
        if (prev.length <= 1) return prev // keep at least 1 day
        return prev.filter(d => d !== dayNum)
      } else {
        return [...prev, dayNum].sort((a, b) => a - b)
      }
    })
  }

  const handleSubmit = async e => {
    e?.preventDefault()
    if (!fullName.trim()) {
      toast(t('Full name is required'))
      return
    }
    if (!dateOfBirth || calculatedAge === null) {
      toast(t('A valid date of birth is required'))
      return
    }
    if (calculatedAge < 13 || calculatedAge > 120) {
      toast(t('Age must be between 13 and 120 years'))
      return
    }
    if (!heightCm || heightCm < 50 || heightCm > 260) {
      toast(t('Height must be between 50 and 260 cm'))
      return
    }
    if (!currentWeightKg || currentWeightKg < 20 || currentWeightKg > 400) {
      toast(t('Current weight must be between 20 and 400 kg'))
      return
    }

    setSaving(true)
    try {
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
        preferredWorkoutDays: preferredDays,
        preferences: preferences.trim()
      }

      const res = await updateProfile(payload)
      if (res?.user) {
        setUser(res.user)
      }
      toast(t('Profile saved! Welcome to openGym'))
      navigate('/home')
    } catch (err) {
      toast(err.message || t('Failed to save profile'))
    } finally {
      setSaving(false)
    }
  }

  const isSetup = !user?.profile?.completed

  return (
    <div className="narrow" style={{ paddingBottom: 60 }}>
      <div className="hdr" style={{ marginBottom: 14 }}>
        {!isSetup && (
          <button className="iconbtn" onClick={() => navigate('/settings')} aria-label={t('Back')}>
            <Icon name="chevronLeft" />
          </button>
        )}
        <div style={{ flex: 1, marginLeft: isSetup ? 0 : 10 }}>
          <h1>{isSetup ? t('Personal Fitness Profile') : t('Edit Fitness Profile')}</h1>
        </div>
      </div>

      <p className="sect-f" style={{ marginTop: 0, marginBottom: 20 }}>
        {isSetup
          ? t('Tell us about yourself to customize your weekly planner, calorie targets, and workout baselines.')
          : t('Update your measurements, fitness goal, and training schedule anytime.')}
      </p>

      {/* Required Profile Details */}
      <Section title={t('Required Details')}>
        <Row icon="person" iconTint="var(--indigo)" title={t('Full Name')}>
          <TextField
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder={t('Your name')}
            maxLength={60}
            style={{ width: 170, textAlign: 'right' }}
          />
        </Row>

        <Row
          icon="calendar"
          iconTint="var(--blue)"
          title={t('Date of Birth')}
          subtitle={calculatedAge !== null ? t('Calculated age: {0} years', calculatedAge) : t('Enter valid date')}
        >
          <input
            type="date"
            className="input"
            value={dateOfBirth}
            onChange={e => setDateOfBirth(e.target.value)}
            style={{ width: 155, padding: '6px 10px', fontSize: 14, textAlign: 'right' }}
          />
        </Row>

        <Row icon="figureRun" iconTint="var(--acc)" title={t('Sex')}>
          <Segmented
            className="seg-inline"
            options={[
              { value: 'male', label: t('Male') },
              { value: 'female', label: t('Female') },
              { value: 'other', label: t('Other') }
            ]}
            value={sex}
            onChange={v => setSex(v)}
          />
        </Row>

        <Row icon="ruler" iconTint="var(--teal)" title={t('Height (cm)')}>
          <div style={{ width: 100 }}>
            <NumberField
              value={heightCm}
              onChange={v => setHeightCm(v)}
              decimal={false}
              placeholder="175"
            />
          </div>
        </Row>

        <Row icon="scale" iconTint="var(--orange)" title={t('Current Weight (kg)')}>
          <div style={{ width: 100 }}>
            <NumberField
              value={currentWeightKg}
              onChange={v => setCurrentWeightKg(v)}
              decimal={true}
              placeholder="70"
            />
          </div>
        </Row>

        <SelectRow
          icon="target"
          iconTint="var(--pink)"
          title={t('Primary Fitness Goal')}
          value={fitnessGoal}
          options={FITNESS_GOALS.map(g => ({ value: g.value, label: t(g.label) }))}
          onChange={v => setFitnessGoal(v)}
        />
      </Section>

      {/* Optional Goals & Lifestyle */}
      <Section title={t('Fitness Experience & Preferences')}>
        <Row icon="trophy" iconTint="var(--yellow)" title={t('Target Weight (kg)')} subtitle={t('Optional')}>
          <div style={{ width: 100 }}>
            <NumberField
              value={targetWeightKg}
              onChange={v => setTargetWeightKg(v)}
              decimal={true}
              nullable={true}
              placeholder={t('Optional')}
            />
          </div>
        </Row>

        <SelectRow
          icon="bolt"
          iconTint="var(--purple)"
          title={t('Activity Level')}
          value={activityLevel}
          options={ACTIVITY_LEVELS.map(a => ({ value: a.value, label: t(a.label) }))}
          onChange={v => setActivityLevel(v)}
        />

        <SelectRow
          icon="medal"
          iconTint="var(--teal)"
          title={t('Experience Level')}
          value={fitnessExperience}
          options={FITNESS_EXPERIENCES.map(e => ({ value: e.value, label: t(e.label) }))}
          onChange={v => setFitnessExperience(v)}
        />

        <Row
          icon="clock"
          iconTint="var(--blue)"
          title={t('Preferred Workout Days')}
          subtitle={t('{0} days selected', preferredDays.length)}
        />
        <div style={{ padding: '8px 16px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DAYS_OF_WEEK.map(({ day, label }) => {
            const active = preferredDays.includes(day)
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`btn ${active ? 'primary' : 'plain'}`}
                style={{
                  minWidth: 42,
                  padding: '6px 12px',
                  borderRadius: 18,
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div style={{ padding: '12px 16px' }}>
          <div className="small muted" style={{ marginBottom: 6 }}>
            {t('Additional Preferences & Notes (Injuries, equipment, diet)')}
          </div>
          <TextArea
            rows={3}
            placeholder={t('e.g. Mild shoulder discomfort on incline press, prefer barbell and dumbbell workouts.')}
            value={preferences}
            onChange={e => setPreferences(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </Section>

      <div style={{ marginTop: 24 }}>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={saving}
          style={{ width: '100%', fontSize: 16, padding: '13px 20px', borderRadius: 12 }}
        >
          {saving ? t('Saving Profile...') : isSetup ? t('Save & Continue to Dashboard') : t('Save Changes')}
        </Button>
      </div>
    </div>
  )
}

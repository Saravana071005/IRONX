// scripts/generate-sounds.js
// Generates clean, high-fidelity PCM WAV alert audio files for OpenGym
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../frontend/public/sounds')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

function createWavBuffer(sampleRate, samples) {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const buf = Buffer.alloc(totalSize)

  // RIFF header
  buf.write('RIFF', 0)
  buf.writeUInt32LE(totalSize - 8, 4)
  buf.write('WAVE', 8)

  // fmt chunk
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)             // Subchunk1Size (16 for PCM)
  buf.writeUInt16LE(1, 20)              // AudioFormat (1 for PCM)
  buf.writeUInt16LE(numChannels, 22)    // NumChannels
  buf.writeUInt32LE(sampleRate, 24)     // SampleRate
  buf.writeUInt32LE(byteRate, 28)       // ByteRate
  buf.writeUInt16LE(blockAlign, 32)     // BlockAlign
  buf.writeUInt16LE(bitsPerSample, 34)  // BitsPerSample

  // data chunk
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)

  // PCM samples
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    // Clamp to -1.0 to 1.0
    const s = Math.max(-1.0, Math.min(1.0, samples[i]))
    const intVal = Math.round(s < 0 ? s * 32768 : s * 32767)
    buf.writeInt16LE(intVal, offset)
    offset += 2
  }

  return buf
}

const SAMPLE_RATE = 44100

// 1. Alarm: 3 loud gym bursts (t=0..0.24s, 0.32..0.56s, 0.64..1.4s)
function generateAlarm() {
  const duration = 1.45
  const totalSamples = Math.floor(SAMPLE_RATE * duration)
  const samples = new Float32Array(totalSamples)

  const bursts = [
    { start: 0.00, end: 0.24, f1: 880, f2: 1760 },
    { start: 0.32, end: 0.56, f1: 880, f2: 1760 },
    { start: 0.64, end: 1.40, f1: 1046.5, f2: 2093 }
  ]

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE
    let sample = 0
    for (const b of bursts) {
      if (t >= b.start && t < b.end) {
        const dt = t - b.start
        const burstDur = b.end - b.start
        // Envelope: 8ms attack, exponential decay towards end
        const attack = Math.min(1, dt / 0.008)
        const decay = Math.exp(-2.5 * (dt / burstDur))
        const env = attack * decay

        const s1 = Math.sin(2 * Math.PI * b.f1 * t)
        const s2 = 0.5 * Math.sin(2 * Math.PI * b.f2 * t)
        // Add gentle third harmonic for cut-through
        const s3 = 0.2 * Math.sin(2 * Math.PI * b.f1 * 1.5 * t)
        sample += (s1 + s2 + s3) * env * 0.75
      }
    }
    samples[i] = sample
  }
  return samples
}

// 2. Triple Boxing Bell: 3 distinct metallic strikes
function generateBoxingBell() {
  const duration = 1.6
  const totalSamples = Math.floor(SAMPLE_RATE * duration)
  const samples = new Float32Array(totalSamples)

  const strikes = [0.00, 0.32, 0.64]
  const harmonics = [
    { freq: 659.25, amp: 0.6, decay: 1.5 },
    { freq: 1318.5, amp: 0.35, decay: 1.1 },
    { freq: 2637.0, amp: 0.20, decay: 0.8 },
    { freq: 3950.0, amp: 0.10, decay: 0.5 }
  ]

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE
    let sample = 0
    strikes.forEach((st, idx) => {
      if (t >= st) {
        const dt = t - st
        const isLast = idx === strikes.length - 1
        const decayMult = isLast ? 1.0 : 0.4
        for (const h of harmonics) {
          const env = Math.exp(-dt / (h.decay * decayMult)) * Math.min(1, dt / 0.003)
          sample += Math.sin(2 * Math.PI * h.freq * dt) * h.amp * env
        }
      }
    })
    samples[i] = sample * 0.65
  }
  return samples
}

// 3. Digital Pulse: Energetic electronic siren pulses
function generateDigitalPulse() {
  const duration = 1.2
  const totalSamples = Math.floor(SAMPLE_RATE * duration)
  const samples = new Float32Array(totalSamples)

  const pulses = [
    { freq: 880, start: 0.00, dur: 0.12 },
    { freq: 1174, start: 0.15, dur: 0.12 },
    { freq: 880, start: 0.30, dur: 0.12 },
    { freq: 1174, start: 0.45, dur: 0.12 },
    { freq: 1396.9, start: 0.60, dur: 0.55 }
  ]

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE
    let sample = 0
    for (const p of pulses) {
      if (t >= p.start && t < p.start + p.dur) {
        const dt = t - p.start
        const env = Math.min(1, dt / 0.005) * Math.exp(-3.5 * (dt / p.dur))
        // Square wave + sawtooth rich timbre
        const phase = (2 * Math.PI * p.freq * dt) % (2 * Math.PI)
        const sq = phase < Math.PI ? 0.6 : -0.6
        const saw = (phase / Math.PI) - 1.0
        sample += (sq * 0.5 + saw * 0.3) * env
      }
    }
    samples[i] = sample * 0.8
  }
  return samples
}

// 4. Heavy Gym Gong: Deep acoustic resonance
function generateGong() {
  const duration = 2.0
  const totalSamples = Math.floor(SAMPLE_RATE * duration)
  const samples = new Float32Array(totalSamples)

  const freqs = [
    { f: 220, amp: 0.65, decay: 1.8 },
    { f: 440, amp: 0.35, decay: 1.4 },
    { f: 660, amp: 0.20, decay: 1.0 },
    { f: 880, amp: 0.15, decay: 0.7 }
  ]

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE
    let sample = 0
    const attack = Math.min(1, t / 0.015)
    for (const f of freqs) {
      const env = attack * Math.exp(-t / f.decay)
      sample += Math.sin(2 * Math.PI * f.f * t) * f.amp * env
    }
    samples[i] = sample * 0.75
  }
  return samples
}

// 5. Melodic Chime: Ascending 4-note chord
function generateChime() {
  const duration = 1.5
  const totalSamples = Math.floor(SAMPLE_RATE * duration)
  const samples = new Float32Array(totalSamples)

  const notes = [
    { freq: 587.33, start: 0.00, dur: 0.55 },
    { freq: 739.99, start: 0.12, dur: 0.65 },
    { freq: 880.00, start: 0.24, dur: 0.75 },
    { freq: 1174.66, start: 0.36, dur: 1.10 }
  ]

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE
    let sample = 0
    for (const n of notes) {
      if (t >= n.start) {
        const dt = t - n.start
        if (dt < n.dur) {
          const env = Math.min(1, dt / 0.01) * Math.exp(-2.8 * (dt / n.dur))
          sample += Math.sin(2 * Math.PI * n.freq * dt) * 0.4 * env
          // subtle shimmer octave
          sample += Math.sin(2 * Math.PI * n.freq * 2 * dt) * 0.15 * env
        }
      }
    }
    samples[i] = sample * 0.8
  }
  return samples
}

// 6. Notification: Crisp short alert ping (suitable for in-app alert & test sound)
function generateNotification() {
  const duration = 0.5
  const totalSamples = Math.floor(SAMPLE_RATE * duration)
  const samples = new Float32Array(totalSamples)

  const notes = [
    { freq: 987.77, start: 0.00, dur: 0.22 }, // B5
    { freq: 1318.51, start: 0.08, dur: 0.40 } // E6
  ]

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE
    let sample = 0
    for (const n of notes) {
      if (t >= n.start) {
        const dt = t - n.start
        if (dt < n.dur) {
          const env = Math.min(1, dt / 0.008) * Math.exp(-4.5 * (dt / n.dur))
          sample += Math.sin(2 * Math.PI * n.freq * dt) * 0.5 * env
          sample += Math.sin(2 * Math.PI * n.freq * 2 * dt) * 0.2 * env
        }
      }
    }
    samples[i] = sample * 0.85
  }
  return samples
}

const tones = [
  { name: 'alarm.wav', fn: generateAlarm },
  { name: 'boxing_bell.wav', fn: generateBoxingBell },
  { name: 'digital_pulse.wav', fn: generateDigitalPulse },
  { name: 'gong.wav', fn: generateGong },
  { name: 'chime.wav', fn: generateChime },
  { name: 'notification.wav', fn: generateNotification }
]

console.log('Generating audio files in:', outDir)
for (const t of tones) {
  const samples = t.fn()
  const buf = createWavBuffer(SAMPLE_RATE, samples)
  const filePath = path.join(outDir, t.name)
  fs.writeFileSync(filePath, buf)
  console.log(` Created ${t.name} (${(buf.length / 1024).toFixed(1)} KB)`)
}
console.log('Audio file generation complete.')

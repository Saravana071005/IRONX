/* ironx-api — passkey (WebAuthn) auth + per-user state storage for IRONX
   No framework, JSON-file storage, signed session cookies.               */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse
} from '@simplewebauthn/server';
import webpush from 'web-push';
import { nutritionRoutes } from './nutrition/routes.js';
import { clearAllNutritionDataForUser, getCanonicalUserNutritionGoals } from './nutrition/db.js';
import { getMongoDb, pingMongo } from './db/mongo.js';
import {
  calculateAge,
  validateProfileData,
  signOAuthState,
  verifyOAuthState,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  verifyGoogleIdToken,
  mergeGuestState,
  ensureMongoAuthIndexes
} from './auth/google.js';

// Load server environment variables from .env if present
const envCandidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../.env')];
for (const envFile of envCandidates) {
  if (fs.existsSync(envFile)) {
    try {
      const content = fs.readFileSync(envFile, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (key && !(key in process.env)) {
            process.env[key] = val;
          }
        }
      }
    } catch {}
    break;
  }
}

const PORT = +(process.env.PORT || 3000);
const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
const defaultDataDir = isVercel ? path.join(os.tmpdir(), 'opengym-data') : (fs.existsSync('/data') ? '/data' : path.resolve(process.cwd(), 'data'));
const DATA = process.env.DATA_DIR || defaultDataDir;
const RP_NAME = process.env.RP_NAME || 'IRONX';
const ORIGIN = (process.env.ORIGIN || 'http://localhost:8080').trim();
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || process.env.ORIGIN || 'https://opengym-frontend-229c.onrender.com').trim();
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();

function getGoogleCallbackUrl(req) {
  if (process.env.GOOGLE_CALLBACK_URL) return process.env.GOOGLE_CALLBACK_URL.trim();
  const host = (req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').trim();
  const proto = (req?.headers?.['x-forwarded-proto'] || (req?.socket?.encrypted ? 'https' : 'http')).trim();
  if (host && host !== 'localhost' && !host.startsWith('127.0.0.1')) {
    return `${proto}://${host}/api/auth/google/callback`;
  }
  return 'https://opengym-backend-ikdi.onrender.com/api/auth/google/callback';
}

const ORIGINS = Array.from(new Set([
  ORIGIN,
  FRONTEND_ORIGIN,
  'https://opengym-frontend-229c.onrender.com',
  'https://opengym-backend-ikdi.onrender.com',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  ...(process.env.ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
]));

function getRpId(req) {
  const envRpId = (process.env.RP_ID || '').trim();
  if (envRpId && envRpId !== 'localhost') return envRpId;
  if (req?.headers?.origin) {
    try {
      const h = new URL(req.headers.origin).hostname;
      if (h && h !== 'localhost' && h !== '127.0.0.1') return h;
    } catch {}
  }
  if (envRpId) return envRpId;
  const host = (req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(':')[0].trim();
  if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  return host || 'localhost';
}

function getOrigin(req) {
  if (req?.headers?.origin) return req.headers.origin;
  const proto = req?.headers?.['x-forwarded-proto'] || (req?.socket?.encrypted ? 'https' : 'http');
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host || 'localhost:8080';
  return `${proto}://${host}`;
}

// Admin dashboard (issue): admins are matched by uid; INVITE_ONLY gates new signups behind a
// code the admin generates. Both default off so a fresh self-hosted instance stays open.
const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
const INVITE_ONLY = /^(1|true|yes|on)$/i.test(process.env.INVITE_ONLY || '');
// 90 days keeps someone who trains a few times a week permanently signed in without a stolen
// cookie staying good for a year. Overridable because a family instance and one on the open
// internet don't want the same number. Only affects cookies minted from now on — the expiry is
// baked into each cookie when it's issued, so lowering this never cuts an existing session short.
const SESSION_DAYS = Math.max(1, +(process.env.SESSION_DAYS || 90) || 90);
const MAX_BODY = 5 * 1024 * 1024;
// Secure cookies require HTTPS; over plain http://localhost the flag would drop the cookie
const SECURE = /^https:/i.test(ORIGIN) ? ' Secure;' : '';

try { fs.mkdirSync(DATA, { recursive: true }); } catch {}
// 0700 is what stops the unprivileged user that Coach jobs run as from reading any of this —
// state files, db.json, the session secret, the provider credential. The Agent SDK process gets
// its job payload in a temp directory and nothing else. Best-effort: a bind-mounted host directory
// may refuse the chmod, and that is not a reason to refuse to boot.
try { fs.chmodSync(DATA, 0o700); } catch { /* host filesystem says no — carry on */ }

/* ---------- secret + db ---------- */
const secretFile = path.join(DATA, 'secret');
if (!fs.existsSync(secretFile)) {
  try { fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 }); } catch {}
}
const SECRET = process.env.SECRET || (fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8').trim() : 'opengym-default-secret-key-prod');

const dbFile = path.join(DATA, 'db.json');
let db = { users: [], creds: [], subs: [], invites: [] };
try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch {}
db.users = db.users || [];
db.creds = db.creds || [];
db.subs = db.subs || [];
db.invites = db.invites || [];

let mongoIndexesEnsured = false;
async function syncFromMongo() {
  if (!process.env.MONGODB_URI) return;
  try {
    const mongo = await getMongoDb();
    if (!mongo) return;
    if (!mongoIndexesEnsured) {
      await ensureMongoAuthIndexes(mongo);
      mongoIndexesEnsured = true;
    }
    const [users, creds, invites] = await Promise.all([
      mongo.collection('users').find({}).toArray(),
      mongo.collection('credentials').find({}).toArray(),
      mongo.collection('invites').find({}).toArray()
    ]);
    if (users && Array.isArray(users)) db.users = users;
    if (creds && Array.isArray(creds)) db.creds = creds;
    if (invites && Array.isArray(invites)) db.invites = invites;
  } catch (err) {
    console.error('Mongo sync error:', err.message);
    throw err;
  }
}
let syncPromise = null;
async function ensureMongoSync() {
  if (!process.env.MONGODB_URI) return;
  if (!syncPromise) {
    syncPromise = syncFromMongo().catch(err => {
      console.error('ensureMongoSync error:', err.message);
      syncPromise = null; // Reset so future requests can retry connecting
    });
  }
  return syncPromise;
}
syncFromMongo().catch(() => {});

const isAdmin = user => !!user && (user.admin === true || ADMIN_UIDS.includes(user.id));
function saveDb(specificUser = null) {
  try { atomicWrite(dbFile, JSON.stringify(db, null, 2)); } catch {}
  if (process.env.MONGODB_URI) {
    getMongoDb().then(async mongo => {
      if (!mongo) return;
      if (specificUser) {
        await mongo.collection('users').updateOne({ id: specificUser.id }, { $set: specificUser }, { upsert: true });
        return;
      }
      const userOps = db.users.map(u => ({
        updateOne: { filter: { id: u.id }, update: { $set: u }, upsert: true }
      }));
      if (userOps.length > 0) await mongo.collection('users').bulkWrite(userOps, { ordered: false }).catch(() => {});
      const credOps = db.creds.map(c => ({
        updateOne: { filter: { id: c.id }, update: { $set: c }, upsert: true }
      }));
      if (credOps.length > 0) await mongo.collection('credentials').bulkWrite(credOps, { ordered: false }).catch(() => {});
      const inviteOps = db.invites.map(i => ({
        updateOne: { filter: { code: i.code }, update: { $set: i }, upsert: true }
      }));
      if (inviteOps.length > 0) await mongo.collection('invites').bulkWrite(inviteOps, { ordered: false }).catch(() => {});
    }).catch(e => console.error('MongoDB persist error:', e.message));
  }
}
function atomicWrite(file, content) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}
const stateFile = uid => path.join(DATA, 'state-' + uid.replace(/[^a-zA-Z0-9_-]/g, '') + '.json');
const settingsFile = uid => path.join(DATA, 'settings-' + uid.replace(/[^a-zA-Z0-9_-]/g, '') + '.json');

function defaultUserSettings(userId = null) {
  return {
    userId: userId || 'guest',
    themeMode: 'dark',
    themePreset: 'warm-gold',
    accentColor: '#E8B477',
    ambientGlowIntensity: 1.0,
    upperGlowIntensity: 1.0,
    backgroundSettings: {
      bgDarkness: '#090909',
      bgAnimation: true,
      glassOpacity: 0.80,
      blurIntensity: 1.0
    },
    language: 'en',
    measurementUnit: 'kg',
    notificationPreferences: {
      restAlertEnabled: true,
      restAlertTone: 'alarm',
      restAlertVolume: 1.0,
      restVibrationEnabled: true,
      restNotifications: false
    },
    calorieTarget: 1900,
    waterGoalLitres: 2.5,
    updatedAt: new Date().toISOString()
  };
}

async function getUserSettings(userId) {
  if (!userId) return defaultUserSettings('guest');
  if (process.env.MONGODB_URI) {
    try {
      const mongo = await getMongoDb();
      if (mongo) {
        const doc = await mongo.collection('user_settings').findOne({ userId });
        if (doc) {
          const { _id, ...clean } = doc;
          return {
            ...defaultUserSettings(userId),
            ...clean,
            backgroundSettings: {
              ...(defaultUserSettings(userId).backgroundSettings),
              ...(clean.backgroundSettings || {})
            },
            notificationPreferences: {
              ...(defaultUserSettings(userId).notificationPreferences),
              ...(clean.notificationPreferences || {})
            }
          };
        }
      }
    } catch (e) {
      console.error('Mongo read user_settings error:', e.message);
    }
  }
  try {
    const sFile = settingsFile(userId);
    if (fs.existsSync(sFile)) {
      const parsed = JSON.parse(fs.readFileSync(sFile, 'utf8'));
      return {
        ...defaultUserSettings(userId),
        ...parsed,
        backgroundSettings: {
          ...(defaultUserSettings(userId).backgroundSettings),
          ...(parsed.backgroundSettings || {})
        },
        notificationPreferences: {
          ...(defaultUserSettings(userId).notificationPreferences),
          ...(parsed.notificationPreferences || {})
        }
      };
    }
  } catch {}
  return defaultUserSettings(userId);
}

async function saveUserSettings(userId, updates = {}) {
  if (!userId) return null;
  const current = await getUserSettings(userId);
  const updated = {
    ...current,
    ...updates,
    backgroundSettings: {
      ...(current.backgroundSettings || {}),
      ...(updates.backgroundSettings || {})
    },
    notificationPreferences: {
      ...(current.notificationPreferences || {}),
      ...(updates.notificationPreferences || {})
    },
    userId,
    updatedAt: new Date().toISOString()
  };

  try { atomicWrite(settingsFile(userId), JSON.stringify(updated, null, 2)); } catch {}

  if (process.env.MONGODB_URI) {
    try {
      const mongo = await getMongoDb();
      if (mongo) {
        await mongo.collection('user_settings').updateOne(
          { userId },
          { $set: updated },
          { upsert: true }
        );
      }
    } catch (e) {
      console.error('Mongo write user_settings error:', e.message);
    }
  }
  return updated;
}

function readState(uid) {
  try { return JSON.parse(fs.readFileSync(stateFile(uid), 'utf8')); } catch { return null; }
}

/* ---------- push notifications (Web Push / VAPID) ---------- */
const vapidFile = path.join(DATA, 'vapid.json');
let vapid;
try { vapid = JSON.parse(fs.readFileSync(vapidFile, 'utf8')); }
catch { vapid = webpush.generateVAPIDKeys(); fs.writeFileSync(vapidFile, JSON.stringify(vapid), { mode: 0o600 }); }
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || (SECURE ? ORIGIN : 'mailto:admin@localhost');
webpush.setVapidDetails(VAPID_SUBJECT, vapid.publicKey, vapid.privateKey);

async function sendPush(userId, payload) {
  const subs = db.subs.filter(s => s.userId === userId);
  if (!subs.length) return;
  const body = JSON.stringify(payload);
  let dirty = false;
  await Promise.all(subs.map(async sub => {
    // urgency 'high' is the one lever we have over delivery speed — iOS/Android throttle
    // low-urgency background push more aggressively under battery-saving modes. TTL is left
    // at the library default (long) so a briefly-offline device still gets it once reconnected,
    // rather than risking it being dropped for the sake of shaving off latency that TTL doesn't
    // actually control anyway.
    try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, { urgency: 'high' }); }
    catch (e) {
      console.error('push send failed', userId, e.statusCode, e.body || e.message);
      if (e.statusCode === 404 || e.statusCode === 410) {
        db.subs = db.subs.filter(s => s.endpoint !== sub.endpoint); dirty = true;
      }
    }
  }));
  if (dirty) saveDb();
}

// Rest-timer alerts: client schedules on start/extend, cancels on skip or on-screen completion —
// this only fires when the tab was backgrounded/suspended and never got to cancel it itself.
const restTimers = new Map(); // userId -> Timeout
function scheduleRestTimer(userId, sec) {
  const t = restTimers.get(userId);
  if (t) clearTimeout(t);
  restTimers.set(userId, setTimeout(() => {
    restTimers.delete(userId);
    sendPush(userId, { title: 'Rest over 💪', body: 'Time for your next set.', tag: 'rest-timer' });
  }, sec * 1000));
}
function cancelRestTimer(userId) {
  const t = restTimers.get(userId);
  if (t) { clearTimeout(t); restTimers.delete(userId); }
}

// "Workout planned today" reminder — one per user per day, at their chosen time.
// Duplicated (not imported) from frontend/src/lib/history.js effectiveRoutineId — tiny pure helper, not worth sharing across the two runtimes.
function effectiveRoutineId(S, iso) {
  const ov = S.dayPlan?.[iso];
  if (ov === 'rest') return null;
  if (ov && S.routines?.some(r => r.id === ov)) return ov;
  const wd = new Date(iso + 'T12:00:00').getDay();
  return S.week?.[wd] || null;
}
// Computes "now" in an arbitrary IANA zone (e.g. "Europe/Lisbon") instead of the server's own —
// each user's reminder fires by their own clock, wherever they and their phone actually are.
function userNow(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).formatToParts(new Date());
    const g = t => parts.find(p => p.type === t)?.value;
    const date = `${g('year')}-${g('month')}-${g('day')}`;
    // Weekday is derived from the zone's own date, not the server's — a Sunday-evening review
    // has to be Sunday where the user is, which is what the reminder already assumes for time.
    return { date, hhmm: `${g('hour')}:${g('minute')}`, weekday: new Date(date + 'T12:00:00Z').getUTCDay() };
  } catch { return null; } // unknown/invalid tz string — skip this user rather than guess
}
setInterval(() => {
  for (const user of db.users) {
    if (!db.subs.some(s => s.userId === user.id)) continue;
    const S = readState(user.id);
    if (!S?.reminder?.on) continue;
    const now = userNow(S.reminder.tz || 'UTC');
    if (!now || S.reminder.time !== now.hhmm) continue;
    if (user.lastReminder === now.date) continue;
    if ((S.workouts || []).some(w => w.d === now.date)) continue;
    const rid = effectiveRoutineId(S, now.date);
    if (!rid) continue; // rest day — nothing planned
    const routine = (S.routines || []).find(r => r.id === rid);
    console.log('reminder firing', user.id, rid);
    user.lastReminder = now.date;
    saveDb();
    sendPush(user.id, {
      title: routine ? `${routine.emoji || '🏋️'} ${routine.name} today` : 'Workout planned today',
      body: "It's on your plan — let's go 💪",
      tag: 'day-reminder'
    });
  }
// Checked every 10s (not 60s) — ticks aren't aligned to the top of the minute, so a 60s
// interval could sit on your target minute for up to 59s before noticing. 10s caps that at ~9s.
}, 10000).unref();

/* ---------- sessions (signed cookie) ---------- */
function sign(payload) {
  const mac = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return payload + '.' + mac;
}
function verifySig(token) {
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const payload = token.slice(0, i), mac = token.slice(i + 1);
  const expect = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  } catch { return null; }
  return payload;
}
// Session payload is `<uid>:<expiry>:<version>`, where the version is the user's `sv` counter.
// Bumping `sv` (POST /api/logout/all) makes every cookie ever handed out for that account stop
// verifying, which is the only revocation there was before short of deleting ./data/secret and
// signing out the whole instance. Cookies minted before `sv` existed have no third field and are
// read as version 0, matching a user who has never bumped — they stay valid until they expire.
const sessionVersion = user => user.sv || 0;
function makeSession(user) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  return sign(user.id + ':' + exp + ':' + sessionVersion(user));
}
function readSession(req) {
  let tok = null;
  if (req?.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
    tok = req.headers.authorization.slice(7).trim();
  }
  if (!tok && req?.headers?.cookie) {
    const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(c => {
      const i = c.indexOf('='); return i < 0 ? ['', ''] : [c.slice(0, i).trim(), c.slice(i + 1).trim()];
    }));
    tok = cookies.gymsid;
  }
  if (!tok) return null;
  const payload = verifySig(tok);
  if (!payload) return null;
  const [uid, exp, ver] = payload.split(':');
  if (!uid || +exp < Date.now()) return null;
  const user = db.users.find(u => u.id === uid) || null;
  if (!user) return null;
  if (user.disabled) return null;           // disabled accounts are locked out everywhere
  // Missing third field = pre-versioning cookie = version 0. Anything non-numeric is a malformed
  // payload (it still had to pass the HMAC, so this is belt-and-braces) and is refused outright.
  const claimed = ver === undefined ? 0 : Number(ver);
  if (!Number.isInteger(claimed) || claimed !== sessionVersion(user)) return null;
  return user;
}
// Guard for /api/admin/* — resolves the caller and 401/403s if they aren't an admin.
function requireAdmin(req, res) {
  const user = readSession(req);
  if (!user) { json(res, 401, { error: 'not signed in' }); return null; }
  if (!isAdmin(user)) { json(res, 403, { error: 'forbidden' }); return null; }
  return user;
}
function sessionCookie(user, req) {
  const isHttps = (req?.headers?.['x-forwarded-proto'] === 'https') || (req?.socket?.encrypted) || /^https:/i.test(ORIGIN) || !!process.env.RENDER;
  const sameSite = isHttps ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax';
  return `gymsid=${makeSession(user)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; ${sameSite}`;
}
function getClearCookie(req) {
  const isHttps = (req?.headers?.['x-forwarded-proto'] === 'https') || (req?.socket?.encrypted) || /^https:/i.test(ORIGIN) || !!process.env.RENDER;
  const sameSite = isHttps ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax';
  return `gymsid=; Path=/; Max-Age=0; HttpOnly; ${sameSite}`;
}
const clearCookie = `gymsid=; Path=/; Max-Age=0; HttpOnly;${SECURE} SameSite=Lax`;

/* ---------- challenge store (in-memory + signed token fallback for serverless) ---------- */
const challenges = new Map(); // cid -> {challenge, name?, uid?, exp}
function putChallenge(data) {
  const payload = JSON.stringify({ ...data, exp: Date.now() + 5 * 60000 });
  const b64 = Buffer.from(payload).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
  const cid = b64 + '.' + mac;
  challenges.set(cid, { ...data, exp: Date.now() + 5 * 60000 });
  return cid;
}
function takeChallenge(cid) {
  if (!cid) return null;
  const c = challenges.get(cid);
  if (c) {
    challenges.delete(cid);
    if (c.exp >= Date.now()) return c;
  }
  const i = cid.lastIndexOf('.');
  if (i < 0) return null;
  const b64 = cid.slice(0, i), mac = cid.slice(i + 1);
  const expect = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (!parsed || parsed.exp < Date.now()) return null;
    return parsed;
  } catch { return null; }
}
setInterval(() => { for (const [k, v] of challenges) if (v.exp < Date.now()) challenges.delete(k); }, 60000).unref();

/* ---------- helpers ---------- */
function json(res, code, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(extraHeaders || {}) });
  res.end(body);
}
function readBody(req) {
  let body;
  try {
    body = req.body;
  } catch {
    body = undefined;
  }
  if (body !== undefined && body !== null) {
    if (typeof body === 'object' && !Buffer.isBuffer(body)) return Promise.resolve(body);
    if (typeof body === 'string') {
      try { return Promise.resolve(JSON.parse(body)); } catch { return Promise.resolve({}); }
    }
    if (Buffer.isBuffer(body)) {
      try { return Promise.resolve(JSON.parse(body.toString('utf8'))); } catch { return Promise.resolve({}); }
    }
  }
  if (typeof req.json === 'function') {
    return req.json().catch(() => ({}));
  }
  if (typeof req.on !== 'function') {
    return Promise.resolve({});
  }
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', d => {
      size += d.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); if (typeof req.destroy === 'function') req.destroy(); return; }
      chunks.push(d);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}
const b64uToBuf = s => Buffer.from(s, 'base64url');

/* ---------- live presence (in-memory) ---------- */
// Clients heartbeat /api/activity while a workout is on screen; the admin dashboard reads who's
// live. Purely ephemeral — never persisted. Expires shortly after the last ping.
const presence = new Map();               // uid -> { name, exIdx, exTotal, setsDone, setsTotal, startedAt, updatedAt }
const PRESENCE_TTL = 70000;               // ~3.5× the 20s client heartbeat
function livePresence(uid) {
  const p = presence.get(uid);
  if (!p) return null;
  if (Date.now() - p.updatedAt > PRESENCE_TTL) { presence.delete(uid); return null; }
  return p;
}
setInterval(() => { for (const [k, v] of presence) if (Date.now() - v.updatedAt > PRESENCE_TTL) presence.delete(k); }, 30000).unref();

/* ---------- routes ---------- */
const routes = {
  'GET /': async (req, res) => {
    json(res, 200, {
      status: 'ok',
      service: 'IRONX API',
      message: 'Backend server is running'
    });
  },
  'GET /api/health': async (req, res) => {
    let mongoStatus = { connected: false, configured: false };
    if (process.env.MONGODB_URI) {
      try {
        mongoStatus = await pingMongo();
      } catch (e) {
        mongoStatus = { connected: false, configured: true, error: e.message };
      }
    }
    const isDbConnected = process.env.MONGODB_URI ? mongoStatus.connected : true;
    if (req.url && (req.url.includes('format=simple') || req.url.endsWith('/db'))) {
      return json(res, isDbConnected ? 200 : 503, { database: isDbConnected ? 'connected' : 'unavailable' });
    }
    // Process health check (liveness probe) always returns 200 to indicate process is up and listening
    json(res, 200, {
      ok: true,
      status: 'healthy',
      database: isDbConnected ? 'connected' : 'unavailable',
      users: (db.users || []).length,
      details: {
        type: process.env.MONGODB_URI ? 'mongodb' : 'sqlite_file',
        connected: isDbConnected,
        configured: !!process.env.MONGODB_URI,
        ...(mongoStatus.error ? { error: mongoStatus.error } : {})
      }
    });
  },

  'GET /api/health/db': async (req, res) => {
    let mongoStatus = { connected: false, configured: false };
    if (process.env.MONGODB_URI) {
      try {
        mongoStatus = await pingMongo();
      } catch (e) {
        mongoStatus = { connected: false, configured: true, error: e.message };
      }
    }
    const isDbConnected = process.env.MONGODB_URI ? mongoStatus.connected : true;
    json(res, isDbConnected ? 200 : 503, {
      database: isDbConnected ? 'connected' : 'unavailable'
    });
  },

  // Public config the login screen needs before anyone is signed in. `coach` is absent unless
  // the instance has both switched the Coach on and successfully connected a provider — the
  // single flag every piece of Coach UI hangs off, so an unconfigured instance is byte-for-byte
  // the app it was before the feature existed.
  'GET /api/config': async (req, res) => {
    json(res, 200, {
      auth_provider: 'google',
      google_client_id: GOOGLE_CLIENT_ID || null,
      invite_only: INVITE_ONLY
    });
  },

  'GET /api/me': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const age = user.profile?.dateOfBirth ? calculateAge(user.profile.dateOfBirth) : null;
    const profile = user.profile ? { ...user.profile, age } : null;
    const settings = await getUserSettings(user.id);
    json(res, 200, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email || null,
        picture: user.picture || null,
        googleSub: user.googleSub || null,
        profile,
        settings,
        isNewUser: !user.profile || !user.profile.completed,
        admin: isAdmin(user)
      }
    });
  },

  /* ---------- Google OAuth 2.0 ---------- */
  'GET /api/auth/google': async (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return json(res, 500, {
        error: 'google_not_configured',
        message: 'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.'
      });
    }
    const parsedUrl = new URL(req.url, 'http://localhost');
    const returnUrl = parsedUrl.searchParams.get('returnUrl') || '/home';
    const intent = parsedUrl.searchParams.get('intent') || 'login';
    const state = signOAuthState({ returnUrl, intent }, SECRET);
    const callbackUrl = getGoogleCallbackUrl(req);
    const authUrl = getGoogleAuthUrl({ clientId: GOOGLE_CLIENT_ID, callbackUrl, state });

    if (parsedUrl.searchParams.get('format') === 'json' || req.headers.accept?.includes('application/json')) {
      return json(res, 200, { url: authUrl });
    }
    res.writeHead(302, { Location: authUrl });
    res.end();
  },

  'GET /api/auth/google/callback': async (req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const code = parsedUrl.searchParams.get('code');
    const state = parsedUrl.searchParams.get('state');
    const oauthError = parsedUrl.searchParams.get('error');
    const frontendBase = FRONTEND_ORIGIN;

    if (oauthError) {
      res.writeHead(302, { Location: `${frontendBase}/#/login?error=${encodeURIComponent(oauthError)}` });
      res.end();
      return;
    }
    if (!code || !state) {
      res.writeHead(302, { Location: `${frontendBase}/#/login?error=missing_code_or_state` });
      res.end();
      return;
    }
    const stateData = verifyOAuthState(state, SECRET);
    if (!stateData) {
      res.writeHead(302, { Location: `${frontendBase}/#/login?error=invalid_or_expired_state` });
      res.end();
      return;
    }

    try {
      const callbackUrl = getGoogleCallbackUrl(req);
      const tokenResponse = await exchangeCodeForTokens({
        code,
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackUrl
      });
      const googleUser = await verifyGoogleIdToken({
        idToken: tokenResponse.id_token,
        clientId: GOOGLE_CLIENT_ID
      });

      let mongo = null;
      if (process.env.MONGODB_URI) {
        try { mongo = await getMongoDb(); } catch {}
      }

      // Check existing user by googleSub
      let user = db.users.find(u => u.googleSub === googleUser.sub);
      if (!user && mongo) {
        user = await mongo.collection('users').findOne({ googleSub: googleUser.sub });
        if (user) db.users.push(user);
      }

      // Safe linking: match by verified email if account exists
      if (!user) {
        let existingByEmail = db.users.find(u => u.email && u.email.toLowerCase() === googleUser.email.toLowerCase());
        if (!existingByEmail && mongo) {
          existingByEmail = await mongo.collection('users').findOne({ email: googleUser.email.toLowerCase() });
          if (existingByEmail) db.users.push(existingByEmail);
        }
        if (existingByEmail) {
          user = existingByEmail;
          user.googleSub = googleUser.sub;
          user.emailVerified = true;
          user.picture = user.picture || googleUser.picture;
          user.updatedAt = new Date().toISOString();
          if (mongo) {
            await mongo.collection('users').updateOne(
              { id: user.id },
              { $set: { googleSub: user.googleSub, emailVerified: true, picture: user.picture, updatedAt: user.updatedAt } }
            );
          }
        }
      }

      let isNewUser = false;
      if (!user) {
        isNewUser = true;
        const uid = crypto.randomBytes(12).toString('base64url');
        user = {
          id: uid,
          googleSub: googleUser.sub,
          email: googleUser.email,
          emailVerified: true,
          name: googleUser.name,
          picture: googleUser.picture,
          profile: null,
          created: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sv: 0
        };
        db.users.push(user);
        if (mongo) {
          try {
            await mongo.collection('users').insertOne(user);
            await mongo.collection('user_settings').insertOne(defaultUserSettings(user.id)).catch(() => {});
            // Create fresh isolated state with ZERO data for the new account
            await mongo.collection('states').insertOne({
              userId: user.id,
              state: {
                unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: 'en',
                theme: 'dark', accent: 'mint', body: 'male', targetW: null,
                bodyweight: [], routines: [], week: {}, dayPlan: {},
                exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
                reminder: { on: false, time: '08:00', tz: null }, effort: null,
                coach: null, favorites: [], restAlertEnabled: true, restAlertTone: 'alarm',
                restAlertVolume: 1.0, restVibrationEnabled: true, restNotifications: false,
                nutritionTargets: { calorie: 1900, calories: 1900, protein: 140, carb: 220, carbs: 220, fat: 65, fibre: 30, diet: 'all', waterGoal: 2.5 },
                meals: [], workoutTemplates: [], cardioLogs: [],
                bgTheme: 'warm-gold', goldShade: '#E8B477', bronzeShade: '#C58A53',
                bgDarkness: '#090909', ambientGlow: true, glowIntensity: 1.0, blurIntensity: 1.0,
                glassOpacity: 0.80, bgAnimation: true, _ts: Date.now()
              },
              updatedAt: new Date().toISOString()
            });
          } catch (err) {
            console.error('Mongo insert user error:', err.message);
          }
        }
      } else {
        user.picture = googleUser.picture || user.picture;
        user.name = user.name || googleUser.name;
        user.updatedAt = new Date().toISOString();
        if (mongo) {
          try {
            await mongo.collection('users').updateOne(
              { id: user.id },
              { $set: { picture: user.picture, updatedAt: user.updatedAt } }
            );
          } catch {}
        }
      }
      saveDb();

      const session = makeSession(user);
      const cookie = sessionCookie(user, req);
      const needsProfile = !user.profile || !user.profile.completed;
      const targetPath = needsProfile ? '/profile-setup' : (stateData.returnUrl || '/home');
      const redirectUrl = `${frontendBase}/#/auth-callback?token=${encodeURIComponent(session)}&target=${encodeURIComponent(targetPath)}&isNew=${needsProfile ? '1' : '0'}`;

      res.writeHead(302, {
        'Location': redirectUrl,
        'Set-Cookie': cookie
      });
      res.end();
    } catch (err) {
      console.error('Google OAuth callback error:', err.message);
      res.writeHead(302, { Location: `${frontendBase}/#/login?error=${encodeURIComponent(err.message)}` });
      res.end();
    }
  },

  /* ---------- Personal Fitness Profile ---------- */
  'GET /api/profile': async (req, res) => {
    const start = Date.now();
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const age = user.profile?.dateOfBirth ? calculateAge(user.profile.dateOfBirth) : null;
    const profile = user.profile ? { ...user.profile, age } : null;
    const settings = await getUserSettings(user.id);
    const duration = Date.now() - start;
    res.setHeader('Server-Timing', `db;dur=${duration};desc="Profile Read"`);
    json(res, 200, {
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email || null,
        picture: user.picture || null,
        googleSub: user.googleSub || null,
        profile,
        settings,
        isNewUser: !user.profile || !user.profile.completed,
        admin: isAdmin(user)
      }
    });
  },

  'PUT /api/profile': async (req, res) => {
    const startTime = Date.now();
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const { valid, profile, calculatedAge, error } = validateProfileData(body);
    if (!valid) return json(res, 400, { error });

    user.profile = profile;
    user.name = profile.fullName;
    user.updatedAt = new Date().toISOString();
    saveDb(user);

    // Synchronously update local user state file immediately
    if (profile.currentWeightKg) {
      try {
        const file = stateFile(user.id);
        let localState = {};
        try { localState = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
        localState.bodyweight = localState.bodyweight || [];
        const today = new Date().toISOString().slice(0, 10);
        if (!localState.bodyweight.some(b => b.date === today)) {
          localState.bodyweight.push({ date: today, weight: profile.currentWeightKg });
        }
        if (profile.targetWeightKg) {
          localState.targetW = profile.targetWeightKg;
        }
        localState._ts = Date.now();
        atomicWrite(file, JSON.stringify(localState));
      } catch {}
    }

    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          const updatePromises = [
            mongo.collection('users').updateOne(
              { id: user.id },
              { $set: { profile: user.profile, name: user.name, updatedAt: user.updatedAt } },
              { upsert: true }
            )
          ];

          // Update initial bodyweight & target weight in user's state in Mongo
          if (profile.currentWeightKg) {
            updatePromises.push((async () => {
              const stateDoc = await mongo.collection('states').findOne({ userId: user.id });
              const existingState = stateDoc?.state || {
                unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: 'en',
                theme: 'dark', accent: 'mint', body: 'male', targetW: null,
                bodyweight: [], routines: [], week: {}, dayPlan: {},
                exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
                reminder: { on: false, time: '08:00', tz: null }, effort: null,
                coach: null, favorites: [], restAlertEnabled: true, restAlertTone: 'alarm',
                restAlertVolume: 1.0, restVibrationEnabled: true, restNotifications: false,
                nutritionTargets: { calorie: 1900, calories: 1900, protein: 140, carb: 220, carbs: 220, fat: 65, fibre: 30, diet: 'all', waterGoal: 2.5 },
                meals: [], workoutTemplates: [], cardioLogs: []
              };
              existingState.bodyweight = existingState.bodyweight || [];
              const today = new Date().toISOString().slice(0, 10);
              if (!existingState.bodyweight.some(b => b.date === today)) {
                existingState.bodyweight.push({ date: today, weight: profile.currentWeightKg });
              }
              if (profile.targetWeightKg) {
                existingState.targetW = profile.targetWeightKg;
              }
              existingState._ts = Date.now();
              await mongo.collection('states').updateOne(
                { userId: user.id },
                { $set: { userId: user.id, state: existingState, updatedAt: new Date().toISOString() } },
                { upsert: true }
              );
            })());
          }

          // Race mongo updates with a 3500ms timeout guard so the response returns well before frontend timeout
          const mongoTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Mongo update timeout')), 3500));
          await Promise.race([Promise.all(updatePromises), mongoTimeout]);
        }
      } catch (err) {
        console.error('Mongo profile update error:', err.message);
      }
    }

    const duration = Date.now() - startTime;
    res.setHeader('Server-Timing', `db;dur=${duration};desc="Profile Save"`);
    json(res, 200, {
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email || null,
        picture: user.picture || null,
        googleSub: user.googleSub || null,
        profile: { ...profile, age: calculatedAge },
        isNewUser: false,
        admin: isAdmin(user)
      }
    });
  },

  'POST /api/profile': (req, res) => routes['PUT /api/profile'](req, res),

  /* ---------- Guest Progress Import ---------- */
  'POST /api/auth/import-guest': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    if (!body.guestState || typeof body.guestState !== 'object') {
      return json(res, 400, { error: 'guestState required' });
    }

    let cloudState = null;
    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          const doc = await mongo.collection('states').findOne({ userId: user.id });
          cloudState = doc?.state || null;
        }
      } catch {}
    }
    if (!cloudState) {
      try {
        cloudState = JSON.parse(fs.readFileSync(stateFile(user.id), 'utf8'));
      } catch {
        cloudState = {};
      }
    }

    const { mergedState, counts } = mergeGuestState(cloudState, body.guestState);
    try { atomicWrite(stateFile(user.id), JSON.stringify(mergedState)); } catch {}

    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          await mongo.collection('states').updateOne(
            { userId: user.id },
            { $set: { userId: user.id, state: mergedState, updatedAt: new Date().toISOString() } },
            { upsert: true }
          );
        }
      } catch (err) {
        console.error('Mongo guest import write error:', err.message);
      }
    }

    json(res, 200, { ok: true, state: mergedState, counts });
  },

  'POST /api/register/options': async (req, res) => {
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name) return json(res, 400, { error: 'name required' });
    const code = String(body.code || '').trim().toUpperCase();
    if (INVITE_ONLY && !db.invites.some(i => i.code === code && !i.usedBy && !i.revoked))
      return json(res, 403, { error: 'a valid invite code is required' });
    const uid = crypto.randomBytes(12).toString('base64url');
    const rpId = getRpId(req);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: rpId,
      userID: Buffer.from(uid), userName: name, userDisplayName: name,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      excludeCredentials: []
    });
    const cid = putChallenge({ challenge: options.challenge, name, uid, code });
    json(res, 200, { cid, options });
  },

  'POST /api/register/verify': async (req, res) => {
    const body = await readBody(req);
    const c = takeChallenge(body.cid);
    if (!c || !c.uid) return json(res, 400, { error: 'challenge expired — try again' });
    const rpId = getRpId(req);
    const origin = getOrigin(req);
    const expectedOrigins = Array.from(new Set([origin, ORIGIN, ...ORIGINS]));
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.credential,
        expectedChallenge: c.challenge,
        expectedOrigin: expectedOrigins,
        expectedRPID: rpId,
        requireUserVerification: false
      });
    } catch (e) { return json(res, 400, { error: 'verification failed: ' + e.message }); }
    if (!verification.verified) return json(res, 400, { error: 'not verified' });
    const { credential } = verification.registrationInfo;
    if (db.creds.find(x => x.id === credential.id)) return json(res, 409, { error: 'credential already registered' });
    // Re-check the invite at the last moment (it may have been used/revoked since options), then burn it.
    let invite = null;
    if (INVITE_ONLY) {
      invite = db.invites.find(i => i.code === c.code && !i.usedBy && !i.revoked);
      if (!invite) return json(res, 403, { error: 'invite code is no longer valid — ask for a new one' });
    }
    const user = { id: c.uid, name: c.name, created: new Date().toISOString() };
    if (invite) { user.invitedBy = invite.code; invite.usedBy = user.id; invite.usedAt = user.created; }
    db.users.push(user);
    db.creds.push({
      id: credential.id, userId: user.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter || 0,
      transports: body.credential?.response?.transports || []
    });
    saveDb();
    json(res, 200, { user: { id: user.id, name: user.name, admin: isAdmin(user) } }, { 'Set-Cookie': sessionCookie(user, req) });
  },

  'POST /api/login/options': async (req, res) => {
    const rpId = getRpId(req);
    const options = await generateAuthenticationOptions({
      rpID: rpId, userVerification: 'preferred', allowCredentials: []
    });
    const cid = putChallenge({ challenge: options.challenge });
    json(res, 200, { cid, options });
  },

  'POST /api/login/verify': async (req, res) => {
    const body = await readBody(req);
    const c = takeChallenge(body.cid);
    if (!c) return json(res, 400, { error: 'challenge expired — try again' });
    let cred = db.creds.find(x => x.id === body.credential?.id);
    if (!cred && process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          const foundCred = await mongo.collection('credentials').findOne({ id: body.credential?.id });
          if (foundCred) {
            db.creds.push(foundCred);
            cred = foundCred;
          }
        }
      } catch (err) {
        console.error('Mongo direct credential lookup error:', err.message);
      }
    }
    if (!cred) return json(res, 404, { error: 'unknown passkey — create a profile first' });
    const rpId = getRpId(req);
    const origin = getOrigin(req);
    const expectedOrigins = Array.from(new Set([origin, ORIGIN, ...ORIGINS]));
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.credential,
        expectedChallenge: c.challenge,
        expectedOrigin: expectedOrigins,
        expectedRPID: rpId,
        requireUserVerification: false,
        credential: {
          id: cred.id,
          publicKey: b64uToBuf(cred.publicKey),
          counter: cred.counter,
          transports: cred.transports
        }
      });
    } catch (e) { return json(res, 400, { error: 'verification failed: ' + e.message }); }
    if (!verification.verified) return json(res, 400, { error: 'not verified' });
    cred.counter = verification.authenticationInfo.newCounter;
    saveDb();
    let user = db.users.find(u => u.id === cred.userId);
    if (!user && process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          const foundUser = await mongo.collection('users').findOne({ id: cred.userId });
          if (foundUser) {
            db.users.push(foundUser);
            user = foundUser;
          }
        }
      } catch (err) {
        console.error('Mongo direct user lookup error:', err.message);
      }
    }
    if (!user) return json(res, 500, { error: 'user missing' });
    if (user.disabled) return json(res, 403, { error: 'this account has been disabled' });
    json(res, 200, { user: { id: user.id, name: user.name, admin: isAdmin(user) } }, { 'Set-Cookie': sessionCookie(user, req) });
  },

  'POST /api/logout': async (req, res) => json(res, 200, { ok: true }, { 'Set-Cookie': getClearCookie(req) }),

  // "Sign out everywhere" — bumps this user's session version, which invalidates every cookie
  // ever issued for the account, on every device, including a copy someone else walked off with.
  // The caller's own cookie is cleared here too, so the browser doing it doesn't sit on a token
  // it no longer accepts. Passkeys are untouched: signing back in works immediately.
  'POST /api/logout/all': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    user.sv = sessionVersion(user) + 1;
    saveDb();
    json(res, 200, { ok: true }, { 'Set-Cookie': getClearCookie(req) });
  },

  'GET /api/data': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    let state = null;
    const settings = await getUserSettings(user.id);

    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          const doc = await mongo.collection('states').findOne({ userId: user.id });
          if (doc?.state) {
            state = doc.state;
          }

          // Hydrate workoutTemplates from scoped collections only if NOT reset
          if (state && !state.isReset && (!state.workoutTemplates || !state.workoutTemplates.length)) {
            const tplDoc = await mongo.collection('workout_templates').findOne({ userId: user.id });
            if (tplDoc?.templates && tplDoc.templates.length) {
              state.workoutTemplates = tplDoc.templates;
            } else {
              const userTpls = await mongo.collection('user_templates').find({ userId: user.id }).toArray();
              if (userTpls && userTpls.length) {
                state.workoutTemplates = userTpls;
              }
            }
          }

          // Hydrate weeklySchedule if missing or empty and not reset
          if (state && !state.isReset && (!state.weeklySchedule || !Object.keys(state.weeklySchedule).length)) {
            const schedDoc = await mongo.collection('weekly_schedules').findOne({ userId: user.id });
            if (schedDoc?.schedule) {
              state.weeklySchedule = schedDoc.schedule;
            }
          }

          // Hydrate meals if missing or empty and not reset
          if (state && !state.isReset && (!state.meals || !state.meals.length)) {
            const mList = await mongo.collection('meal_logs').find({ user_id: user.id }).toArray();
            if (mList && mList.length) {
              state.meals = mList.map(m => ({
                id: m.id || m._id?.toString(),
                d: m.date || m.d,
                date: m.date || m.d,
                type: m.meal_type || m.type || 'lunch',
                meal_type: m.meal_type || m.type || 'lunch',
                name: m.food_name || m.name,
                food_name: m.food_name || m.name,
                qty: m.serving_quantity || m.qty || 1,
                serving_quantity: m.serving_quantity || m.qty || 1,
                unit: m.serving_unit || m.unit || 'g',
                serving_unit: m.serving_unit || m.unit || 'g',
                energy_kcal: m.energy_kcal != null ? m.energy_kcal : (m.calories != null ? m.calories : 0),
                calories: m.energy_kcal != null ? m.energy_kcal : (m.calories != null ? m.calories : 0),
                protein_g: m.protein_g != null ? m.protein_g : (m.protein != null ? m.protein : 0),
                protein: m.protein_g != null ? m.protein_g : (m.protein != null ? m.protein : 0),
                carb_g: m.carb_g != null ? m.carb_g : (m.carb != null ? m.carb : (m.carbs != null ? m.carbs : 0)),
                carb: m.carb_g != null ? m.carb_g : (m.carb != null ? m.carb : (m.carbs != null ? m.carbs : 0)),
                fat_g: m.fat_g != null ? m.fat_g : (m.fat != null ? m.fat : 0),
                fat: m.fat_g != null ? m.fat_g : (m.fat != null ? m.fat : 0),
                notes: m.notes || null,
                created_at: m.created_at || m.createdAt
              }));
            }
          }

          // Hydrate cardioLogs if missing or empty and not reset
          if (state && !state.isReset && (!state.cardioLogs || !state.cardioLogs.length)) {
            const cList = await mongo.collection('cardio_logs').find({ $or: [{ userId: user.id }, { user_id: user.id }] }).toArray();
            if (cList && cList.length) {
              state.cardioLogs = cList.map(c => ({
                id: c.id || c._id?.toString(),
                d: c.d || c.date,
                date: c.d || c.date,
                activity: c.activity || c.activity_type || 'Walking',
                activity_type: c.activity || c.activity_type || 'Walking',
                durationMinutes: c.durationMinutes != null ? c.durationMinutes : (c.duration_min != null ? c.duration_min : 0),
                totalDurationMinutes: c.totalDurationMinutes != null ? c.totalDurationMinutes : (c.duration_min != null ? c.duration_min : 0),
                distanceKm: c.distanceKm != null ? c.distanceKm : (c.distance_km != null ? c.distance_km : null),
                distance_km: c.distance_km != null ? c.distance_km : (c.distanceKm != null ? c.distanceKm : null),
                steps: c.steps != null ? c.steps : null,
                calories_burned: c.calories_burned != null ? c.calories_burned : null,
                createdAt: c.createdAt || c.created_at
              }));
            }
          }

          // Hydrate workouts if missing or empty and not reset
          if (state && !state.isReset && (!state.workouts || !state.workouts.length)) {
            const wList = await mongo.collection('workout_sessions').find({ userId: user.id }).toArray();
            if (wList && wList.length) {
              state.workouts = wList;
            }
          }

          if (state) {
            // Hydrate canonical nutritionTargets
            try {
              const canonical = getCanonicalUserNutritionGoals(user.id);
              if (canonical && canonical.calorie_target) {
                state.nutritionTargets = {
                  ...(state.nutritionTargets || {}),
                  calorie: canonical.calorie_target,
                  calories: canonical.calorie_target,
                  protein: canonical.protein_target || state.nutritionTargets?.protein || 140,
                  carb: canonical.carb_target || state.nutritionTargets?.carb || 220,
                  carbs: canonical.carb_target || state.nutritionTargets?.carbs || 220,
                  fat: canonical.fat_target || state.nutritionTargets?.fat || 60,
                  fibre: canonical.fibre_target || state.nutritionTargets?.fibre || 28
                };
              }
            } catch (e) {}

            // Apply account-isolated settings
            state.themePreset = settings.themePreset || state.themePreset || 'warm-gold';
            state.bgTheme = settings.themePreset || state.bgTheme || 'warm-gold';
            state.accent = settings.accentColor || state.accent || '#E8B477';
            state.goldShade = settings.accentColor || state.goldShade || '#E8B477';
            state.ambientGlowIntensity = settings.ambientGlowIntensity != null ? settings.ambientGlowIntensity : 1.0;
            state.upperGlowIntensity = settings.upperGlowIntensity != null ? settings.upperGlowIntensity : 1.0;
            state.userSettings = settings;
            return json(res, 200, { state });
          }
        }
      } catch (err) {
        console.error('Mongo read state error:', err.message);
      }
    }
    try {
      state = JSON.parse(fs.readFileSync(stateFile(user.id), 'utf8'));
      if (state) {
        state.themePreset = settings.themePreset || state.themePreset || 'warm-gold';
        state.bgTheme = settings.themePreset || state.bgTheme || 'warm-gold';
        state.accent = settings.accentColor || state.accent || '#E8B477';
        state.goldShade = settings.accentColor || state.goldShade || '#E8B477';
        state.ambientGlowIntensity = settings.ambientGlowIntensity != null ? settings.ambientGlowIntensity : 1.0;
        state.upperGlowIntensity = settings.upperGlowIntensity != null ? settings.upperGlowIntensity : 1.0;
        state.userSettings = settings;
      }
      json(res, 200, { state });
    } catch { json(res, 200, { state: null }); }
  },

  'PUT /api/data': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    if (!body.state || typeof body.state !== 'object') return json(res, 400, { error: 'state required' });
    delete body.state.active;              // in-progress workouts stay device-local

    // Sync appearance/settings updates into user_settings
    const settingsUpdates = {};
    if (body.state.themePreset || body.state.bgTheme) {
      settingsUpdates.themePreset = body.state.themePreset || body.state.bgTheme;
    }
    if (body.state.accent || body.state.goldShade) {
      settingsUpdates.accentColor = body.state.accent || body.state.goldShade;
    }
    if (body.state.ambientGlowIntensity != null || body.state.glowIntensity != null) {
      settingsUpdates.ambientGlowIntensity = body.state.ambientGlowIntensity != null ? body.state.ambientGlowIntensity : body.state.glowIntensity;
    }
    if (body.state.upperGlowIntensity != null) {
      settingsUpdates.upperGlowIntensity = body.state.upperGlowIntensity;
    }
    if (body.state.bgDarkness || body.state.glassOpacity != null || body.state.blurIntensity != null || body.state.bgAnimation != null) {
      settingsUpdates.backgroundSettings = {
        bgDarkness: body.state.bgDarkness || '#090909',
        bgAnimation: body.state.bgAnimation !== false,
        glassOpacity: body.state.glassOpacity !== undefined ? body.state.glassOpacity : 0.80,
        blurIntensity: body.state.blurIntensity !== undefined ? body.state.blurIntensity : 1.0
      };
    }
    if (body.state.unit) settingsUpdates.measurementUnit = body.state.unit;
    if (Object.keys(settingsUpdates).length > 0) {
      saveUserSettings(user.id, settingsUpdates).catch(() => {});
    }

    try { atomicWrite(stateFile(user.id), JSON.stringify(body.state)); } catch {}
    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          await mongo.collection('states').updateOne(
            { userId: user.id },
            { $set: { userId: user.id, state: body.state, updatedAt: new Date().toISOString() } },
            { upsert: true }
          );

          // Scoped MongoDB collections for workout templates, sessions, and cardio logs
          if (body.state.workoutTemplates !== undefined) {
            await mongo.collection('workout_templates').updateOne(
              { userId: user.id },
              { $set: { userId: user.id, templates: body.state.workoutTemplates, updatedAt: new Date().toISOString() } },
              { upsert: true }
            ).catch(() => {});

            const tpls = Array.isArray(body.state.workoutTemplates)
              ? body.state.workoutTemplates
              : (body.state.workoutTemplates && typeof body.state.workoutTemplates === 'object'
                  ? Object.values(body.state.workoutTemplates)
                  : []);
            if (tpls.length > 0) {
              const tplOps = tpls.map(t => ({
                updateOne: {
                  filter: { userId: user.id, id: t.id },
                  update: { $set: { ...t, userId: user.id, updatedAt: new Date().toISOString() } },
                  upsert: true
                }
              }));
              await mongo.collection('user_templates').bulkWrite(tplOps, { ordered: false }).catch(() => {});
            } else {
              await mongo.collection('user_templates').deleteMany({ userId: user.id }).catch(() => {});
            }
          }

          if (body.state.weeklySchedule !== undefined) {
            await mongo.collection('weekly_schedules').updateOne(
              { userId: user.id },
              { $set: { userId: user.id, schedule: body.state.weeklySchedule, updatedAt: new Date().toISOString() } },
              { upsert: true }
            ).catch(() => {});
          }

          if (body.state.customEx !== undefined) {
            if (Array.isArray(body.state.customEx) && body.state.customEx.length > 0) {
              const customOps = body.state.customEx.map(ex => ({
                updateOne: {
                  filter: { userId: user.id, id: ex.id },
                  update: { $set: { ...ex, userId: user.id, updatedAt: new Date().toISOString() } },
                  upsert: true
                }
              }));
              await mongo.collection('custom_exercises').bulkWrite(customOps, { ordered: false }).catch(() => {});
            } else {
              await mongo.collection('custom_exercises').deleteMany({ userId: user.id }).catch(() => {});
            }
          }

          if (body.state.cardioLogs !== undefined) {
            if (Array.isArray(body.state.cardioLogs) && body.state.cardioLogs.length > 0) {
              const cardioOps = body.state.cardioLogs.map(c => ({
                updateOne: {
                  filter: { userId: user.id, id: c.id },
                  update: { $set: { ...c, userId: user.id, updatedAt: new Date().toISOString() } },
                  upsert: true
                }
              }));
              if (cardioOps.length > 0) {
                await mongo.collection('cardio_logs').bulkWrite(cardioOps, { ordered: false }).catch(() => {});
              }
            } else {
              await mongo.collection('cardio_logs').deleteMany({ $or: [{ userId: user.id }, { user_id: user.id }] }).catch(() => {});
            }
          }

          if (body.state.workouts !== undefined) {
            if (Array.isArray(body.state.workouts) && body.state.workouts.length > 0) {
              const workoutOps = body.state.workouts.map(w => ({
                updateOne: {
                  filter: { userId: user.id, id: w.id },
                  update: { $set: { ...w, userId: user.id, updatedAt: new Date().toISOString() } },
                  upsert: true
                }
              }));
              if (workoutOps.length > 0) {
                await mongo.collection('workout_sessions').bulkWrite(workoutOps, { ordered: false }).catch(() => {});
              }

              // Persist muscle training records scoped by userId, workoutSessionId, and workoutDate
              const muscleOps = [];
              body.state.workouts.forEach(w => {
                const wDate = String(w.d || w.date || '').slice(0, 10);
                (w.entries || []).forEach(e => {
                  const doneSets = (e.sets || []).filter(s => s && s.done);
                  if (!doneSets.length) return;
                  const primaryMuscles = Array.isArray(e.primaryMuscles)
                    ? e.primaryMuscles
                    : (e.targetMuscles ? [e.targetMuscles] : (e.muscleGroup ? [e.muscleGroup] : []));
                  const secondaryMuscles = Array.isArray(e.secondaryMuscles) ? e.secondaryMuscles : [];
                  const record = {
                    userId: user.id,
                    workoutSessionId: w.id,
                    workoutDate: wDate,
                    workoutName: w.name || 'Strength Workout',
                    exerciseId: e.id,
                    exerciseName: e.name || e.n || e.id,
                    muscleGroups: {
                      primary: primaryMuscles,
                      secondary: secondaryMuscles
                    },
                    completedSets: doneSets.length,
                    completedReps: doneSets.reduce((sum, s) => sum + (Number(s.r) || 0), 0),
                    sets: doneSets.map(s => ({
                      weight: Number(s.w) || 0,
                      reps: Number(s.r) || 0,
                      done: true
                    })),
                    volumeKg: doneSets.reduce((sum, s) => sum + (Number(s.w) || 0) * (Number(s.r) || 0), 0),
                    updatedAt: new Date().toISOString()
                  };
                  muscleOps.push({
                    updateOne: {
                      filter: { userId: user.id, workoutSessionId: w.id, exerciseId: e.id },
                      update: { $set: record },
                      upsert: true
                    }
                  });
                });
              });

              if (muscleOps.length > 0) {
                await mongo.collection('muscle_history').bulkWrite(muscleOps, { ordered: false }).catch(() => {});
              }
            } else {
              await mongo.collection('workout_sessions').deleteMany({ userId: user.id }).catch(() => {});
              await mongo.collection('muscle_history').deleteMany({ userId: user.id }).catch(() => {});
            }
          }

          if (body.state.meals !== undefined) {
            if (Array.isArray(body.state.meals) && body.state.meals.length > 0) {
              const mealOps = body.state.meals.map(m => {
                const entry = {
                  id: m.id,
                  user_id: user.id,
                  date: m.date || m.d,
                  meal_type: String(m.meal_type || m.type || 'lunch').toLowerCase(),
                  food_id: m.food_id || m.foodId || null,
                  food_name: m.food_name || m.name || 'Food item',
                  serving_quantity: Number(m.serving_quantity || m.qty) || 1,
                  serving_unit: m.serving_unit || m.unit || 'g',
                  serving_grams: Number(m.serving_grams || m.grams) || 0,
                  energy_kcal: Number(m.energy_kcal != null ? m.energy_kcal : (m.calories != null ? m.calories : m.calorie)) || 0,
                  protein_g: Number(m.protein_g != null ? m.protein_g : m.protein) || 0,
                  carb_g: Number(m.carb_g != null ? m.carb_g : (m.carb != null ? m.carb : m.carbs)) || 0,
                  fat_g: Number(m.fat_g != null ? m.fat_g : m.fat) || 0,
                  fibre_g: Number(m.fibre_g != null ? m.fibre_g : m.fibre) || 0,
                  notes: m.notes || null,
                  created_at: m.created_at || m.createdAt || new Date().toISOString()
                };
                return {
                  updateOne: {
                    filter: { user_id: user.id, id: entry.id },
                    update: { $set: { ...entry, user_id: user.id, updatedAt: new Date().toISOString() } },
                    upsert: true
                  }
                };
              });
              if (mealOps.length > 0) {
                await mongo.collection('meal_logs').bulkWrite(mealOps, { ordered: false }).catch(() => {});
              }
            } else {
              await mongo.collection('meal_logs').deleteMany({ user_id: user.id }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error('Mongo write state error:', err.message);
      }
    }
    json(res, 200, { ok: true, ts: body.state._ts || null });
  },

  /* ---------- User Settings & Account Isolation ---------- */
  'GET /api/settings': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const settings = await getUserSettings(user.id);
    json(res, 200, { ok: true, settings });
  },

  'PUT /api/settings': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const updates = body?.settings || body || {};
    const settings = await saveUserSettings(user.id, updates);
    json(res, 200, { ok: true, settings });
  },

  /* ---------- Muscle Training History & Recovery Load ---------- */
  'GET /api/muscle-history': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const url = new URL(req.url, 'http://localhost');
    const date = url.searchParams.get('date');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          const filter = { userId: user.id };
          if (date) {
            filter.workoutDate = date;
          } else if (startDate && endDate) {
            filter.workoutDate = { $gte: startDate, $lte: endDate };
          }
          const records = await mongo.collection('muscle_history').find(filter).sort({ workoutDate: -1 }).toArray();
          return json(res, 200, { ok: true, history: records });
        }
      } catch (err) {
        console.error('Mongo read muscle_history error:', err.message);
      }
    }

    // Local file fallback isolated strictly by user.id
    try {
      const state = JSON.parse(fs.readFileSync(stateFile(user.id), 'utf8'));
      const workouts = state.workouts || [];
      const history = [];
      workouts.forEach(w => {
        const wDate = String(w.d || w.date || '').slice(0, 10);
        if (date && wDate !== date) return;
        if (startDate && endDate && (wDate < startDate || wDate > endDate)) return;
        (w.entries || []).forEach(e => {
          const doneSets = (e.sets || []).filter(s => s && s.done);
          if (!doneSets.length) return;
          history.push({
            userId: user.id,
            workoutSessionId: w.id,
            workoutDate: wDate,
            workoutName: w.name || 'Strength Workout',
            exerciseId: e.id,
            exerciseName: e.name || e.n || e.id,
            muscleGroups: {
              primary: e.primaryMuscles || (e.targetMuscles ? [e.targetMuscles] : (e.muscleGroup ? [e.muscleGroup] : [])),
              secondary: e.secondaryMuscles || []
            },
            completedSets: doneSets.length,
            completedReps: doneSets.reduce((sum, s) => sum + (Number(s.r) || 0), 0),
            sets: doneSets.map(s => ({ weight: Number(s.w) || 0, reps: Number(s.r) || 0, done: true })),
            volumeKg: doneSets.reduce((sum, s) => sum + (Number(s.w) || 0) * (Number(s.r) || 0), 0)
          });
        });
      });
      return json(res, 200, { ok: true, history });
    } catch {
      return json(res, 200, { ok: true, history: [] });
    }
  },

  /* ---------- Complete Account & Fitness Reset System ---------- */
  'POST /api/user/reset': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const scope = body.scope === 'everything' ? 'everything' : 'fitness_only';

    // 1. Wipe SQLite nutrition data
    try {
      clearAllNutritionDataForUser(user.id);
    } catch (e) {
      console.error('Error clearing SQLite nutrition data for user:', e.message);
    }

    // 2. Settings handling
    let newSettings = null;
    if (scope === 'everything') {
      newSettings = defaultUserSettings(user.id);
      await saveUserSettings(user.id, newSettings);
    } else {
      newSettings = await getUserSettings(user.id);
    }

    // 3. Clear file-based state
    const cleanState = {
      isReset: true,
      workoutTemplates: [],
      weeklySchedule: {},
      workouts: [],
      cardioLogs: [],
      meals: [],
      customEx: [],
      weightLogs: [],
      bodyweight: [],
      dayPlan: {},
      routines: [],
      week: {},
      _ts: Date.now()
    };
    if (scope === 'fitness_only') {
      cleanState.themePreset = newSettings.themePreset || 'warm-gold';
      cleanState.bgTheme = newSettings.themePreset || 'warm-gold';
      cleanState.accent = newSettings.accentColor || '#E8B477';
      cleanState.goldShade = newSettings.accentColor || '#E8B477';
      cleanState.ambientGlowIntensity = newSettings.ambientGlowIntensity != null ? newSettings.ambientGlowIntensity : 1.0;
      cleanState.upperGlowIntensity = newSettings.upperGlowIntensity != null ? newSettings.upperGlowIntensity : 1.0;
    } else {
      cleanState.themePreset = 'warm-gold';
      cleanState.bgTheme = 'warm-gold';
      cleanState.accent = '#E8B477';
      cleanState.goldShade = '#E8B477';
      cleanState.ambientGlowIntensity = 1.0;
      cleanState.upperGlowIntensity = 1.0;
    }

    try {
      atomicWrite(stateFile(user.id), JSON.stringify(cleanState, null, 2));
    } catch {}

    // 4. Clear MongoDB collections for this user
    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          await Promise.all([
            mongo.collection('states').updateOne(
              { userId: user.id },
              { $set: { userId: user.id, state: cleanState, updatedAt: new Date().toISOString() } },
              { upsert: true }
            ),
            mongo.collection('workout_templates').deleteMany({ userId: user.id }),
            mongo.collection('user_templates').deleteMany({ userId: user.id }),
            mongo.collection('weekly_schedules').deleteMany({ userId: user.id }),
            mongo.collection('workout_sessions').deleteMany({ userId: user.id }),
            mongo.collection('muscle_history').deleteMany({ userId: user.id }),
            mongo.collection('meal_logs').deleteMany({ user_id: user.id }),
            mongo.collection('cardio_logs').deleteMany({ $or: [{ userId: user.id }, { user_id: user.id }] }),
            mongo.collection('custom_exercises').deleteMany({ userId: user.id }),
            mongo.collection('weight_logs').deleteMany({ userId: user.id })
          ]);
        }
      } catch (e) {
        console.error('Mongo reset error:', e.message);
      }
    }

    json(res, 200, {
      ok: true,
      message: scope === 'everything' ? 'All data and settings have been reset.' : 'Fitness data has been reset.',
      scope,
      settings: newSettings,
      state: cleanState
    });
  },

  'GET /api/templates': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          const doc = await mongo.collection('workout_templates').findOne({ userId: user.id });
          if (doc?.templates && doc.templates.length) {
            return json(res, 200, { ok: true, templates: doc.templates });
          }
          const userTpls = await mongo.collection('user_templates').find({ userId: user.id }).toArray();
          if (userTpls && userTpls.length) {
            return json(res, 200, { ok: true, templates: userTpls });
          }
          const stateDoc = await mongo.collection('states').findOne({ userId: user.id });
          if (stateDoc?.state?.workoutTemplates && stateDoc.state.workoutTemplates.length) {
            return json(res, 200, { ok: true, templates: stateDoc.state.workoutTemplates });
          }
        }
      } catch (err) {
        console.error('Mongo get templates error:', err.message);
      }
    }
    try {
      const state = JSON.parse(fs.readFileSync(stateFile(user.id), 'utf8'));
      if (state?.workoutTemplates) {
        return json(res, 200, { ok: true, templates: state.workoutTemplates });
      }
    } catch {}
    json(res, 200, { ok: true, templates: [] });
  },

  'PUT /api/templates': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const templates = Array.isArray(body.templates) ? body.templates : [];
    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          await mongo.collection('workout_templates').updateOne(
            { userId: user.id },
            { $set: { userId: user.id, templates, updatedAt: new Date().toISOString() } },
            { upsert: true }
          );
          await mongo.collection('states').updateOne(
            { userId: user.id },
            { $set: { 'state.workoutTemplates': templates, updatedAt: new Date().toISOString() } }
          );
        }
      } catch (err) {
        console.error('Mongo put templates error:', err.message);
      }
    }
    json(res, 200, { ok: true, templates });
  },

  'GET /api/schedule': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          const doc = await mongo.collection('weekly_schedules').findOne({ userId: user.id });
          return json(res, 200, { schedule: doc?.schedule || {} });
        }
      } catch (err) {
        console.error('Mongo get schedule error:', err.message);
      }
    }
    json(res, 200, { schedule: {} });
  },

  'GET /api/push/public-key': async (req, res) => json(res, 200, { key: vapid.publicKey }),

  'POST /api/push/subscribe': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const sub = body.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return json(res, 400, { error: 'invalid subscription' });
    db.subs = db.subs.filter(s => s.endpoint !== sub.endpoint);
    db.subs.push({ userId: user.id, endpoint: sub.endpoint, keys: sub.keys, created: new Date().toISOString() });
    saveDb();
    json(res, 200, { ok: true });
  },

  'POST /api/push/unsubscribe': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    db.subs = db.subs.filter(s => !(s.userId === user.id && s.endpoint === body.endpoint));
    saveDb();
    json(res, 200, { ok: true });
  },

  'POST /api/push/test': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    await sendPush(user.id, { title: 'IRONX', body: 'Test notification ✅ — this is what alerts look like.', tag: 'test' });
    json(res, 200, { ok: true });
  },

  'POST /api/push/rest-timer': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const sec = Math.max(1, Math.min(3600, Math.round(+body.seconds || 0)));
    if (!sec) return json(res, 400, { error: 'seconds required' });
    scheduleRestTimer(user.id, sec);
    json(res, 200, { ok: true });
  },

  'POST /api/push/rest-timer/cancel': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    cancelRestTimer(user.id);
    json(res, 200, { ok: true });
  },

  // Live-workout heartbeat: client pings while a workout is on screen; { active:false } drops it.
  'POST /api/activity': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    if (body.active) {
      presence.set(user.id, {
        name: String(body.name || '').slice(0, 60),
        exIdx: +body.exIdx || 0, exTotal: +body.exTotal || 0,
        setsDone: +body.setsDone || 0, setsTotal: +body.setsTotal || 0,
        startedAt: +body.startedAt || Date.now(),
        updatedAt: Date.now()
      });
    } else presence.delete(user.id);
    json(res, 200, { ok: true });
  },

  /* ---------- admin dashboard ---------- */
  // One row per user, cheap enough for a personal instance (reads each state file once).
  'GET /api/admin/users': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const users = db.users.map(u => {
      const S = readState(u.id) || {};
      const workouts = S.workouts || [];
      const last = workouts[workouts.length - 1];
      return {
        id: u.id, name: u.name, created: u.created || null,
        disabled: !!u.disabled, admin: isAdmin(u), invitedBy: u.invitedBy || null,
        workouts: workouts.length,
        lastWorkout: last ? last.d : null,
        lastSync: S._ts || null,
        hasPush: db.subs.some(s => s.userId === u.id),
        live: livePresence(u.id)
      };
    });
    json(res, 200, { users, invite_only: INVITE_ONLY, now: Date.now() });
  },

  // Drill-down: full workout history + body-weight log for one user.
  'GET /api/admin/user': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    const u = db.users.find(x => x.id === id);
    if (!u) return json(res, 404, { error: 'no such user' });
    const S = readState(u.id) || {};
    json(res, 200, {
      user: { id: u.id, name: u.name, created: u.created || null, disabled: !!u.disabled, admin: isAdmin(u), invitedBy: u.invitedBy || null },
      unit: S.unit || 'kg',
      lastSync: S._ts || null,
      routines: (S.routines || []).map(r => ({ id: r.id, name: r.name, emoji: r.emoji, count: (r.ex || []).length })),
      bodyweight: S.bodyweight || [],
      workouts: (S.workouts || []).slice().reverse()   // newest first for display
    });
  },

  'POST /api/admin/user/disable': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const body = await readBody(req);
    const u = db.users.find(x => x.id === body.id);
    if (!u) return json(res, 404, { error: 'no such user' });
    if (isAdmin(u)) return json(res, 400, { error: 'cannot disable an admin' });
    u.disabled = !!body.disabled;
    if (u.disabled) presence.delete(u.id);   // drop them off "training now" at once
    saveDb();
    json(res, 200, { ok: true, id: u.id, disabled: u.disabled });
  },

  'GET /api/admin/invites': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    // resolve usedBy uid → name for display
    const invites = db.invites.map(i => ({
      ...i, usedByName: i.usedBy ? (db.users.find(u => u.id === i.usedBy) || {}).name || null : null
    }));
    json(res, 200, { invites, invite_only: INVITE_ONLY });
  },

  'POST /api/admin/invites/new': async (req, res) => {
    const admin = requireAdmin(req, res); if (!admin) return;
    const body = await readBody(req);
    let code;
    // 16 hex chars = 64 bits, up from 8 chars / 32 bits. The app has no rate limiting by design
    // (that's the reverse proxy's job) and /api/register/options tells a caller whether a code is
    // good, so the code itself has to be the thing that isn't worth guessing. Codes already in
    // db.json keep working — validation is an exact string compare, never a length or format check.
    do { code = crypto.randomBytes(8).toString('hex').toUpperCase(); } while (db.invites.some(i => i.code === code));
    const invite = { code, note: String(body.note || '').slice(0, 60), createdBy: admin.id, created: new Date().toISOString() };
    db.invites.push(invite);
    saveDb();
    json(res, 200, { invite });
  },

  'POST /api/admin/invites/revoke': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const body = await readBody(req);
    const inv = db.invites.find(i => i.code === String(body.code || '').toUpperCase());
    if (!inv) return json(res, 404, { error: 'no such code' });
    if (inv.usedBy) return json(res, 400, { error: 'already used — cannot revoke' });
    db.invites = db.invites.filter(i => i.code !== inv.code);
    saveDb();
    json(res, 200, { ok: true });
  },

  
  /* ---------- Nutrition Engine ---------- */
  ...nutritionRoutes({ json, readBody, readSession })
};

/* ---------- Coach: disabled & removed ---------- */

export async function handleRequest(req, res) {
  // Handle CORS
  const reqOrigin = req.headers.origin;
  if (reqOrigin) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://x');
  let pathname = (url.pathname || '/').replace(/\/+$/, '') || '/';
  if (!pathname.startsWith('/api') && routes[req.method + ' /api' + pathname]) {
    pathname = '/api' + pathname;
  }

  // Health check probes, root informational endpoint, and OAuth routes must never be blocked by or fail from background database sync
  const isHealthCheck = pathname === '/' || pathname === '/api/health' || pathname === '/api/health/db' || pathname.startsWith('/api/auth/google');
  if (!isHealthCheck) {
    try {
      const syncTimeout = new Promise(resolve => setTimeout(resolve, 1500));
      await Promise.race([ensureMongoSync(), syncTimeout]);
    } catch (err) {
      console.error('ensureMongoSync non-blocking error:', err.message);
    }
  }

  const key = req.method + ' ' + pathname;
  const handler = routes[key];
  if (!handler) return json(res, 404, { error: 'not found' });
  try { await handler(req, res); }
  catch (e) {
    console.error(key, e);
    if (!res.headersSent) json(res, 500, { error: 'server error', message: e?.message, stack: e?.stack });
  }
}

export default handleRequest;
export { db, makeSession, readSession };

const isRender = !!process.env.RENDER;
const isDirectRun = process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].includes('server.js'));
if ((!isVercel || isRender) && (isDirectRun || isRender)) {
  const server = http.createServer(handleRequest);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`gym-api listening on 0.0.0.0:${PORT} (rpID=${process.env.RP_ID || 'localhost'}, origin=${ORIGIN})`);
  });
}

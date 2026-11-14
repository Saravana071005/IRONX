import crypto from 'node:crypto';

/**
 * Calculates age from Date of Birth string (YYYY-MM-DD).
 * Age is strictly computed dynamically and not stored as an inconsistent standalone value.
 */
export function calculateAge(dobString) {
  if (!dobString || typeof dobString !== 'string') return null;
  const match = dobString.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [_, y, m, d] = match;
  const birthDate = new Date(+y, +m - 1, +d);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Validates and normalizes personal fitness profile input.
 */
export function validateProfileData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Profile data is required' };
  }

  const fullName = String(data.fullName || data.name || '').trim();
  if (!fullName || fullName.length > 80) {
    return { valid: false, error: 'Full name is required (1 to 80 characters)' };
  }

  const dateOfBirth = String(data.dateOfBirth || '').trim();
  const age = calculateAge(dateOfBirth);
  if (age === null || age < 13 || age > 120) {
    return { valid: false, error: 'Valid date of birth required (age must be between 13 and 120)' };
  }

  const sex = String(data.sex || '').toLowerCase().trim();
  if (!['male', 'female', 'other'].includes(sex)) {
    return { valid: false, error: 'Sex must be male, female, or other' };
  }

  const heightCm = Number(data.heightCm);
  if (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 260) {
    return { valid: false, error: 'Height must be between 50 and 260 cm' };
  }

  const currentWeightKg = Number(data.currentWeightKg);
  if (!Number.isFinite(currentWeightKg) || currentWeightKg < 20 || currentWeightKg > 400) {
    return { valid: false, error: 'Current weight must be between 20 and 400 kg' };
  }

  const fitnessGoal = String(data.fitnessGoal || '').trim();
  if (!fitnessGoal) {
    return { valid: false, error: 'Fitness goal is required' };
  }

  // Optional fields
  let targetWeightKg = null;
  if (data.targetWeightKg !== undefined && data.targetWeightKg !== null && data.targetWeightKg !== '') {
    const tw = Number(data.targetWeightKg);
    if (!Number.isFinite(tw) || tw < 20 || tw > 400) {
      return { valid: false, error: 'Target weight must be between 20 and 400 kg' };
    }
    targetWeightKg = Math.round(tw * 10) / 10;
  }

  const activityLevel = String(data.activityLevel || 'moderately_active').trim();
  const fitnessExperience = String(data.fitnessExperience || 'intermediate').trim();

  let preferredWorkoutDays = Array.isArray(data.preferredWorkoutDays)
    ? data.preferredWorkoutDays.map(Number).filter(d => d >= 1 && d <= 7)
    : [1, 2, 3, 4, 5, 6];
  if (!preferredWorkoutDays.length) preferredWorkoutDays = [1, 2, 3, 4, 5, 6];

  const preferences = String(data.preferences || '').trim().slice(0, 500);

  return {
    valid: true,
    profile: {
      fullName,
      dateOfBirth,
      sex,
      heightCm: Math.round(heightCm * 10) / 10,
      currentWeightKg: Math.round(currentWeightKg * 10) / 10,
      targetWeightKg,
      fitnessGoal,
      activityLevel,
      fitnessExperience,
      preferredWorkoutDays,
      preferences,
      completed: true,
      updatedAt: new Date().toISOString()
    },
    calculatedAge: age
  };
}

/**
 * Generates an HMAC-signed CSRF state token for OAuth 2.0 flow.
 */
export function signOAuthState(payload, secret) {
  const json = JSON.stringify({ ...payload, nonce: crypto.randomBytes(12).toString('hex'), exp: Date.now() + 10 * 60 * 1000 });
  const b64 = Buffer.from(json).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(b64).digest('base64url');
  return `${b64}.${mac}`;
}

/**
 * Verifies an HMAC-signed CSRF state token.
 */
export function verifyOAuthState(stateToken, secret) {
  if (!stateToken || typeof stateToken !== 'string') return null;
  const idx = stateToken.lastIndexOf('.');
  if (idx < 0) return null;
  const b64 = stateToken.slice(0, idx);
  const mac = stateToken.slice(idx + 1);
  const expected = crypto.createHmac('sha256', secret).update(b64).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (!payload || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Builds the Google OAuth 2.0 authorization URL.
 */
export function getGoogleAuthUrl({ clientId, callbackUrl, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    access_type: 'online'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges authorization code with Google OAuth token endpoint.
 */
export async function exchangeCodeForTokens({ code, clientId, clientSecret, callbackUrl, fetchFn = globalThis.fetch }) {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: callbackUrl,
    grant_type: 'authorization_code'
  });

  const res = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `HTTP ${res.status} exchanging OAuth code`);
  }
  return data;
}

/**
 * Validates Google ID token and returns authenticated Google user identity.
 */
export async function verifyGoogleIdToken({ idToken, clientId, fetchFn = globalThis.fetch }) {
  if (!idToken) throw new Error('ID token is required');

  // Validate via Google tokeninfo
  const res = await fetchFn(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Invalid Google ID token');
  }

  // Validate audience
  if (data.aud !== clientId) {
    throw new Error(`Google token audience mismatch: expected ${clientId}, got ${data.aud}`);
  }

  // Validate issuer
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(data.iss)) {
    throw new Error(`Invalid Google token issuer: ${data.iss}`);
  }

  // Validate expiration
  const nowSec = Math.floor(Date.now() / 1000);
  if (data.exp && Number(data.exp) < nowSec) {
    throw new Error('Google ID token is expired');
  }

  // Validate verified email
  const isEmailVerified = data.email_verified === true || data.email_verified === 'true';
  if (!isEmailVerified) {
    throw new Error('Google account email is not verified');
  }

  if (!data.sub) {
    throw new Error('Missing Google subject identifier (sub)');
  }

  return {
    sub: data.sub,
    email: data.email.toLowerCase(),
    emailVerified: true,
    name: data.name || data.email.split('@')[0],
    picture: data.picture || null
  };
}

/**
 * Merges temporary guest state into existing authenticated cloud state without duplicating records.
 */
export function mergeGuestState(cloudState = {}, guestState = {}) {
  const merged = JSON.parse(JSON.stringify(cloudState || {}));

  // Ensure arrays exist
  merged.workouts = merged.workouts || [];
  merged.routines = merged.routines || [];
  merged.meals = merged.meals || [];
  merged.bodyweight = merged.bodyweight || [];
  merged.customEx = merged.customEx || [];
  merged.favorites = merged.favorites || [];

  let mergedWorkouts = 0;
  let mergedRoutines = 0;
  let mergedMeals = 0;

  // 1. Workouts: merge by id or date timestamp
  const existingWorkoutKeys = new Set(merged.workouts.map(w => w.id || w.d));
  for (const gw of (guestState.workouts || [])) {
    const key = gw.id || gw.d;
    if (key && !existingWorkoutKeys.has(key)) {
      merged.workouts.push(gw);
      existingWorkoutKeys.add(key);
      mergedWorkouts++;
    }
  }

  // 2. Routines: merge by id or name
  const existingRoutineKeys = new Set(merged.routines.map(r => r.id || r.name));
  for (const gr of (guestState.routines || [])) {
    const key = gr.id || gr.name;
    if (key && !existingRoutineKeys.has(key)) {
      merged.routines.push(gr);
      existingRoutineKeys.add(key);
      mergedRoutines++;
    }
  }

  // 3. Meals: merge by id or timestamp
  const existingMealKeys = new Set(merged.meals.map(m => m.id || `${m.t}_${m.name}`));
  for (const gm of (guestState.meals || [])) {
    const key = gm.id || `${gm.t}_${gm.name}`;
    if (key && !existingMealKeys.has(key)) {
      merged.meals.push(gm);
      existingMealKeys.add(key);
      mergedMeals++;
    }
  }

  // 4. Bodyweight: merge by date (keep cloud if already present on same date)
  const existingBwDates = new Set(merged.bodyweight.map(b => b.d));
  for (const gb of (guestState.bodyweight || [])) {
    if (gb.d && !existingBwDates.has(gb.d)) {
      merged.bodyweight.push(gb);
      existingBwDates.add(gb.d);
    }
  }

  // 5. Custom exercises: merge by id
  const existingCustomIds = new Set(merged.customEx.map(c => c.id));
  for (const gc of (guestState.customEx || [])) {
    if (gc.id && !existingCustomIds.has(gc.id)) {
      merged.customEx.push(gc);
      existingCustomIds.add(gc.id);
    }
  }

  // 6. Favorites
  merged.favorites = Array.from(new Set([...merged.favorites, ...(guestState.favorites || [])]));

  merged._ts = Date.now();

  return {
    mergedState: merged,
    counts: {
      workouts: mergedWorkouts,
      routines: mergedRoutines,
      meals: mergedMeals
    }
  };
}

/**
 * Ensures MongoDB indexes exist for users and states collections.
 */
export async function ensureMongoAuthIndexes(mongoDb) {
  if (!mongoDb) return;
  try {
    const users = mongoDb.collection('users');
    await users.createIndex({ googleSub: 1 }, { unique: true, sparse: true });
    await users.createIndex({ id: 1 }, { unique: true });
    await users.createIndex({ email: 1 });

    const states = mongoDb.collection('states');
    await states.createIndex({ userId: 1 }, { unique: true });
  } catch (err) {
    console.error('Failed to create MongoDB auth indexes:', err.message);
  }
}

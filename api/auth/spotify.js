import crypto from 'node:crypto';

// AES-256-GCM encryption for Spotify credentials at rest
export function getEncryptionKey(secret) {
  const sec = secret || process.env.SECRET || 'opengym-spotify-secret-salt';
  return crypto.hkdfSync('sha256', Buffer.from(sec, 'utf8'), Buffer.alloc(0), Buffer.from('opengym-spotify-v1'), 32);
}

export function encryptSpotifyData(obj, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(secret), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

export function decryptSpotifyData(blob, secret) {
  if (!blob) return null;
  try {
    const buf = Buffer.from(String(blob), 'base64');
    if (buf.length < 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(secret), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

// OAuth State verification with HMAC-SHA256 signature
export function signSpotifyState(payload, secret) {
  const sec = secret || process.env.SECRET || 'opengym-spotify-secret-salt';
  const data = JSON.stringify({ ...payload, exp: Date.now() + 10 * 60000 });
  const b64 = Buffer.from(data, 'utf8').toString('base64url');
  const mac = crypto.createHmac('sha256', sec).update(b64).digest('base64url');
  return `${b64}.${mac}`;
}

export function verifySpotifyState(stateToken, secret) {
  if (!stateToken || typeof stateToken !== 'string') return null;
  const parts = stateToken.split('.');
  if (parts.length !== 2) return null;
  const [b64, mac] = parts;
  const sec = secret || process.env.SECRET || 'opengym-spotify-secret-salt';
  const expectedMac = crypto.createHmac('sha256', sec).update(b64).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac))) return null;
    const data = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (!data || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// Generate Spotify Authorization URL
export function getSpotifyAuthUrl({ clientId, redirectUri, state }) {
  if (!clientId || !redirectUri) {
    throw new Error('Spotify clientId and redirectUri are required');
  }
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
  ];
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state: state || '',
    show_dialog: 'true'
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// Exchange authorization code for Spotify tokens
export async function exchangeSpotifyCode({ code, clientId, clientSecret, redirectUri, fetchFn = fetch }) {
  if (!code || !clientId || !clientSecret || !redirectUri) {
    throw new Error('code, clientId, clientSecret, and redirectUri are required');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  });

  const res = await fetchFn('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: bodyParams.toString()
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Spotify token exchange failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type || 'Bearer',
    expiresIn: data.expires_in,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    scope: data.scope
  };
}

// Refresh expired access token
export async function refreshSpotifyToken({ refreshToken, clientId, clientSecret, fetchFn = fetch }) {
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('refreshToken, clientId, and clientSecret are required');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const res = await fetchFn('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: bodyParams.toString()
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Spotify token refresh failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    scope: data.scope
  };
}

// Ensure access token is valid, refreshing if needed
export async function getValidAccessToken({ tokens, clientId, clientSecret, onTokenRefreshed, fetchFn = fetch }) {
  if (!tokens || !tokens.accessToken) return null;

  // Refresh if within 90 seconds of expiry
  if (tokens.refreshToken && tokens.expiresAt && Date.now() > tokens.expiresAt - 90000) {
    try {
      const refreshed = await refreshSpotifyToken({
        refreshToken: tokens.refreshToken,
        clientId,
        clientSecret,
        fetchFn
      });
      const updatedTokens = {
        ...tokens,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken || tokens.refreshToken,
        expiresAt: refreshed.expiresAt
      };
      if (typeof onTokenRefreshed === 'function') {
        await onTokenRefreshed(updatedTokens);
      }
      return updatedTokens.accessToken;
    } catch {
      return tokens.accessToken;
    }
  }

  return tokens.accessToken;
}

// Fetch current playback state
export async function getSpotifyPlaybackState({ accessToken, fetchFn = fetch }) {
  if (!accessToken) {
    return { connected: false, isPlaying: false, activeDevice: null, track: null };
  }

  const res = await fetchFn('https://api.spotify.com/v1/me/player', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (res.status === 204) {
    // Player is idle / no playback active
    return {
      connected: true,
      isPlaying: false,
      activeDevice: null,
      track: null,
      deviceAvailable: false
    };
  }

  if (res.status === 401) {
    return {
      connected: false,
      isPlaying: false,
      error: 'EXPIRED_TOKEN'
    };
  }

  if (!res.ok) {
    return {
      connected: true,
      isPlaying: false,
      activeDevice: null,
      track: null,
      error: `HTTP_${res.status}`
    };
  }

  const data = await res.json();
  const trackName = data.item?.name || null;
  const artists = data.item?.artists?.map(a => a.name).join(', ') || '';
  const fullTrack = trackName ? (artists ? `${trackName} - ${artists}` : trackName) : null;

  return {
    connected: true,
    isPlaying: !!data.is_playing,
    activeDevice: data.device?.name || null,
    deviceId: data.device?.id || null,
    deviceType: data.device?.type || null,
    deviceAvailable: !!data.device,
    track: fullTrack,
    progressMs: data.progress_ms || 0,
    durationMs: data.item?.duration_ms || 0
  };
}

// Pause playback
export async function pauseSpotifyPlayback({ accessToken, fetchFn = fetch }) {
  if (!accessToken) {
    return { ok: false, error: 'NOT_CONNECTED', message: 'Spotify not connected' };
  }

  const res = await fetchFn('https://api.spotify.com/v1/me/player/pause', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (res.status === 204 || res.ok) {
    return { ok: true, paused: true };
  }

  if (res.status === 404) {
    return { ok: false, error: 'NO_ACTIVE_DEVICE', message: 'No active Spotify player found. Start playing in Spotify first.' };
  }

  if (res.status === 403) {
    return { ok: false, error: 'RESTRICTED', message: 'Playback control restricted. Spotify Premium is required.' };
  }

  const text = await res.text().catch(() => '');
  return { ok: false, error: `HTTP_${res.status}`, message: text || 'Failed to pause playback' };
}

// Resume playback
export async function resumeSpotifyPlayback({ accessToken, fetchFn = fetch }) {
  if (!accessToken) {
    return { ok: false, error: 'NOT_CONNECTED', message: 'Spotify not connected' };
  }

  const res = await fetchFn('https://api.spotify.com/v1/me/player/play', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (res.status === 204 || res.ok) {
    return { ok: true, playing: true };
  }

  if (res.status === 404) {
    return { ok: false, error: 'NO_ACTIVE_DEVICE', message: 'No active Spotify player found. Start playing in Spotify first.' };
  }

  if (res.status === 403) {
    return { ok: false, error: 'RESTRICTED', message: 'Playback control restricted. Spotify Premium is required.' };
  }

  const text = await res.text().catch(() => '');
  return { ok: false, error: `HTTP_${res.status}`, message: text || 'Failed to resume playback' };
}

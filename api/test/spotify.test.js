import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptSpotifyData,
  decryptSpotifyData,
  signSpotifyState,
  verifySpotifyState,
  getSpotifyAuthUrl,
  exchangeSpotifyCode,
  refreshSpotifyToken,
  getValidAccessToken,
  getSpotifyPlaybackState,
  pauseSpotifyPlayback,
  resumeSpotifyPlayback
} from '../auth/spotify.js';

test('encryptSpotifyData and decryptSpotifyData round-trip successfully', () => {
  const secret = 'super-secret-test-key-32-chars!!';
  const original = {
    accessToken: 'test-access-token-123',
    refreshToken: 'test-refresh-token-456',
    expiresAt: Date.now() + 3600000
  };

  const encrypted = encryptSpotifyData(original, secret);
  assert.equal(typeof encrypted, 'string');
  assert.notEqual(encrypted, JSON.stringify(original));

  const decrypted = decryptSpotifyData(encrypted, secret);
  assert.deepEqual(decrypted, original);
});

test('decryptSpotifyData returns null on tampered or invalid payload', () => {
  const secret = 'super-secret-test-key-32-chars!!';
  assert.equal(decryptSpotifyData(null, secret), null);
  assert.equal(decryptSpotifyData('', secret), null);
  assert.equal(decryptSpotifyData('invalid-base64', secret), null);

  const original = { token: 'valid-secret' };
  const encrypted = encryptSpotifyData(original, secret);
  // Decrypting with wrong secret should fail closed (return null)
  const wrongSecretDecrypted = decryptSpotifyData(encrypted, 'wrong-secret-key-that-fails-auth');
  assert.equal(wrongSecretDecrypted, null);
});

test('signSpotifyState and verifySpotifyState validate state correctly', () => {
  const secret = 'test-secret';
  const stateToken = signSpotifyState({ userId: 'user-abc', returnTo: '/workout' }, secret);
  assert.equal(typeof stateToken, 'string');

  const verified = verifySpotifyState(stateToken, secret);
  assert.equal(verified.userId, 'user-abc');
  assert.equal(verified.returnTo, '/workout');

  // Verify failure on tampered state
  assert.equal(verifySpotifyState(stateToken + 'tamper', secret), null);
  assert.equal(verifySpotifyState('bad.token', secret), null);
  assert.equal(verifySpotifyState(null, secret), null);
});

test('getSpotifyAuthUrl constructs URL with required Spotify scopes', () => {
  const url = getSpotifyAuthUrl({
    clientId: 'sp-client-id-123',
    redirectUri: 'https://example.com/api/spotify/callback',
    state: 'state-abc'
  });

  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://accounts.spotify.com');
  assert.equal(parsed.pathname, '/authorize');
  assert.equal(parsed.searchParams.get('client_id'), 'sp-client-id-123');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'https://example.com/api/spotify/callback');
  assert.equal(parsed.searchParams.get('state'), 'state-abc');
  assert.match(parsed.searchParams.get('scope'), /user-read-playback-state/);
  assert.match(parsed.searchParams.get('scope'), /user-modify-playback-state/);
});

test('exchangeSpotifyCode exchanges code and parses tokens', async () => {
  const mockFetch = async (url, opts) => {
    assert.equal(url, 'https://accounts.spotify.com/api/token');
    assert.equal(opts.method, 'POST');
    assert.match(opts.headers.Authorization, /^Basic /);
    assert.match(opts.body, /grant_type=authorization_code/);
    assert.match(opts.body, /code=valid-code/);

    return {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'acc-token-123',
        refresh_token: 'ref-token-456',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'user-read-playback-state user-modify-playback-state'
      })
    };
  };

  const tokens = await exchangeSpotifyCode({
    code: 'valid-code',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    redirectUri: 'https://example.com/cb',
    fetchFn: mockFetch
  });

  assert.equal(tokens.accessToken, 'acc-token-123');
  assert.equal(tokens.refreshToken, 'ref-token-456');
  assert.ok(tokens.expiresAt > Date.now());
});

test('getValidAccessToken refreshes token when close to expiration', async () => {
  let refreshed = false;
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      access_token: 'new-acc-token',
      expires_in: 3600
    })
  });

  const expiringTokens = {
    accessToken: 'old-acc-token',
    refreshToken: 'valid-refresh-token',
    expiresAt: Date.now() + 10000 // expires in 10s, threshold is 90s
  };

  const token = await getValidAccessToken({
    tokens: expiringTokens,
    clientId: 'client-id',
    clientSecret: 'client-secret',
    onTokenRefreshed: (updated) => {
      refreshed = true;
      assert.equal(updated.accessToken, 'new-acc-token');
    },
    fetchFn: mockFetch
  });

  assert.equal(token, 'new-acc-token');
  assert.equal(refreshed, true);
});

test('getSpotifyPlaybackState handles active track, idle 204, and expired 401', async () => {
  // 1. Active playback
  const mockPlaying = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      is_playing: true,
      progress_ms: 45000,
      device: { name: 'iPhone 15 Pro', id: 'dev-1', type: 'Smartphone' },
      item: { name: 'Stronger', duration_ms: 312000, artists: [{ name: 'Kanye West' }] }
    })
  });

  const state1 = await getSpotifyPlaybackState({ accessToken: 'valid-tok', fetchFn: mockPlaying });
  assert.equal(state1.connected, true);
  assert.equal(state1.isPlaying, true);
  assert.equal(state1.activeDevice, 'iPhone 15 Pro');
  assert.equal(state1.track, 'Stronger - Kanye West');

  // 2. Idle (204 No Content)
  const mockIdle = async () => ({ ok: true, status: 204 });
  const state2 = await getSpotifyPlaybackState({ accessToken: 'valid-tok', fetchFn: mockIdle });
  assert.equal(state2.connected, true);
  assert.equal(state2.isPlaying, false);
  assert.equal(state2.activeDevice, null);

  // 3. Expired token (401)
  const mockExpired = async () => ({ ok: false, status: 401 });
  const state3 = await getSpotifyPlaybackState({ accessToken: 'expired-tok', fetchFn: mockExpired });
  assert.equal(state3.connected, false);
  assert.equal(state3.error, 'EXPIRED_TOKEN');
});

test('pauseSpotifyPlayback and resumeSpotifyPlayback handle 204 success, 404, and 403', async () => {
  // Success
  const mockSuccess = async () => ({ ok: true, status: 204 });
  const pauseRes = await pauseSpotifyPlayback({ accessToken: 'valid-tok', fetchFn: mockSuccess });
  assert.equal(pauseRes.ok, true);
  assert.equal(pauseRes.paused, true);

  const playRes = await resumeSpotifyPlayback({ accessToken: 'valid-tok', fetchFn: mockSuccess });
  assert.equal(playRes.ok, true);
  assert.equal(playRes.playing, true);

  // 404 No Active Device
  const mockNoDevice = async () => ({ ok: false, status: 404, text: async () => 'Device not found' });
  const pauseNoDev = await pauseSpotifyPlayback({ accessToken: 'valid-tok', fetchFn: mockNoDevice });
  assert.equal(pauseNoDev.ok, false);
  assert.equal(pauseNoDev.error, 'NO_ACTIVE_DEVICE');

  // 403 Restricted (Non-premium or playback restriction)
  const mockRestricted = async () => ({ ok: false, status: 403, text: async () => 'Restricted' });
  const playRestricted = await resumeSpotifyPlayback({ accessToken: 'valid-tok', fetchFn: mockRestricted });
  assert.equal(playRestricted.ok, false);
  assert.equal(playRestricted.error, 'RESTRICTED');
});

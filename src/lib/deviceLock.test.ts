import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDeviceLockAvailable, registerDeviceLock, verifyDeviceLock } from './deviceLock';

describe('deviceLock', () => {
  beforeEach(() => {
    // We start with a clean slate
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isDeviceLockAvailable returns false when PublicKeyCredential is undefined', async () => {
    vi.stubGlobal('PublicKeyCredential', undefined);

    const available = await isDeviceLockAvailable();
    expect(available).toBe(false);
  });

  it('isDeviceLockAvailable returns false when isUserVerifyingPlatformAuthenticatorAvailable is not a function', async () => {
    vi.stubGlobal('PublicKeyCredential', {});

    const available = await isDeviceLockAvailable();
    expect(available).toBe(false);
  });

  it('isDeviceLockAvailable returns false when isUserVerifyingPlatformAuthenticatorAvailable rejects', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.reject(new Error('Test error'))
    });

    const available = await isDeviceLockAvailable();
    expect(available).toBe(false);
  });

  it('isDeviceLockAvailable returns true when isUserVerifyingPlatformAuthenticatorAvailable resolves true', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
    });

    const available = await isDeviceLockAvailable();
    expect(available).toBe(true);
  });

  it('isDeviceLockAvailable returns false when isUserVerifyingPlatformAuthenticatorAvailable resolves false', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(false)
    });

    const available = await isDeviceLockAvailable();
    expect(available).toBe(false);
  });

  it('registerDeviceLock returns null if unavailable', async () => {
    vi.stubGlobal('PublicKeyCredential', undefined);

    const result = await registerDeviceLock();
    expect(result).toBeNull();
  });

  it('registerDeviceLock returns { id: "fake-cred" } on success', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
    });

    // We mock the crypto global since jsdom might not have the webcrypto API fully functional
    // for getRandomValues
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => arr
    });

    // Stub navigator.credentials.create
    const credentialsStub = {
      create: vi.fn().mockResolvedValue({ id: 'fake-cred' }),
      get: vi.fn()
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });

    const result = await registerDeviceLock();
    expect(result).toEqual({ id: 'fake-cred' });
    expect(credentialsStub.create).toHaveBeenCalled();
  });

  it('registerDeviceLock returns null if navigator.credentials.create throws', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
    });

    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => arr
    });

    const credentialsStub = {
      create: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      get: vi.fn()
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });

    const result = await registerDeviceLock();
    expect(result).toBeNull();
  });

  it('verifyDeviceLock returns true on success', async () => {
    const credentialsStub = {
      create: vi.fn(),
      get: vi.fn().mockResolvedValue({ id: 'fake-cred' })
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });
    vi.stubGlobal('atob', (s: string) => s);

    const result = await verifyDeviceLock('fake-cred');
    expect(result).toBe(true);
    expect(credentialsStub.get).toHaveBeenCalled();
  });

  it('verifyDeviceLock returns false and does not throw when navigator.credentials.get rejects with NotAllowedError', async () => {
    const credentialsStub = {
      create: vi.fn(),
      get: vi.fn().mockRejectedValue(new Error('NotAllowedError'))
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });

    // stub atob so it doesn't fail on base64 decoding
    vi.stubGlobal('atob', (s: string) => s);

    const result = await verifyDeviceLock('fake-cred');
    expect(result).toBe(false);
  });

  it('verifyDeviceLock returns false when get resolves to null', async () => {
    const credentialsStub = {
      create: vi.fn(),
      get: vi.fn().mockResolvedValue(null)
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });
    vi.stubGlobal('atob', (s: string) => s);

    const result = await verifyDeviceLock('fake-cred');
    expect(result).toBe(false);
  });

  it('verifyDeviceLock returns false when get returns another id', async () => {
    const credentialsStub = {
      create: vi.fn(),
      get: vi.fn().mockResolvedValue({ id: 'wrong-cred' })
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });
    vi.stubGlobal('atob', (s: string) => s);

    const result = await verifyDeviceLock('fake-cred');
    expect(result).toBe(false);
  });

  it('verifyDeviceLock returns false when credentialId is empty and does not call get', async () => {
    const credentialsStub = {
      create: vi.fn(),
      get: vi.fn()
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });

    const result = await verifyDeviceLock('');
    expect(result).toBe(false);
    expect(credentialsStub.get).not.toHaveBeenCalled();
  });

  it('verifyDeviceLock calls get with decoded credential bytes in allowCredentials', async () => {
    const credentialsStub = {
      create: vi.fn(),
      get: vi.fn().mockResolvedValue({ id: 'fake-cred' })
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });

    // We expect base64urlToUint8Array to map "fake-cred" into a Uint8Array.
    // We mock atob to return a string for "fake-cred" appropriately
    vi.stubGlobal('atob', (s: string) => s);

    await verifyDeviceLock('fake-cred');
    const getCallArgs = credentialsStub.get.mock.calls[0][0];

    expect(getCallArgs.publicKey.allowCredentials).toBeDefined();
    expect(getCallArgs.publicKey.allowCredentials[0].type).toBe('public-key');
    expect(getCallArgs.publicKey.allowCredentials[0].id).toBeInstanceOf(Uint8Array);
  });

  it('registerDeviceLock blocks hostile options from lowering verification requirements', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
    });
    vi.stubGlobal('crypto', { getRandomValues: (arr: Uint8Array) => arr });

    const credentialsStub = {
      create: vi.fn().mockResolvedValue({ id: 'fake-cred' }),
      get: vi.fn()
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });

    const hostileOptions = {
      user: { name: 'ana@x.com' },
      attestation: 'direct',
      authenticatorSelection: {
        authenticatorAttachment: 'cross-platform',
        userVerification: 'discouraged',
        residentKey: 'discouraged'
      }
    };

    const result = await registerDeviceLock(hostileOptions);
    expect(result).toEqual({ id: 'fake-cred' });

    const createCallArgs = credentialsStub.create.mock.calls[0][0];
    expect(createCallArgs.publicKey.authenticatorSelection.authenticatorAttachment).toBe('platform');
    expect(createCallArgs.publicKey.authenticatorSelection.userVerification).toBe('required');
    expect(createCallArgs.publicKey.authenticatorSelection.residentKey).toBe('preferred');
    expect(createCallArgs.publicKey.user.name).toBe('local-user');
    expect(createCallArgs.publicKey.attestation).toBe('none');
  });

  it('verifyDeviceLock always enforces userVerification required', async () => {
    const credentialsStub = {
      create: vi.fn(),
      get: vi.fn().mockResolvedValue({ id: 'fake-cred' })
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });
    vi.stubGlobal('atob', (s: string) => s);

    await verifyDeviceLock('fake-cred');

    const getCallArgs = credentialsStub.get.mock.calls[0][0];
    expect(getCallArgs.publicKey.userVerification).toBe('required');
  });

  it('registerDeviceLock ignores hostile extensions, excludeCredentials, hints, and attestationFormats', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
    });
    vi.stubGlobal('crypto', { getRandomValues: (arr: Uint8Array) => arr });

    const credentialsStub = {
      create: vi.fn().mockResolvedValue({ id: 'fake-cred' }),
      get: vi.fn()
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });

    const hostileOptions = {
      extensions: { prf: {}, credProps: true },
      excludeCredentials: [{ id: 1 }],
      hints: ['hybrid'],
      attestationFormats: ['packed']
    };

    await registerDeviceLock(hostileOptions);

    const createCallArgs = credentialsStub.create.mock.calls[0][0];
    expect('extensions' in createCallArgs.publicKey).toBe(false);
    expect('excludeCredentials' in createCallArgs.publicKey).toBe(false);
    expect('hints' in createCallArgs.publicKey).toBe(false);
    expect('attestationFormats' in createCallArgs.publicKey).toBe(false);
  });

  it('registerDeviceLock blocks hostile authenticatorSelection.requireResidentKey: false', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
    });
    vi.stubGlobal('crypto', { getRandomValues: (arr: Uint8Array) => arr });

    const credentialsStub = {
      create: vi.fn().mockResolvedValue({ id: 'fake-cred' }),
      get: vi.fn()
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });

    const hostileOptions = {
      authenticatorSelection: {
        requireResidentKey: false
      }
    };

    await registerDeviceLock(hostileOptions);

    const createCallArgs = credentialsStub.create.mock.calls[0][0];
    const selection = createCallArgs.publicKey.authenticatorSelection;
    expect(selection).toEqual({
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred'
    });
    expect('requireResidentKey' in selection).toBe(false);
  });

  it('registerDeviceLock honours legitimate knobs like rp.name and timeout', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
    });
    vi.stubGlobal('crypto', { getRandomValues: (arr: Uint8Array) => arr });

    const credentialsStub = {
      create: vi.fn().mockResolvedValue({ id: 'fake-cred' }),
      get: vi.fn()
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });

    const legitimateOptions = {
      rp: { name: 'Mi app' },
      timeout: 30000
    };

    await registerDeviceLock(legitimateOptions);

    const createCallArgs = credentialsStub.create.mock.calls[0][0];
    expect(createCallArgs.publicKey.rp.name).toBe('Mi app');
    expect(createCallArgs.publicKey.timeout).toBe(30000);
  });

  it('registerDeviceLock falls back to defaults for out-of-range or wrong-type values', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
    });
    vi.stubGlobal('crypto', { getRandomValues: (arr: Uint8Array) => arr });

    const credentialsStub = {
      create: vi.fn().mockResolvedValue({ id: 'fake-cred' }),
      get: vi.fn()
    };
    vi.stubGlobal('navigator', { credentials: credentialsStub });

    // case 1: timeout too low
    await registerDeviceLock({ timeout: 1 });
    expect(credentialsStub.create.mock.calls[0][0].publicKey.timeout).toBe(60000);

    // case 2: timeout NaN
    await registerDeviceLock({ timeout: NaN });
    expect(credentialsStub.create.mock.calls[1][0].publicKey.timeout).toBe(60000);

    // case 3: timeout is a string
    await registerDeviceLock({ timeout: '5' });
    expect(credentialsStub.create.mock.calls[2][0].publicKey.timeout).toBe(60000);

    // case 4: rp.name is empty string
    await registerDeviceLock({ rp: { name: '' } });
    expect(credentialsStub.create.mock.calls[3][0].publicKey.rp.name).toBe("PisaStyle Device Protection");

    // case 5: rp.name is too long (65 chars)
    await registerDeviceLock({ rp: { name: 'A'.repeat(65) } });
    expect(credentialsStub.create.mock.calls[4][0].publicKey.rp.name).toBe("PisaStyle Device Protection");
  });
});

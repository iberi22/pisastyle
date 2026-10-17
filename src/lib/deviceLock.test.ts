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

    const result = await verifyDeviceLock('fake-cred');
    expect(result).toBe(false);
  });
});

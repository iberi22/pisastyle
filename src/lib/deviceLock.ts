// src/lib/deviceLock.ts
// deviceLock.ts — PisaStyle optional device protection with the platform authenticator

// Local types to avoid changing src/env.d.ts
type LocalPublicKeyCredential = {
  isUserVerifyingPlatformAuthenticatorAvailable: () => Promise<boolean>;
};

export async function isDeviceLockAvailable(): Promise<boolean> {
  try {
    if (typeof globalThis.PublicKeyCredential === 'undefined') {
      return false;
    }
    const pkc = globalThis.PublicKeyCredential as unknown as LocalPublicKeyCredential;
    if (typeof pkc.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false;
    }
    const isAvailable = await pkc.isUserVerifyingPlatformAuthenticatorAvailable();
    return !!isAvailable;
  } catch (e) {
    return false;
  }
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - base64url.length % 4) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = typeof globalThis.atob === 'function' ? globalThis.atob(base64) : '';
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerDeviceLock(options?: any): Promise<{ id: string } | null> {
  try {
    const isAvailable = await isDeviceLockAvailable();
    if (!isAvailable) {
      return null;
    }

    // We only need a dummy user id since we don't store accounts
    const dummyUserId = new Uint8Array(16);
    crypto.getRandomValues(dummyUserId);

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const cred = await navigator.credentials.create({
      publicKey: {
        ...(options || {}),
        challenge,
        rp: {
          ...(options?.rp || {}),
          name: options?.rp?.name || "PisaStyle Device Protection",
          id: globalThis.location?.hostname || "localhost"
        },
        user: {
          id: dummyUserId,
          name: "local-user",
          displayName: "Local User"
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 } // RS256
        ],
        timeout: options?.timeout || 60000,
        attestation: "none",
        authenticatorSelection: {
          ...(options?.authenticatorSelection || {}),
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred"
        }
      } as any
    }) as any;

    if (cred && cred.id) {
      return { id: cred.id };
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function verifyDeviceLock(credentialId: string): Promise<boolean> {
  try {
    if (!credentialId) {
      return false;
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const allowCredentials = [{
      type: 'public-key',
      id: base64urlToUint8Array(credentialId)
    }];

    const cred = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        allowCredentials,
        userVerification: "required"
      } as any
    }) as any;

    if (cred && cred.id) {
      if (cred.id !== credentialId) {
        return false;
      }
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

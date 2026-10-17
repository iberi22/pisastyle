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
        challenge,
        rp: {
          name: "PisaStyle Device Protection",
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
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred"
        },
        timeout: 60000,
        attestation: "none",
        ...options
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
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const cred = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required",
        // we allow any credential returned by the platform, but this forces the
        // prompt if passkeys are available
      } as any
    }) as any;

    if (cred && cred.id) {
      // In a real app we might verify the challenge and credentialId
      // Here we just care that the user passed the platform verification
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

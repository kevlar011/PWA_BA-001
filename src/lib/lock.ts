/**
 * The app lock.
 *
 * Two ways in, both resolving to the same thing:
 *   · the passphrase you already use for sync, one secret, not two
 *   · a platform passkey, which is Face ID on the iPhone and Windows Hello
 *     on the PC, with no extra setup beyond enrolling once
 *
 * The passkey is a convenience gate, not a second encryption layer. The data
 * on this device is protected by the device itself; this stops someone who
 * opens the app from reading your ledger.
 */

import { fingerprint } from './crypto';

const CRED_KEY = 'kevlar-passkey-id';

const b64url = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromB64url = (s: string): ArrayBuffer => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

function available(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials &&
    typeof PublicKeyCredential !== 'undefined'
  );
}

/** Whether this device can offer Face ID / Hello at all. */
export async function biometricsSupported(): Promise<boolean> {
  if (!available()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export const hasPasskey = (): boolean =>
  typeof localStorage !== 'undefined' && !!localStorage.getItem(CRED_KEY);

/**
 * Enrols a platform passkey. The credential never leaves the device and is
 * bound to this origin, so it cannot be replayed anywhere else.
 */
export async function enrolPasskey(name: string): Promise<{ ok: boolean; error?: string }> {
  if (!available()) return { ok: false, error: 'This browser has no passkey support.' };

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32)));
    const userId = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));

    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'KEVLAR' },
        user: { id: userId, name: name || 'kevlar', displayName: name || 'KEVLAR' },
        // ES256 then RS256, between them every platform authenticator is covered.
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;

    if (!cred) return { ok: false, error: 'Enrolment was cancelled.' };
    localStorage.setItem(CRED_KEY, b64url(cred.rawId));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not enrol.' };
  }
}

/** Prompts for Face ID / Hello. Resolves true only on a real verification. */
export async function verifyPasskey(): Promise<boolean> {
  if (!available()) return false;
  const id = localStorage.getItem(CRED_KEY);
  if (!id) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32)));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: 'public-key', id: fromB64url(id) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}

export function forgetPasskey(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(CRED_KEY);
}

/**
 * Checks a typed passphrase against the stored fingerprint.
 *
 * Compares hashes rather than the phrase itself, so the raw value is never
 * needed for the comparison.
 */
export async function checkPassphrase(entered: string, expected?: string): Promise<boolean> {
  if (!expected) return false;
  return (await fingerprint(entered.trim())) === expected;
}

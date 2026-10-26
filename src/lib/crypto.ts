/**
 * Client-side encryption for sync.
 *
 * Your ledger is encrypted on this device before it goes anywhere. The server
 * only ever receives an opaque blob and an identifier it cannot reverse, it
 * has no way to read your figures, and neither does anyone who finds the app.
 *
 * One passphrase does two jobs, derived separately so neither leaks the other:
 *   · the encryption key, via PBKDF2
 *   · the storage id, via a differently-salted hash
 *
 * Everything here uses WebCrypto, which is available in Safari, Chrome and
 * every browser that can install a PWA.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Deliberately slow. The passphrase is the only thing protecting the data. */
const ITERATIONS = 310_000;

/*
 * Fixed salts. A random per-user salt would be better cryptographic practice,
 * but it would have to be stored somewhere both devices can reach *before*
 * they can talk to each other, a chicken-and-egg problem. These are domain
 * separators: they stop the key and the id being derivable from one another.
 */
const KEY_SALT = enc.encode('kevlar/v1/key');
const ID_SALT = enc.encode('kevlar/v1/id');

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error('This browser cannot encrypt. Sync needs a secure context (https).');
  }
  return c.subtle;
}

const toB64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return btoa(out);
};

/** Returns a plain ArrayBuffer, WebCrypto's types reject the SharedArrayBuffer-capable view. */
const fromB64 = (s: string): ArrayBuffer => {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

/** Stretches the passphrase into an AES-GCM key. */
export async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: KEY_SALT, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * The row this device reads and writes. Unguessable without the passphrase,
 * and derived under a different salt so it reveals nothing about the key.
 */
export async function deriveSyncId(passphrase: string): Promise<string> {
  const base = await subtle().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', salt: ID_SALT, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    256
  );
  const bytes = new Uint8Array(bits);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type Sealed = {
  /** Format marker, so a future change can migrate old blobs. */
  v: 1;
  iv: string;
  data: string;
};

/** Encrypts any JSON-serialisable value. */
export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const cipher = await subtle().encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(value))
  );
  return { v: 1, iv: toB64(iv.buffer), data: toB64(cipher) };
}

/**
 * Decrypts a blob. Throws on a wrong passphrase, AES-GCM authenticates, so a
 * bad key fails loudly rather than returning plausible nonsense.
 */
export async function open<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const plain = await subtle().decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv) },
    key,
    fromB64(sealed.data)
  );
  return JSON.parse(dec.decode(plain)) as T;
}

/** Cheap check that a blob looks like something we wrote. */
export function isSealed(x: unknown): x is Sealed {
  const s = x as Sealed;
  return !!s && s.v === 1 && typeof s.iv === 'string' && typeof s.data === 'string';
}

/** Stored so the app can verify a passphrase without a round trip. */
export async function fingerprint(passphrase: string): Promise<string> {
  const bits = await subtle().digest('SHA-256', enc.encode(`kevlar/verify/${passphrase}`));
  return toB64(bits).slice(0, 24);
}

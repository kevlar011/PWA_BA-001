/**
 * Encrypted sync.
 *
 * The device does all the thinking: pull the remote blob, decrypt it, merge it
 * with what is here, encrypt the result, push it back. The server is a dumb
 * shelf that holds one opaque value under one opaque key.
 *
 * Shaped for Supabase's REST endpoint because it is free and needs no code
 * deployed, but the surface is small enough to repoint at anything that can
 * store a JSON blob by id.
 */

import { deriveKey, deriveSyncId, isSealed, open, seal, type Sealed } from './crypto';
import { mergeData, pruneTombstones } from './merge';
import type { KevlarData, Settings } from './types';

export type SyncConfig = { url: string; key: string };

export type SyncResult =
  | { ok: true; merged: KevlarData; pulled: boolean }
  | { ok: false; error: string };

const TABLE = 'kevlar_sync';

function headers(cfg: SyncConfig): Record<string, string> {
  return {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Strips anything device-specific before the blob is sealed.
 *
 * The backend key in particular must never travel: it would be encrypted, but
 * putting a credential inside the payload it authenticates is a bad habit.
 */
function forUpload(data: KevlarData): KevlarData {
  const settings: Settings = { ...data.settings };
  delete settings.syncUrl;
  delete settings.syncKey;
  delete settings.passphraseCheck;
  delete settings.passphrase;
  delete settings.syncedAt;
  delete settings.aiKey;
  return { ...data, settings };
}

/** Fetch with a hard timeout — a hung request should not hang the app. */
async function req(input: string, init: RequestInit, ms = 12_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function pull(cfg: SyncConfig, id: string): Promise<Sealed | null> {
  const res = await req(
    `${cfg.url.replace(/\/$/, '')}/rest/v1/${TABLE}?id=eq.${id}&select=blob`,
    { method: 'GET', headers: headers(cfg) }
  );
  if (!res.ok) throw new Error(`Pull failed (${res.status}). Check the URL and key.`);

  const rows = (await res.json()) as { blob: unknown }[];
  if (!rows.length) return null;

  const blob = rows[0]?.blob;
  if (!isSealed(blob)) throw new Error('Remote data is not in a format KEVLAR wrote.');
  return blob;
}

async function push(cfg: SyncConfig, id: string, blob: Sealed): Promise<void> {
  const res = await req(`${cfg.url.replace(/\/$/, '')}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: { ...headers(cfg), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id, blob, updated_at: new Date().toISOString() }),
  });
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`Push failed (${res.status}).`);
  }
}

/**
 * One full reconciliation.
 *
 * Safe to call repeatedly; it is idempotent when nothing has changed on
 * either side.
 */
export async function syncNow(
  local: KevlarData,
  passphrase: string,
  cfg: SyncConfig
): Promise<SyncResult> {
  if (!cfg.url || !cfg.key) return { ok: false, error: 'Sync is not configured.' };
  if (!passphrase) return { ok: false, error: 'No passphrase set.' };

  try {
    const [key, id] = await Promise.all([deriveKey(passphrase), deriveSyncId(passphrase)]);

    const remoteBlob = await pull(cfg, id);

    let merged = local;
    let pulled = false;

    if (remoteBlob) {
      let remote: KevlarData;
      try {
        remote = await open<KevlarData>(key, remoteBlob);
      } catch {
        // AES-GCM authenticates, so this is a wrong passphrase rather than
        // corruption. Refuse loudly instead of overwriting good remote data.
        return {
          ok: false,
          error: 'That passphrase does not match the data already stored. Nothing was changed.',
        };
      }
      merged = pruneTombstones(mergeData(local, remote));
      pulled = true;
    }

    await push(cfg, id, await seal(key, forUpload(merged)));

    return { ok: true, merged, pulled };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.includes('abort') ? 'Sync timed out.' : msg };
  }
}

/**
 * Downloads the server copy and returns it verbatim, with no merge.
 *
 * For adopting a device: a fresh install has just been through onboarding, so
 * its settings are genuinely the newest and would win a merge — overwriting
 * the ledger you actually care about. This takes the server's word instead.
 */
export async function pullOnly(
  passphrase: string,
  cfg: SyncConfig
): Promise<{ ok: true; data: KevlarData } | { ok: false; error: string }> {
  if (!cfg.url || !cfg.key) return { ok: false, error: 'Sync is not configured.' };
  if (!passphrase) return { ok: false, error: 'No passphrase set.' };

  try {
    const [key, id] = await Promise.all([deriveKey(passphrase), deriveSyncId(passphrase)]);
    const blob = await pull(cfg, id);
    if (!blob) return { ok: false, error: 'There is nothing stored on the server yet.' };

    try {
      return { ok: true, data: await open<KevlarData>(key, blob) };
    } catch {
      return { ok: false, error: 'That passphrase does not match the stored data.' };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Verifies credentials without touching any data. */
export async function testConnection(cfg: SyncConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await req(
      `${cfg.url.replace(/\/$/, '')}/rest/v1/${TABLE}?select=id&limit=1`,
      { method: 'GET', headers: headers(cfg) },
      8000
    );
    if (res.ok) return { ok: true };
    if (res.status === 404) {
      return { ok: false, error: 'Reached the server but the kevlar_sync table is missing.' };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'Server rejected the key.' };
    }
    return { ok: false, error: `Server returned ${res.status}.` };
  } catch {
    return { ok: false, error: 'Could not reach that URL.' };
  }
}

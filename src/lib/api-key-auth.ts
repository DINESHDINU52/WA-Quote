import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { getDb, getFirebaseAuth } from '@/lib/firebase/client';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface ApiKeyDoc {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  status: 'active' | 'revoked';
  createdAt: number;
  createdBy?: string;
  lastUsedAt?: number | null;
  usageCount?: number;
  permissions?: string[];
  revokedAt?: number | null;
}

const SERVICE_EMAIL = 'api-service@chnindia.com';
const SERVICE_PASS = 'ChnApi@2026SecretKey!';

let _serverAuthPromise: Promise<void> | null = null;

/**
 * Ensures server-side routes are authenticated with the internal
 * admin service account so Firestore rules allow all reads & writes.
 */
export async function ensureServerAuth(): Promise<void> {
  if (typeof window !== 'undefined') return;
  const auth = getFirebaseAuth();
  if (auth.currentUser) return;

  if (!_serverAuthPromise) {
    _serverAuthPromise = (async () => {
      try {
        await signInWithEmailAndPassword(auth, SERVICE_EMAIL, SERVICE_PASS);
      } catch (err: any) {
        console.error('[server-auth] Sign-in error:', err?.message || err);
      } finally {
        _serverAuthPromise = null;
      }
    })();
  }
  return _serverAuthPromise;
}

export function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

/**
 * Helper to get all keys stored in settings/api_keys
 */
async function loadKeysDoc(): Promise<ApiKeyDoc[]> {
  await ensureServerAuth();
  const db = getDb();
  try {
    const s = await getDoc(doc(db, 'settings', 'api_keys'));
    if (!s.exists()) return [];
    const data = s.data();
    return Array.isArray(data?.keys) ? (data.keys as ApiKeyDoc[]) : [];
  } catch (err) {
    console.error('[api-key-auth] loadKeysDoc error:', err);
    return [];
  }
}

/**
 * Helper to save all keys to settings/api_keys
 */
async function saveKeysDoc(keys: ApiKeyDoc[]): Promise<void> {
  await ensureServerAuth();
  const db = getDb();
  await setDoc(
    doc(db, 'settings', 'api_keys'),
    {
      keys,
      updatedAt: Date.now()
    },
    { merge: true }
  );
}

/**
 * Generates a cryptographically strong API key.
 * Format: ed_live_<48 hex chars>
 */
export async function createApiKey(
  name: string,
  createdBy?: string,
  permissions: string[] = ['crm:read']
): Promise<{ rawKey: string; keyDoc: ApiKeyDoc }> {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const rawKey = `ed_live_${randomBytes}`;
  const keyHash = hashKey(rawKey);

  // e.g. ed_live_a1b2••••9f3e
  const keyPrefix = `ed_live_${randomBytes.slice(0, 4)}••••${randomBytes.slice(-4)}`;
  const keyId = `key_${Date.now()}_${randomBytes.slice(0, 8)}`;

  const keyDoc: ApiKeyDoc = {
    id: keyId,
    name: name.trim() || 'CRM Integration',
    keyHash,
    keyPrefix,
    status: 'active',
    createdAt: Date.now(),
    createdBy: createdBy || 'admin',
    lastUsedAt: null,
    usageCount: 0,
    permissions
  };

  const existing = await loadKeysDoc();
  const updated = [keyDoc, ...existing];
  await saveKeysDoc(updated);

  return { rawKey, keyDoc };
}

/**
 * Validates an incoming request against active API keys.
 */
export async function validateApiKey(
  req: NextRequest
): Promise<{ valid: boolean; error?: string; status?: number; keyDoc?: ApiKeyDoc }> {
  // Extract key from headers
  const authHeader = req.headers.get('authorization') || '';
  const xApiKey = req.headers.get('x-api-key') || '';
  const apiKeyHeader = req.headers.get('api-key') || '';

  let rawKey = '';
  if (authHeader.startsWith('Bearer ')) {
    rawKey = authHeader.slice(7).trim();
  } else if (authHeader.startsWith('ApiKey ') || authHeader.startsWith('apikey ')) {
    rawKey = authHeader.slice(7).trim();
  } else if (xApiKey) {
    rawKey = xApiKey.trim();
  } else if (apiKeyHeader) {
    rawKey = apiKeyHeader.trim();
  }

  // Also allow query parameter as fallback: ?api_key=... or ?key=...
  if (!rawKey) {
    const url = new URL(req.url);
    rawKey = url.searchParams.get('api_key') || url.searchParams.get('key') || '';
  }

  if (!rawKey) {
    return {
      valid: false,
      error: 'Missing API key. Please provide your key via "Authorization: Bearer <key>" or "x-api-key: <key>" header.',
      status: 401
    };
  }

  const computedHash = hashKey(rawKey);
  const keys = await loadKeysDoc();

  const foundKey = keys.find((k) => k.keyHash === computedHash);

  if (!foundKey) {
    return {
      valid: false,
      error: 'Invalid API key. Please check your credentials.',
      status: 401
    };
  }

  if (foundKey.status !== 'active') {
    return {
      valid: false,
      error: 'This API key has been revoked.',
      status: 403
    };
  }

  // Asynchronously update lastUsedAt and usageCount in background
  foundKey.lastUsedAt = Date.now();
  foundKey.usageCount = (foundKey.usageCount || 0) + 1;
  saveKeysDoc(keys).catch((err) => console.error('[api-key] Error updating usage stats:', err));

  return {
    valid: true,
    keyDoc: foundKey
  };
}

/**
 * List all API keys for admin display.
 */
export async function listApiKeys(): Promise<ApiKeyDoc[]> {
  const keys = await loadKeysDoc();
  // Sort desc by createdAt
  return keys.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Revoke an API key.
 */
export async function revokeApiKey(id: string): Promise<boolean> {
  const keys = await loadKeysDoc();
  const target = keys.find((k) => k.id === id);
  if (!target) return false;
  target.status = 'revoked';
  target.revokedAt = Date.now();
  await saveKeysDoc(keys);
  return true;
}

/**
 * Permanently delete an API key.
 */
export async function deleteApiKey(id: string): Promise<boolean> {
  const keys = await loadKeysDoc();
  const filtered = keys.filter((k) => k.id !== id);
  await saveKeysDoc(filtered);
  return true;
}

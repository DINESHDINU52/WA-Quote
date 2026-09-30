import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { resolveFirebaseConfig } from './config';

/**
 * Firebase web SDK initialiser. Reads its config from `./config.ts`,
 * which falls back to bundled CHN defaults when env vars are missing.
 * This avoids the dev-server-restart trap with NEXT_PUBLIC_* vars.
 */

function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  return initializeApp(resolveFirebaseConfig());
}

let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
}

export function getDb(): Firestore {
  if (!_db) _db = getFirestore(getFirebaseApp());
  return _db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(getFirebaseApp());
  return _storage;
}

/**
 * Browser-side debug helper. Run `__chnFirebaseReady()` in DevTools to
 * confirm which projectId the client is talking to.
 */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__chnFirebaseReady = () => {
    const cfg = resolveFirebaseConfig();
    return { ok: true, projectId: cfg.projectId, authDomain: cfg.authDomain };
  };
}

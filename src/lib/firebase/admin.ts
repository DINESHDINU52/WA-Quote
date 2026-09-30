/**
 * Firebase Admin SDK — server-only. Used for privileged operations like
 * creating users with email/password from the admin panel.
 *
 * Initialises with Application Default Credentials when running on GCP,
 * or with the project ID alone for local dev (sufficient for Auth operations
 * when using the emulator or when the service account is implicit).
 */

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let _app: App | null = null;

export function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApps()[0];
    return _app;
  }

  // Try service account JSON from env
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson && serviceAccountJson.length > 10) {
    try {
      let jsonStr = serviceAccountJson.trim();
      // Handle base64-encoded
      if (!jsonStr.startsWith('{')) {
        jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8');
      }
      const parsed = JSON.parse(jsonStr);
      if (parsed.project_id && parsed.private_key) {
        _app = initializeApp({ credential: cert(parsed) });
        return _app;
      }
    } catch (e: any) {
      console.error('[admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e?.message);
    }
  }

  // Try loading from a file as fallback
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'service-account.json');
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      _app = initializeApp({ credential: cert(parsed) });
      return _app;
    }
  } catch (e: any) {
    console.error('[admin] Failed to load service-account.json file:', e?.message);
  }

  // Last fallback: just project ID (only works with ADC on GCP)
  console.warn('[admin] No credentials found, using projectId only — will fail for Auth operations');
  _app = initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'chn-extradesk'
  });
  return _app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

let _db: Firestore | null = null;

export function getAdminFirestore(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getAdminApp());
  try {
    _db.settings({ ignoreUndefinedProperties: true });
  } catch {}
  return _db;
}

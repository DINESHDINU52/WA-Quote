/**
 * Firebase Web SDK configuration for chn-extradesk.
 */

export const FIREBASE_CONFIG_DEFAULTS = {
  apiKey: 'AIzaSyDnjfPLMIbx5ok4JLFPU7qcI3UGff233FE',
  authDomain: 'chn-extradesk.firebaseapp.com',
  projectId: 'chn-extradesk',
  storageBucket: 'chn-extradesk.firebasestorage.app',
  messagingSenderId: '135493886618',
  appId: '1:135493886618:web:909c61b8f1a5cc00cef523',
  measurementId: 'G-HCFGKC1CSC'
} as const;

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/**
 * Resolve the active Firebase config. Env vars override defaults when present.
 */
export function resolveFirebaseConfig(): FirebaseWebConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || FIREBASE_CONFIG_DEFAULTS.apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || FIREBASE_CONFIG_DEFAULTS.authDomain,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || FIREBASE_CONFIG_DEFAULTS.projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || FIREBASE_CONFIG_DEFAULTS.storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || FIREBASE_CONFIG_DEFAULTS.messagingSenderId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || FIREBASE_CONFIG_DEFAULTS.appId,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || FIREBASE_CONFIG_DEFAULTS.measurementId
  };
}

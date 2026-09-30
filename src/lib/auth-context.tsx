'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getDb } from './firebase/client';

export type Role = 'md' | 'admin' | 'accountant' | 'sales' | 'viewer';

const envAdmins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const SUPERADMIN_EMAILS: string[] = Array.from(
  new Set([
    'itsupport@chnindia.com',
    'chncbe2026@gmail.com',
    'admin@example.com',
    ...envAdmins
  ])
);

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (normalized === 'itsupport@chnindia.com') return true;
  return SUPERADMIN_EMAILS.includes(normalized);
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  active?: boolean;
  status?: string;
  department?: string;
  phone?: string;
  createdAt?: unknown;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  accessDenied: boolean;
  claimAdminRole: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Check if an email is in the access whitelist.
 * Superadmin emails are always allowed.
 */
async function checkAccessAllowed(email: string): Promise<boolean> {
  if (!email) return false;
  if (isSuperAdminEmail(email)) return true;
  try {
    const snap = await getDoc(doc(getDb(), 'settings', 'access'));
    if (!snap.exists()) return true; // No access control configured
    const data = snap.data();
    const allowedEmails: string[] = data.allowedEmails || [];
    if (allowedEmails.length === 0) return true; // Empty list = no restriction
    return allowedEmails.map((e) => e.toLowerCase()).includes(email.toLowerCase());
  } catch (err) {
    console.error('[access] Failed to check whitelist:', err);
    return isSuperAdminEmail(email);
  }
}

/**
 * Loads the user's `users/{uid}` profile.
 * - Auto-elevates superadmins (itsupport@chnindia.com) to 'md' (Managing Director).
 * - Checks for pre-approved placeholder records by email.
 * - Enforces admin approval: new/unapproved users return 'pending_approval'.
 * - Deactivated/rejected accounts return 'inactive'.
 */
async function loadOrCreateProfile(user: User): Promise<UserProfile | 'inactive' | 'pending_approval'> {
  const ref = doc(getDb(), 'users', user.uid);
  const snap = await getDoc(ref);
  const isSuper = isSuperAdminEmail(user.email);

  // 1. Superadmin (itsupport@chnindia.com, etc.): always full admin/MD access
  if (isSuper) {
    const existingName = snap.exists() ? snap.data().displayName : user.displayName;
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email ?? '',
      displayName: existingName || user.email || 'Admin',
      role: 'md',
      active: true,
      status: 'approved'
    };
    try {
      await setDoc(ref, { ...profile, active: true, status: 'approved', updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.warn('Superadmin auto-elevation save failed:', e);
    }
    return profile;
  }

  // 2. Check if an admin pre-approved this email before the user signed in
  if (!snap.exists() && user.email) {
    const emailKey = user.email.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');
    try {
      const emailSnap = await getDoc(doc(getDb(), 'users', emailKey));
      if (emailSnap.exists() && emailSnap.data()?.status === 'approved' && emailSnap.data()?.active === true) {
        const preData = emailSnap.data();
        const approvedProfile: UserProfile = {
          uid: user.uid,
          email: user.email,
          displayName: preData.displayName || user.displayName || user.email,
          role: preData.role || 'sales',
          active: true,
          status: 'approved'
        };
        await setDoc(ref, {
          ...approvedProfile,
          createdAt: serverTimestamp(),
          approvedAt: preData.approvedAt || serverTimestamp()
        });
        return approvedProfile;
      }
    } catch (err) {
      console.warn('Check pre-approved email failed:', err);
    }
  }

  // 3. Existing user record in Firestore
  if (snap.exists()) {
    const data = snap.data();

    // Check if user is pending approval
    if (data.status === 'pending_approval' || (data.active === false && data.status !== 'rejected')) {
      return 'pending_approval';
    }

    // Check if user is deactivated or rejected
    if (data.active === false || data.status === 'rejected') {
      return 'inactive';
    }

    // Approved & active member
    return {
      uid: user.uid,
      email: user.email ?? '',
      displayName: data.displayName ?? user.displayName ?? '',
      role: (data.role as Role) ?? 'sales',
      active: true,
      status: data.status ?? 'approved',
      department: data.department,
      phone: data.phone
    };
  }

  // 4. New user: record as pending approval; admin must approve in Settings > Users
  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? user.email ?? 'New User',
    role: 'viewer',
    active: false,
    status: 'pending_approval',
    createdAt: serverTimestamp(),
    requestedAt: serverTimestamp()
  });

  return 'pending_approval';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (u) => {
      setUser(u);
      setAccessDenied(false);
      if (u) {
        try {
          // Check access whitelist
          const allowed = await checkAccessAllowed(u.email ?? '');
          if (!allowed && !isSuperAdminEmail(u.email)) {
            setAccessDenied(true);
            setProfile(null);

            // Register pending access request in Firestore so Admin can see & approve in UI
            try {
              await setDoc(
                doc(getDb(), 'users', u.uid),
                {
                  uid: u.uid,
                  email: u.email ?? '',
                  displayName: u.displayName ?? u.email ?? 'New User',
                  role: 'viewer',
                  active: false,
                  status: 'pending_approval',
                  requestedAt: serverTimestamp(),
                  createdAt: serverTimestamp()
                },
                { merge: true }
              );
            } catch (err) {
              console.error('Failed to record pending approval in users:', err);
            }

            await signOut(getFirebaseAuth());
            setUser(null);
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
              window.location.href = '/login?pending=' + encodeURIComponent(u.email ?? '');
            }
            setLoading(false);
            return;
          }

          const result = await loadOrCreateProfile(u);
          if (result === 'pending_approval') {
            setAccessDenied(true);
            setProfile(null);
            await signOut(getFirebaseAuth());
            setUser(null);
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
              window.location.href = '/login?pending=' + encodeURIComponent(u.email ?? '');
            }
            setLoading(false);
            return;
          }

          if (result === 'inactive') {
            setAccessDenied(true);
            setProfile(null);
            await signOut(getFirebaseAuth());
            setUser(null);
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
              window.location.href = '/login?denied=' + encodeURIComponent(u.email ?? '') + '&reason=inactive';
            }
            setLoading(false);
            return;
          }

          setProfile(result);
        } catch (err) {
          console.error('Failed to load profile', err);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const claimAdminRole = async () => {
    if (!user) throw new Error('Not signed in');
    const ref = doc(getDb(), 'users', user.uid);
    await setDoc(
      ref,
      {
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? profile?.displayName ?? 'Admin',
        role: 'md',
        active: true,
        status: 'active',
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    setProfile((prev) =>
      prev
        ? { ...prev, role: 'md', active: true }
        : {
            uid: user.uid,
            email: user.email ?? '',
            displayName: user.displayName ?? 'Admin',
            role: 'md',
            active: true
          }
    );
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      accessDenied,
      claimAdminRole,
      signInWithEmail: async (email, password) => {
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      },
      signInWithGoogle: async () => {
        const provider = new GoogleAuthProvider();
        try {
          await signInWithPopup(getFirebaseAuth(), provider);
        } catch (err: any) {
          // If popup fails due to unauthorized domain, fallback to redirect
          if (err?.code === 'auth/unauthorized-domain') {
            await signInWithRedirect(getFirebaseAuth(), provider);
            return;
          }
          throw err;
        }
      },
      signOutUser: async () => {
        await signOut(getFirebaseAuth());
      }
    }),
    [user, profile, loading, accessDenied]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function hasRole(profile: UserProfile | null, allowed: Role[]): boolean {
  if (!profile) return false;
  // Managing Director gets all access — passes any role check
  if (profile.role === 'md') return true;
  // Superadmin emails always get all access
  if (isSuperAdminEmail(profile.email)) return true;
  return allowed.includes(profile.role);
}

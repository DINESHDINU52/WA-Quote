import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';

export const runtime = 'nodejs';

/**
 * POST /api/admin/create-user
 * Body: { email, password, displayName, role, idToken }
 *
 * Creates a new Firebase Auth user and their Firestore profile doc.
 * Only admins can call this (verified via idToken).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, displayName, role, idToken } = body;

    if (!email || !password || !displayName || !role || !idToken) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: email, password, displayName, role, idToken' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();

    // Verify the caller is an admin
    let callerUid: string;
    try {
      const decoded = await auth.verifyIdToken(idToken);
      callerUid = decoded.uid;
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid auth token' }, { status: 401 });
    }

    // Check caller's role in Firestore
    const db = getFirestore(getApps()[0]);
    const callerDoc = await db.collection('users').doc(callerUid).get();
    if (!callerDoc.exists) {
      return NextResponse.json({ ok: false, error: 'Caller user not found' }, { status: 403 });
    }
    const callerRole = callerDoc.data()?.role;
    if (callerRole !== 'admin' && callerRole !== 'md') {
      return NextResponse.json({ ok: false, error: 'Only admins can create users' }, { status: 403 });
    }

    // Create the user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName
    });

    // Create their Firestore profile
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role,
      createdAt: new Date(),
      createdBy: callerUid
    });

    // Add to access whitelist if it exists
    const accessDoc = await db.collection('settings').doc('access').get();
    if (accessDoc.exists) {
      const allowedEmails: string[] = accessDoc.data()?.allowedEmails || [];
      if (!allowedEmails.includes(email.toLowerCase())) {
        allowedEmails.push(email.toLowerCase());
        await db.collection('settings').doc('access').set(
          { allowedEmails },
          { merge: true }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName
    });
  } catch (err: any) {
    console.error('[create-user] error:', err);
    const msg = err?.code === 'auth/email-already-exists'
      ? 'A user with this email already exists'
      : err?.message || 'Failed to create user';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

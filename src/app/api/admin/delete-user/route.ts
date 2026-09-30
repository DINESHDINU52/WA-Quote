import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';

export const runtime = 'nodejs';

/**
 * POST /api/admin/delete-user
 * Body: { uid, idToken }
 *
 * Deletes a Firebase Auth user and their Firestore profile doc.
 * Only admins can call this (verified via idToken).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, idToken } = body;

    if (!uid || !idToken) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: uid, idToken' },
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

    // Cannot delete yourself
    if (callerUid === uid) {
      return NextResponse.json({ ok: false, error: 'You cannot delete your own account' }, { status: 400 });
    }

    // Check caller's role in Firestore
    const db = getFirestore(getApps()[0]);
    const callerDoc = await db.collection('users').doc(callerUid).get();
    if (!callerDoc.exists) {
      return NextResponse.json({ ok: false, error: 'Caller user not found' }, { status: 403 });
    }
    const callerRole = callerDoc.data()?.role;
    if (callerRole !== 'admin' && callerRole !== 'md') {
      return NextResponse.json({ ok: false, error: 'Only admins can delete users' }, { status: 403 });
    }

    // Look up target before deletion
    const targetDocPre = await db.collection('users').doc(uid).get();

    // Get the user's email before deleting (for whitelist cleanup)
    const targetEmail = targetDocPre.data()?.email?.toLowerCase();

    // Delete from Firebase Auth
    try {
      await auth.deleteUser(uid);
    } catch (err: any) {
      // User might not exist in Auth (manual Firestore entry) — continue
      if (err?.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    // Delete Firestore profile
    await db.collection('users').doc(uid).delete();

    // Remove from access whitelist if present
    if (targetEmail) {
      const accessDoc = await db.collection('settings').doc('access').get();
      if (accessDoc.exists) {
        const allowedEmails: string[] = accessDoc.data()?.allowedEmails || [];
        const updated = allowedEmails.filter((e) => e !== targetEmail);
        if (updated.length !== allowedEmails.length) {
          await db.collection('settings').doc('access').set(
            { allowedEmails: updated },
            { merge: true }
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[delete-user] error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}

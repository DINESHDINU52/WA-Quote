'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { useAuth, SUPERADMIN_EMAILS, isSuperAdminEmail } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Plus, Trash2, CheckCircle2, AlertCircle, Shield, Users, Crown } from 'lucide-react';

export default function AccessSettingsPage() {
  const { profile, user } = useAuth();
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'md' ||
    isSuperAdminEmail(profile?.email) ||
    isSuperAdminEmail(user?.email);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'settings', 'access'));
        if (snap.exists()) {
          const data = snap.data();
          setEmails(data.allowedEmails || []);
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load');
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  function addEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    if (emails.includes(email)) {
      setError('Email already in the list');
      return;
    }
    setEmails([...emails, email]);
    setNewEmail('');
    setError(null);
  }

  function removeEmail(email: string) {
    if (SUPERADMIN_EMAILS.includes(email.toLowerCase())) {
      alert('Superadmin emails cannot be removed from the access whitelist.');
      return;
    }
    setEmails(emails.filter((e) => e !== email));
  }

  async function save() {
    setSaved(null);
    setError(null);
    try {
      await setDoc(
        doc(getDb(), 'settings', 'access'),
        { allowedEmails: emails, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setSaved('Saved. Only these emails can sign in now.');
      setTimeout(() => setSaved(null), 3000);
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    }
  }

  if (!loaded) return <div className="text-ink-400 p-8">Loading access settings...</div>;

  return (
    <>
      <PageHeader
        title="Access Control Whitelist"
        description="Only emails listed here can sign in to WA Quote. Block unauthorized accounts or approve new staff."
        actions={
          <Link
            href="/settings/users"
            className="btn-secondary inline-flex items-center gap-1.5"
          >
            <Users className="h-4 w-4" />
            <span>Manage Users & Roles</span>
          </Link>
        }
      />

      <div className="card p-6 max-w-2xl">
        <div className="flex items-start gap-3 mb-6 rounded-md border border-amber-200 bg-amber-50 p-4">
          <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Important:</strong> If the list is empty, anyone with a Google account can sign in.
            When emails are added, only whitelisted accounts can access the application. Superadmins always have access.
          </div>
        </div>

        {/* Add email */}
        <div className="flex gap-2 mb-4">
          <input
            type="email"
            className="input flex-1"
            placeholder="e.g. colleague@chnindia.com or user@gmail.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEmail()}
          />
          <button onClick={addEmail} className="btn-primary">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {/* Email list */}
        {emails.length === 0 ? (
          <div className="rounded-md border border-ink-200 bg-ink-50 px-4 py-8 text-center text-sm text-ink-400">
            No emails added. Access control is <strong>disabled</strong> — anyone can sign in.
          </div>
        ) : (
          <div className="rounded-md border border-ink-200 divide-y divide-ink-100 max-h-96 overflow-y-auto">
            {emails.map((email) => {
              const isSuper = SUPERADMIN_EMAILS.includes(email.toLowerCase());
              return (
                <div
                  key={email}
                  className="flex items-center justify-between px-4 py-3 hover:bg-ink-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink-900">{email}</span>
                    {isSuper && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        <Crown className="h-3 w-3 text-amber-600" />
                        Superadmin
                      </span>
                    )}
                  </div>
                  {!isSuper ? (
                    <button
                      onClick={() => removeEmail(email)}
                      className="text-ink-400 hover:text-red-700 transition-colors"
                      title="Remove from whitelist"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-ink-400">Protected</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={!isAdmin} className="btn-primary">
            Save access list
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {saved}
            </span>
          )}
          {error && (
            <span className="inline-flex items-center gap-1 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </span>
          )}
        </div>

        <p className="mt-4 text-xs text-ink-400">
          Users not in this list will be directed to an approval pending screen upon sign-in, allowing an administrator to approve them directly from{' '}
          <Link href="/settings/users" className="text-brand-600 hover:underline font-medium">
            Settings &gt; Users
          </Link>
          .
        </p>
      </div>
    </>
  );
}

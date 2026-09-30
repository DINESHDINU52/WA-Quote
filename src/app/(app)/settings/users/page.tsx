'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { useAuth, isSuperAdminEmail, type Role } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import {
  Shield,
  ShieldCheck,
  Eye,
  Briefcase,
  Crown,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  UserCheck,
  Clock,
  Sparkles
} from 'lucide-react';

interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  active?: boolean;
  status?: string;
  phone?: string;
  department?: string;
  requestedRole?: string;
  registeredAt?: any;
  requestedAt?: any;
  createdAt?: any;
}

const ROLES: { value: Role; label: string; description: string; icon: typeof Shield }[] = [
  {
    value: 'md',
    label: 'Managing Director',
    description: 'Highest authority. Full access to all features, users, settings, reports. Cannot be deleted or restricted.',
    icon: Crown
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full access — settings, users, create/edit/delete everything',
    icon: ShieldCheck
  },
  {
    value: 'accountant',
    label: 'Accountant',
    description: 'Create/edit all docs, customers, devices. No user management or settings',
    icon: Briefcase
  },
  {
    value: 'sales',
    label: 'Sales',
    description: 'Create & edit quotations/proformas, add/edit/delete devices & customers. Cannot delete quotations or change settings',
    icon: Briefcase
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to everything. Cannot create, edit, or delete',
    icon: Eye
  }
];

export default function UsersSettingsPage() {
  const { profile, user, claimAdminRole } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  // Selected roles for pending users map: uid -> Role
  const [pendingRoleSelection, setPendingRoleSelection] = useState<Record<string, Role>>({});

  const isAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'md' ||
    isSuperAdminEmail(profile?.email) ||
    isSuperAdminEmail(user?.email);

  useEffect(() => {
    // Admin can read all users; non-admin can only read their own doc
    const q = query(collection(getDb(), 'users'), orderBy('email'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, 'uid'>) })));
        setLoading(false);
      },
      () => {
        // If permission denied (non-admin), just show empty
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  async function handleClaimAdmin() {
    setClaimBusy(true);
    setClaimMsg(null);
    try {
      await claimAdminRole();
      setClaimMsg('Successfully elevated account to Managing Director! You now have full approval access.');
    } catch (err: any) {
      alert(err?.message || 'Failed to claim admin role');
    } finally {
      setClaimBusy(false);
    }
  }

  async function approveUser(u: UserDoc, roleToAssign: Role) {
    setUpdating(u.uid);
    try {
      // 1. Update user profile in Firestore
      await updateDoc(doc(getDb(), 'users', u.uid), {
        role: roleToAssign,
        active: true,
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: profile?.email || user?.email || 'admin'
      });

      // 2. Add email to access whitelist in settings/access
      try {
        const accessRef = doc(getDb(), 'settings', 'access');
        const snap = await getDoc(accessRef);
        const currentList: string[] = snap.exists() ? snap.data().allowedEmails || [] : [];
        const emailLower = u.email.toLowerCase().trim();
        if (!currentList.map((e) => e.toLowerCase()).includes(emailLower)) {
          await setDoc(
            accessRef,
            {
              allowedEmails: [...currentList, emailLower],
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.warn('Could not auto-sync to settings/access whitelist:', err);
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to approve user');
    } finally {
      setUpdating(null);
    }
  }

  async function rejectPendingUser(uid: string) {
    if (!confirm('Reject this user access request?')) return;
    setUpdating(uid);
    try {
      await updateDoc(doc(getDb(), 'users', uid), {
        status: 'rejected',
        active: false,
        rejectedAt: serverTimestamp()
      });
    } catch (e: any) {
      alert(e?.message || 'Failed to reject user');
    } finally {
      setUpdating(null);
    }
  }

  async function changeRole(uid: string, newRole: Role) {
    if (uid === profile?.uid && newRole !== 'admin' && newRole !== 'md') {
      if (!confirm('You are about to remove your own admin access. Are you sure?')) return;
    }
    setUpdating(uid);
    try {
      await updateDoc(doc(getDb(), 'users', uid), { role: newRole });
    } catch (e: any) {
      alert(e?.message || 'Failed to update role');
    } finally {
      setUpdating(null);
    }
  }

  async function toggleActive(uid: string, currentlyActive: boolean) {
    if (uid === profile?.uid) {
      alert('You cannot deactivate your own account.');
      return;
    }
    setUpdating(uid);
    try {
      await updateDoc(doc(getDb(), 'users', uid), { active: !currentlyActive });
    } catch (e: any) {
      alert(e?.message || 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  }

  async function deleteUser(uid: string, displayName: string) {
    if (uid === profile?.uid) {
      alert('You cannot delete your own account.');
      return;
    }
    if (
      !confirm(
        `Are you sure you want to permanently delete "${displayName}"? This will remove them from Firebase Auth and Firestore. This cannot be undone.`
      )
    ) {
      return;
    }
    setUpdating(uid);
    try {
      const idToken = await user?.getIdToken();
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, idToken })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
    } catch (e: any) {
      alert(e?.message || 'Failed to delete user');
    } finally {
      setUpdating(null);
    }
  }

  // Filter pending approvals vs active members
  const pendingUsers = users.filter(
    (u) => u.status === 'pending_approval' || (u.active === false && u.status !== 'rejected')
  );
  const activeUsers = users.filter(
    (u) => u.status !== 'pending_approval' && u.active !== false
  );

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Manage who can access WA Quote and what they can do. Approve Firebase users, grant roles, and whitelist access."
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowApproveModal(true)}
                  className="btn-secondary inline-flex items-center gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  title="Approve directly added Firebase users or whitelist by email"
                >
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  Approve Firebase user
                </button>
                <button onClick={() => setShowCreate(true)} className="btn-primary">
                  <Plus className="h-4 w-4" />
                  Create user
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Admin Elevation Banner (if user is not yet recognized as admin) */}
      {!isAdmin && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm animate-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-900 text-sm">
                  Elevate Account to Managing Director / Admin
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  You are currently logged in with a standard viewer profile. Click below to claim MD access and approve users in the UI.
                </p>
              </div>
            </div>
            <button
              onClick={handleClaimAdmin}
              disabled={claimBusy}
              className="btn-primary whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5"
            >
              {claimBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span>Claim MD Access</span>
            </button>
          </div>
          {claimMsg && (
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>{claimMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* 1. Pending Approvals Queue (HIGH VISIBILITY) */}
      {pendingUsers.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/90 to-yellow-50/70 p-5 shadow-sm animate-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber-500 text-white">
                <Clock className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide">
                Pending User Approvals ({pendingUsers.length})
              </h3>
            </div>
            <span className="text-[11px] font-medium text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
              Action Required
            </span>
          </div>
          <p className="text-xs text-amber-700 mb-4">
            These users attempted to sign in or were added in Firebase Authentication. Choose a role and click "Approve & Whitelist" to grant them access immediately.
          </p>

          <div className="divide-y divide-amber-200/60 rounded-lg border border-amber-200 bg-white overflow-hidden shadow-sm">
            {pendingUsers.map((u) => {
              const selectedRole = pendingRoleSelection[u.uid] || (u.requestedRole as Role) || 'sales';
              const isBusy = updating === u.uid;

              return (
                <div
                  key={u.uid}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 hover:bg-amber-50/30 transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="font-semibold text-ink-900 text-sm flex flex-wrap items-center gap-2">
                      <span>{u.displayName || 'No Name'}</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        {u.status === 'pending_approval' ? 'Pending Approval' : 'Inactive'}
                      </span>
                      {u.department && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {u.department}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>{u.email}</span>
                      {u.phone && <span>· 📞 {u.phone}</span>}
                      {u.requestedRole && (
                        <span className="text-brand-600 font-semibold">· Requested: {u.requestedRole.toUpperCase()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      className="input py-1 text-xs w-36"
                      value={selectedRole}
                      disabled={isBusy || !isAdmin}
                      onChange={(e) =>
                        setPendingRoleSelection((prev) => ({
                          ...prev,
                          [u.uid]: e.target.value as Role
                        }))
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={isBusy || !isAdmin}
                      onClick={() => approveUser(u, selectedRole)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      <span>Approve & Whitelist</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy || !isAdmin}
                      onClick={() => rejectPendingUser(u.uid)}
                      className="inline-flex items-center px-2 py-1.5 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-50 text-xs font-medium transition-colors"
                      title="Reject request"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Role legend */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROLES.map((r) => (
          <div key={r.value} className="card flex items-start gap-3 p-3.5">
            <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700">
              <r.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-900">{r.label}</div>
              <div className="mt-0.5 text-[11px] text-ink-500 leading-tight">{r.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Users table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-ink-50/50 border-b border-ink-100 flex items-center justify-between">
          <div className="font-semibold text-xs text-ink-700 uppercase tracking-wider">
            Active Team Members ({activeUsers.length})
          </div>
          <span className="text-[11px] text-ink-400">
            Total registered accounts: {users.length}
          </span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Current Role</th>
              <th className="px-4 py-3 font-medium">Change Role</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-400">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                    <span>Loading team members...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && activeUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-400">
                  No active users found. Use "Approve Firebase user" or "Create user" above.
                </td>
              </tr>
            )}
            {activeUsers.map((u) => (
              <tr key={u.uid} className="hover:bg-ink-50/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-900">
                    {u.displayName || 'No name'}
                    {u.uid === profile?.uid && (
                      <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 border border-brand-200">
                        YOU
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-700">{u.email}</td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => toggleActive(u.uid, u.active !== false)}
                      disabled={updating === u.uid || u.uid === profile?.uid}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        u.active !== false
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      } disabled:cursor-not-allowed`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          u.active !== false ? 'bg-emerald-500' : 'bg-red-400'
                        }`}
                      />
                      {u.active !== false ? 'Active' : 'Inactive'}
                    </button>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        u.active !== false
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          u.active !== false ? 'bg-emerald-500' : 'bg-red-400'
                        }`}
                      />
                      {u.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <select
                      className="input w-36 py-1 text-xs"
                      value={u.role}
                      disabled={updating === u.uid}
                      onChange={(e) => changeRole(u.uid, e.target.value as Role)}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-ink-400">Admin only</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && u.uid !== profile?.uid ? (
                    <button
                      type="button"
                      onClick={() => deleteUser(u.uid, u.displayName || u.email)}
                      disabled={updating === u.uid}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
                      title="Delete user permanently"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  ) : (
                    <span className="text-xs text-ink-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-ink-400">
        New users who sign in or get added in Firebase can be approved instantly from the{' '}
        <span className="font-semibold text-ink-700">Pending Approvals</span> card or with the{' '}
        <span className="font-semibold text-ink-700">Approve Firebase user</span> button above.
      </div>

      {/* Dialog 1: Direct Approve Firebase User */}
      {showApproveModal && (
        <ApproveFirebaseUserDialog
          onClose={() => setShowApproveModal(false)}
          onSuccess={() => setShowApproveModal(false)}
        />
      )}

      {/* Dialog 2: Create User with Password */}
      {showCreate && <CreateUserDialog onClose={() => setShowCreate(false)} />}
    </>
  );
}

/** Dialog to approve an existing Firebase Auth user or whitelist a new email */
function ApproveFirebaseUserDialog({
  onClose,
  onSuccess
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { profile, user } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('sales');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setResult({ ok: false, msg: 'Please provide a valid email address.' });
      return;
    }
    setBusy(true);
    setResult(null);

    try {
      // 1. Add email to access whitelist in settings/access
      const accessRef = doc(getDb(), 'settings', 'access');
      const snap = await getDoc(accessRef);
      const currentList: string[] = snap.exists() ? snap.data().allowedEmails || [] : [];
      if (!currentList.map((e) => e.toLowerCase()).includes(cleanEmail)) {
        await setDoc(
          accessRef,
          {
            allowedEmails: [...currentList, cleanEmail],
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      }

      // 2. Check if a user record with this email already exists in Firestore
      // If not, write a pre-approved placeholder keyed by a sanitized email ID
      const userKey = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      await setDoc(
        doc(getDb(), 'users', userKey),
        {
          email: cleanEmail,
          displayName: displayName.trim() || cleanEmail,
          role,
          active: true,
          status: 'approved',
          approvedBy: profile?.email || user?.email || 'admin',
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setResult({
        ok: true,
        msg: `User "${cleanEmail}" approved as ${role}. They are now whitelisted and can sign in with full access.`
      });
      setTimeout(() => {
        onSuccess();
      }, 1800);
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message || 'Failed to approve user' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 animate-in shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-700">
              <UserCheck className="h-5 w-5" />
            </div>
            <h2 className="font-serif text-lg font-semibold text-ink-900">
              Approve Firebase User
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-ink-500 mb-4">
          Enter the email of a user created in Firebase Authentication or new team member. This will whitelist them and grant immediate access upon login.
        </p>

        <form onSubmit={handleApprove} className="space-y-4">
          <div>
            <label className="label">User Email *</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. colleague@chnindia.com or user@gmail.com"
            />
          </div>

          <div>
            <label className="label">Full Name (Optional)</label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Dinesh Kumar"
            />
          </div>

          <div>
            <label className="label">Assigned Role</label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.description}
                </option>
              ))}
            </select>
          </div>

          {result && (
            <div
              className={
                result.ok
                  ? 'flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800'
                  : 'flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800'
              }
            >
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <span>{result.msg}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              Approve & Whitelist
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Dialog to create user in Firebase Auth via API */
function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !displayName) return;
    setBusy(true);
    setResult(null);
    try {
      const idToken = await user?.getIdToken();
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, role, idToken })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setResult({
        ok: true,
        msg: `User "${displayName}" created with role "${role}". They can sign in now.`
      });
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message || 'Failed to create user' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/30 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 animate-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold text-ink-900">Create new user</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input
              className="input"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Dinesh Kumar"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. dinesh@chnindia.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="text"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
            />
            <p className="mt-1 text-[11px] text-ink-400">
              Share this with the user. They can change it later via "Forgot password".
            </p>
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.description}
                </option>
              ))}
            </select>
          </div>

          {result && (
            <div
              className={
                result.ok
                  ? 'flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800'
                  : 'flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800'
              }
            >
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <span>{result.msg}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Close
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create user
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const map: Record<Role, string> = {
    md: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-300',
    admin: 'bg-brand-50 text-brand-700',
    accountant: 'bg-blue-50 text-blue-700',
    sales: 'bg-amber-50 text-amber-700',
    viewer: 'bg-ink-100 text-ink-600'
  };
  const label = role === 'md' ? '👑 MD' : role;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${map[role]}`}
    >
      {label}
    </span>
  );
}

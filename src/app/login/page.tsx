'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, isSuperAdminEmail } from '@/lib/auth-context';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getDb } from '@/lib/firebase/client';
import {
  Mail,
  Lock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  User,
  Phone,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Clock
} from 'lucide-react';

function LoginInner() {
  const { signInWithEmail, signInWithGoogle, accessDenied } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const deniedEmail = params.get('denied');
  const pendingEmail = params.get('pending');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showDenied, setShowDenied] = useState(!!deniedEmail);
  const [showPending, setShowPending] = useState(!!pendingEmail);
  const [pendingAccountEmail, setPendingAccountEmail] = useState(pendingEmail || '');
  const [showRegister, setShowRegister] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (pendingEmail) {
      setPendingAccountEmail(pendingEmail);
      setShowPending(true);
    }
  }, [pendingEmail]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Ensure the video plays (handles autoplay policy)
    video.play().catch(() => { });
  }, []);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);

      // Verify approval status directly in Firestore
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      if (currentUser && !isSuperAdminEmail(currentUser.email)) {
        const snap = await getDoc(doc(getDb(), 'users', currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === 'pending_approval' || (data.active === false && data.status !== 'approved')) {
            await signOut(auth);
            setPendingAccountEmail(currentUser.email || email.trim());
            setShowPending(true);
            setBusy(false);
            return;
          }
        }
      }

      router.replace(next);
    } catch (e: any) {
      const msg = e?.code === 'auth/invalid-credential'
        ? 'Invalid email or password. Please check and try again.'
        : e?.code === 'auth/user-not-found'
          ? 'No account found with this email. Click "Register for Access" below to create one.'
          : e?.code === 'auth/wrong-password'
            ? 'Incorrect password. Please try again.'
            : e?.code === 'auth/too-many-requests'
              ? 'Too many failed attempts. Please wait and try again.'
              : e?.message ?? 'Sign-in failed. Please try again.';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setErr(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      router.replace(next);
    } catch (e: any) {
      const msg = e?.code === 'auth/popup-closed-by-user'
        ? 'Sign-in cancelled. Please try again.'
        : e?.code === 'auth/invalid-credential'
          ? 'Invalid credentials. Please try again.'
          : e?.message ?? 'Sign-in failed. Please try again.';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Pending Approval Modal */}
      {showPending && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-ink-900/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md overflow-hidden animate-in shadow-2xl">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 px-6 py-6 text-center text-white">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white/20">
                <Clock className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-xl font-bold">Access Pending Approval</h2>
              <p className="mt-1 text-sm text-amber-100">Account registered successfully</p>
            </div>
            <div className="px-6 py-5 text-center">
              <p className="text-sm text-ink-700">
                Your account <span className="font-bold text-ink-900">{pendingAccountEmail || email}</span> has been logged and is awaiting administrator approval.
              </p>
              <p className="mt-3 text-xs text-ink-500 leading-relaxed">
                An administrator can approve your account and assign your permissions directly from <span className="font-semibold text-ink-700">Settings &gt; Users</span>.
              </p>
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 text-left space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-600" /> Organization Admins:
                </div>
                <div>Please contact an administrator at <strong className="text-ink-900">itsupport@chnindia.com</strong> to activate your login.</div>
              </div>
            </div>
            <div className="border-t border-ink-100 bg-ink-50 px-6 py-4">
              <button
                onClick={() => {
                  setShowPending(false);
                  router.replace('/login');
                }}
                className="btn-primary w-full justify-center"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Denied Modal */}
      {showDenied && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-ink-900/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-sm overflow-hidden animate-in">
            <div className="bg-red-600 px-6 py-6 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white/20">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Access Denied</h2>
              <p className="mt-1 text-sm text-red-100">Unauthorized email address</p>
            </div>
            <div className="px-6 py-5 text-center">
              <p className="text-sm text-ink-700">
                The email <span className="font-bold text-ink-900">{deniedEmail}</span> is not registered in WA Quote.
              </p>
              <p className="mt-3 text-xs text-ink-500">
                Only authorized staff can access this application. Contact your administrator to get access.
              </p>
            </div>
            <div className="border-t border-ink-100 bg-ink-50 px-6 py-4">
              <button
                onClick={() => {
                  setShowDenied(false);
                  // Clear the denied param from URL
                  router.replace('/login');
                }}
                className="btn-primary w-full justify-center"
              >
                Try another account
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative flex min-h-screen w-full items-center justify-center bg-slate-50/50 overflow-hidden">
        {/* Injecting keyframe animations for premium graphics */}
        <style jsx global>{`
        @keyframes float-orb-1 {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(40px, -60px) scale(1.15); }
          66% { transform: translate(-20px, 30px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes float-orb-2 {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-50px, 50px) scale(1.12); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes float-orb-3 {
          0% { transform: translate(0px, 0px) scale(1); }
          40% { transform: translate(30px, 40px) scale(0.95); }
          70% { transform: translate(-20px, -40px) scale(1.08); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse-slow {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes logo-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes logo-glow {
          0%, 100% { 
            box-shadow: 0 4px 20px -2px rgba(var(--brand-500), 0.12), 0 2px 8px -1px rgba(var(--brand-500), 0.08); 
            border-color: rgba(var(--brand-200), 0.6);
          }
          50% { 
            box-shadow: 0 12px 30px 2px rgba(var(--brand-500), 0.28), 0 4px 12px 0px rgba(var(--brand-500), 0.18); 
            border-color: rgba(var(--brand-400), 0.9);
          }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        .orb-1 { animation: float-orb-1 22s infinite ease-in-out; }
        .orb-2 { animation: float-orb-2 26s infinite ease-in-out; }
        .orb-3 { animation: float-orb-3 24s infinite ease-in-out; }
        .spin-slow { animation: spin-slow 16s linear infinite; }
        .spin-reverse-slow { animation: spin-reverse-slow 24s linear infinite; }
        .logo-float-anim { animation: logo-float 4s infinite ease-in-out; }
        .logo-container-glow { animation: logo-glow 4s infinite ease-in-out; }
        .pulse-slow { animation: pulse-slow 8s infinite ease-in-out; }
      `}</style>

        {/* 1. Looping Cinematic Video Layer */}
        <video
          ref={videoRef}
          src="/login-bg.mp4"
          className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
          muted
          playsInline
          autoPlay
          loop
          style={{ opacity: 0.9 }}
        />

        {/* 2. Dark cinematic overlay with color accents */}
        <div className="absolute inset-0 bg-black/70 pointer-events-none z-0" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/30 via-transparent to-indigo-950/30 pointer-events-none z-0" />

        {/* 3. Floating Ambient Glowing Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[12%] left-[18%] h-96 w-96 rounded-full bg-brand-500/10 blur-[120px] orb-1" />
          <div className="absolute bottom-[18%] right-[12%] h-[450px] w-[450px] rounded-full bg-indigo-500/8 blur-[130px] orb-2" />
          <div className="absolute top-[55%] left-[8%] h-[320px] w-[320px] rounded-full bg-purple-500/6 blur-[100px] orb-3" />
        </div>

        {/* 4. Fine-bordered Cinematic Floating Geometrics — removed */}

        {/* 5. Slow-moving Light Dust Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[25%] left-[35%] w-1.5 h-1.5 rounded-full bg-brand-400/30 blur-[0.3px] animate-ambient-float" style={{ animationDuration: '19s' }} />
          <div className="absolute top-[52%] left-[65%] w-2 h-2 rounded-full bg-indigo-400/20 blur-[0.8px] animate-ambient-float" style={{ animationDuration: '25s', animationDelay: '-5s' }} />
          <div className="absolute bottom-[28%] left-[45%] w-1.5 h-1.5 rounded-full bg-purple-400/25 blur-[0.3px] animate-ambient-float" style={{ animationDuration: '16s', animationDelay: '-9s' }} />
          <div className="absolute top-[38%] left-[12%] w-2.5 h-2.5 rounded-full bg-brand-300/15 blur-[1.2px] animate-ambient-float" style={{ animationDuration: '30s', animationDelay: '-14s' }} />
          <div className="absolute bottom-[18%] right-[28%] w-1.5 h-1.5 rounded-full bg-indigo-300/20 blur-[0.5px] animate-ambient-float" style={{ animationDuration: '23s', animationDelay: '-3s' }} />
        </div>


        {/* Center Card: Premium fully functional Login Form Panel */}
        <div className="relative z-10 flex w-full max-w-[460px] flex-col justify-between px-6 py-8 sm:px-10 sm:py-10 bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-2xl shadow-black/30 m-4">

          {/* Subtle grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.015] pointer-events-none -z-20 bg-repeat"
            style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="none" stroke="%23000" stroke-width="1"/></svg>')` }}
          />

          {/* Top brand header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-600 animate-ping" />
              <span className="text-[10px] font-extrabold tracking-widest text-brand-600 uppercase">SYSTEM ONLINE</span>
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100/50 text-[10px] font-bold text-emerald-700">
              <ShieldCheck className="h-3 w-3 stroke-[2.5]" />
              <span>Secure Access</span>
            </div>
          </div>

          {/* Main form area */}
          <div className="my-auto py-8">
            <div className="mb-8 flex flex-col items-center">
              {/* Logo with dual-rotating technical border and dynamic glow */}
              <div className="relative p-3 rounded-2xl bg-gradient-to-b from-brand-50 to-brand-100/20 border transition-all duration-300 logo-container-glow logo-float-anim mb-4">
                {/* Outer spinning tech accent border (Clockwise) */}
                <div className="absolute -inset-1.5 border border-dashed border-brand-500/25 rounded-2xl spin-slow pointer-events-none" />
                {/* Inner spinning tech accent border (Counter-Clockwise) */}
                <div className="absolute -inset-3 border border-dotted border-brand-400/20 rounded-2xl spin-reverse-slow pointer-events-none" />
                {/* Subtle ambient core glow */}
                <div className="absolute inset-0 bg-brand-500/5 rounded-2xl blur-sm pointer-events-none" />

                <img src="/WA Quote  - 2.png" alt="WA Quote" className="relative h-16 w-16 object-contain rounded-xl z-10 transition-transform duration-500 hover:scale-110 drop-shadow-md" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-1.5 justify-center">
                  <span>WA Quote</span>
                  <Sparkles className="h-5 w-5 text-brand-500 fill-brand-500 animate-pulse" />
                </div>
                <div className="text-[10px] font-bold text-brand-600 tracking-[0.2em] uppercase mt-1">
                  CHN TECHNOLOGIES PVT LTD
                </div>
              </div>
            </div>

            <form onSubmit={handleEmail} className="space-y-4">
              <div>
                <label className="label text-slate-600 mb-1" htmlFor="email">Work Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-500 transition-colors duration-200">
                    <Mail className="h-4 w-4 stroke-[2.25]" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200/80 bg-white/60 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-300 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 shadow-sm hover:border-slate-300"
                    placeholder="name@chnindia.com"
                  />
                </div>
              </div>

              <div>
                <label className="label text-slate-600 mb-1" htmlFor="password">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-500 transition-colors duration-200">
                    <Lock className="h-4 w-4 stroke-[2.25]" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200/80 bg-white/60 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-300 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 shadow-sm hover:border-slate-300"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {err && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-500/20 transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{busy ? 'Verifying access...' : 'Sign in to WA Quote'}</span>
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </button>
            </form>

            {/* New User Self-Registration Trigger */}
            <div className="mt-4 pt-3.5 border-t border-slate-200/70 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">New staff member?</span>
              <button
                type="button"
                onClick={() => setShowRegister(true)}
                className="font-bold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1.5 transition-colors group"
              >
                <UserPlus className="h-3.5 w-3.5 transition-transform group-hover:scale-110 text-brand-500" />
                <span>Register for Access</span>
              </button>
            </div>

            <div className="my-5 flex items-center gap-3 text-[10px] font-black text-slate-400 tracking-wider">
              <span className="h-px flex-1 bg-slate-200/70" />
              SECURE CREDENTIAL FEDERATION
              <span className="h-px flex-1 bg-slate-200/70" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={busy}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-sm rounded-xl shadow-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2.5 hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.14 3.01-.97 4.19l3.25 2.53c1.9-1.75 3-4.32 3-8.57z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.25-2.53c-.9.6-2.07.96-3.41.96-2.63 0-4.86-1.77-5.66-4.15H1.17v2.6C3.18 21.87 7.27 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.34 15.37c-.21-.63-.33-1.3-.33-2s.12-1.37.33-2V6.77H1.17c-.75 1.49-1.17 3.15-1.17 4.93s.42 3.44 1.17 4.93l5.17-3.96z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.96 1.19 15.24 0 12 0 7.27 0 3.18 2.13 1.17 6.77l5.17 3.96c.8-2.38 3.03-4.15 5.66-4.15z"
                />
              </svg>
              <span>Login with Google</span>
            </button>
          </div>

          {/* Bottom footer bar */}
          <div className="flex flex-col items-center text-center border-t border-slate-200/50 pt-4 gap-2">
            <span className="text-[10px] font-medium text-slate-400">© 2026 CHN Technologies Pvt Ltd.</span>
            <span className="text-[9px] font-semibold text-brand-500/80 uppercase tracking-widest">Proudly Presented by CHN Technologies Pvt Ltd</span>
          </div>
        </div>

        {/* User Registration Modal */}
        {showRegister && (
          <RegisterModal
            open={showRegister}
            onClose={() => setShowRegister(false)}
            onSuccess={() => {
              setShowRegister(false);
            }}
          />
        )}
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-slate-400 bg-slate-50 font-semibold">Loading WA Quote...</div>}>
      <LoginInner />
    </Suspense>
  );
}

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function RegisterModal({ open, onClose, onSuccess }: RegisterModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Sales & Business Development');
  const [requestedRole, setRequestedRole] = useState('sales');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErr('Please enter a valid work email address.');
      return;
    }
    if (password.length < 6) {
      setErr('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErr('Passwords do not match. Please re-enter your password.');
      return;
    }

    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      // 1. Create account in Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      // 2. Set display name
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }

      // 3. Register user in Firestore with pending_approval
      const isSuper = isSuperAdminEmail(cleanEmail);
      await setDoc(doc(getDb(), 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cleanEmail,
        displayName: name.trim() || cleanEmail,
        phone: phone.trim() || '',
        department: department || 'Sales & Business Development',
        role: isSuper ? 'md' : 'viewer',
        requestedRole: requestedRole || 'sales',
        active: isSuper ? true : false,
        status: isSuper ? 'approved' : 'pending_approval',
        registeredAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // 4. Non-superadmin: sign out immediately so they cannot enter without approval
      if (!isSuper) {
        await signOut(auth);
        setSubmitted(true);
      } else {
        // Superadmin auto-approved
        onSuccess();
      }
    } catch (e: any) {
      const msg = e?.code === 'auth/email-already-in-use'
        ? 'An account with this email is already registered. If you need activation, please contact an administrator.'
        : e?.code === 'auth/weak-password'
          ? 'Password must be at least 6 characters.'
          : e?.code === 'auth/invalid-email'
            ? 'Invalid email format. Please check your email address.'
            : e?.message ?? 'Registration failed. Please try again.';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-ink-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="card w-full max-w-lg overflow-hidden animate-in shadow-2xl my-6">
        {/* Modal Header */}
        <div className="relative bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-700 px-6 py-6 text-white text-center">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-white/70 hover:text-white transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
            <UserPlus className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold">Staff Account Registration</h2>
          <p className="mt-0.5 text-xs text-brand-100">
            WA Quote · Access Request
          </p>
        </div>

        {/* Modal Content */}
        {submitted ? (
          <div className="p-6 text-center space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink-900">Registration Submitted!</h3>
              <p className="text-xs text-ink-500 mt-1">
                Your request has been logged successfully and is waiting for approval.
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-left text-xs space-y-2">
              <div className="flex items-center justify-between font-semibold text-ink-800">
                <span>Account Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">
                  Pending Approval
                </span>
              </div>
              <div className="flex items-center justify-between text-ink-600">
                <span>Work Email:</span>
                <span className="font-mono font-medium text-ink-900">{email}</span>
              </div>
              <div className="flex items-center justify-between text-ink-600">
                <span>Department:</span>
                <span className="font-medium text-ink-900">{department}</span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-ink-600 text-left space-y-1">
              <div className="font-semibold text-ink-800 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-brand-600" /> What happens next?
              </div>
              <p className="text-ink-500 leading-relaxed">
                An administrator (such as <strong className="text-ink-800">itsupport@chnindia.com</strong>) will review your registration and activate your account in <strong className="text-ink-800">Settings &gt; Users</strong>. Once approved, you can log in immediately with your email and password.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-primary w-full justify-center py-2.5"
              >
                Return to Sign In
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {err && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs text-slate-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs text-slate-700 mb-1">Work Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@chnindia.com"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs text-slate-700 mb-1">Phone Number (Optional)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs text-slate-700 mb-1">Department</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                  >
                    <option value="Sales & Business Development">Sales & Business Development</option>
                    <option value="Accounts & Finance">Accounts & Finance</option>
                    <option value="Technical Support & IT">Technical Support & IT</option>
                    <option value="Operations & Logistics">Operations & Logistics</option>
                    <option value="Management">Management</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="label text-xs text-slate-700 mb-1">Requested Role</label>
              <select
                value={requestedRole}
                onChange={(e) => setRequestedRole(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
              >
                <option value="sales">Sales Executive (Create & Manage Quotations/PIs/Orders)</option>
                <option value="accountant">Accountant (Manage Payments & Invoices)</option>
                <option value="viewer">Viewer (Read-only Access)</option>
                <option value="admin">Administrator (Requires Admin Confirmation)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs text-slate-700 mb-1">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs text-slate-700 mb-1">Confirm Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type password"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Approval Requirement:</strong> New accounts are submitted in <em>Pending</em> status. An administrator must approve your account in <strong>Settings &gt; Users</strong> before login is permitted.
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="btn-secondary flex-1 justify-center py-2.5 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary flex-1 justify-center py-2.5 text-xs bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-bold"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                <span>{busy ? 'Registering...' : 'Submit Request'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


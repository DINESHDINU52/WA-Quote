import { redirect } from 'next/navigation';

/** Root entry — funnel users into the app shell. AuthGuard handles the login flow. */
export default function Home() {
  redirect('/dashboard');
}

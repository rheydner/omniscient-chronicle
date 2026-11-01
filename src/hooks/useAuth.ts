import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useChronicleStore } from '@/store/useChronicleStore';

export type AuthStatus = 'pending' | 'ready';

const GM_EMAILS = [
  'rheydnerjrrj@gmail.com',
  (process.env.NEXT_PUBLIC_GM_EMAIL || '').toLowerCase().trim(),
].filter(Boolean);

export function isUserGM(user: { email?: string | null } | null): boolean {
  if (!user?.email) return false;
  return GM_EMAILS.includes(user.email.toLowerCase().trim());
}

const registeredSessionSet = new Set<string>();

async function syncUserRegistry(user: User): Promise<void> {
  if (registeredSessionSet.has(user.uid)) return;
  registeredSessionSet.add(user.uid);
  try {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        lastSeenAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    registeredSessionSet.delete(user.uid);
    console.warn('[Chronicle Auth] Falha ao sincronizar registro de usuário:', err);
  }
}

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus>('pending');
  const [user, setUser] = useState<User | null>(null);
  const setAuthUser = useChronicleStore((s) => s.setAuthUser);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (cancelled) return;
      const gm = isUserGM(firebaseUser);
      setUser(firebaseUser);
      setStatus('ready');

      setAuthUser({
        uid: firebaseUser?.uid ?? null,
        email: firebaseUser?.email ?? null,
        displayName: firebaseUser?.displayName ?? null,
        photoURL: firebaseUser?.photoURL ?? null,
        isActualGM: gm,
      });

      if (firebaseUser) {
        void syncUserRegistry(firebaseUser);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [setAuthUser]);

  return { status, user };
}

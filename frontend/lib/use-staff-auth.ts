'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, staffToken, type StaffRole } from '@/lib/api';

export type StaffAuthStatus = 'checking' | 'anonymous' | 'authed';

/**
 * Shared staff session for the admin dashboard and the gate scanner.
 *
 * The password is verified by the backend, which returns a short-lived JWT — the
 * password itself is no longer present in the browser bundle. On mount any stored
 * token is revalidated against /api/auth/me so a token that expired while the tab
 * sat idle drops the user back to the sign-in screen instead of failing later.
 */
export function useStaffAuth() {
  const [status, setStatus] = useState<StaffAuthStatus>('checking');
  const [role, setRole] = useState<StaffRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;

    if (!staffToken.get()) {
      setStatus('anonymous');
      return;
    }

    api.auth
      .me()
      .then(({ role: verified }) => {
        if (!active) return;
        setRole(verified);
        setStatus('authed');
      })
      .catch(() => {
        if (!active) return;
        staffToken.clear();
        setStatus('anonymous');
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (password: string) => {
    setPending(true);
    setError(null);
    try {
      const { token, role: grantedRole } = await api.auth.login(password);
      staffToken.set(token);
      setRole(grantedRole);
      setStatus('authed');
      return true;
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.',
      );
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  const signOut = useCallback(() => {
    staffToken.clear();
    setRole(null);
    setStatus('anonymous');
    setError(null);
  }, []);

  /** Call when a request comes back 401 mid-session. */
  const handleAuthFailure = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.isAuthFailure) {
      staffToken.clear();
      setRole(null);
      setStatus('anonymous');
      setError('Your session expired. Please sign in again.');
      return true;
    }
    return false;
  }, []);

  return {
    status,
    role,
    error,
    pending,
    isAdmin: role === 'admin',
    signIn,
    signOut,
    handleAuthFailure,
    clearError: useCallback(() => setError(null), []),
  };
}

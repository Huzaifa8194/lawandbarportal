"use client";

import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";

export class PortalAccessDeniedError extends Error {
  constructor(public readonly reason?: string) {
    super("Portal access denied");
    this.name = "PortalAccessDeniedError";
  }
}

export class RedeemAccessCodeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "RedeemAccessCodeError";
  }
}

export type SignInResult = "ok" | "needs_code";

type AuthContextType = {
  user: User | null;
  isAdmin: boolean;
  accessEnabled: boolean;
  /** When signed in but `accessEnabled` is false, last portal-access `reason` (e.g. `no_bundle`). */
  portalAccessReason: string | undefined;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  redeemAccessCode: (code: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type PortalAccessApiResponse = {
  allowed: boolean;
  isAdmin: boolean;
  reason?: string;
};

async function fetchPortalAccess(user: User): Promise<PortalAccessApiResponse> {
  const token = await user.getIdToken();
  const res = await fetch("/api/auth/portal-access", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as PortalAccessApiResponse & { error?: string };
  if (!res.ok) {
    return { allowed: false, isAdmin: false, reason: "error" };
  }
  return data;
}

function applySessionCookies(allowed: boolean, isAdmin: boolean) {
  document.cookie = "lb_session=1; path=/; max-age=2592000; samesite=lax";
  document.cookie = `lb_admin=${isAdmin ? "1" : "0"}; path=/; max-age=2592000; samesite=lax`;
  document.cookie = `lb_access=${allowed ? "1" : "0"}; path=/; max-age=2592000; samesite=lax`;
}

function clearSessionCookies() {
  document.cookie = "lb_session=; path=/; max-age=0; samesite=lax";
  document.cookie = "lb_admin=; path=/; max-age=0; samesite=lax";
  document.cookie = "lb_access=; path=/; max-age=0; samesite=lax";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessEnabled, setAccessEnabled] = useState(true);
  const [portalAccessReason, setPortalAccessReason] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        try {
          const access = await fetchPortalAccess(currentUser);
          setIsAdmin(Boolean(access.isAdmin));
          setAccessEnabled(Boolean(access.allowed));
          setPortalAccessReason(access.allowed ? undefined : access.reason);
          applySessionCookies(access.allowed, Boolean(access.isAdmin));
        } catch {
          setIsAdmin(false);
          setAccessEnabled(false);
          setPortalAccessReason("error");
          applySessionCookies(false, false);
        }
      } else {
        setIsAdmin(false);
        setAccessEnabled(true);
        setPortalAccessReason(undefined);
        clearSessionCookies();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAdmin,
      accessEnabled,
      portalAccessReason,
      loading,
      signIn: async (email: string, password: string): Promise<SignInResult> => {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const access = await fetchPortalAccess(cred.user);
        if (access.allowed) {
          applySessionCookies(true, Boolean(access.isAdmin));
          return "ok";
        }
        if (access.reason === "no_bundle") {
          setIsAdmin(Boolean(access.isAdmin));
          setAccessEnabled(false);
          setPortalAccessReason("no_bundle");
          applySessionCookies(false, Boolean(access.isAdmin));
          return "needs_code";
        }
        await firebaseSignOut(auth);
        throw new PortalAccessDeniedError(access.reason);
      },
      signOut: async () => {
        await firebaseSignOut(auth);
      },
      redeemAccessCode: async (code: string) => {
        const current = auth.currentUser;
        if (!current) {
          throw new RedeemAccessCodeError("You must be signed in to redeem a code.", "NOT_SIGNED_IN");
        }
        const token = await current.getIdToken();
        const res = await fetch("/api/auth/redeem-access-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as { error?: string; code?: string; ok?: boolean };
        if (!res.ok) {
          throw new RedeemAccessCodeError(data.error || "Could not redeem code.", data.code || "UNKNOWN");
        }
        const access = await fetchPortalAccess(current);
        setIsAdmin(Boolean(access.isAdmin));
        setAccessEnabled(Boolean(access.allowed));
        setPortalAccessReason(access.allowed ? undefined : access.reason);
        applySessionCookies(access.allowed, Boolean(access.isAdmin));
      },
    }),
    [accessEnabled, isAdmin, loading, portalAccessReason, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

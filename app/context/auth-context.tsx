"use client";

import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";

type AuthContextType = {
  user: User | null;
  isAdmin: boolean;
  accessEnabled: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessEnabled, setAccessEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const profile = userDoc.data() as { isAdmin?: boolean; accessEnabled?: boolean } | undefined;
        const nextIsAdmin = Boolean(profile?.isAdmin);
        const nextAccessEnabled = profile?.accessEnabled !== false;

        setIsAdmin(nextIsAdmin);
        setAccessEnabled(nextAccessEnabled);

        document.cookie = "lb_session=1; path=/; max-age=2592000; samesite=lax";
        document.cookie = `lb_admin=${nextIsAdmin ? "1" : "0"}; path=/; max-age=2592000; samesite=lax`;
      } else {
        setIsAdmin(false);
        setAccessEnabled(true);
        document.cookie = "lb_session=; path=/; max-age=0; samesite=lax";
        document.cookie = "lb_admin=; path=/; max-age=0; samesite=lax";
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
      loading,
      signIn: async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOut: async () => {
        await firebaseSignOut(auth);
      },
    }),
    [accessEnabled, isAdmin, loading, user],
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

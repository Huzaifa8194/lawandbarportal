"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/app/context/auth-context";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, user, isAdmin, accessEnabled } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login?next=/admin");
      return;
    }
    if (!isAdmin || !accessEnabled) {
      router.replace("/unauthorized");
    }
  }, [accessEnabled, isAdmin, loading, router, user]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Checking admin permissions...
      </div>
    );
  }

  if (!user || !isAdmin || !accessEnabled) return null;
  return <>{children}</>;
}

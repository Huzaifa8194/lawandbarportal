"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";

export default function LogoutButton() {
  const router = useRouter();
  const { signOut } = useAuth();

  const onLogout = async () => {
    await signOut();
    router.push("/auth/login");
  };

  return (
    <button
      onClick={onLogout}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
    >
      Sign out
    </button>
  );
}

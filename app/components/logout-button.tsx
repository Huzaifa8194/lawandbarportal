"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";

type LogoutButtonProps = {
  variant?: "default" | "sidebar";
};

export default function LogoutButton({ variant = "default" }: LogoutButtonProps) {
  const router = useRouter();
  const { signOut } = useAuth();

  const onLogout = async () => {
    await signOut();
    router.push("/auth/login");
  };

  const isSidebar = variant === "sidebar";

  return (
    <button
      type="button"
      onClick={onLogout}
      className={
        isSidebar
          ? "flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          : "rounded-lg border border-[#121f1d]/15 bg-white px-3 py-1.5 text-sm font-medium text-[#121f1d] transition hover:bg-[#121f1d]/5"
      }
    >
      <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Sign out
    </button>
  );
}

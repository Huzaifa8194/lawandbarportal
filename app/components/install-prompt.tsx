"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "lb_install_dismissed_at";
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true
  );
}

function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

function shouldRemind(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return true;
    return Date.now() - Number(raw) > REMIND_AFTER_MS;
  } catch {
    return true;
  }
}

function saveDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [phase, setPhase] = useState<"hidden" | "entering" | "visible" | "exiting">("hidden");
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isStandalone() || !isMobileUA()) return;

    setIsIOS(isIOSDevice());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setPhase("hidden"));

    timerRef.current = setTimeout(() => {
      if (shouldRemind()) {
        setPhase("entering");
        setTimeout(() => setPhase("visible"), 20);
      }
    }, 2500);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timerRef.current);
    };
  }, []);

  const dismiss = useCallback(() => {
    setPhase("exiting");
    saveDismiss();
    setTimeout(() => setPhase("hidden"), 400);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setPhase("hidden");
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSTip(true);
    } else {
      setShowIOSTip(true);
    }
  }, [deferredPrompt, isIOS]);

  if (phase === "hidden") return null;

  const animClass =
    phase === "entering" || phase === "exiting"
      ? "translate-y-full opacity-0"
      : "translate-y-0 opacity-100";

  return (
    <>
      {/* Animated bottom sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-5 transition-all duration-500 ease-out ${animClass}`}
      >
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#121f1d] shadow-2xl shadow-black/40">
          {/* Glow accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#26d9c0] to-transparent lb-glow-pulse" />

          <div className="px-5 pb-4 pt-4">
            <div className="flex items-start gap-3">
              {/* Animated icon */}
              <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#26d9c0]/15">
                <div className="absolute inset-0 rounded-xl bg-[#26d9c0]/20 lb-ping-slow" />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#26d9c0"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  Get the Law &amp; Bar App
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/55">
                  Install for faster access, offline study, and a native
                  experience.
                </p>
              </div>

              {/* Close / skip */}
              <button
                onClick={dismiss}
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white/70"
                aria-label="Dismiss"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex gap-2.5">
              <button
                onClick={dismiss}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/5"
              >
                Not now
              </button>
              <button
                onClick={handleInstall}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#26d9c0] px-4 py-2.5 text-sm font-semibold text-[#121f1d] transition hover:brightness-110 active:scale-[0.98] lb-btn-glow"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download App
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* iOS / generic instructions modal */}
      {showIOSTip && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowIOSTip(false)}
        >
          <div
            className="mx-4 mb-6 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl lb-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#26d9c0] to-transparent" />
            <div className="space-y-3 p-6">
              <h3 className="text-lg font-bold text-gray-900">
                Install Law &amp; Bar
              </h3>
              {isIOS ? (
                <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#26d9c0]/15 text-xs font-bold text-[#0d4a42]">1</span>
                    <p>
                      Tap the{" "}
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-0.5">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                      </svg>{" "}
                      <strong>Share</strong> button at the bottom of Safari.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#26d9c0]/15 text-xs font-bold text-[#0d4a42]">2</span>
                    <p>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#26d9c0]/15 text-xs font-bold text-[#0d4a42]">3</span>
                    <p>Tap <strong>&quot;Add&quot;</strong> to confirm. The app icon will appear on your home screen.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#26d9c0]/15 text-xs font-bold text-[#0d4a42]">1</span>
                    <p>Open this page in <strong>Chrome</strong> or <strong>Edge</strong>.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#26d9c0]/15 text-xs font-bold text-[#0d4a42]">2</span>
                    <p>Tap the <strong>menu (⋮)</strong> in the top-right corner.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#26d9c0]/15 text-xs font-bold text-[#0d4a42]">3</span>
                    <p>Select <strong>&quot;Install App&quot;</strong> or <strong>&quot;Add to Home Screen&quot;</strong>.</p>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => {
                    setShowIOSTip(false);
                    dismiss();
                  }}
                  className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
                >
                  Maybe later
                </button>
                <button
                  onClick={() => setShowIOSTip(false)}
                  className="rounded-lg bg-[#26d9c0] px-4 py-2 text-sm font-semibold text-[#121f1d] hover:brightness-110"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

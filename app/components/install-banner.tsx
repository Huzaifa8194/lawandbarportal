"use client";

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (!isMobileUA()) return;

    setIsIOS(isIOSDevice());
    setShow(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShow(false);
      setDeferredPrompt(null);
    } else {
      setShowSteps(true);
    }
  }, [deferredPrompt]);

  if (!show) return null;

  return (
    <div className="mt-5 lb-slide-up">
      <div className="relative overflow-hidden rounded-2xl border border-[#26d9c0]/25 bg-gradient-to-br from-[#0d1f1c] to-[#152e29]">
        {/* Animated glow border */}
        <div className="absolute inset-0 rounded-2xl lb-border-glow pointer-events-none" />

        <div className="relative px-5 py-4">
          <div className="flex items-center gap-3">
            {/* Animated download icon */}
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#26d9c0]/15">
              <div className="absolute inset-0 rounded-xl bg-[#26d9c0]/10 lb-ping-slow" />
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#26d9c0"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lb-bounce-subtle"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                Download the App
              </p>
              <p className="text-[11px] leading-snug text-white/50">
                Faster access &middot; Offline study &middot; Better experience
              </p>
            </div>
          </div>

          {!showSteps ? (
            <button
              onClick={handleInstall}
              className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#26d9c0] py-2.5 text-sm font-semibold text-[#121f1d] transition active:scale-[0.98] lb-btn-glow"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Install Law &amp; Bar
            </button>
          ) : (
            <div className="mt-3 space-y-2 lb-slide-up">
              {isIOS ? (
                <>
                  <Step n={1}>
                    Tap the{" "}
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-0.5">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>{" "}
                    <strong>Share</strong> button in Safari
                  </Step>
                  <Step n={2}>Tap <strong>&quot;Add to Home Screen&quot;</strong></Step>
                  <Step n={3}>Tap <strong>&quot;Add&quot;</strong> to confirm</Step>
                </>
              ) : (
                <>
                  <Step n={1}>Open this page in <strong>Chrome</strong></Step>
                  <Step n={2}>Tap <strong>menu ⋮</strong> (top right)</Step>
                  <Step n={3}>Select <strong>&quot;Install App&quot;</strong></Step>
                </>
              )}
              <button
                onClick={() => setShowSteps(false)}
                className="mt-1 w-full text-center text-xs text-white/40 hover:text-white/60"
              >
                Hide steps
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-xs leading-relaxed text-white/70">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#26d9c0]/20 text-[10px] font-bold text-[#26d9c0]">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </div>
  );
}

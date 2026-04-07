"use client";

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const ios = isIOSDevice();
    setIsIOS(ios);

    if (ios || isMobile()) {
      setVisible(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setVisible(false));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setVisible(false);
      setDeferredPrompt(null);
    } else if (!isIOS) {
      setShowIOSTip(true);
    }
  }, [deferredPrompt, isIOS]);

  if (!visible || dismissed) return null;

  return (
    <>
      <button
        onClick={isIOS ? () => setShowIOSTip(true) : handleInstall}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg transition hover:scale-105 hover:shadow-xl active:scale-95"
        style={{ backgroundColor: "#26d9c0", color: "#121f1d" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download App
      </button>

      {showIOSTip && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowIOSTip(false)}
        >
          <div
            className="mx-4 mb-8 w-full max-w-sm space-y-3 rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900">
              Install Law &amp; Bar
            </h3>
            {isIOS ? (
              <p className="text-sm text-gray-600 leading-relaxed">
                Tap the{" "}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="inline -mt-0.5"
                >
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>{" "}
                <strong>Share</strong> button in Safari, then tap{" "}
                <strong>&quot;Add to Home Screen&quot;</strong>.
              </p>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed">
                Open this site in <strong>Chrome</strong> or{" "}
                <strong>Edge</strong>, then tap the{" "}
                <strong>menu (⋮)</strong> and select{" "}
                <strong>&quot;Add to Home Screen&quot;</strong> or{" "}
                <strong>&quot;Install App&quot;</strong>.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowIOSTip(false);
                  setDismissed(true);
                }}
                className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
              >
                Not now
              </button>
              <button
                onClick={() => setShowIOSTip(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: "#26d9c0", color: "#121f1d" }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

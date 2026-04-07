"use client";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4 px-6">
        <h1 className="text-3xl font-serif font-bold">You&apos;re Offline</h1>
        <p className="text-lg opacity-70">
          Please check your internet connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-block rounded-lg bg-lb-accent px-6 py-3 text-sm font-semibold text-lb-sidebar transition hover:opacity-90"
        >
          Retry
        </button>
      </div>
    </main>
  );
}

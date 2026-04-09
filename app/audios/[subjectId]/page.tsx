"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import PortalShell from "../../components/portal-shell";
import { usePortalLiveData } from "../../lib/use-portal-live";

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export default function AudioSubjectPage() {
  const params = useParams<{ subjectId: string }>();
  const { subjects, audios, loading } = usePortalLiveData({ includeAttempts: false });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const subject = subjects.find((item) => item.id === params.subjectId);
  const subjectAudios = useMemo(
    () => audios.filter((item) => item.subjectId === params.subjectId),
    [audios, params.subjectId],
  );

  const [selectedAudioId, setSelectedAudioId] = useState<string>("");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    setSelectedAudioId((prev) =>
      prev && subjectAudios.some((audio) => audio.id === prev) ? prev : subjectAudios[0]?.id ?? "",
    );
  }, [subjectAudios]);

  const selectedAudio = subjectAudios.find((item) => item.id === selectedAudioId) ?? null;
  const backTrackHref = subject?.track === "FLK 2" ? "/audios/flk2" : "/audios/flk1";

  if (!loading && !subject) {
    return (
      <PortalShell title="Audios" subtitle="Subject not found.">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Subject not found or not published.
          <Link href="/audios" className="ml-2 font-semibold underline">
            Back to audios
          </Link>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell
      title={subject ? `${subject.name} - Audio Learning` : "Audio Learning"}
      subtitle="Listen by subject with an audio-only study experience."
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link href={backTrackHref} className="text-sm font-medium text-[#0d4a42] hover:text-[#26d9c0]">
          ← Back to {subject?.track ?? "track"} audios
        </Link>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            {selectedAudio ? (
              <>
                <h2 className="text-lg font-semibold text-slate-900">{selectedAudio.title}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {formatTime(position)} / {formatTime(duration)}
                </p>
                <audio
                  ref={audioRef}
                  key={selectedAudio.id}
                  src={selectedAudio.fileUrl}
                  controls
                  className="mt-3 w-full"
                  onLoadedMetadata={(event) => {
                    setDuration(event.currentTarget.duration || 0);
                    event.currentTarget.playbackRate = rate;
                  }}
                  onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime || 0)}
                />
                <div className="mt-3 flex gap-1.5">
                  {[0.75, 1, 1.25, 1.5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setRate(value);
                        if (audioRef.current) audioRef.current.playbackRate = value;
                      }}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        rate === value
                          ? "border-[#26d9c0]/60 bg-[#26d9c0]/10 text-[#0d4a42]"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      {value}x
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">No audio lessons available for this subject yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Audio lessons</h3>
            <div className="mt-2 max-h-[360px] space-y-1.5 overflow-auto">
              {subjectAudios.map((audio, index) => {
                const active = audio.id === selectedAudioId;
                return (
                  <button
                    key={audio.id}
                    type="button"
                    onClick={() => setSelectedAudioId(audio.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      active
                        ? "border-[#26d9c0]/50 bg-[#26d9c0]/10 text-[#0d4a42]"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {index + 1}. {audio.title}
                  </button>
                );
              })}
              {subjectAudios.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                  No audio lessons published yet.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

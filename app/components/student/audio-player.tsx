"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { studentApi } from "@/lib/services/student-api";

export default function AudioPlayer({
  audioId,
  audioUrl,
  title,
}: {
  audioId: string;
  audioUrl: string;
  title: string;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = (await studentApi.getAudioState(audioId)) as
          | { currentSeconds?: number; playbackRate?: number }
          | null;
        if (!saved) return;
        setPosition(saved.currentSeconds || 0);
        setRate(saved.playbackRate || 1);
      } finally {
        setReady(true);
      }
    };
    load().catch(() => setReady(true));
  }, [audioId]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      studentApi
        .saveAudioState(audioId, { currentSeconds: Math.floor(position), playbackRate: rate })
        .catch(() => undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [audioId, position, rate, ready]);

  const durationText = useMemo(() => {
    const d = Math.floor(duration || 0);
    const m = Math.floor(d / 60);
    const s = d % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [duration]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>
      <audio
        ref={ref}
        src={audioUrl}
        controls
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
          event.currentTarget.currentTime = position || 0;
          event.currentTarget.playbackRate = rate;
        }}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime || 0)}
        className="w-full"
      />
      <div className="flex flex-wrap items-center gap-2">
        {[1, 1.25, 1.5, 2].map((value) => (
          <button
            key={value}
            onClick={() => {
              setRate(value);
              if (ref.current) ref.current.playbackRate = value;
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              rate === value
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-700"
            }`}
          >
            {value}x
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Resume saved automatically. Duration: {durationText}
      </p>
    </div>
  );
}

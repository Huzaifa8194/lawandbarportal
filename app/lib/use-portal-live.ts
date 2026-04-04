"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  listAudios,
  listBooks,
  listMcqs,
  listMockExams,
  listSubjects,
  listVideos,
} from "@/lib/repositories/portal-repository";
import type {
  Attempt,
  AudioLesson,
  Book,
  Mcq,
  MockExam,
  Subject,
  VideoLesson,
} from "@/lib/types/admin";
import { useAuth } from "../context/auth-context";
import { studentApi } from "@/lib/services/student-api";

type PortalLiveOptions = {
  includeAttempts?: boolean;
};

export function usePortalLiveData(options?: PortalLiveOptions) {
  const includeAttempts = options?.includeAttempts ?? true;
  const pathname = usePathname();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [audios, setAudios] = useState<AudioLesson[]>([]);
  const [mcqs, setMcqs] = useState<Mcq[]>([]);
  const [mocks, setMocks] = useState<MockExam[]>([]);
  const [videos, setVideos] = useState<VideoLesson[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [subjectsResp, booksResp, audiosResp, mcqsResp, mocksResp, videosResp] = await Promise.all([
          listSubjects(),
          listBooks(),
          listAudios(),
          listMcqs(),
          listMockExams(),
          listVideos(),
        ]);
        if (!mounted) return;
        setSubjects(subjectsResp.filter((item) => item.published));
        setBooks(booksResp.filter((item) => item.published));
        setAudios(audiosResp.filter((item) => item.published));
        setMcqs(mcqsResp.filter((item) => item.published));
        setMocks(mocksResp.filter((item) => item.published));
        setVideos(videosResp.filter((item) => item.published));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!includeAttempts || !user) {
      setAttempts([]);
      setAttemptsLoading(false);
      return;
    }
    let cancelled = false;
    setAttemptsLoading(true);
    (async () => {
      try {
        const attemptsResp = await studentApi.listAttempts();
        if (!cancelled) setAttempts(attemptsResp.data as Attempt[]);
      } catch {
        if (!cancelled) setAttempts([]);
      } finally {
        if (!cancelled) setAttemptsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, includeAttempts, pathname]);

  return { subjects, books, audios, videos, mcqs, mocks, attempts, loading, attemptsLoading };
}

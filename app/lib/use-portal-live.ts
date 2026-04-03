"use client";

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
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [audios, setAudios] = useState<AudioLesson[]>([]);
  const [mcqs, setMcqs] = useState<Mcq[]>([]);
  const [mocks, setMocks] = useState<MockExam[]>([]);
  const [videos, setVideos] = useState<VideoLesson[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

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

        if (user && includeAttempts) {
          try {
            const attemptsResp = (await studentApi.listAttempts()) as Attempt[];
            if (mounted) setAttempts(attemptsResp);
          } catch {
            if (mounted) setAttempts([]);
          }
        } else {
          setAttempts([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user, includeAttempts]);

  return { subjects, books, audios, videos, mcqs, mocks, attempts, loading };
}

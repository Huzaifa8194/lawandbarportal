"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  listAudios,
  listBooks,
  listMcqs,
  listMergedMockExamsForStudent,
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
  catalogOnlyLoading?: boolean;
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
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;
    async function loadCatalog() {
      setLoading(true);
      setCatalogError(false);
      try {
        const [subjectsResp, booksResp] = await Promise.race([
          Promise.all([listSubjects(), listBooks()]),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Catalog timed out")), 15_000); }),
        ]);
        if (!mounted) return;
        setSubjects(subjectsResp.filter((item) => item.published));
        setBooks(booksResp.filter((item) => item.published));
      } catch {
        if (mounted) setCatalogError(true);
      } finally {
        clearTimeout(timer!);
        if (mounted) setLoading(false);
      }
    }
    void loadCatalog();
    return () => { mounted = false; clearTimeout(timer); };
  }, [user, catalogAttempt]);

  useEffect(() => {
    let mounted = true;
    async function loadResources() {
      setResourcesLoading(true);
      const [audiosResp, mcqsResp, mocksResp, videosResp] = await Promise.allSettled([
        listAudios(), listMcqs(),
        listMergedMockExamsForStudent(user ? { uid: user.uid, email: user.email ?? null } : null),
        listVideos(),
      ]);
      if (!mounted) return;
      if (audiosResp.status === "fulfilled") setAudios(audiosResp.value.filter((item) => item.published));
      if (mcqsResp.status === "fulfilled") setMcqs(mcqsResp.value.filter((item) => item.published));
      if (mocksResp.status === "fulfilled") setMocks(mocksResp.value.filter((item) => item.published && (item.track === "FLK 1" || item.track === "FLK 2")));
      if (videosResp.status === "fulfilled") setVideos(videosResp.value.filter((item) => item.published));
      setResourcesLoading(false);
    }
    void loadResources();
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

  return { subjects, books, audios, videos, mcqs, mocks, attempts, loading: loading || (!options?.catalogOnlyLoading && resourcesLoading), attemptsLoading, catalogError, retryCatalog: () => setCatalogAttempt((attempt) => attempt + 1) };
}

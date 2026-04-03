"use client";

import { useEffect, useState } from "react";
import {
  listAudios,
  listBooks,
  listMcqs,
  listMockExams,
  listSubjects,
} from "@/lib/repositories/portal-repository";
import type { Attempt, AudioLesson, Book, Mcq, MockExam, Subject } from "@/lib/types/admin";
import { useAuth } from "../context/auth-context";
import { studentApi } from "@/lib/services/student-api";

export function usePortalLiveData() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [audios, setAudios] = useState<AudioLesson[]>([]);
  const [mcqs, setMcqs] = useState<Mcq[]>([]);
  const [mocks, setMocks] = useState<MockExam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [subjectsResp, booksResp, audiosResp, mcqsResp, mocksResp] = await Promise.all([
          listSubjects(),
          listBooks(),
          listAudios(),
          listMcqs(),
          listMockExams(),
        ]);
        if (!mounted) return;
        setSubjects(subjectsResp.filter((item) => item.published));
        setBooks(booksResp.filter((item) => item.published));
        setAudios(audiosResp.filter((item) => item.published));
        setMcqs(mcqsResp.filter((item) => item.published));
        setMocks(mocksResp.filter((item) => item.published));

        if (user) {
          const attemptsResp = (await studentApi.listAttempts()) as Attempt[];
          if (mounted) setAttempts(attemptsResp);
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
  }, [user]);

  return { subjects, books, audios, mcqs, mocks, attempts, loading };
}

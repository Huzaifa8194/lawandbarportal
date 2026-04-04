"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataPagination from "../components/data-pagination";
import PortalShell from "../components/portal-shell";
import { usePortalLiveData } from "../lib/use-portal-live";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const { subjects, books, audios, videos, mcqs, mocks } = usePortalLiveData();
  const q = query.trim().toLowerCase();

  const [bookPage, setBookPage] = useState(1);
  const [bookPageSize, setBookPageSize] = useState(10);
  const [mcqPage, setMcqPage] = useState(1);
  const [mcqPageSize, setMcqPageSize] = useState(10);
  const [mockPage, setMockPage] = useState(1);
  const [mockPageSize, setMockPageSize] = useState(10);
  const [videoPage, setVideoPage] = useState(1);
  const [videoPageSize, setVideoPageSize] = useState(10);

  useEffect(() => {
    setBookPage(1);
    setMcqPage(1);
    setMockPage(1);
    setVideoPage(1);
  }, [q]);

  const filteredSubjects = useMemo(
    () => subjects.filter((item) => !q || item.name.toLowerCase().includes(q)),
    [q, subjects],
  );
  const filteredMcqs = useMemo(
    () => mcqs.filter((item) => !q || item.question.toLowerCase().includes(q)),
    [mcqs, q],
  );
  const filteredMocks = useMemo(
    () => mocks.filter((item) => !q || item.title.toLowerCase().includes(q)),
    [mocks, q],
  );
  const filteredVideos = useMemo(
    () => videos.filter((item) => !q || item.title.toLowerCase().includes(q)),
    [videos, q],
  );

  const bookTotalPages = Math.max(1, Math.ceil(filteredSubjects.length / bookPageSize) || 1);
  const mcqTotalPages = Math.max(1, Math.ceil(filteredMcqs.length / mcqPageSize) || 1);
  const mockTotalPages = Math.max(1, Math.ceil(filteredMocks.length / mockPageSize) || 1);
  const videoTotalPages = Math.max(1, Math.ceil(filteredVideos.length / videoPageSize) || 1);

  useEffect(() => {
    if (bookPage > bookTotalPages) setBookPage(bookTotalPages);
  }, [bookPage, bookTotalPages]);
  useEffect(() => {
    if (mcqPage > mcqTotalPages) setMcqPage(mcqTotalPages);
  }, [mcqPage, mcqTotalPages]);
  useEffect(() => {
    if (mockPage > mockTotalPages) setMockPage(mockTotalPages);
  }, [mockPage, mockTotalPages]);
  useEffect(() => {
    if (videoPage > videoTotalPages) setVideoPage(videoTotalPages);
  }, [videoPage, videoTotalPages]);

  const pagedSubjects = useMemo(() => {
    const start = (bookPage - 1) * bookPageSize;
    return filteredSubjects.slice(start, start + bookPageSize);
  }, [filteredSubjects, bookPage, bookPageSize]);

  const pagedMcqs = useMemo(() => {
    const start = (mcqPage - 1) * mcqPageSize;
    return filteredMcqs.slice(start, start + mcqPageSize);
  }, [filteredMcqs, mcqPage, mcqPageSize]);

  const pagedMocks = useMemo(() => {
    const start = (mockPage - 1) * mockPageSize;
    return filteredMocks.slice(start, start + mockPageSize);
  }, [filteredMocks, mockPage, mockPageSize]);

  const pagedVideos = useMemo(() => {
    const start = (videoPage - 1) * videoPageSize;
    return filteredVideos.slice(start, start + videoPageSize);
  }, [filteredVideos, videoPage, videoPageSize]);

  return (
    <PortalShell
      title="Search"
      subtitle="Search across books, audio lessons, subjects, and MCQs."
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="text-sm font-medium text-slate-700" htmlFor="portal-search">
          Global search
        </label>
        <input
          id="portal-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search subjects, books, audios, mock questions..."
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:ring"
        />
        <p className="mt-2 text-xs text-slate-500">
          Search is scoped across published subjects, books, audios, MCQs, and mock exams. Each column
          paginates independently.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Books & Audio</h3>
          <DataPagination
            variant="neutral"
            className="mt-3 border-b border-slate-100 pb-3"
            label="Books and audio results pagination"
            total={filteredSubjects.length}
            page={bookPage}
            pageSize={bookPageSize}
            onPageChange={setBookPage}
            onPageSizeChange={(n) => {
              setBookPageSize(n);
              setBookPage(1);
            }}
          />
          <div className="mt-3 space-y-2">
            {pagedSubjects.map((item) => {
              const book = books.find((bookItem) => bookItem.subjectId === item.id);
              const audio = audios.find((audioItem) => audioItem.subjectId === item.id);
              return (
                <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-slate-600">
                    {book?.title || "No book"} | {audio?.title || "No audio"} |{" "}
                    {(videos.filter((video) => video.subjectId === item.id).length || 0).toString()} videos
                  </p>
                  <Link href={`/subjects/${item.id}`} className="mt-2 inline-block text-xs text-slate-700 underline">
                    Open subject
                  </Link>
                </div>
              );
            })}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">MCQs</h3>
          <DataPagination
            variant="neutral"
            className="mt-3 border-b border-slate-100 pb-3"
            label="MCQ results pagination"
            total={filteredMcqs.length}
            page={mcqPage}
            pageSize={mcqPageSize}
            onPageChange={setMcqPage}
            onPageSizeChange={(n) => {
              setMcqPageSize(n);
              setMcqPage(1);
            }}
          />
          <div className="mt-3 space-y-2">
            {pagedMcqs.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm font-medium">{item.subjectName}</p>
                <p className="text-xs text-slate-600">{item.question}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Mocks</h3>
          <DataPagination
            variant="neutral"
            className="mt-3 border-b border-slate-100 pb-3"
            label="Mock exam results pagination"
            total={filteredMocks.length}
            page={mockPage}
            pageSize={mockPageSize}
            onPageChange={setMockPage}
            onPageSizeChange={(n) => {
              setMockPageSize(n);
              setMockPage(1);
            }}
          />
          <div className="mt-3 space-y-2">
            {pagedMocks.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-slate-600">
                  {item.track} • {item.durationMinutes} min
                </p>
                <div className="mt-2 flex gap-2">
                  <Link href={`/mocks/${item.id}?mode=practice`} className="text-xs underline">
                    Practice
                  </Link>
                  <Link href={`/mocks/${item.id}?mode=exam`} className="text-xs underline">
                    Exam
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Videos</h3>
          <DataPagination
            variant="neutral"
            className="mt-3 border-b border-slate-100 pb-3"
            label="Video results pagination"
            total={filteredVideos.length}
            page={videoPage}
            pageSize={videoPageSize}
            onPageChange={setVideoPage}
            onPageSizeChange={(n) => {
              setVideoPageSize(n);
              setVideoPage(1);
            }}
          />
          <div className="mt-3 space-y-2">
            {pagedVideos.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-slate-600">{item.subjectName}</p>
                <Link href={`/subjects/${item.subjectId}`} className="mt-2 inline-block text-xs underline">
                  Watch in subject workspace
                </Link>
              </div>
            ))}
          </div>
        </article>
      </section>
    </PortalShell>
  );
}

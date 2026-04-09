export type PdfBookmark = {
  id: string;
  page: number;
  label: string;
  createdAt: string;
};

export type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PdfNote = {
  id: string;
  page: number;
  text: string;
  selectedText?: string;
  rects?: HighlightRect[];
  createdAt: string;
};

export type PdfHighlight = {
  id: string;
  page: number;
  text: string;
  color: "yellow" | "green" | "blue" | "pink";
  rects?: HighlightRect[];
  createdAt: string;
};

export type PdfStudyState = {
  bookId: string;
  currentPage: number;
  bookmarks: PdfBookmark[];
  notes: PdfNote[];
  highlights: PdfHighlight[];
  updatedAt: string;
};

export type AudioStudyState = {
  audioId: string;
  currentSeconds: number;
  playbackRate: number;
  updatedAt: string;
};

export type AttemptAnswer = {
  mcqId: string;
  selectedOption: number;
  correctOption: number;
  isCorrect: boolean;
};

export type StudentAttempt = {
  id: string;
  userId: string;
  mockId: string;
  mode: "practice" | "exam";
  score: number;
  totalQuestions: number;
  answers: AttemptAnswer[];
  createdAt: string;
};

export type AttemptsPaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedAttemptsResponse = {
  data: StudentAttempt[];
  pagination: AttemptsPaginationMeta;
};

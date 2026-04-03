export type PdfBookmark = {
  id: string;
  page: number;
  label: string;
  createdAt: string;
};

export type PdfNote = {
  id: string;
  page: number;
  text: string;
  createdAt: string;
};

export type PdfHighlight = {
  id: string;
  page: number;
  text: string;
  color: "yellow" | "green" | "blue" | "pink";
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

export type FlkTrack = "FLK 1" | "FLK 2";

export type UserProfile = {
  uid: string;
  email: string;
  fullName?: string;
  isAdmin?: boolean;
  accessEnabled?: boolean;
  createdAt?: string;
};

export type Subject = {
  id: string;
  name: string;
  track: FlkTrack;
  order: number;
  published: boolean;
};

export type Book = {
  id: string;
  subjectId: string;
  subjectName: string;
  track: FlkTrack;
  title: string;
  description?: string;
  fileUrl: string;
  filePath: string;
  published: boolean;
  updatedAt?: string;
};

export type AudioLesson = {
  id: string;
  subjectId: string;
  subjectName: string;
  track: FlkTrack;
  bookId?: string;
  title: string;
  fileUrl: string;
  filePath: string;
  durationSeconds?: number;
  published: boolean;
  updatedAt?: string;
};

export type VideoLesson = {
  id: string;
  subjectId: string;
  subjectName: string;
  track: FlkTrack;
  bookId?: string;
  title: string;
  description?: string;
  fileUrl: string;
  filePath: string;
  durationSeconds?: number;
  published: boolean;
  updatedAt?: string;
};

export type Mcq = {
  id: string;
  subjectId: string;
  subjectName: string;
  track: FlkTrack;
  question: string;
  options: [string, string, string, string, string];
  correctOption: number;
  explanation: string;
  published: boolean;
  updatedAt?: string;
};

export type MockExam = {
  id: string;
  title: string;
  track: FlkTrack;
  subjectIds: string[];
  questionIds: string[];
  durationMinutes: number;
  examMode: boolean;
  revealAnswersInPractice: boolean;
  published: boolean;
  updatedAt?: string;
};

export type AccessCode = {
  id: string;
  code: string;
  email?: string;
  uid?: string;
  active: boolean;
  expiresAt?: string;
  usedAt?: string;
};

export type Attempt = {
  id: string;
  userId: string;
  mockId: string;
  mode?: "practice" | "exam";
  score: number;
  totalQuestions?: number;
  answers?: Array<{
    mcqId: string;
    selectedOption: number;
    correctOption: number;
    isCorrect: boolean;
  }>;
  createdAt?: string;
};

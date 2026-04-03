export type SubjectResource = {
  id: string;
  track: "FLK 1" | "FLK 2";
  subject: string;
  bookTitle: string;
  bookProgress: number;
  audioTitle: string;
  audioDuration: string;
  audioPosition: string;
};

export type McqQuestion = {
  id: string;
  track: "FLK 1" | "FLK 2";
  subject: string;
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
};

export const subjectResources: SubjectResource[] = [
  {
    id: "business-law",
    track: "FLK 1",
    subject: "Business Law and Practice",
    bookTitle: "Business Law Essentials",
    bookProgress: 62,
    audioTitle: "Chapter 5: Company Structures",
    audioDuration: "42m",
    audioPosition: "18m 11s",
  },
  {
    id: "contract",
    track: "FLK 1",
    subject: "Contract Law",
    bookTitle: "SQE Contract Principles",
    bookProgress: 41,
    audioTitle: "Offer, Acceptance and Consideration",
    audioDuration: "35m",
    audioPosition: "12m 49s",
  },
  {
    id: "property",
    track: "FLK 2",
    subject: "Property Practice",
    bookTitle: "Property Transactions Guide",
    bookProgress: 73,
    audioTitle: "Completion and Post-Completion",
    audioDuration: "28m",
    audioPosition: "21m 03s",
  },
];

export const latestMockScores = [
  { name: "FLK 1 Mixed Mock 03", score: 71, mode: "Exam" },
  { name: "Contract Timed Practice", score: 78, mode: "Practice" },
  { name: "Property Drill Set 02", score: 66, mode: "Practice" },
];

export const mcqQuestions: McqQuestion[] = [
  {
    id: "q1",
    track: "FLK 1",
    subject: "Contract Law",
    question: "Which element is required for a valid contract in English law?",
    options: [
      "Moral intention",
      "Consideration",
      "Witness signature",
      "Registration",
      "Notarization",
    ],
    correctOption: 1,
    explanation:
      "Consideration is a core requirement alongside offer, acceptance, and intention to create legal relations.",
  },
  {
    id: "q2",
    track: "FLK 2",
    subject: "Property Practice",
    question: "When does legal title transfer on a registered disposition?",
    options: [
      "On exchange",
      "On completion",
      "On registration",
      "On payment of SDLT",
      "On contract execution",
    ],
    correctOption: 2,
    explanation:
      "For registered land, legal title generally transfers on registration at HM Land Registry.",
  },
];

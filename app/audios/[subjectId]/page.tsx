/**
 * `/audios/[subjectId]` (same dynamic shape as `/subjects/[subjectId]`).
 * Re-exports the shared workspace; audio lists use `audiosForSubjectSorted` there
 * (Chapter 1, Topic 2, … numeric sequence).
 */
export { default } from "../../subjects/[subjectId]/page";

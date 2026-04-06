## Law & Bar SQE Study Portal

Student portal for SQE books, subject audio, mocks, and progress tracking.

This app is structured to share the same Firebase auth/database project as the main website.

## Getting Started

1) Install dependencies yourself (do this in `lawandbarportal`):

```bash
npm install
npm install firebase
npm install firebase-admin
```

2) Create `.env.local` from `.env.example` and set these values to match your main website Firebase project:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
GROQ_API_KEY=
```

3) Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional Library Stack (Install Yourself)

For richer student UX (recommended), run these yourself:

```bash
npm install @react-pdf-viewer/core @react-pdf-viewer/default-layout pdfjs-dist
```

If you prefer annotation-heavy commercial-grade PDF tooling later, we can switch to a paid SDK.
Current implementation includes a no-dependency fallback viewer so the app still runs without these packages.

## Current Auth Wiring

- Firebase client setup: `lib/firebase.ts`
- Auth provider/context: `app/context/auth-context.tsx`
- Login page: `app/auth/login/page.tsx`
- Protected routes middleware: `middleware.ts`
- Secure admin request verification: `app/api/admin/_lib/auth.ts`
- Firebase admin SDK setup: `lib/firebase-admin.ts`

Protected pages include:

- `/`
- `/subjects/*`
- `/mocks`
- `/progress`
- `/search`
- `/admin`

Student AI assistant:

- Add `GROQ_API_KEY` in `.env.local` to enable the chatbot.
- The assistant is available in user pages and uses page-aware context (subjects, mocks, progress, and current page data).

Admin CRUD modules:

- `/admin/students`
- `/admin/subjects`
- `/admin/books`
- `/admin/audios`
- `/admin/mcqs`
- `/admin/mocks`

Student pages now read from Firestore-backed repositories in `lib/repositories/portal-repository.ts`.

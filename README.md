## Law & Bar SQE Study Portal

Student portal for SQE books, subject audio, mocks, and progress tracking.

This app is structured to share the same Firebase auth/database project as the main website.

## Getting Started

1) Install dependencies yourself (do this in `lawandbarportal`):

```bash
npm install
npm install firebase
```

2) Create `.env.local` from `.env.example` and set these values to match your main website Firebase project:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

3) Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Current Auth Wiring

- Firebase client setup: `lib/firebase.ts`
- Auth provider/context: `app/context/auth-context.tsx`
- Login page: `app/auth/login/page.tsx`
- Protected routes middleware: `middleware.ts`

Protected pages currently include:

- `/`
- `/subjects/*`
- `/mocks`
- `/progress`
- `/search`
- `/admin`

## Next Integration Step

Connect page data currently in `app/lib/portal-data.ts` to Firestore collections for:

- subjects
- books
- audios
- mcqs
- mock_exams
- attempts / scores

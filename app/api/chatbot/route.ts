import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  messages?: ChatMessage[];
  context?: string;
  mode?: string;
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const SQE_BASE_PROMPT = `You are an expert SQE (Solicitors Qualifying Examination) study partner for Law & Bar. You have deep knowledge of English & Welsh law covering all SQE1 and SQE2 topics.

Your core SQE knowledge areas:
- FLK1: Business Law & Practice, Dispute Resolution, Contract Law, Tort Law, Constitutional & Administrative Law, EU Law, Legal System of England & Wales
- FLK2: Property Law & Practice, Wills & Administration of Estates, Solicitors Accounts, Land Law, Trusts, Criminal Law & Practice

You are conversational, encouraging, and thorough. Always explain the legal reasoning behind answers. When citing legal principles, mention the relevant statute or case law where applicable.`;

const MODE_PROMPTS: Record<string, string> = {
  mcq: `MODE: MCQ Practice
Generate single-best-answer MCQs in proper SQE format. For each question:
1. Write a realistic scenario/fact pattern (2-3 sentences minimum)
2. Ask a clear legal question about the scenario
3. Provide exactly 4 options labeled A, B, C, D
4. After the student answers (or if they ask for the answer), reveal the correct answer with a detailed explanation of WHY it's correct and why each wrong option is incorrect
5. Reference the relevant legal principle, statute, or case

If the student hasn't specified a topic, ask which SQE subject area they'd like to practice. Keep difficulty at SQE exam level. Generate one question at a time and wait for their answer before proceeding.`,

  legal_qa: `MODE: Legal Q&A
Answer legal questions thoroughly with SQE exam relevance in mind. Structure your answers:
1. State the legal principle or rule clearly
2. Cite relevant statute/case law
3. Explain how it applies in practice
4. Note any exceptions or limitations
5. If relevant, mention how this topic commonly appears in SQE exams

Be detailed but digestible. Use examples to illustrate complex points.`,

  case_analysis: `MODE: Case Analysis
Help students analyze legal scenarios and fact patterns like they would in the SQE. When given a scenario:
1. Identify the area(s) of law engaged
2. Extract the key legal issues
3. Apply the relevant legal tests/principles step by step
4. Consider arguments for both sides where applicable
5. Reach a reasoned conclusion
6. Note any practical considerations (professional conduct, client care)

If no scenario is provided, generate a practice scenario for the student to work through.`,

  exam_tips: `MODE: Exam Tips & Strategy
Provide practical SQE exam preparation advice including:
- Time management strategies for FLK1 and FLK2
- How to approach single-best-answer questions
- Common traps and distractors in SQE questions
- Subject-specific revision strategies
- How to prioritise topics by exam weighting
- Techniques for eliminating wrong answers
- Stress management and exam day tips
- How to structure a study plan

Be specific and actionable. Draw on common patterns in SQE assessments.`,

  study_plan: `MODE: Study Plan
Help the student create or refine their SQE study plan. Consider:
- Which exam they're preparing for (SQE1 or SQE2)
- How much time they have until the exam
- Their current knowledge level and weak areas
- Optimal subject ordering and time allocation
- Active recall and spaced repetition techniques
- When to start mock exams
- How to use the portal's resources (subjects, mocks, progress tracking)

Be practical and create structured plans with clear milestones.`,

  general: `MODE: General SQE Study Partner
You're a flexible study companion. Help with whatever the student needs:
- Answer law questions at SQE level
- Explain concepts they're struggling with
- Quiz them informally on topics
- Discuss legal scenarios
- Help with study planning
- Motivate and encourage their progress

Adapt your response style to what they're asking for.`,
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is missing on the server." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as ChatRequestBody;
    const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
    const safeMessages = incomingMessages
      .filter(
        (message): message is ChatMessage =>
          Boolean(message?.content) &&
          (message?.role === "user" || message?.role === "assistant"),
      )
      .slice(-16);

    if (!safeMessages.length) {
      return NextResponse.json({ error: "At least one message is required." }, { status: 400 });
    }

    const mode = body.mode || "general";
    const modePrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.general;
    const context = (body.context || "").slice(0, 8000);

    const systemPrompt = [
      SQE_BASE_PROMPT,
      modePrompt,
      context
        ? `\nPortal context (student's current page and available resources):\n${context}`
        : "",
      "\nIMPORTANT: You are primarily a law tutor. Focus on helping with SQE preparation, legal knowledge, and exam skills. You can reference portal resources when relevant but your main job is teaching law.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const upstream = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: mode === "mcq" ? 0.7 : 0.4,
        max_tokens: 1200,
        messages: [
          { role: "system", content: systemPrompt },
          ...safeMessages,
        ],
      }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      return NextResponse.json(
        { error: `Groq request failed (${upstream.status}): ${errorText.slice(0, 300)}` },
        { status: 502 },
      );
    }

    const data = await upstream.json();
    const answer = data?.choices?.[0]?.message?.content;
    if (!answer || typeof answer !== "string") {
      return NextResponse.json({ error: "No assistant response returned." }, { status: 502 });
    }

    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Chat request failed.",
      },
      { status: 500 },
    );
  }
}

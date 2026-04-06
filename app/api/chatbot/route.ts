import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  messages?: ChatMessage[];
  context?: string;
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

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
      .slice(-12);

    if (!safeMessages.length) {
      return NextResponse.json({ error: "At least one message is required." }, { status: 400 });
    }

    const context = (body.context || "").slice(0, 14000);
    const systemPrompt = [
      "You are Law & Bar student support assistant for an SQE portal.",
      "Answer only using the portal context if possible. If context is insufficient, say that clearly.",
      "Be concise, practical, and student-friendly.",
      "When relevant, mention exact page areas the user can use (subjects, mocks, progress, etc.).",
      context ? `Portal context:\n${context}` : "No extra portal context was supplied.",
    ].join("\n\n");

    const upstream = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        max_tokens: 700,
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

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs"; // ensure Node.js runtime (not edge)
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { topic, category, bullets, count = 6 } = await request.json();
    if ((!bullets || !bullets.trim()) && (!topic || !topic.toString().trim())) {
      return NextResponse.json({ error: "Provide either topic (and optional category) or notes to generate quiz" }, { status: 400 });
    }

    const PPLX_API_KEY = process.env.PPLX_API_KEY;
    const safeBullets = (bullets || "").toString().slice(0, 4000);
    const baseJsonShape = '{"questions":[{"question":"string","options":["string","string","string","string"],"correctIndex":0-3,"explanation":"string"}]}'
    const prompt = (bullets && bullets.trim().length)
      ? `You are a quiz generator. Create ${count} multiple-choice questions STRICTLY from the notes below. Do NOT introduce any facts not present in the notes.\n\nTOPIC: ${topic || "General"}\nNOTES (authoritative, only source of truth):\n- ${safeBullets}\n\nReturn ONLY valid JSON (no markdown) shaped as: ${baseJsonShape}`
      : `You are a quiz generator. Create ${count} multiple-choice questions for the TOPIC and CATEGORY below. Ensure coverage of fundamentals and practical applications suitable for learners in this category. Balance difficulty and avoid obscure trivia.\n\nTOPIC: ${topic}\nCATEGORY: ${category || "General"}\n\nReturn ONLY valid JSON (no markdown) shaped as: ${baseJsonShape}`;

    let raw = "";
    if (PPLX_API_KEY) {
      // Use Perplexity API with model fallbacks
      const models = [
        "sonar-small-chat",
        "sonar-small-online",
        "sonar-pro",
        "llama-3.1-sonar-small-128k-online",
      ];
      let lastErr = null;
      for (const modelName of models) {
        const resp = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${PPLX_API_KEY}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            temperature: 0.2,
            max_tokens: 1500,
            top_p: 0.9,
            stream: false,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "quiz_schema",
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["questions"],
                  properties: {
                    questions: {
                      type: "array",
                      minItems: 1,
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["question", "options", "correctIndex", "explanation"],
                        properties: {
                          question: { type: "string" },
                          options: {
                            type: "array",
                            minItems: 4,
                            maxItems: 4,
                            items: { type: "string" }
                          },
                          correctIndex: { type: "integer", minimum: 0, maximum: 3 },
                          explanation: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            },
            messages: [
              {
                role: "system",
                content:
                  "You generate quizzes as strict JSON. No markdown, no backticks, no explanations outside the JSON.",
              },
              { role: "user", content: prompt },
            ],
          }),
        });
        const rawText = await resp.text();
        let data;
        try { data = JSON.parse(rawText); } catch { data = { rawText }; }
        if (resp.ok) {
          raw = data?.choices?.[0]?.message?.content || data?.rawText || "";
          lastErr = null;
          break;
        } else {
          const err = data?.error?.message || data?.rawText || JSON.stringify(data);
          lastErr = { status: resp.status, err, modelName };
        }
      }
      if (lastErr) {
        return NextResponse.json({ error: `Perplexity API error: ${lastErr.err}`, modelTried: lastErr.modelName }, { status: lastErr.status || 500 });
      }
    } else {
      // Fallback to Gemini
      const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Server API key not configured" }, { status: 500 });
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
      raw = typeof result?.response?.text === "function" ? result.response.text() : "";
    }

    const cleaned = (raw || "").trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = JSON.parse(raw);
    }

    if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
      const snippet = (raw || "").toString().slice(0, 400);
      return NextResponse.json({ error: "Invalid quiz format", snippet }, { status: 422 });
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (e) {
    console.error("/api/quiz error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const { topic, chapterName } = body || {};
    if (!topic || !chapterName) {
      return NextResponse.json({ error: "Missing topic or chapterName" }, { status: 400 });
    }

    const PPLX_API_KEY = process.env.PPLX_API_KEY;
    if (!PPLX_API_KEY) {
      return NextResponse.json({ error: "Server PPLX_API_KEY not configured" }, { status: 500 });
    }

    const prompt = `Generate detailed learning content as strict JSON for the following:
Topic: ${topic}
Chapter: ${chapterName}

Return ONLY a JSON object with this shape:
{
  "title": string, // title for this chapter content
  "chapters": [
    { "title": string, "explanation": string, "codeExample": string } // codeExample may be "" if not applicable
  ]
}`;

    const models = [
      "sonar-small-chat",
      "sonar-pro",
      "sonar-small-online",
      "llama-3.1-sonar-small-128k-online",
    ];

    let raw = "";
    let lastErr = null;

    for (const modelName of models) {
      const resp = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PPLX_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          temperature: 0.2,
          max_tokens: 2000,
          top_p: 0.9,
          stream: false,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "chapter_content_schema",
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["title", "chapters"],
                properties: {
                  title: { type: "string" },
                  chapters: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["title", "explanation", "codeExample"],
                      properties: {
                        title: { type: "string" },
                        explanation: { type: "string" },
                        codeExample: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          messages: [
            { role: "system", content: "You output strict JSON only." },
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

    const cleaned = (raw || "").trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    let parsed;
    try { parsed = JSON.parse(cleaned); } catch { parsed = JSON.parse(raw); }

    if (!parsed?.chapters || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
      const snippet = (raw || "").toString().slice(0, 400);
      return NextResponse.json({ error: "Invalid chapter content format", snippet }, { status: 422 });
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (e) {
    console.error("/api/chapter-content error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

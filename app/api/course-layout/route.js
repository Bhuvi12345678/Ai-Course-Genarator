import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      category,
      topic,
      level,
      duration,
      noOfChapters,
    } = body || {};

    if (!category || !topic || !level || !duration || !noOfChapters) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const PPLX_API_KEY = process.env.PPLX_API_KEY;
    if (!PPLX_API_KEY) {
      return NextResponse.json(
        { error: "Server PPLX_API_KEY not configured" },
        { status: 500 }
      );
    }

    const prompt = `Generate a course layout in strict JSON based on these inputs. Do not invent unrelated topics.
Category: ${category}
Topic: ${topic}
Level: ${level}
Duration: ${duration}
NoOfChapters: ${noOfChapters}

Return ONLY a JSON object matching this schema (no markdown):
{
  "CourseName": string,
  "Description": string,
  "Category": string,
  "Topic": string,
  "Level": string,
  "Duration": string,
  "NoOfChapters": number,
  "Chapters": [
    { "ChapterName": string, "About": string, "Duration": string }
  ]
}`;

    // Try Perplexity models with strict json_schema
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
              name: "course_layout_schema",
              schema: {
                type: "object",
                additionalProperties: false,
                required: [
                  "CourseName",
                  "Description",
                  "Category",
                  "Topic",
                  "Level",
                  "Duration",
                  "NoOfChapters",
                  "Chapters",
                ],
                properties: {
                  CourseName: { type: "string" },
                  Description: { type: "string" },
                  Category: { type: "string" },
                  Topic: { type: "string" },
                  Level: { type: "string" },
                  Duration: { type: "string" },
                  NoOfChapters: { type: "number" },
                  Chapters: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["ChapterName", "About", "Duration"],
                      properties: {
                        ChapterName: { type: "string" },
                        About: { type: "string" },
                        Duration: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          messages: [
            {
              role: "system",
              content:
                "You generate strict JSON only. No markdown, no backticks, no explanations outside the JSON.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      const rawText = await resp.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { rawText };
      }
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
      return NextResponse.json(
        { error: `Perplexity API error: ${lastErr.err}`, modelTried: lastErr.modelName },
        { status: lastErr.status || 500 }
      );
    }

    const cleaned = (raw || "").trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = JSON.parse(raw);
    }

    // Quick validation
    if (!parsed?.Chapters || !Array.isArray(parsed.Chapters) || parsed.Chapters.length === 0) {
      const snippet = (raw || "").toString().slice(0, 400);
      return NextResponse.json(
        { error: "Invalid course layout format", snippet },
        { status: 422 }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (e) {
    console.error("/api/course-layout error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

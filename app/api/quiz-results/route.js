import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/configs/db";
import { QuizResults } from "@/configs/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    if (!courseId) return NextResponse.json({ error: "Missing courseId" }, { status: 400 });

    const rows = await db
      .select()
      .from(QuizResults)
      .where(and(eq(QuizResults.userId, userId), eq(QuizResults.courseId, courseId)));

    return NextResponse.json({ results: rows }, { status: 200 });
  } catch (e) {
    console.error("/api/quiz-results GET error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { courseId, chapterId, score, total, answers } = await request.json();
    if (!courseId || !chapterId || typeof score !== "number" || typeof total !== "number") {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const existing = await db
      .select({ id: QuizResults.id })
      .from(QuizResults)
      .where(and(eq(QuizResults.userId, userId), eq(QuizResults.courseId, courseId), eq(QuizResults.chapterId, chapterId)));

    if (existing?.length) {
      const updated = await db
        .update(QuizResults)
        .set({ score, total, answers })
        .where(and(eq(QuizResults.userId, userId), eq(QuizResults.courseId, courseId), eq(QuizResults.chapterId, chapterId)))
        .returning();
      return NextResponse.json({ ok: true, result: updated?.[0] }, { status: 200 });
    }

    const inserted = await db
      .insert(QuizResults)
      .values({ userId, courseId, chapterId, score, total, answers })
      .returning();

    return NextResponse.json({ ok: true, result: inserted?.[0] }, { status: 201 });
  } catch (e) {
    console.error("/api/quiz-results POST error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

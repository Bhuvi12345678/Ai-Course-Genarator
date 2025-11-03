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
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const anonId = searchParams.get("anonId");
    if (!courseId) return NextResponse.json({ error: "Missing courseId" }, { status: 400 });

    const key = userId || anonId;
    if (!key) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select()
      .from(QuizResults)
      .where(and(eq(QuizResults.userId, key), eq(QuizResults.courseId, courseId)));

    const results = rows.map((r) => {
      const percentage = r.total ? Math.round((r.score / r.total) * 100) : 0;
      const recommendation = percentage >= 90
        ? "Great performance! You can proceed to the next category."
        : "You scored below 90%. We recommend reviewing the course before proceeding.";
      return { ...r, percentage, recommendation };
    });

    return NextResponse.json({ results }, { status: 200 });
  } catch (e) {
    console.error("/api/quiz-results GET error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId } = auth();
    const { courseId, chapterId, score, total, answers, anonId } = await request.json();
    if (!courseId || !chapterId || typeof score !== "number" || typeof total !== "number") {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const key = userId || anonId;
    if (!key) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await db
      .select({ id: QuizResults.id })
      .from(QuizResults)
      .where(and(eq(QuizResults.userId, key), eq(QuizResults.courseId, courseId), eq(QuizResults.chapterId, chapterId)));

    if (existing?.length) {
      const updated = await db
        .update(QuizResults)
        .set({ score, total, answers })
        .where(and(eq(QuizResults.userId, key), eq(QuizResults.courseId, courseId), eq(QuizResults.chapterId, chapterId)))
        .returning();
      const row = updated?.[0];
      const percentage = row?.total ? Math.round((row.score / row.total) * 100) : 0;
      const recommendation = percentage >= 90
        ? "Great performance! You can proceed to the next category."
        : "You scored below 90%. We recommend reviewing the course before proceeding.";
      return NextResponse.json({ ok: true, result: { ...row, percentage, recommendation } }, { status: 200 });
    }

    const inserted = await db
      .insert(QuizResults)
      .values({ userId: key, courseId, chapterId, score, total, answers })
      .returning();

    const row = inserted?.[0];
    const percentage = row?.total ? Math.round((row.score / row.total) * 100) : 0;
    const recommendation = percentage >= 90
      ? "Great performance! You can proceed to the next category."
      : "You scored below 90%. We recommend reviewing the course before proceeding.";

    return NextResponse.json({ ok: true, result: { ...row, percentage, recommendation } }, { status: 201 });
  } catch (e) {
    console.error("/api/quiz-results POST error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}


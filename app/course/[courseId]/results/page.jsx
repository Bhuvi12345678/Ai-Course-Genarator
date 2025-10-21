"use client";
import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/configs/db";
import { CourseList } from "@/configs/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

function CourseResults({ params }) {
  const Params = React.use(params);
  const [course, setCourse] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const rows = await db.select().from(CourseList).where(eq(CourseList.courseId, Params?.courseId));
        const c = rows?.[0];
        setCourse(c);
        const resp = await fetch(`/api/quiz-results?courseId=${Params?.courseId}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Failed to fetch results");
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch (e) {
        setErr(e?.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [Params?.courseId]);

  const overall = useMemo(() => {
    if (!results?.length) return null;
    const sum = results.reduce((acc, r) => ({ score: acc.score + (r.score || 0), total: acc.total + (r.total || 0) }), { score: 0, total: 0 });
    return { score: sum.score, total: sum.total, percent: sum.total ? Math.round((sum.score * 100) / sum.total) : 0 };
  }, [results]);

  const chaptersCount = course?.courseOutput?.Chapters?.length || 0;
  const completedCount = results?.length || 0;
  const allDone = chaptersCount > 0 && completedCount >= chaptersCount;

  const weakChapters = useMemo(() => {
    const byChapter = new Map();
    results.forEach((r) => byChapter.set(r.chapterId, r));
    return (course?.courseOutput?.Chapters || [])
      .filter((ch, idx) => {
        const key = String(ch?.ChapterName || idx);
        const r = byChapter.get(key);
        if (!r) return false;
        const pct = r.total ? (r.score * 100) / r.total : 0;
        return pct < 60;
      })
      .slice(0, 4);
  }, [course, results]);

  return (
    <div className="md:ml-72 p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Course Results</h1>
        <p className="text-gray-600">{course?.courseOutput?.CourseName}</p>
      </div>

      {loading ? (
        <p className="text-gray-600">Loading results...</p>
      ) : err ? (
        <p className="text-red-600">{err}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="border rounded-lg p-4 bg-white">
              <p className="text-sm text-gray-500">Chapters Completed</p>
              <p className="text-2xl font-semibold">{completedCount}/{chaptersCount}</p>
            </div>
            <div className="border rounded-lg p-4 bg-white">
              <p className="text-sm text-gray-500">Overall Score</p>
              <p className="text-2xl font-semibold">{overall ? `${overall.score}/${overall.total}` : "-"}</p>
            </div>
            <div className="border rounded-lg p-4 bg-white">
              <p className="text-sm text-gray-500">Overall %</p>
              <p className="text-2xl font-semibold">{overall ? `${overall.percent}%` : "-"}</p>
            </div>
          </div>

          {!allDone && (
            <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-300 mb-8 text-sm text-gray-800">
              Complete all chapter quizzes to unlock certification.
            </div>
          )}

          {allDone && (
            <div className="border rounded-lg p-4 bg-green-50 border-green-300 mb-8">
              <p className="text-gray-800">Great job! You have completed all chapters.</p>
              <div className="mt-3">
                <a className="inline-block rounded-lg bg-primary text-white px-4 py-2 text-sm" href={process.env.NEXT_PUBLIC_CERT_URL || "/dashboard/upgrade"} target="_blank" rel="noreferrer">
                  Claim Certificate
                </a>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="font-semibold text-lg mb-2">Per-chapter scores</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(course?.courseOutput?.Chapters || []).map((ch, idx) => {
                const cid = String(ch?.ChapterName || idx);
                const r = results.find((x) => x.chapterId === cid);
                const label = `${idx + 1}. ${ch?.ChapterName}`;
                return (
                  <div key={cid} className="border rounded-md p-3 bg-white flex items-center justify-between">
                    <span className="text-sm text-gray-800">{label}</span>
                    <span className={`text-xs px-2 py-1 rounded border ${r ? "border-green-600 text-green-700 bg-green-50" : "border-gray-300 text-gray-600 bg-gray-50"}`}>
                      {r ? `${r.score}/${r.total}` : "Not attempted"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-lg mb-2">Recommendations</h2>
            {weakChapters.length === 0 ? (
              <p className="text-gray-600 text-sm">No recommendations right now. Keep up the great work!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {weakChapters.map((ch, idx) => {
                  const title = ch?.ChapterName || `Chapter ${idx + 1}`;
                  const links = [
                    { label: "FreeCodeCamp", url: `https://www.freecodecamp.org/learn/` },
                    { label: "MDN Docs", url: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(title)}` },
                    { label: "YouTube", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}` },
                  ];
                  return (
                    <div key={idx} className="border rounded-md p-3 bg-white">
                      <p className="font-medium text-sm mb-2">{title}</p>
                      <div className="flex flex-wrap gap-2">
                        {links.map((l, i) => (
                          <a key={i} href={l.url} target="_blank" rel="noreferrer" className="text-primary text-sm underline">
                            {l.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-8">
        <Link href={`/course/${Params?.courseId}/start`} className="text-sm text-primary underline">Back to course</Link>
      </div>
    </div>
  );
}

export default CourseResults;

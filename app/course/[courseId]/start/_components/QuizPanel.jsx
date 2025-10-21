"use client";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

function QuizPanel({ chapter, content }) {
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const bullets = useMemo(() => {
    const points = content?.content?.chapters?.map((c) => `${c?.title}: ${c?.explanation?.slice(0, 220)}`) || [];
    return points.join("\n- ");
  }, [content]);

  const tryGenerate = async (count) => {
    const resp = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: chapter?.ChapterName, bullets, count }),
    });
    let data;
    try {
      data = await resp.json();
    } catch (_) {
      data = { error: "Non-JSON response from API" };
    }
    if (!resp.ok) {
      const extra = data?.snippet ? `\n\nSnippet: ${data.snippet}` : "";
      throw new Error((data?.error || "Quiz API error") + extra);
    }
    if (!Array.isArray(data?.questions) || data.questions.length === 0) {
      throw new Error("Invalid quiz format");
    }
    return data;
  };

  const generateQuiz = async () => {
    setLoading(true);
    setSubmitted(false);
    setAnswers({});
    try {
      if (!bullets || bullets.trim().length === 0) {
        alert("No chapter content available to generate a quiz. Please ensure the chapter content is generated.");
        return;
      }
      const counts = [6, 4, 3];
      let parsed = null;
      for (const c of counts) {
        try {
          parsed = await tryGenerate(c);
          break;
        } catch (_) {
          // try next fallback
        }
      }
      if (!parsed) throw new Error("Unable to generate a valid quiz response");
      setQuiz(parsed);
    } catch (e) {
      console.error(e);
      alert((e?.message || "Failed to generate quiz.") + "\n\nPlease check the Network tab for /api/quiz response.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (qi, oi) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qi]: oi }));
  };

  const score = useMemo(() => {
    if (!quiz || !submitted) return null;
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correct += 1;
    });
    return { correct, total: quiz.questions.length };
  }, [quiz, answers, submitted]);

  const persistResult = async () => {
    if (!quiz) return;
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correct += 1;
    });
    try {
      await fetch("/api/quiz-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: content?.courseId,
          // Use stored chapterId from the Chapters row to ensure consistent keying
          chapterId: String(content?.chapterId ?? "0"),
          score: correct,
          total: quiz.questions.length,
          answers,
        }),
      });
    } catch (_) {}
  };

  return (
    <div className="mt-10 border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-xl">Chapter Quiz</h3>
        <Button onClick={generateQuiz} disabled={loading}>
          {loading ? "Generating..." : quiz ? "Regenerate Quiz" : "Generate Quiz"}
        </Button>
      </div>

      {!quiz ? (
        <p className="text-gray-600">Generate a quiz to test your understanding of this chapter. Questions are based only on the content above.</p>
      ) : (
        <div className="space-y-6">
          {quiz.questions.map((q, qi) => (
            <div key={qi} className="bg-slate-50 rounded-md p-4">
              <p className="font-medium mb-2">{qi + 1}. {q.question}</p>
              <div className="grid md:grid-cols-2 gap-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  const isCorrect = submitted && q.correctIndex === oi;
                  const isWrongSel = submitted && selected && !isCorrect;
                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => handleSelect(qi, oi)}
                      className={`text-left border rounded p-2 transition-colors ${
                        isCorrect ? "border-green-600 bg-green-50" : isWrongSel ? "border-red-600 bg-red-50" : selected ? "border-primary" : "border-slate-200"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className="text-sm mt-2 text-gray-600">{q.explanation}</p>
              )}
            </div>
          ))}

          <div className="flex items-center gap-3">
            <Button
              onClick={async () => {
                setSubmitted(true);
                await persistResult();
              }}
              disabled={submitted || Object.keys(answers).length !== quiz.questions.length}
            >
              {submitted ? "Submitted" : "Submit Answers"}
            </Button>
            {submitted && score && (
              <span className="text-sm text-gray-700 rounded px-2 py-1 bg-green-50 border border-green-600/30">
                Score: {score.correct}/{score.total}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizPanel;

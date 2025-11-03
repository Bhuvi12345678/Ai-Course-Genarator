"use client";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

function QuizPanel({ chapter, content }) {
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [percent, setPercent] = useState(null);
  const [recommendation, setRecommendation] = useState("");
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [viewed, setViewed] = useState({ 0: true });

  const topics = content?.content?.chapters || [];
  const selectedTopic = topics?.[selectedTopicIndex] || null;
  const bullets = useMemo(() => {
    const exp = selectedTopic?.explanation || "";
    return exp.length ? exp : "";
  }, [selectedTopic]);

  const allViewed = topics.length === 0 || Object.keys(viewed).length >= topics.length;

  const tryGenerate = async (count) => {
    const resp = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: selectedTopic?.title || chapter?.ChapterName, bullets, count }),
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
    setPercent(null);
    setRecommendation("");
    try {
      if (!bullets || bullets.trim().length === 0) {
        alert("No topic content available to generate a quiz. Please ensure the topic content is generated.");
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
    // Prepare anonymous ID if not signed in
    let anonId = null;
    try {
      const key = "anonId";
      anonId = localStorage.getItem(key);
      if (!anonId) {
        anonId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `anon_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
        localStorage.setItem(key, anonId);
      }
    } catch (_) {}
    try {
      const resp = await fetch("/api/quiz-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: content?.courseId,
          // Store by chapter index so course-level gating works reliably
          chapterId: String(content?.chapterId ?? "0"),
          score: correct,
          total: quiz.questions.length,
          answers: { selections: answers, topicTitle: selectedTopic?.title || `Topic ${selectedTopicIndex + 1}` },
          anonId,
        }),
      });
      try {
        const data = await resp.json();
        const row = data?.result || {};
        if (typeof row.percentage === "number") setPercent(row.percentage);
        if (typeof row.recommendation === "string") setRecommendation(row.recommendation);
      } catch (_) {}
    } catch (_) {}
  };

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <div>
          <h3 className="quiz-title">
            {selectedTopic?.title ? `${selectedTopic.title}` : "Topic Quiz"}
          </h3>
          <p className="quiz-description">
            {!quiz
              ? selectedTopic?.title
                ? `Test your knowledge about ${selectedTopic.title}`
                : "Generate a quiz to test your understanding of this topic."
              : `Answer the following questions about ${selectedTopic?.title || 'this topic'}`}
          </p>
        </div>
        <Button 
          onClick={generateQuiz} 
          disabled={loading || !allViewed}
          className="shrink-0"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Generating...
            </span>
          ) : quiz ? (
            "Regenerate Quiz"
          ) : (
            "Generate Quiz"
          )}
        </Button>
      </div>

      {topics.length > 0 && (
        <div className="topic-tabs">
          {topics.map((t, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (loading) return;
                setSelectedTopicIndex(idx);
                setViewed((v) => ({ ...v, [idx]: true }));
                setQuiz(null);
                setAnswers({});
                setSubmitted(false);
                setPercent(null);
                setRecommendation("");
              }}
              className={`topic-tab ${selectedTopicIndex === idx ? 'active' : ''}`}
            >
              {t?.title || `Topic ${idx + 1}`}
              {viewed[idx] && (
                <span className="ml-1.5 w-1.5 h-1.5 bg-primary/20 rounded-full inline-block"></span>
              )}
            </button>
          ))}
        </div>
      )}

      {!allViewed && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg border border-yellow-200 dark:border-yellow-800/50 mb-6">
          <p className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Please view all topics above to unlock the quiz.
          </p>
        </div>
      )}

      {loading && !quiz ? (
        <div className="quiz-loading">
          <div className="quiz-loading-spinner"></div>
        </div>
      ) : !quiz ? (
        <div className="quiz-card">
          <p className="text-gray-600 dark:text-gray-400">
            {selectedTopic?.title 
              ? `Click the button above to generate a quiz about ${selectedTopic.title}. Questions will be based on the selected topic.`
              : "Select a topic and generate a quiz to test your knowledge."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {quiz.questions.map((q, qi) => (
            <div key={qi} className="quiz-card">
              <h4 className="quiz-question">
                <span className="text-primary font-bold mr-2">{qi + 1}.</span>
                {q.question}
              </h4>
              <div className="quiz-options">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  const isCorrect = submitted && q.correctIndex === oi;
                  const isWrongSel = submitted && selected && !isCorrect;
                  
                  let optionClass = "option-button";
                  if (submitted) {
                    if (isCorrect) {
                      optionClass += " correct";
                    } else if (isWrongSel) {
                      optionClass += " incorrect";
                    } else if (selected) {
                      optionClass += " selected";
                    }
                  } else if (selected) {
                    optionClass += " selected";
                  }

                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => handleSelect(qi, oi)}
                      className={optionClass}
                      disabled={submitted}
                    >
                      <div className="flex items-center">
                        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full border mr-3 text-sm font-medium">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span>{opt}</span>
                        {submitted && isCorrect && (
                          <span className="ml-auto text-green-600 dark:text-green-400">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                        {submitted && isWrongSel && (
                          <span className="ml-auto text-red-500">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {submitted && q.explanation && (
                <div className="quiz-explanation">
                  <p className="font-medium mb-1">Explanation:</p>
                  <p>{q.explanation}</p>
                </div>
              )}
            </div>
          ))}

          {!submitted ? (
            <div className="flex items-center gap-4">
              <Button
                onClick={async () => {
                  setSubmitted(true);
                  await persistResult();
                }}
                disabled={Object.keys(answers).length !== quiz.questions.length}
                className="px-6 py-2.5 text-base"
              >
                Submit Quiz
              </Button>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {Object.keys(answers).length} of {quiz.questions.length} questions answered
              </p>
            </div>
          ) : (
            <div className="quiz-results">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Quiz Completed!
                </h3>
                <div className="quiz-percentage">
                  {Math.round((score.correct / score.total) * 100)}%
                </div>
                <p className="quiz-score">
                  {score.correct} out of {score.total} correct
                </p>
                
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-6 mb-4">
                  <div 
                    className="h-2.5 rounded-full bg-gradient-to-r from-primary to-secondary" 
                    style={{ width: `${(score.correct / score.total) * 100}%` }}
                  ></div>
                </div>

                {recommendation && (
                  <div className={`quiz-recommendation ${(score.correct / score.total) >= 0.8 ? 'success' : 'warning'}`}>
                    <p className="font-medium mb-1">
                      {(score.correct / score.total) >= 0.8 ? '🎉 Great job!' : '📝 Keep learning!'}
                    </p>
                    <p>{recommendation}</p>
                  </div>
                )}

                <div className="mt-6">
                  <Button 
                    onClick={generateQuiz}
                    variant="outline"
                    className="mr-3"
                  >
                    Try Again
                  </Button>
                  <Button 
                    onClick={() => {
                      setQuiz(null);
                      setAnswers({});
                      setSubmitted(false);
                    }}
                  >
                    New Quiz
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default QuizPanel;

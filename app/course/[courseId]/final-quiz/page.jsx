"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { db } from "@/configs/db";
import { CourseList } from "@/configs/schema";
import { eq } from "drizzle-orm";

function FinalQuizPage({ params }) {
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState(10);
  const [course, setCourse] = useState(null);
  const [score, setScore] = useState(null);
  const [recommendation, setRecommendation] = useState("");

  // Load course data
  useEffect(() => {
    const loadCourse = async () => {
      try {
        const [courseData] = await db.select()
          .from(CourseList)
          .where(eq(CourseList.courseId, params.courseId));
        setCourse(courseData);
      } catch (err) {
        console.error("Failed to load course:", err);
        setError("Failed to load course data");
      }
    };
    loadCourse();
  }, [params.courseId]);

  const generateQuiz = async () => {
    setLoading(true);
    setError("");
    setSubmitted(false);
    setAnswers({});
    setScore(null);
    
    try {
      const response = await fetch("/api/final-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          courseId: params.courseId,
          count: Math.min(20, Math.max(5, count)) // Ensure count is between 5-20
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate quiz");
      }

      const data = await response.json();
      setQuiz(data);
    } catch (err) {
      console.error("Quiz generation error:", err);
      setError(err.message || "Failed to generate quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex, optionIndex) => {
    if (submitted) return;
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length === 0) {
      setError("Please answer at least one question before submitting.");
      return;
    }
    
    setSubmitted(true);
    
    // Calculate score
    const correct = Object.entries(answers).reduce((acc, [qIndex, aIndex]) => {
      return acc + (quiz.questions[parseInt(qIndex)].correctIndex === aIndex ? 1 : 0);
    }, 0);
    
    const calculatedScore = Math.round((correct / quiz.questions.length) * 100);
    setScore(calculatedScore);
    
    // Simple score-based message
    let message = '';
    if (calculatedScore >= 90) message = 'Excellent work! You have a strong grasp of the material.';
    else if (calculatedScore >= 80) message = 'Good job! Review the questions you missed.';
    else if (calculatedScore >= 70) message = 'Keep practicing! Focus on the fundamentals.';
    else if (calculatedScore >= 60) message = 'Spend more time reviewing the course materials.';
    else message = 'Please review the course materials and try again.';
    
    setRecommendation(message);
    
    // Save results and navigate to results page
    try {
      await saveQuizResults(calculatedScore);
      // Store results in session storage for the results page
      sessionStorage.setItem('quizResults', JSON.stringify({
        score: calculatedScore,
        totalQuestions: quiz.questions.length,
        correctAnswers: correct,
        courseName: course?.courseOutput?.CourseName || 'this course'
      }));
      
      // Navigate to results page
      window.location.href = `/course/${params.courseId}/final-quiz/results`;
    } catch (error) {
      console.error('Error saving results:', error);
      setError('Results could not be saved. Please try again.');
    }
  };

  const saveQuizResults = async (score) => {
    try {
      await fetch("/api/quiz-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: params.courseId,
          score,
          totalQuestions: quiz.questions.length,
          courseName: quiz.courseName || "Course"
        }),
      });
    } catch (error) {
      console.error("Failed to save quiz results:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {quiz?.courseName || (course?.name || "Course")} Quiz
        </h1>
        {quiz?.isFallback && (
          <p className="text-yellow-600 text-sm mt-1">
            Note: Using simplified quiz questions
          </p>
        )}
      </div>
      
      {!submitted && !quiz && (
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex items-center">
            <label htmlFor="questionCount" className="mr-2 text-sm text-gray-700">
              Questions:
            </label>
            <select
              id="questionCount"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value))}
              disabled={loading}
              className="border rounded px-3 py-1 text-sm"
            >
              {[5, 10, 15, 20].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
          <Button 
            onClick={generateQuiz} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 min-w-[150px]"
          >
            {loading ? "Generating..." : "Generate Quiz"}
          </Button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
          <button
            onClick={generateQuiz}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Try Again
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-2 text-gray-600">Generating your quiz...</p>
        </div>
      )}

      {!loading && quiz?.questions?.length > 0 && (
        <div className="space-y-6">
          {quiz.questions.map((q, qIndex) => (
            <div 
              key={qIndex} 
              className={`p-6 rounded-lg border ${
                submitted 
                  ? answers[qIndex] === q.correctIndex 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              <h3 className="text-lg font-medium mb-4">
                {qIndex + 1}. {q.question}
              </h3>
              
              <div className="space-y-3">
                {q.options.map((option, oIndex) => {
                  const isSelected = answers[qIndex] === oIndex;
                  const isCorrect = q.correctIndex === oIndex;
                  
                  return (
                    <div 
                      key={oIndex}
                      className={`
                        p-3 rounded-md border cursor-pointer transition-colors
                        ${!submitted 
                          ? isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:bg-gray-50'
                          : isCorrect
                            ? 'border-green-500 bg-green-50'
                            : isSelected
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-200'
                        }
                      `}
                      onClick={() => !submitted && handleAnswerSelect(qIndex, oIndex)}
                    >
                      <div className="flex items-center">
                        <div className={`
                          flex items-center justify-center w-6 h-6 rounded-full mr-3 font-medium
                          ${!submitted 
                            ? isSelected 
                              ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                              : 'bg-gray-100 text-gray-700 border border-gray-300'
                            : isCorrect
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : isSelected
                                ? 'bg-red-100 text-red-700 border border-red-300'
                                : 'bg-gray-100 text-gray-500 border border-gray-300'
                          }
                        `}>
                          {String.fromCharCode(65 + oIndex)}
                        </div>
                        <span>{option}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {submitted && (
                <div className="mt-4 p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Explanation:</span> {q.explanation}
                  </p>
                </div>
              )}
            </div>
          ))}

          {!submitted ? (
            <div className="mt-8 flex justify-end">
              <Button 
                onClick={handleSubmit}
                disabled={Object.keys(answers).length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                Submit Quiz
              </Button>
            </div>
          ) : (
            <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg text-center">
              <h3 className="text-2xl font-bold mb-2">
                Quiz Completed!
              </h3>
              <p className="text-lg mb-4">
                Your score: <span className="font-bold">{score}%</span>
              </p>
              <p className="text-gray-600 mb-6">
                {recommendation}
              </p>
              <div className="flex justify-center gap-4">
                <Button 
                  onClick={() => {
                    setSubmitted(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  Review Answers
                </Button>
                <Button 
                  onClick={() => {
                    setQuiz(null);
                    setSubmitted(false);
                    setAnswers({});
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  New Quiz
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !quiz && !error && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No quiz generated yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Click the button below to generate a quiz based on this course.
          </p>
          <div className="mt-6">
            <Button 
              onClick={generateQuiz} 
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                'Generate Quiz'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FinalQuizPage;

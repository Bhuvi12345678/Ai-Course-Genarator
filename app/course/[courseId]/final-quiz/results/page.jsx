"use client";
import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { db } from "@/configs/db";
import { CourseList } from "@/configs/schema";
import { eq } from "drizzle-orm";

export default function QuizResultsPage({ params }) {
  const [results, setResults] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get results from session storage
        const savedResults = sessionStorage.getItem('quizResults');
        if (!savedResults) {
          router.push(`/course/${params.courseId}/final-quiz`);
          return;
        }
        
        const resultData = JSON.parse(savedResults);
        setResults(resultData);
        
        // Load course data to get the current level
        const [courseData] = await db.select()
          .from(CourseList)
          .where(eq(CourseList.courseId, params.courseId));
          
        setCourse(courseData);
      } catch (error) {
        console.error('Error loading results:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [params.courseId, router]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading results...</div>;
  }

  if (!results || !course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-lg mb-4">No results found. Please take the quiz first.</p>
        <Button onClick={() => router.push(`/course/${params.courseId}/final-quiz`)}>
          Take Quiz
        </Button>
      </div>
    );
  }

  const passed = results.score >= 75;
  const courseLevel = course.courseOutput?.Level?.toLowerCase() || 'beginner';
  
  // Determine next level and message
  let nextLevel = '';
  let nextLevelMessage = '';
  let nextStep = '';
  
  if (passed) {
    if (courseLevel.includes('beginner')) {
      nextLevel = 'intermediate';
      nextLevelMessage = `You've mastered the basics! Ready for the next challenge?`;
      nextStep = `Explore our ${nextLevel} level courses to continue your learning journey.`;
    } else if (courseLevel.includes('intermediate')) {
      nextLevel = 'advanced';
      nextLevelMessage = `Great job! You're ready to tackle more complex topics.`;
      nextStep = `Check out our ${nextLevel} level courses to take your skills to the next level.`;
    } else {
      nextLevelMessage = `Congratulations! You've successfully completed this advanced course.`;
      nextStep = 'You have a comprehensive understanding of this subject. Consider mentoring others or exploring related fields.';
    }
  } else {
    nextLevelMessage = `You're on the right track, but let's strengthen your understanding.`;
    nextStep = `We recommend reviewing the course material and retaking the quiz to improve your score.`;
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Quiz Results</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full text-4xl font-bold 
            border-8 border-blue-100 mb-4
            ${passed ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50'}">
            {results.score}%
          </div>
          <h2 className="text-2xl font-semibold">
            {passed ? '🎉 Congratulations!' : 'Keep Learning!'}
          </h2>
          <p className="text-gray-600">
            {results.correctAnswers} out of {results.totalQuestions} correct answers
          </p>
        </div>

        <div className={`p-6 rounded-lg mb-6 ${passed ? 'bg-green-50' : 'bg-yellow-50'}`}>
          <h3 className="font-semibold text-lg mb-2">
            {passed ? 'Great Job!' : 'Next Steps:'}
          </h3>
          <p className="mb-3">{nextLevelMessage}</p>
          <p>{nextStep}</p>
          
          {passed && nextLevel && (
            <div className="mt-4 p-4 bg-white rounded-md border border-green-200">
              <h4 className="font-medium mb-2">Suggested Next Course:</h4>
              <Button 
                onClick={() => {
                  // This would ideally navigate to the next level course
                  // For now, it just shows an alert
                  alert(`Navigating to ${nextLevel} level courses...`);
                }}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                View {nextLevel.charAt(0).toUpperCase() + nextLevel.slice(1)} Level Courses
              </Button>
            </div>
          )}
        </div>

        {!passed && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">How to improve:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Review the course materials you found challenging</li>
              <li>Take notes on key concepts and formulas</li>
              <li>Practice with additional exercises</li>
              <li>Reach out to the instructor or community for help</li>
              <li>Retake the quiz after reviewing</li>
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4 mt-8">
        <Button 
          variant="outline" 
          onClick={() => router.push('/dashboard')}
          className="flex-1"
        >
          Back to Dashboard
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => router.push(`/course/${params.courseId}/final-quiz`)}
          className="flex-1"
        >
          {passed ? 'Retake Quiz' : 'Try Again'}
        </Button>
        
        {!passed && (
          <Button 
            onClick={() => router.push(`/course/${params.courseId}`)}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Review Course
          </Button>
        )}
      </div>
    </div>
  );
}

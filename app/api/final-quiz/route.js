import { NextResponse } from "next/server";
import { db } from "@/configs/db";
import { Chapters, CourseList } from "@/configs/schema";
import { eq } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper function to extract course content
function extractCourseContent(course, chapters) {
  let content = [];
  
  // Add course metadata
  if (course?.courseOutput?.CourseName) content.push(`Course: ${course.courseOutput.CourseName}`);
  if (course?.courseOutput?.CourseDescription) content.push(`Description: ${course.courseOutput.CourseDescription}`);
  
  // Add learning objectives if available
  if (course?.courseOutput?.LearningObjectives?.length) {
    content.push("\nLearning Objectives:");
    content = content.concat(course.courseOutput.LearningObjectives.map((obj, i) => `${i + 1}. ${obj}`));
  }

  // Add chapter content
  chapters.forEach((chapter, idx) => {
    const chapterTitle = chapter.chapterName || `Chapter ${idx + 1}`;
    content.push(`\n## ${chapterTitle}`);
    
    if (chapter.content?.chapters?.length) {
      chapter.content.chapters.forEach(topic => {
        if (topic.title) content.push(`### ${topic.title}`);
        if (topic.explanation) content.push(topic.explanation);
      });
    }
  });

  return content.join('\n').slice(0, 10000);
}

export async function POST(request) {
  try {
    const { courseId, count = 10 } = await request.json();
    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    // Get course and chapters
    const [course] = await db.select().from(CourseList).where(eq(CourseList.courseId, courseId));
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const chapters = await db.select()
      .from(Chapters)
      .where(eq(Chapters.courseId, courseId))
      .orderBy(Chapters.chapterId);

    if (!chapters?.length) {
      return NextResponse.json({ error: "No content found for this course" }, { status: 404 });
    }

    // Extract course content
    const courseContent = extractCourseContent(course, chapters);
    const courseName = course.courseOutput?.CourseName || course.name || "this course";
    const category = course.courseOutput?.Category || course.category || "general knowledge";

    // Generate quiz using Google's Gemini
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      
      const prompt = `Generate exactly ${count} multiple-choice questions about "${courseName}" (category: ${category}). 
      The questions should cover the main concepts and key points from the entire course.

COURSE CONTENT:
${courseContent}

INSTRUCTIONS:
1. Create ${count} high-quality multiple-choice questions
2. Each question should have 4 options (A, B, C, D)
3. Only one correct answer per question
4. Include a clear explanation for each answer
5. Questions should cover different aspects of the course
6. Do not include chapter-specific references

Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Explanation of the correct answer"
    }
  ]
}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse the response
      const jsonMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : text;
      const quizData = JSON.parse(jsonString);
      
      // Validate the response
      if (!quizData.questions || !Array.isArray(quizData.questions)) {
        throw new Error("Invalid quiz format received from AI");
      }
      
      return NextResponse.json({
        questions: quizData.questions.slice(0, count),
        courseName,
        category
      });
      
    } catch (aiError) {
      console.error("AI generation error:", aiError);
      // Fallback to simple quiz generation if AI fails
      return generateFallbackQuiz(course, count);
    }

  } catch (error) {
    console.error("Quiz generation error:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate quiz",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Simple fallback quiz generator
function generateFallbackQuiz(course, count = 5) {
  const courseName = course.courseOutput?.CourseName || course.name || "this course";
  const category = course.courseOutput?.Category || course.category || "general knowledge";
  const questions = [];
  
  const questionTemplates = [
    {
      question: `What is a key concept in ${courseName}?`,
      options: [
        `The fundamental principle that underlies ${courseName}`,
        `A common misconception about ${category}`,
        `A basic technique used in ${category}`,
        `An advanced topic in ${category}`
      ],
      explanation: (courseName, category) => 
        `The fundamental principle is the core concept that ${courseName} is built upon. ` +
        `Understanding this concept is essential for mastering the course material.`
    },
    {
      question: `Which of the following best describes the main goal of ${courseName}?`,
      options: [
        `To teach students the core principles of ${category}`,
        `To provide an overview of various ${category} topics`,
        `To prepare students for advanced studies in ${category}`,
        `To introduce basic ${category} concepts`
      ],
      explanation: (courseName, category) =>
        `The primary objective of ${courseName} is to teach students the core principles of ${category}, ` +
        `providing a solid foundation for understanding the subject matter.`
    },
    {
      question: `What is an essential skill you'll develop in ${courseName}?`,
      options: [
        `Analyzing ${category} concepts critically`,
        `Memorizing ${category} terminology`,
        `Following ${category} procedures`,
        `Identifying ${category} tools`
      ],
      explanation: (courseName, category) =>
        `Critical analysis is a key skill in ${courseName} as it enables students to ` +
        `evaluate ${category} concepts, theories, and applications effectively.`
    },
    {
      question: `Which of these is a common application of ${category} knowledge?`,
      options: [
        `Solving real-world ${category} problems`,
        `Creating ${category} terminology`,
        `Memorizing ${category} facts`,
        `Classifying ${category} topics`
      ],
      explanation: (courseName, category) =>
        `The practical application of ${category} knowledge is crucial as it allows students ` +
        `to solve real-world problems using the concepts learned in ${courseName}.`
    },
    {
      question: `What makes ${courseName} important in today's context?`,
      options: [
        `Its relevance to current ${category} challenges`,
        `Its historical significance in ${category}`,
        `The number of people who study ${category}`,
        `The complexity of ${category} concepts`
      ],
      explanation: (courseName, category) =>
        `${courseName} is particularly valuable because it addresses current ${category} challenges, ` +
        `making the knowledge directly applicable to modern situations and problems.`
    }
  ];

  // Use the available templates and cycle through them if needed
  for (let i = 0; i < count; i++) {
    const template = questionTemplates[i % questionTemplates.length];
    const options = [...template.options].sort(() => 0.5 - Math.random());
    const correctIndex = options.indexOf(template.options[0]);
    
    questions.push({
      question: template.question,
      options: options,
      correctIndex: correctIndex,
      explanation: typeof template.explanation === 'function' 
        ? template.explanation(courseName, category)
        : template.explanation
    });
  }
  
  return NextResponse.json({
    questions,
    courseName,
    isFallback: true
  });
}

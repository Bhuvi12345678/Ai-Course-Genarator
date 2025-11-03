"use client";
import { db } from "@/configs/db";
import { CourseList, Chapters } from "@/configs/schema";
import { useUser } from "@clerk/nextjs";
import { and, eq } from "drizzle-orm";
import React, { useEffect, useState } from "react";
import CourseBasicInfo from "./_components/CourseBasicInfo";
import CourseDetail from "./_components/CourseDetail";
import ChapterList from "./_components/ChapterList";
import { Button } from "@/components/ui/button";
// import { GenerateChapterContent_AI } from "@/configs/AiModel"; // replaced by server API
import LoadingDialog from "../_components/LoadingDialog";
import getVideos from "@/configs/service";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

function CourseLayout({ params }) {
  const Params = React.use(params);
  const { user } = useUser();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { toast } = useToast();

  useEffect(() => {
    // console.log(Params); //courseId
    // console.log(user);

    if (Params && user) {
      GetCourse();
    }
  }, [Params, user]);

  const GetCourse = async () => {
    try {
      const params = await Params;
      const result = await db
        .select()
        .from(CourseList)
        .where(
          and(
            eq(CourseList.courseId, params?.courseId),
            eq(CourseList?.createdBy, user?.primaryEmailAddress?.emailAddress)
          )
        );
      setCourse(result[0]);
      // console.log("Course data:", result[0]);
    } catch (error) {
      // console.error("Error fetching course:", error);
      toast({
        variant: "destructive",
        duration: 3000,
        title: "Uh oh! Something went wrong.",
        description: "There was a problem with your request.",
      });
    }
  };

  const GenerateChapterContent = async () => {
    setLoading(true);

    try {
      const chapters = course?.courseOutput?.Chapters;

      const includeVideo = course?.includeVideo;
      // console.log("IncludeVideo : " + includeVideo);

      // Delete previous content if generated and got any error
      const checkPreviousContent = await db
        .select()
        .from(Chapters)
        .where(eq(Chapters.courseId, course?.courseId));
      if (checkPreviousContent.length > 0) {
        const chapterResponse = await db
          .delete(Chapters)
          .where(eq(Chapters.courseId, course?.courseId))
          .returning({ id: Chapters?.id });
      }

      const YT_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

      for (const [index, chapter] of chapters.entries()) {
        // console.log(`Generating Chapter Content for ${chapter?.ChapterName}`);

        // Server-side chapter content generation (Perplexity)
        const resp = await fetch("/api/chapter-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: course?.name, chapterName: chapter?.ChapterName }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data?.error || `Failed to generate content for ${chapter?.ChapterName}`);
        }
        const content = data;

        // Generate Video URL
        // Ensure non-null default to satisfy NOT NULL constraint in DB
        let videoId = [];

        if (includeVideo === "Yes" && YT_KEY) {
          // console.log(`Generating Video URL for ${chapter?.ChapterName}`);
          const resp = await getVideos(
            course?.name + ":" + chapter?.ChapterName
          );

          // console.log(resp);

          // console.log(resp[0]?.id?.videoId);
          videoId = [
            resp[0]?.id?.videoId,
            resp[1]?.id?.videoId,
            resp[2]?.id?.videoId,
          ];
          // console.log(videoId);
        } else if (includeVideo === "Yes" && !YT_KEY) {
          // Skip video generation if key not present; keep [] to avoid NOT NULL violation
          console.warn("YouTube API key missing; skipping video generation");
        }
        // Save Chapter Content + Video URL

        await db.insert(Chapters).values({
          chapterId: index,
          courseId: course?.courseId,
          content: content,
          videoId: videoId,
        });
        toast({
          duration: 2000,
          title: `Chapter ${index + 1} Generated Successfully!`,
          description: `Chapter ${index + 1} has been generated successfully!`,
        });
      }
      await db
        .update(CourseList)
        .set({
          publish: true,
        })
        .where(eq(CourseList.courseId, course?.courseId));

      toast({
        variant: "success",
        duration: 3000,
        title: "Course Content Generated Successfully!",
        description: "Course Content has been generated successfully!",
      });
      router.replace("/create-course/" + course?.courseId + "/finish");
    } catch (error) {
      console.log(error);
      toast({
        variant: "destructive",
        duration: 5000,
        title: "Uh oh! Something went wrong.",
        description: error?.message || "An unexpected error occurred!",
      });
      await GetCourse();
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <LoadingDialog loading={loading} />
      <div className="mt-10 px-7 md:px-20 lg:px-44">
        <h2 className="font-bold text-center text-2xl">Course Layout</h2>
        {/* Basic Info */}
        <CourseBasicInfo course={course} refreshData={() => GetCourse()} />
        {/* Course Detail */}
        <CourseDetail course={course} />
        {/* List of Lesson */}
        <ChapterList course={course} refreshData={() => GetCourse()} />

        <Button onClick={() => GenerateChapterContent()} className="my-10">
          Generate Course Content
        </Button>
      </div>
    </>
  );
}

export default CourseLayout;

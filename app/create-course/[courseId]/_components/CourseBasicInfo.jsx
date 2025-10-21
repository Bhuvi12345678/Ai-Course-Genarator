import { Button } from "@/components/ui/button";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { HiOutlinePuzzle } from "react-icons/hi";
import EditCourseBasicInfo from "./EditCourseBasicInfo";
import { storage, auth } from "@/configs/firebaseConfig";
import { signInAnonymously } from "firebase/auth";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db } from "@/configs/db";
import { CourseList } from "@/configs/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

function CourseBasicInfo({ course, refreshData, edit = true }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const { toast } = useToast();

  const onFileChanged = async (e) => {
    try {
      // Ensure we have an authenticated Firebase session before Storage calls
      if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch (_) {}
      }
      // Debug: log uid to confirm auth present
      // console.log('Firebase auth uid:', auth.currentUser?.uid);

      const file = e.target.files && e.target.files[0];
      if (!file) return;
      setSelectedFile(URL.createObjectURL(file));

      // Delete Previous Image
      if (course?.courseBanner != "/placeholder.png") {
        const extractStoragePath = (url) => {
          try {
            const u = new URL(url);
            // Pattern: /v0/b/<bucket>/o/<encodedPath>
            const m = u.pathname.match(/\/o\/(.+)$/);
            if (m && m[1]) {
              const withoutQuery = m[1].split("?")[0];
              return decodeURIComponent(withoutQuery);
            }
            // Fallback: after '/o/' in pathname
            const idx = u.pathname.indexOf("/o/");
            if (idx !== -1) {
              const tail = u.pathname.slice(idx + 3).split("?")[0];
              return decodeURIComponent(tail);
            }
            return null;
          } catch {
            return null;
          }
        };

        const filePath = extractStoragePath(course?.courseBanner);
        if (filePath) {
          try {
            const fileRef = ref(storage, filePath);
            await deleteObject(fileRef);
            // console.log("Previous Image Deleted");
          } catch (delErr) {
            // Ignore delete errors (e.g., already deleted)
            // console.warn('Delete previous banner failed:', delErr);
          }
        }
      }

      // Upload new image in storage
      const fileName = Date.now() + file.name;
      const storageRef = ref(storage, "ai-course/" + fileName);

      const snapshot = await uploadBytes(storageRef, file);
      // console.log("Uploaded Completed!");

      const imageLink = await getDownloadURL(storageRef);
      // console.log("Image Link Generated!", imageLink);

      const result = await db
        .update(CourseList)
        .set({ courseBanner: imageLink })
        .where(eq(CourseList.id, course?.id));
      // console.log(result);
      refreshData(true);
      toast({
        variant: "success",
        duration: 3000,
        title: "Image Uploaded Successfully!",
        description: "Banner updated for this course.",
      });
    } catch (error) {
      // console.log(error);
      toast({
        variant: "destructive",
        duration: 3000,
        title: "Uh oh! Something went wrong.",
        description: error?.message || "There was a problem with your request.",
      });
    }
  };

  return (
    <div className="p-10 border rounded-xl shadow-sm mt-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          {/* Title */}
          <h2 className="text-3xl font-bold flex gap-1">
            {course?.courseOutput?.CourseName}
            {edit && (
              <EditCourseBasicInfo
                course={course}
                size={50}
                refreshData={() => {
                  refreshData(true);
                }}
              />
            )}
          </h2>
          <p className="text-sm text-gray-400 mt-3">
            {course?.courseOutput?.Description}
          </p>
          <h2 className="font-medium mt-2 flex gap-2 items-center text-primary">
            <HiOutlinePuzzle size={20} />
            {course?.category}
          </h2>
          {!edit && (
            <Link href={`/course/${course?.courseId}/start`}>
              <Button className="w-full mt-5">Start</Button>
            </Link>
          )}
        </div>
        {/* Image */}
        <div>
          <label htmlFor="upload-image">
            <Image
              src={
                selectedFile
                  ? selectedFile
                  : course?.courseBanner || "/placeholder.png"
              }
              quality={100}
              priority={true}
              alt="placeholder image for course image"
              width={300}
              height={300}
              className={`w-full rounded-xl object-cover h-[250px] ${
                edit ? "cursor-pointer" : ""
              }`}
              unoptimized
            />
          </label>
          {edit && (
            <input
              type="file"
              accept="image/*"
              id="upload-image"
              className="opacity-0"
              onChange={onFileChanged}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default CourseBasicInfo;

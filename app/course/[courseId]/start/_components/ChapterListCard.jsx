import React from "react";
import { HiOutlineClock } from "react-icons/hi";

function ChapterListCard({ chapter, index, visited }) {
  return (
    <div className="grid grid-cols-5 p-4 border-b items-center">
      <div>
        <h2 className={`flex items-center justify-center rounded-full w-8 h-8 text-center text-white ${visited ? "bg-green-600" : "bg-primary"}`}>
          {index + 1}
        </h2>
      </div>

      <div className="col-span-4">
        <div className="flex items-center gap-2">
          <h2 className="font-medium">{chapter?.ChapterName}</h2>
          {visited && (
            <span className="text-xs px-2 py-0.5 rounded border border-green-600/40 text-green-700 bg-green-50">Completed</span>
          )}
        </div>
        <h2 className="flex items-center gap-2 text-sm text-primary">
          <HiOutlineClock />
          {chapter?.Duration}
        </h2>
      </div>
    </div>
  );
}

export default ChapterListCard;

import React from 'react';

export default function Loading() {
  return (
    <div className="w-full h-full p-8 flex flex-col gap-6 animate-pulse">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 rounded-lg bg-border/50"></div>
        <div className="h-8 w-1/3 bg-border/50 rounded-lg"></div>
      </div>
      <div className="h-[200px] w-full bg-border/30 rounded-lg"></div>
      <div className="h-[300px] w-full bg-border/20 rounded-lg mt-2"></div>
    </div>
  );
}

import React from 'react';

export default function Loading() {
  return (
    <div className="w-full h-full p-8 flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-1/4 bg-border/50 rounded-lg"></div>
      <div className="flex gap-4">
        <div className="h-32 w-full bg-border/30 rounded-lg"></div>
        <div className="h-32 w-full bg-border/30 rounded-lg"></div>
        <div className="h-32 w-full bg-border/30 rounded-lg"></div>
      </div>
      <div className="h-64 w-full bg-border/20 rounded-lg mt-4"></div>
    </div>
  );
}

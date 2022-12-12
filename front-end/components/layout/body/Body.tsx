import React from "react";

interface BodyProps {
  children: React.ReactNode;
}

export default function Body({ children }: BodyProps) {
  return (
    <main className="h-screen w-screen px-2 py-8 overflow-hidden">
      <div className="relative w-full h-full flex flex-col justify-center items-center">
        {children}
      </div>
    </main>
  );
}

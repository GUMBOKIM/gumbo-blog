import React from "react";

interface BodyProps {
  children: React.ReactNode;
}

export default function Body({ children }: BodyProps) {
  return (
    <main className="h-screen w-screen px-2 py-8 overflow-hidden">
      <div className="relative w-full h-full flex flex-col justify-center items-center">
        <div className="relative flex h-full w-full max-w-7xl justify-around gap-2">
          {children}
        </div>
      </div>
    </main>
  );
}

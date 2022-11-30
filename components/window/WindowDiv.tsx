import React from "react";

interface WindowProps {
  title: string;
  className?: string;
  children: React.ReactNode;
}

export default function WindowDiv({
  title,
  className = "",
  children,
}: WindowProps) {
  return (
    <div className={`window ${className}`}>
      <div className="window-header">
        <div className="window-title">{title}</div>
        <div className="window-fake-btn" />
      </div>
      <div className="w-full p-2">{children}</div>
    </div>
  );
}

import React from "react";

type CardProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      {title ? <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold">{title}</div> : null}
      <div className="p-4">{children}</div>
    </div>
  );
}

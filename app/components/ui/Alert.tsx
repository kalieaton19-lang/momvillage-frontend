import React from "react";

type AlertProps = {
  title?: string;
  children?: React.ReactNode;
  variant?: "info" | "success" | "warning" | "error";
  className?: string;
};

export function Alert({ title, children, variant = "info", className = "" }: AlertProps) {
  const variants: Record<string, string> = {
    info: "bg-blue-50 text-blue-800 border-blue-200",
    success: "bg-green-50 text-green-800 border-green-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    error: "bg-red-50 text-red-800 border-red-200",
  };
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${variants[variant]} ${className}`} role="alert">
      {title ? <div className="font-semibold mb-1">{title}</div> : null}
      {children}
    </div>
  );
}

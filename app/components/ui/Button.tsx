"use client";
import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
};

export function Button({ variant = "primary", fullWidth, className = "", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    primary: "bg-black text-white hover:bg-gray-800 focus:ring-black",
    secondary: "bg-gray-200 text-black hover:bg-gray-300 focus:ring-gray-400",
    ghost: "bg-transparent text-black hover:bg-gray-100 focus:ring-gray-300",
  };
  const width = fullWidth ? "w-full" : "";
  return <button className={`${base} ${variants[variant]} ${width} ${className}`} {...props} />;
}

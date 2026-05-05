"use client";
import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export function Input({ label, hint, className = "", ...props }: InputProps) {
  const { id, name } = props;
  return (
    <div className="space-y-1">
      {label && id ? (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      ) : label ? (
        <span className="block text-sm font-medium text-gray-700">{label}</span>
      ) : null}
      <input
        id={id}
        name={name}
        className={`block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-black focus:ring-black ${className}`}
        {...props}
      />
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

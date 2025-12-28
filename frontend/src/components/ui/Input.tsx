"use client";

import React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error = false, type, ...props }, ref) => {
    const baseClasses =
      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50";
    const errorClasses = error ? "border-red-500 focus:ring-red-500" : "";
    const combinedClasses = `${baseClasses} ${errorClasses} ${className}`;

    return (
      <input type={type} className={combinedClasses} ref={ref} {...props} />
    );
  }
);

Input.displayName = "Input";

export { Input };

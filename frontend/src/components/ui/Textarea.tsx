"use client";

import React from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error = false, ...props }, ref) => {
    const baseClasses =
      "flex min-h-[80px] w-full rounded-md border border-gray-300 text-black bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50";
    const errorClasses = error ? "border-red-500 focus:ring-red-500" : "";
    const combinedClasses = `${baseClasses} ${errorClasses} ${className}`;

    return <textarea className={combinedClasses} ref={ref} {...props} />;
  }
);

Textarea.displayName = "Textarea";

export { Textarea };

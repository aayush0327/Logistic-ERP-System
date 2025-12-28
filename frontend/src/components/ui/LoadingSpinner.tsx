"use client";

/**
 * Reusable Loading Spinner Component
 */
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  text?: string;
}

export function LoadingSpinner({
  size = "md",
  className,
  text,
}: LoadingSpinnerProps) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <div className="relative">
        <div
          className={cn("rounded-full border-4 border-gray-200", sizes[size])}
        ></div>
        <div
          className={cn(
            "absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin",
            sizes[size]
          )}
        ></div>
      </div>
      {text && (
        <p className="mt-3 text-sm text-gray-600 animate-pulse">{text}</p>
      )}
    </div>
  );
}

/**
 * Full Page Loading Spinner
 */
export function FullPageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoadingSpinner size="xl" text={text} />
    </div>
  );
}

/**
 * Inline Loading Spinner (for buttons, etc)
 */
export function InlineSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("inline-block", className)}>
      <div className="relative w-4 h-4">
        <div className="absolute inset-0 rounded-full border-2 border-gray-300"></div>
        <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
      </div>
    </div>
  );
}

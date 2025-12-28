"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  variant?: "line" | "circle" | "rectangle";
}

export function Skeleton({
  className,
  width,
  height,
  variant = "line",
}: SkeletonProps) {
  const baseClasses = "bg-gray-200 animate-pulse";

  const variantClasses = {
    line: "rounded",
    circle: "rounded-full",
    rectangle: "rounded-lg",
  };

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={{
        width: width || undefined,
        height: height || undefined,
      }}
    />
  );
}

// Preset components for common use cases
export function SkeletonText({
  lines = 1,
  className,
  lineHeight = "1rem",
  gap = "0.5rem",
}: {
  lines?: number;
  className?: string;
  lineHeight?: string;
  gap?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="line"
          height={lineHeight}
          width={i === lines - 1 && lines > 1 ? "70%" : "100%"}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({
  size = "2.5rem",
  className,
}: {
  size?: string;
  className?: string;
}) {
  return (
    <Skeleton
      variant="circle"
      width={size}
      height={size}
      className={className}
    />
  );
}

export function SkeletonCard({
  className,
  height = "10rem",
}: {
  className?: string;
  height?: string;
}) {
  return (
    <Skeleton
      variant="rectangle"
      height={height}
      width="100%"
      className={className}
    />
  );
}

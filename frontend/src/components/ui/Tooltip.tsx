"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const childRef = React.useRef<HTMLDivElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (childRef.current && tooltipRef.current) {
      const childRect = childRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let top = 0;
      let left = 0;

      switch (side) {
        case "top":
          top = childRect.top - tooltipRect.height - 8;
          left = childRect.left + childRect.width / 2 - tooltipRect.width / 2;
          break;
        case "bottom":
          top = childRect.bottom + 8;
          left = childRect.left + childRect.width / 2 - tooltipRect.width / 2;
          break;
        case "left":
          top = childRect.top + childRect.height / 2 - tooltipRect.height / 2;
          left = childRect.left - tooltipRect.width - 8;
          break;
        case "right":
          top = childRect.top + childRect.height / 2 - tooltipRect.height / 2;
          left = childRect.right + 8;
          break;
      }

      setPosition({ top, left });
    }
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <div
        ref={childRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            "fixed z-50 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md shadow-lg pointer-events-none animate-in fade-in-0 zoom-in-95 duration-200",
            className
          )}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {content}
          {/* Arrow */}
          <div
            className={cn(
              "absolute w-2 h-2 bg-gray-900 transform rotate-45",
              side === "top" && "-bottom-1 left-1/2 -translate-x-1/2",
              side === "bottom" && "-top-1 left-1/2 -translate-x-1/2",
              side === "left" && "-right-1 top-1/2 -translate-y-1/2",
              side === "right" && "-left-1 top-1/2 -translate-y-1/2"
            )}
          />
        </div>
      )}
    </>
  );
}

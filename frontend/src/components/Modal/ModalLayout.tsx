"use client";

import { ReactNode, useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalLayoutProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  showCloseIcon?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const sizeClasses = {
  sm: "max-w-md min-w-[90vw] md:min-w-[448px] w-full md:w-auto",
  md: "max-w-lg min-w-[90vw] md:min-w-[512px] w-full md:w-auto",
  lg: "max-w-2xl min-w-[90vw] md:min-w-[672px] w-full md:w-auto",
  xl: "max-w-4xl min-w-[90vw] md:min-w-[768px] w-full md:w-auto",
  full: "max-w-full w-full mx-4",
};

export function ModalLayout({
  isOpen,
  onClose,
  title,
  children,
  className,
  showCloseIcon = true,
  size = "md",
}: ModalLayoutProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to ensure the DOM has updated before starting the animation
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
      // Wait for the exit animation to complete before removing from DOM
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match the animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          isAnimating ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-10">
        {/* Modal */}
        <div
          className={cn(
            // Base styles
            "relative transform bg-white shadow-xl transition-all duration-300 ease-out",
            // Mobile first - full width at bottom
            "rounded-lg w-full",
            // Size classes
            sizeClasses[size],
            // Animations
            isAnimating
              ? "translate-y-0 opacity-100 scale-100"
              : "-translate-y-full opacity-0 scale-95",
            // Custom className
            className
          )}
        >
          {/* Mobile Drag Handle (visual indicator for swipe-up) */}
          <div className="sm:hidden flex justify-center pt-2 pb-1">
            <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
          </div>

          {/* Header */}
          {(title || showCloseIcon) && (
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              {title && (
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              )}
              {showCloseIcon && (
                <button
                  onClick={onClose}
                  className="ml-auto h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="px-6 py-4 sm:max-h-[70vh] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>

      {/* Add custom styles for better animations */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(100%);
          }
        }

        @media (min-width: 640px) {
          @keyframes slideUp {
            from {
              transform: translateY(20px) scale(0.95);
              opacity: 0;
            }
            to {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
          }

          @keyframes slideDown {
            from {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
            to {
              transform: translateY(20px) scale(0.95);
              opacity: 0;
            }
          }
        }
      `}</style>
    </div>
  );
}

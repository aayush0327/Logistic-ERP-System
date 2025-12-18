"use client";

import { useEffect } from "react";
import { ModalLayout } from "./ModalLayout";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  showCloseIcon?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
  showCloseIcon = true,
  size = "md",
  closeOnEscape = true,
  closeOnBackdrop = true,
}: ModalProps) {
  // Handle escape key press
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleBackdropClick = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={handleBackdropClick}
      title={title}
      className={className}
      showCloseIcon={showCloseIcon}
      size={size}
    >
      {children}
    </ModalLayout>
  );
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface DropdownMenuProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DropdownMenu({
  children,
  open: controlledOpen,
  onOpenChange,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  return (
    <DropdownMenuProvider isOpen={isOpen} setIsOpen={setIsOpen}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuProvider>
  );
}

interface DropdownMenuProviderProps {
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

function DropdownMenuProvider({
  children,
  isOpen,
  setIsOpen,
}: DropdownMenuProviderProps) {
  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </DropdownMenuContext.Provider>
  );
}

interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DropdownMenuTrigger({
  children,
  asChild = false,
}: DropdownMenuTriggerProps) {
  const { isOpen, setIsOpen } = React.useContext(DropdownMenuContext);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      "aria-expanded": isOpen,
      "aria-haspopup": true,
    } as any);
  }

  return (
    <div ref={menuRef} onClick={handleClick}>
      {children}
    </div>
  );
}

interface DropdownMenuContentProps {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}

export function DropdownMenuContent({
  children,
  align = "end",
  className = "",
}: DropdownMenuContentProps) {
  const { isOpen, setIsOpen } = React.useContext(DropdownMenuContext);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number }>(
    { top: 0, left: 0 }
  );

  const updatePosition = React.useCallback(() => {
    const trigger = document.querySelector('[aria-expanded="true"]');
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      let left = rect.left;

      if (align === "end") {
        left = rect.right - 192; // 192 = w-48 (12rem)
      } else if (align === "center") {
        left = rect.left + rect.width / 2 - 96; // 96 = half of w-48
      }

      setPosition({
        top: rect.bottom + window.scrollY + 4, // 4 = mt-2
        left: Math.max(8, Math.min(left, window.innerWidth - 200)), // Keep within viewport
      });
    }
  }, [align]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", updatePosition);

      // Calculate initial position
      updatePosition();
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, setIsOpen, updatePosition]);

  if (!isOpen) return null;

  const content = (
    <div
      ref={menuRef}
      className={`z-50 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-opacity-5 focus:outline-none ${className}`}
      role="menu"
      aria-orientation="vertical"
      aria-labelledby="menu-button"
      style={{
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
        pointerEvents: "auto",
      }}
    >
      <div className="py-1" role="none" style={{ pointerEvents: "auto" }}>
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function DropdownMenuItem({
  children,
  onClick,
  disabled = false,
  className = "",
}: DropdownMenuItemProps) {
  const { setIsOpen } = React.useContext(DropdownMenuContext);

  const handleClick = () => {
    if (disabled) return;

    // Close the menu first
    setIsOpen(false);

    // Execute the onClick handler after a small delay to allow menu to close
    if (onClick) {
      setTimeout(() => {
        onClick();
      }, 0);
    }
  };

  return (
    <button
      type="button"
      className={`block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900 ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer active:bg-gray-200"
      } ${className}`}
      role="menuitem"
      onClick={handleClick}
      disabled={disabled}
      style={{ pointerEvents: "auto" }}
    >
      {children}
    </button>
  );
}

// Context for managing dropdown state
const DropdownMenuContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

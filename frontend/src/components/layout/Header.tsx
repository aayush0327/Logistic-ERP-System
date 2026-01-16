"use client";

import { Bell, UserCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { useRouter } from "next/navigation";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { NotificationBell } from "@/components/notifications";

interface HeaderProps {
  className?: string;
}

// Helper to get initials from name
function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "U";
}

export function Header({ className }: HeaderProps) {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const initials = getInitials(user?.first_name, user?.last_name);

  return (
    <header className={cn("bg-white border-b border-gray-200", className)}>
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{currentDate}</span>

          {/* Notification Bell */}
          <NotificationBell />

          {/* User Avatar with Dropdown */}
          <Dropdown
            trigger={
              <button className="w-9 h-9 cursor-pointer bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm hover:bg-blue-700 transition-colors">
                {initials}
              </button>
            }
            position="bottom"
            align="right"
          >
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <DropdownItem
              onClick={() => router.push("/profile")}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                Profile
              </div>
            </DropdownItem>
            <DropdownItem
              onClick={() => router.push("/settings")}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </div>
            </DropdownItem>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}

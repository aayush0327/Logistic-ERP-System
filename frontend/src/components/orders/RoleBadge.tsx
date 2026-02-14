"use client";

import { Badge } from "@/components/ui/Badge";
import { Shield, UserCog, Megaphone } from "lucide-react";

type UserRole = 'admin' | 'branch_manager' | 'marketing_person';

interface RoleBadgeProps {
  role?: UserRole;
  className?: string;
}

export function RoleBadge({ role, className = "" }: RoleBadgeProps) {
  if (!role) return null;

  const roleConfig = {
    admin: {
      label: "Admin",
      icon: Shield,
      variant: "info" as const,
      className: "bg-purple-50 text-purple-700 border-purple-200",
    },
    branch_manager: {
      label: "Branch Manager",
      icon: UserCog,
      variant: "info" as const,
      className: "bg-blue-50 text-blue-700 border-blue-200",
    },
    marketing_person: {
      label: "Marketing Person",
      icon: Megaphone,
      variant: "success" as const,
      className: "bg-green-50 text-green-700 border-green-200",
    },
  };

  const config = roleConfig[role] || roleConfig.admin;
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} ${className} font-semibold px-2 py-1 flex items-center gap-1`}
    >
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </Badge>
  );
}

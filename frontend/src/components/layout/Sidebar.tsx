"use client";

import { cn } from "@/lib/utils";
import {
  Package,
  Truck,
  Settings,
  FileText,
  ChevronRight,
  ChevronDown,
  User,
  LogOut,
  Building2,
  Users,
  DollarSign,
  Package2,
  LayoutDashboard,
  MapPin,
  ShoppingCart,
  ChevronLeft,
  Menu,
  UserCircle,
  UserCheck,
  FileClock,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { logoutAsync } from "@/store/slices/auth.slice";
import { useState, useEffect } from "react";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { ROLES, getUserRole, getAccessibleRoutes } from "@/lib/roles";
import { showSuccessToast } from "@/utils/toast";

interface SubMenuItem {
  label: string;
  href: string;
  icon?: React.ElementType;
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  role: string;
  subItems?: SubMenuItem[];
}

// Define navigation structure for each role
const navigationStructure: NavItem[] = [
  {
    label: "Super Admin",
    icon: User,
    role: ROLES.SUPER_ADMIN,
    subItems: [
      {
        label: "Dashboard",
        href: "/super-admin/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Company Admin",
    icon: Building2,
    role: ROLES.COMPANY_ADMIN,
    subItems: [
      {
        label: "Dashboard",
        href: "/company-admin/masters",
        icon: LayoutDashboard,
      },
      {
        label: "Branch Management",
        href: "/company-admin/masters/branches",
        icon: Building2,
      },
      {
        label: "Customer Management",
        href: "/company-admin/masters/customers",
        icon: Users,
      },
      {
        label: "Vehicle Management",
        href: "/company-admin/masters/vehicles",
        icon: Truck,
      },
      {
        label: "Product Management",
        href: "/company-admin/masters/products",
        icon: Package,
      },
      {
        label: "User Management",
        href: "/company-admin/masters/users",
        icon: UserCheck,
      },
      {
        label: "Pricing Configuration",
        href: "/company-admin/masters/pricing",
        icon: DollarSign,
      },
      {
        label: "Audit Logs",
        href: "/company-admin/masters/audit-logs",
        icon: FileClock,
      },
      {
        label: "Analytics Dashboard",
        href: "/company-admin/analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Branch Manager",
    icon: MapPin,
    role: ROLES.BRANCH_MANAGER,
    subItems: [
      {
        label: "Dashboard",
        href: "/branch-manager/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Finance Manager",
    icon: DollarSign,
    role: ROLES.FINANCE_MANAGER,
    subItems: [
      {
        label: "Dashboard",
        href: "/finance-manager/dashboard",
        icon: LayoutDashboard,
      },
      // { label: "Invoices", href: "/finance-manager/invoices", icon: FileText },
      // { label: "Reports", href: "/finance-manager/reports", icon: FileText },
    ],
  },
  {
    label: "Logistics Manager",
    icon: Package2,
    role: ROLES.LOGISTICS_MANAGER,
    subItems: [
      // {
      //   label: "Dashboard",
      //   href: "/logistics-manager/dashboard",
      //   icon: LayoutDashboard,
      // },
      {
        label: "Dashboard",
        href: "/logistics-manager/trips-management",
        icon: LayoutDashboard,
      },
      // {
      //   label: "Fleet Management",
      //   href: "/logistics-manager/fleet",
      //   icon: Truck,
      // },
      // { label: "Routes", href: "/logistics-manager/routes", icon: MapPin },
    ],
  },
  {
    label: "Driver",
    icon: Truck,
    role: ROLES.DRIVER,
    subItems: [
      { label: "My Trips", href: "/drivermodule/trips", icon: Truck },
      // { label: "Deliveries", href: "/drivermodule/deliveries", icon: Package },
    ],
  },
  {
    label: "User",
    icon: UserCircle,
    role: ROLES.USER,
    subItems: [
      // Will be populated based on your instructions
      // { label: "Profile", href: "/user/profile", icon: UserCircle },
    ],
  },
];

interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({
  className,
  isCollapsed = false,
  onToggle,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  // Get user role using the new getUserRole function
  const userRole = getUserRole(user || {});

  // Handle logout
  const handleLogout = async () => {
    try {
      await dispatch(logoutAsync()).unwrap();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Toggle menu expansion - only one open at a time
  const toggleMenu = (role: string) => {
    setExpandedMenu((prev) => (prev === role ? null : role));
  };

  // Filter navigation based on user role using ROLE_ROUTES
  const getFilteredNavigation = () => {
    if (!user || !userRole) return [];

    // Super admin sees everything
    // if (user.is_superuser || userRole === ROLES.SUPER_ADMIN) {
    //   return navigationStructure;
    // }

    // Get accessible routes for the user's role
    const accessibleRoutes = getAccessibleRoutes(userRole);

    // Filter navigation items based on accessible routes
    return navigationStructure.filter((nav) => {
      // If no subItems, check if the main href is accessible
      if (!nav.subItems || nav.subItems.length === 0) {
        return (
          nav.href &&
          accessibleRoutes.some((route) => nav.href!.startsWith(route))
        );
      }

      // Check if any subItem is accessible
      return nav.subItems.some((subItem) =>
        accessibleRoutes.some((route) => subItem.href.startsWith(route))
      );
    });
  };

  const filteredNavigation = getFilteredNavigation();

  // Auto-expand active menu on mount
  useEffect(() => {
    filteredNavigation.forEach((nav) => {
      const isActive = nav.subItems?.some((sub) =>
        pathname.startsWith(sub.href)
      );
      if (isActive) {
        setExpandedMenu(nav.role);
      }
    });
  }, [pathname]);

  return (
    <aside
      className={cn(
        "bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header with Toggle Button */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        {!isCollapsed && (
          <div className="overflow-hidden">
            <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">
              LogisticERP
            </h1>
            <p className="text-xs text-gray-500 whitespace-nowrap">
              Management System
            </p>
          </div>
        )}
        <button
          onClick={onToggle}
          className={cn(
            "p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600",
            isCollapsed && "mx-auto"
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <Menu className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-1">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isExpanded = expandedMenu === item.role;
            const hasActiveChild = item.subItems?.some((sub) =>
              pathname.startsWith(sub.href)
            );

            return (
              <li key={item.role}>
                {/* Main Menu Item */}
                <button
                  onClick={() => toggleMenu(item.role)}
                  className={cn(
                    "w-full flex items-center cursor-pointer px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    hasActiveChild
                      ? "bg-[#E6ECFF] text-[#1F40AE]"
                      : "text-gray-700 hover:bg-[#F1F4FF]",
                    isCollapsed ? "justify-center" : "justify-between"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div
                    className={cn("flex items-center", !isCollapsed && "gap-3")}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {!isCollapsed && (
                      <span className="whitespace-nowrap">{item.label}</span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <span className="transition-transform duration-200">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </span>
                  )}
                </button>

                {/* Sub Menu Items with Animation */}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded && !isCollapsed
                      ? "max-h-96 opacity-100"
                      : "max-h-0 opacity-0"
                  )}
                >
                  {item.subItems && (
                    <ul className="mt-1 ml-4 space-y-1">
                      {item.subItems.map((subItem) => {
                        const SubIcon = subItem.icon || ChevronRight;
                        // More precise active check: exact match OR starts with followed by slash
                        // Special handling for Dashboard to not match other routes under /company-admin/masters
                        const isDashboard = subItem.href === "/company-admin/masters";
                        const isActive =
                          pathname === subItem.href ||
                          (!isDashboard && pathname.startsWith(subItem.href + "/"));

                        return (
                          <li key={subItem.href}>
                            <Link
                              href={subItem.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                                isActive
                                  ? "bg-[#D4DEFF] text-[#1F40AE] font-medium"
                                  : "text-gray-600 hover:bg-[#F1F4FF] hover:text-gray-900"
                              )}
                            >
                              <SubIcon className="w-4 h-4 shrink-0" />
                              <span className="whitespace-nowrap">
                                {subItem.label}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info and Logout Section */}
      <div className="border-t border-gray-200 p-2 space-y-1">
        {/* User Info Row */}
        <div
          className={cn(
            "flex items-center cursor-pointer rounded-lg p-2 transition-colors",
            isCollapsed ? "justify-center" : "gap-3"
          )}
        >
          <div
            className={cn(
              "bg-blue-600 rounded-full flex items-center justify-center shrink-0",
              isCollapsed ? "w-8 h-8" : "w-10 h-10"
            )}
          >
            <User
              className={cn("text-white", isCollapsed ? "w-4 h-4" : "w-5 h-5")}
            />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.first_name || "User"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.role_name || user?.role?.name || "User"}
              </p>
            </div>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center cursor-pointer rounded-lg p-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors",
            isCollapsed ? "justify-center" : "gap-3 px-3"
          )}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

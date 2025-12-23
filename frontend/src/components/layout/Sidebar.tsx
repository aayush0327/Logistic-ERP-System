'use client';

import { cn } from '@/lib/utils';
import {
  Home,
  Package,
  Truck,
  CheckCircle,
  Clock,
  Settings,
  FileText,
  ChevronRight,
  User,
  UserCircle,
  LogOut,
  UserCheck,
  DollarSign
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { logoutAsync } from '@/store/slices/auth.slice';
import { showSuccessToast } from '@/utils/toast';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  access?: 'super_admin' | 'admin' | 'user';
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, access: 'user' },
  { label: 'Orders', href: '/orders', icon: Package, access: 'user' },
  { label: 'Trips', href: '/trips', icon: Truck, access: 'user' },
  { label: 'Driver', href: '/driver', icon: UserCheck, access: 'user' },
  { label: 'Finance', href: '/finance', icon: DollarSign, access: 'admin' },
  { label: 'Deliveries', href: '/deliveries', icon: CheckCircle, access: 'user' },
  { label: 'History', href: '/history', icon: Clock, access: 'user' },
  { label: 'Manage Masters', href: '/masters', icon: Settings, access: 'admin' },
  { label: 'Audit Logs', href: '/audit-logs', icon: FileText, access: 'admin' },
  { label: 'Super Admin', href: '/super-admin', icon: User, access: 'super_admin' },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  // Handle logout
  const handleLogout = async () => {
    try {
      await dispatch(logoutAsync()).unwrap();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Filter nav items based on user access level
  const filteredNavItems = navItems.filter(item => {
    // If no access level specified, show to everyone
    if (!item.access) return true;

    // Super admin can see everything
    if (user?.is_superuser) return true;

    // Check access levels
    if (item.access === 'user') return true;
    if (item.access === 'admin' && user?.role_id === 2) return true;  // Admin role
    if (item.access === 'admin' && user?.role_id === 3) return true;  // Manager role
    if (item.access === 'super_admin') return user?.is_superuser;

    return false;
  });

  return (
    <aside className={cn('w-64 bg-white border-r border-gray-200 flex flex-col h-full', className)}>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">AnimalCare</h1>
        <p className="text-sm text-gray-500">Orders & Deliveries</p>
      </div>

      <nav className="flex-1 px-4 pb-4">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-gray-200 p-4">
        <Dropdown
          trigger={
            <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {user?.first_name || 'User'}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
            </div>
          }
        >
          <DropdownItem onClick={() => window.location.href = '/profile'}>
            <div className="flex items-center gap-2">
              <UserCircle className="w-4 h-4" />
              Profile
            </div>
          </DropdownItem>
          <DropdownItem onClick={() => window.location.href = '/settings'}>
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </div>
          </DropdownItem>
          <hr className="my-1" />
          <DropdownItem onClick={handleLogout}>
            <div className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </div>
          </DropdownItem>
        </Dropdown>
      </div>
    </aside>
  );
}
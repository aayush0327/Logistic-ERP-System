'use client';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutAsync } from '@/store/slices/auth.slice';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isLoading } = useAppSelector((state) => state.auth);

  const handleLogout = async () => {
    await dispatch(logoutAsync());
    router.push('/login');
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <LogOut className="w-4 h-4" />
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FinanceManagerIndex() {
  const router = useRouter();

  useEffect(() => {
    router.push('/finance-manager/dashboard');
  }, [router]);

  return null;
}


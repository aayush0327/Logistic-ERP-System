import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main className={cn('flex-1 bg-gray-50 overflow-auto', className)}>
      <div className="p-6">
        {children}
      </div>
    </main>
  );
}
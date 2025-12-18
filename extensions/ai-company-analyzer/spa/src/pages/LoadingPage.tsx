import { Spinner } from '@/components/ui';

interface LoadingPageProps { message?: string; }

export default function LoadingPage({ message = '로딩 중...' }: LoadingPageProps) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-4" />
        <p className="text-ink-muted">{message}</p>
      </div>
    </div>
  );
}

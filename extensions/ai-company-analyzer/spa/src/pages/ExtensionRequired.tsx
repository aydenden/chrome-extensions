import { useExtension } from '@/contexts/ExtensionContext';

export default function ExtensionRequired() {
  const { error, isChecking, retry } = useExtension();

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="max-w-md text-center p-8">
        <h1 className="text-3xl font-bold mb-4">Extension 연결 필요</h1>
        <p className="text-ink-muted mb-6">
          AI Company Analyzer Extension이 설치되어 있지 않거나 연결할 수 없습니다.
        </p>
        {error && <p className="text-signal-negative mb-4 text-sm">오류: {error}</p>}
        <div className="space-y-4">
          <button onClick={retry} disabled={isChecking} className="w-full px-6 py-3 bg-ink text-paper font-semibold">
            {isChecking ? '연결 확인 중...' : '다시 시도'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="headline text-6xl mb-4">404</h1>
        <p className="text-xl text-ink-muted mb-8">페이지를 찾을 수 없습니다</p>
        <Link to="/"><Button variant="secondary">홈으로 돌아가기</Button></Link>
      </div>
    </div>
  );
}

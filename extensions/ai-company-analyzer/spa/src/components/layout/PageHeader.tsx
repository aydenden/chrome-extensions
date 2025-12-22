import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, backTo, actions }: PageHeaderProps) {
  return (
    <div className="editorial-grid mb-8">
      <div className="col-span-12">
        {backTo && (
          <Link to={backTo} className="inline-flex items-center gap-2 text-ink-muted hover:text-ink mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">뒤로</span>
          </Link>
        )}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="headline text-3xl sm:text-4xl">{title}</h1>
            {subtitle && <p className="text-ink-muted mt-2">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

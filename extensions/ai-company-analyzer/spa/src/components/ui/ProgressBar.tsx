import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
  className?: string;
}

export default function ProgressBar({ value, showLabel = true, className }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('w-full', className)}>
      <div className="h-2 bg-surface-sunken">
        <div className="h-full bg-ink transition-all duration-300" style={{ width: `${percentage}%` }} />
      </div>
      {showLabel && <div className="mt-1 text-right"><span className="data-figure text-sm text-ink-muted">{percentage}%</span></div>}
    </div>
  );
}

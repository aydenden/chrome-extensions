import { cn } from '@/lib/utils';

interface VariableChipProps {
  name: string;
  label: string;
  description: string;
  onClick: (variable: string) => void;
}

export function VariableChip({ name, label, description, onClick }: VariableChipProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(`{{${name}}}`)}
      className={cn(
        'group relative inline-flex items-center gap-1.5',
        'px-2.5 py-1 font-mono text-xs',
        'bg-surface-sunken border border-border-strong',
        'hover:bg-ink hover:text-paper hover:border-ink',
        'transition-colors duration-150',
        'cursor-pointer'
      )}
      title={description}
    >
      <span className="text-ink-muted group-hover:text-paper/70">{'{{'}</span>
      <span>{label}</span>
      <span className="text-ink-muted group-hover:text-paper/70">{'}}'}</span>
    </button>
  );
}

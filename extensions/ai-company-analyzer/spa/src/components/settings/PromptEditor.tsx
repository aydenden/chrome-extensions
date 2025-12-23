import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { VariableChip } from './VariableChip';
import type { PromptVariable } from '@/lib/prompts';

interface PromptEditorProps {
  title: string;
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
  variables: readonly PromptVariable[];
  isModified: boolean;
}

export function PromptEditor({
  title,
  value,
  onChange,
  onReset,
  variables,
  isModified,
}: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = useCallback((variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.slice(0, start) + variable + value.slice(end);

    onChange(newValue);

    // 커서 위치 복원
    requestAnimationFrame(() => {
      textarea.focus();
      const newPosition = start + variable.length;
      textarea.setSelectionRange(newPosition, newPosition);
    });
  }, [value, onChange]);

  return (
    <div className="border border-border-strong">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-strong bg-surface-sunken">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          {isModified && (
            <span className="text-xs px-1.5 py-0.5 bg-signal-neutral/10 text-signal-neutral">
              수정됨
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-xs"
        >
          기본값 복원
        </Button>
      </div>

      {/* 변수 태그 */}
      <div className="px-4 py-3 border-b border-border-subtle bg-surface-elevated">
        <p className="text-xs text-ink-muted mb-2">사용 가능한 변수 (클릭하면 커서 위치에 삽입)</p>
        <div className="flex flex-wrap gap-2">
          {variables.map((variable) => (
            <VariableChip
              key={variable.name}
              name={variable.name}
              label={variable.label}
              description={variable.description}
              onClick={insertVariable}
            />
          ))}
        </div>
      </div>

      {/* 에디터 */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full min-h-[240px] p-4',
            'font-mono text-sm leading-relaxed',
            'bg-paper-dark text-paper',
            'border-0 outline-none resize-y',
            'placeholder:text-paper/40'
          )}
          placeholder="프롬프트를 입력하세요..."
          spellCheck={false}
        />
        {/* 라인 카운터 오버레이 */}
        <div className="absolute bottom-2 right-3 text-xs text-paper/40 font-mono">
          {value.split('\n').length} lines
        </div>
      </div>
    </div>
  );
}

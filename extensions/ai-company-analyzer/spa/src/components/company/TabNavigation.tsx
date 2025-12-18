import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  count?: number;
  badge?: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="border-b-2 border-ink">
      <nav className="flex gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'px-6 py-3 font-semibold transition-colors border-2 border-b-0',
                isActive
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-transparent text-ink border-transparent hover:bg-surface-sunken'
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={cn('ml-2', isActive ? 'text-paper' : 'text-ink-muted')}>({tab.count})</span>
              )}
              {tab.badge && (
                <span
                  className={cn(
                    'ml-2 px-2 py-0.5 text-xs rounded',
                    isActive ? 'bg-signal-positive text-white' : 'bg-signal-positive/20 text-signal-positive'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

import { useRef, useEffect } from 'react';

interface PillTabsProps<T extends string> {
  tabs: { key: T; label: string }[];
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
}

export default function PillTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  className = '',
}: PillTabsProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const activeButton = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      const scrollLeft = buttonRect.left - containerRect.left - (containerRect.width - buttonRect.width) / 2 + container.scrollLeft;

      container.scrollTo({
        left: scrollLeft,
        behavior: 'smooth',
      });
    }
  }, [activeTab]);

  return (
    <div
      ref={scrollRef}
      className={`flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide ${className}`}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            ref={isActive ? activeRef : undefined}
            onClick={() => onChange(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 touch-target flex-shrink-0 ${
              isActive
                ? 'bg-primary text-white shadow-md'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

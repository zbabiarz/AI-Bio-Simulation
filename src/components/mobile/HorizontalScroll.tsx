import { useRef, useState, useEffect } from 'react';

interface HorizontalScrollProps {
  children: React.ReactNode;
  showIndicators?: boolean;
  className?: string;
}

export default function HorizontalScroll({
  children,
  showIndicators = true,
  className = '',
}: HorizontalScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const items = container.children;
    setTotalItems(items.length);

    const handleScroll = () => {
      if (!container) return;
      const scrollLeft = container.scrollLeft;
      const itemWidth = container.children[0]?.clientWidth || 0;
      const gap = 16;
      const index = Math.round(scrollLeft / (itemWidth + gap));
      setActiveIndex(Math.min(index, items.length - 1));
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [children]);

  return (
    <div className={className}>
      <div
        ref={scrollRef}
        className="horizontal-scroll"
      >
        {children}
      </div>

      {showIndicators && totalItems > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {Array.from({ length: totalItems }).map((_, index) => (
            <button
              key={index}
              onClick={() => {
                const container = scrollRef.current;
                if (!container) return;
                const itemWidth = container.children[0]?.clientWidth || 0;
                const gap = 16;
                container.scrollTo({
                  left: index * (itemWidth + gap),
                  behavior: 'smooth',
                });
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? 'w-6 bg-primary'
                  : 'w-1.5 bg-gray-300 dark:bg-slate-600'
              }`}
              aria-label={`Go to item ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'primary';
}

export function Skeleton({ className = '', variant = 'default' }: SkeletonProps) {
  return (
    <div
      className={`${variant === 'primary' ? 'skeleton-primary' : 'skeleton'} ${className}`}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card-mobile-elevated animate-fade-in ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-20 w-full mb-3" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonGauge({ className = '' }: { className?: string }) {
  return (
    <div className={`card-mobile-elevated animate-fade-in ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
      <div className="flex flex-col items-center">
        <div className="relative">
          <Skeleton variant="primary" className="w-56 h-56 rounded-full" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Skeleton className="h-14 w-20 mb-2" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-2 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart({ className = '' }: { className?: string }) {
  return (
    <div className={`card-mobile-elevated animate-fade-in ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function SkeletonList({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonInsightCard({ className = '' }: { className?: string }) {
  return (
    <div className={`w-72 flex-shrink-0 card-mobile-elevated animate-fade-in ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-4/5 mb-2" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  );
}

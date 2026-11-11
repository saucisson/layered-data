// Skeleton screens for async loading states — a pulsing placeholder
// that mirrors the shape of the content being loaded (WCAG 3.2.1:
// no surprise layout shift when the real content arrives).

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={"animate-pulse rounded bg-slate-200 dark:bg-slate-700 " + (className ?? "h-4 w-full")}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={"h-3 " + (index === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800" aria-hidden="true">
      <Skeleton className="h-4 w-1/3" />
      <SkeletonText lines={4} />
    </div>
  );
}

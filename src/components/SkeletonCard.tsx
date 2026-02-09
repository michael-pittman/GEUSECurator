export function SkeletonCard() {
  return (
    <div
      className="aspect-[3/4] animate-pulse rounded-xl sm:rounded-2xl bg-surface-card"
      role="status"
      aria-label="Loading artwork"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div
      className="aspect-[3/4] rounded-2xl animate-shimmer"
      role="status"
      aria-label="Loading artwork"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

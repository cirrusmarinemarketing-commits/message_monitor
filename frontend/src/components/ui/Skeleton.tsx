type SkeletonProps = {
  rows?: number
}

function Skeleton({ rows = 4 }: SkeletonProps) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <div className="skeleton-block skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton-block skeleton-line-wide" />
            <div className="skeleton-block skeleton-line-narrow" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default Skeleton

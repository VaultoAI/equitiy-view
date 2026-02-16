'use client';

/**
 * Skeleton placeholder matching TVLChart card layout (title + chart area).
 * Used while pool list or pool detail data is loading.
 */
export function ChartSkeleton() {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 px-2 py-3 md:p-6 rounded-lg">
      <div className="animate-pulse">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="h-[300px] bg-gray-300 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

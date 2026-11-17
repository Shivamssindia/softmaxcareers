import React from 'react';

export function ShimmerBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`shimmer-effect rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}

export function JobCardSkeleton() {
  return (
    <div className="ui-card p-6 space-y-4 shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <ShimmerBlock className="h-4 w-28 rounded-full" />
          <ShimmerBlock className="h-6 w-3/4 rounded-lg" />
          <ShimmerBlock className="h-4 w-1/2 rounded" />
        </div>
        <ShimmerBlock className="w-10 h-10 rounded-xl" />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <ShimmerBlock className="h-6 w-20 rounded-full" />
        <ShimmerBlock className="h-6 w-24 rounded-full" />
        <ShimmerBlock className="h-6 w-16 rounded-full" />
      </div>

      <div className="space-y-2 pt-2">
        <ShimmerBlock className="h-3 w-full rounded" />
        <ShimmerBlock className="h-3 w-5/6 rounded" />
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <ShimmerBlock className="h-5 w-24 rounded" />
        <ShimmerBlock className="h-9 w-28 rounded-xl" />
      </div>
    </div>
  );
}

export function JobGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
        <ShimmerBlock className="h-8 w-48 rounded-lg" />
        <ShimmerBlock className="h-8 w-32 rounded-lg" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 dark:bg-slate-800/40">
          {Array.from({ length: cols }).map((_, idx) => (
            <ShimmerBlock
              key={idx}
              className={`h-4 rounded ${idx === 0 ? 'col-span-4' : 'col-span-2'}`}
            />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="grid grid-cols-12 gap-4 p-4 items-center">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <ShimmerBlock
                key={cIdx}
                className={`h-4 rounded ${cIdx === 0 ? 'col-span-4 w-3/4' : 'col-span-2 w-2/3'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ShimmerBlock className="w-24 h-24 rounded-full" />
          <div className="space-y-3 flex-1 text-center sm:text-left">
            <ShimmerBlock className="h-7 w-48 rounded-lg mx-auto sm:mx-0" />
            <ShimmerBlock className="h-4 w-64 rounded mx-auto sm:mx-0" />
            <ShimmerBlock className="h-4 w-36 rounded mx-auto sm:mx-0" />
          </div>
          <ShimmerBlock className="h-10 w-28 rounded-xl" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <ShimmerBlock className="h-16 rounded-xl" />
          <ShimmerBlock className="h-16 rounded-xl" />
          <ShimmerBlock className="h-16 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <ShimmerBlock className="h-5 w-36 rounded" />
          <ShimmerBlock className="h-4 w-full rounded" />
          <ShimmerBlock className="h-4 w-5/6 rounded" />
          <ShimmerBlock className="h-4 w-4/6 rounded" />
        </div>
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <ShimmerBlock className="h-5 w-36 rounded" />
          <div className="flex flex-wrap gap-2">
            <ShimmerBlock className="h-6 w-20 rounded-full" />
            <ShimmerBlock className="h-6 w-24 rounded-full" />
            <ShimmerBlock className="h-6 w-16 rounded-full" />
            <ShimmerBlock className="h-6 w-28 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConsoleSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-8">
      {/* Header Skeleton */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <ShimmerBlock className="h-7 w-56 rounded-lg" />
            <ShimmerBlock className="h-4 w-72 rounded" />
          </div>
          <ShimmerBlock className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <ShimmerBlock className="h-16 rounded-xl" />
          <ShimmerBlock className="h-16 rounded-xl" />
          <ShimmerBlock className="h-16 rounded-xl" />
          <ShimmerBlock className="h-16 rounded-xl" />
        </div>
      </div>

      {/* Applications list Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <ShimmerBlock className="h-6 w-44 rounded-lg" />
          <ShimmerBlock className="h-8 w-28 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <ShimmerBlock className="h-5 w-48 rounded" />
                  <ShimmerBlock className="h-5 w-20 rounded-full" />
                </div>
                <ShimmerBlock className="h-3 w-64 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <ShimmerBlock className="h-9 w-28 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { Skeleton, SkeletonStat } from "@/components/ui/Skeleton";

export function ProjectDetailSkeleton() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-8 lg:w-[60%] lg:flex-none lg:basis-[60%]">
        <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-8 w-2/3 max-w-md rounded-md" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          <div className="mt-5 flex gap-6">
            <Skeleton className="h-9 w-40 rounded-full" />
            <Skeleton className="h-9 w-40 rounded-full" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SkeletonStat />
          <SkeletonStat />
          <SkeletonStat />
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
          <Skeleton className="h-7 w-40 rounded-md" />
          <div className="mt-6 space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-36 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
      <div className="w-full shrink-0 lg:w-[40%] lg:basis-[40%]">
        <Skeleton className="h-[calc(100vh-200px)] w-full rounded-xl" />
      </div>
    </div>
  );
}

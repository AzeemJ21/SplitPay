import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const shimmerBase =
  "animate-shimmer rounded bg-bg-card [background-image:linear-gradient(90deg,var(--bg-card)_25%,var(--bg-elevated)_50%,var(--bg-card)_75%)] [background-size:200%_100%]";

export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn(shimmerBase, className)} {...props} />;
}

export function SkeletonText({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <Skeleton className={cn("h-4 w-full max-w-[12rem]", className)} {...props} />;
}

export function SkeletonCard({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <Skeleton className={cn("h-32 w-full rounded-xl", className)} {...props} />;
}

export function SkeletonStat({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border-subtle bg-bg-card p-5",
        className,
      )}
      {...props}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

import { Skeleton } from "@/components/ui/Skeleton";

export function ChatSkeleton() {
  return (
    <div
      className="flex h-[calc(100vh-200px)] flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-card"
      aria-hidden
    >
      <div className="border-b border-border-subtle px-4 py-3">
        <Skeleton className="h-5 w-32 rounded-md" />
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
            <Skeleton className={`h-16 rounded-2xl ${i % 2 === 0 ? "w-[55%]" : "w-[60%]"}`} />
          </div>
        ))}
      </div>
      <div className="border-t border-border-subtle p-3">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

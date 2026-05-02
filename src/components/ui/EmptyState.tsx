import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10">
        <Icon className="h-8 w-8 text-orange-500" strokeWidth={1.5} />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-white">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md font-body text-sm text-[#666666]">{description}</p>
      ) : null}
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 rounded-md border border-orange-600 bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-orange-400"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

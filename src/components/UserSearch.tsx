"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SearchUser = {
  id: string;
  name: string;
  email: string;
  splitCode: string;
};

type UserSearchProps = {
  onSelect: (user: SearchUser) => void;
  className?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export function UserSearch({ onSelect, className }: UserSearchProps) {
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const DEBOUNCE_MS = 300;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setError(true);
        setResults([]);
        return;
      }
      const j = (await res.json()) as { data: SearchUser[] };
      setResults(j.data ?? []);
    } catch {
      setError(true);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(value);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, runSearch]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name, email, or #splitcode"
          autoComplete="off"
          className="h-11 w-full rounded-md border border-border-default bg-bg-card pr-10 pl-3 text-sm text-text-primary outline-none focus:border-orange-500"
        />
        {loading ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          </span>
        ) : null}
      </div>

      {open && value.trim() ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-auto rounded-md border border-border-subtle bg-bg-surface py-1 shadow-lg">
          {error ? (
            <p className="px-3 py-2 text-sm text-orange-400">Search failed. Try again.</p>
          ) : !loading && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-text-muted">No users found</p>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onSelect(u);
                  setValue("");
                  setResults([]);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-bg-card"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-black">
                  {initials(u.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text-primary">{u.name}</span>
                  <span className="block truncate text-xs text-text-secondary">{u.email}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-orange-500">#{u.splitCode}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

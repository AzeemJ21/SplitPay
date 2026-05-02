"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "profile" | "security" | "appearance" | "notifications";

type MeResponse = {
  id: string;
  name: string;
  email: string;
  splitCode: string;
  avatarUrl?: string;
  virtualCardBalance?: number;
  notificationPrefs?: NotificationPrefsState;
};

type NotificationPrefsState = {
  emailProjectAssignment: boolean;
  emailMilestoneFunded: boolean;
  emailWorkSubmitted: boolean;
  emailPaymentReleased: boolean;
  emailPaymentFailed: boolean;
};

const defaultPrefs: NotificationPrefsState = {
  emailProjectAssignment: true,
  emailMilestoneFunded: true,
  emailWorkSubmitted: true,
  emailPaymentReleased: true,
  emailPaymentFailed: true,
};

const tabs: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
];

function PrefsToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-orange-500" : "bg-zinc-700",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [tab, setTab] = useState<TabId>("profile");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPrefsState>(defaultPrefs);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => setMounted(true), []);

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/me");
      if (!res.ok) return;
      const j = (await res.json()) as { data: MeResponse };
      setMe(j.data);
      setProfileName(j.data.name);
      setProfileEmail(j.data.email);
      setAvatarPreview(j.data.avatarUrl ?? null);
      setPrefs({ ...defaultPrefs, ...j.data.notificationPrefs });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const initials = useMemo(() => {
    const n = profileName.trim();
    if (!n) return "?";
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }, [profileName]);

  const splitDisplay = me?.splitCode ? `#${me.splitCode}` : "—";

  const onAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      if (avatarFile) {
        const fd = new FormData();
        fd.append("name", profileName.trim());
        fd.append("email", profileEmail.trim());
        fd.append("avatar", avatarFile);
        const res = await fetch("/api/users/me", { method: "PUT", body: fd });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) {
          showToast(j.error ?? "Could not save profile");
          return;
        }
        setAvatarFile(null);
        await loadMe();
      } else {
        const res = await fetch("/api/users/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profileName.trim(),
            email: profileEmail.trim(),
          }),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) {
          showToast(j.error ?? "Could not save profile");
          return;
        }
        await loadMe();
      }
      showToast("Profile updated");
      router.refresh();
    } finally {
      setProfileSaving(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    if (pwdNew !== pwdConfirm) {
      setPwdError("New passwords do not match.");
      return;
    }
    if (pwdNew.length < 8) {
      setPwdError("New password must be at least 8 characters.");
      return;
    }
    setPwdSubmitting(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pwdCurrent,
          newPassword: pwdNew,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPwdError(j.error ?? "Could not update password.");
        return;
      }
      setPwdCurrent("");
      setPwdNew("");
      setPwdConfirm("");
      showToast("Password changed successfully");
    } finally {
      setPwdSubmitting(false);
    }
  };

  const saveNotificationPrefs = async () => {
    setPrefsSaving(true);
    try {
      const res = await fetch("/api/users/me/notification-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        showToast("Could not save preferences");
        return;
      }
      showToast("Preferences saved");
      await loadMe();
    } finally {
      setPrefsSaving(false);
    }
  };

  const themeActive = mounted ? resolvedTheme : "dark";

  return (
    <div className="relative">
      {toast ? (
        <div className="toast-success shadow-lg" role="status">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <nav
          className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:w-52 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
          aria-label="Settings sections"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "whitespace-nowrap rounded-md px-4 py-2.5 text-left text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-bg-card text-orange-500"
                  : "text-text-secondary hover:bg-bg-card/60 hover:text-text-primary",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-bg-surface p-6">
          {tab === "profile" && (
            <div className="space-y-8">
              <h2 className="font-display text-2xl text-text-primary">Profile</h2>

              {loading ? (
                <div className="h-40 animate-pulse rounded-lg bg-bg-card" />
              ) : (
                <>
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                    <div className="relative">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onAvatarPick}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative h-20 w-20 overflow-hidden rounded-full bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
                      >
                        {avatarPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarPreview}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-black">
                            {initials}
                          </span>
                        )}
                        <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <Camera className="mb-0.5 h-4 w-4" />
                          Change Photo
                        </span>
                      </button>
                    </div>

                    <div className="grid flex-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm text-text-secondary">Full Name</label>
                        <input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm text-text-secondary">Email</label>
                        <div className="relative">
                          <input
                            value={profileEmail}
                            onChange={(e) => setProfileEmail(e.target.value)}
                            className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 pr-24 text-sm text-text-primary outline-none focus:border-orange-500"
                          />
                          <span className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-600 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified
                          </span>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm text-text-secondary">Split Code</label>
                        <div
                          className="flex h-11 items-center justify-between gap-3 rounded-md border border-border-default bg-bg-card px-3 text-sm"
                          title="Can only be changed once"
                        >
                          <span className="font-mono text-orange-500">{splitDisplay}</span>
                          <span className="text-xs text-text-muted">Hover for info</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={profileSaving}
                      onClick={() => void saveProfile()}
                      className="h-11 rounded-md border border-orange-600 bg-orange-500 px-6 text-sm font-semibold text-black transition-colors hover:bg-orange-400 disabled:opacity-60"
                    >
                      {profileSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "security" && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-text-primary">Security</h2>
              <form onSubmit={(e) => void submitPassword(e)} className="max-w-lg space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-text-secondary">Current Password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={pwdCurrent}
                    onChange={(e) => setPwdCurrent(e.target.value)}
                    className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-text-secondary">New Password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={pwdNew}
                    onChange={(e) => setPwdNew(e.target.value)}
                    className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-orange-500"
                  />
                  <p className="mt-1 text-xs text-text-muted">Minimum 8 characters</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-text-secondary">Confirm New Password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-orange-500"
                  />
                </div>
                {pwdError ? (
                  <p className="text-sm text-red-500" role="alert">
                    {pwdError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={pwdSubmitting}
                  className="h-11 rounded-md border border-orange-600 bg-orange-500 px-5 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
                >
                  {pwdSubmitting ? "Updating…" : "Update Password"}
                </button>
              </form>
            </div>
          )}

          {tab === "appearance" && mounted && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-text-primary">Appearance</h2>
              <p className="text-sm font-medium text-text-primary">Theme</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border p-5 text-left transition-colors",
                    themeActive === "dark"
                      ? "border-orange-500 ring-1 ring-orange-500/30"
                      : "border-border-subtle hover:border-border-default",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-text-primary">
                      <Moon className="h-5 w-5 text-text-secondary" />
                      Dark Mode
                    </span>
                    {themeActive === "dark" ? (
                      <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-semibold text-orange-500">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <div className="h-16 rounded-lg border border-border-subtle bg-bg-base shadow-inner" />
                  <p className="text-xs text-text-muted">Default SplitPay look</p>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border p-5 text-left transition-colors",
                    themeActive === "light"
                      ? "border-orange-500 ring-1 ring-orange-500/30"
                      : "border-border-subtle hover:border-border-default",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-text-primary">
                      <Sun className="h-5 w-5 text-text-secondary" />
                      Light Mode
                    </span>
                    {themeActive === "light" ? (
                      <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-semibold text-orange-500">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <div className="h-16 rounded-lg border border-border-subtle bg-[#f5f5f5] shadow-inner" />
                  <p className="text-xs text-text-muted">Bright workspace</p>
                </button>
              </div>
            </div>
          )}

          {tab === "appearance" && !mounted && (
            <div className="h-40 animate-pulse rounded-lg bg-bg-card" />
          )}

          {tab === "notifications" && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-text-primary">Notifications</h2>
              <div className="space-y-3">
                {(
                  [
                    {
                      key: "emailProjectAssignment" as const,
                      title: "Email on project assignment",
                      desc: "When you are assigned to a new project.",
                    },
                    {
                      key: "emailMilestoneFunded" as const,
                      title: "Email on milestone funded",
                      desc: "When a client funds a milestone.",
                    },
                    {
                      key: "emailWorkSubmitted" as const,
                      title: "Email on work submitted",
                      desc: "When a freelancer submits work for review.",
                    },
                    {
                      key: "emailPaymentReleased" as const,
                      title: "Email on payment released",
                      desc: "When escrow or merchant payouts complete.",
                    },
                    {
                      key: "emailPaymentFailed" as const,
                      title: "Email on payment failed",
                      desc: "When a split payment or charge fails.",
                    },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-card p-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{row.title}</p>
                      <p className="text-xs text-text-secondary">{row.desc}</p>
                    </div>
                    <PrefsToggle
                      checked={prefs[row.key]}
                      onChange={(v) => setPrefs((p) => ({ ...p, [row.key]: v }))}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={prefsSaving}
                  onClick={() => void saveNotificationPrefs()}
                  className="h-11 rounded-md border border-orange-600 bg-orange-500 px-6 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
                >
                  {prefsSaving ? "Saving…" : "Save preferences"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

import { useSession } from "next-auth/react";
import {
  ArrowUp,
  Loader2,
  Mic,
  Paperclip,
  Pause,
  Play,
  Square,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { cn } from "@/lib/utils";

type ProjectChatProps = {
  projectId: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

function isYesterday(d: Date) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return isSameDay(d, y);
}

function dateSeparatorLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMessageTime(d: Date) {
  if (isToday(d)) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function seedHeights(id: string, n: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997;
  return Array.from({ length: n }, (_, i) => 4 + ((h + i * 17) % 60));
}

function WaveformBars({ id, animated }: { id: string; animated?: boolean }) {
  const heights = useMemo(() => seedHeights(id, 12), [id]);
  return (
    <div className="flex h-8 items-end gap-0.5">
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-sm bg-orange-500/90",
            animated && "animate-pulse",
          )}
          style={{ height: `${h}%`, minHeight: "4px", maxHeight: "100%" }}
        />
      ))}
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-2 px-2 py-1">
      <div className="h-3 w-24 animate-pulse rounded bg-bg-elevated" />
      <div
        className={cn(
          "max-w-[70%] animate-pulse rounded-2xl border border-border-subtle bg-bg-card px-4 py-3",
          "ml-0",
        )}
      >
        <div className="h-3 w-full rounded bg-bg-elevated" />
        <div className="mt-2 h-3 w-3/4 rounded bg-bg-elevated" />
      </div>
    </div>
  );
}

function VoiceBubble({
  msg,
  own,
}: {
  msg: ChatMessage;
  own: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !msg.fileUrl) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDur(Number.isFinite(a.duration) ? a.duration : 0);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
      a.currentTime = 0;
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnded);
    };
  }, [msg.fileUrl]);

  const pct = dur > 0 ? Math.min(100, (current / dur) * 100) : 0;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  return (
    <>
      <audio ref={audioRef} src={msg.fileUrl} preload="metadata" className="hidden" />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
            own ? "bg-orange-500 text-black hover:bg-orange-400" : "bg-orange-500/25 text-orange-400 hover:bg-orange-500/35",
          )}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-[140px] overflow-hidden rounded-full bg-[#2A2A2A]">
              <div
                className="h-full rounded-full bg-orange-500 transition-[width] duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-xs text-text-muted tabular-nums">
              {dur > 0 ? formatClock(dur) : "—"}
            </span>
          </div>
          <WaveformBars id={msg.id} />
        </div>
      </div>
    </>
  );
}

export function ProjectChat({ projectId }: ProjectChatProps) {
  const { data: session } = useSession();
  const { messages, loading, sendMessage, retryMessage, listEndRef } = useChat(projectId);
  const [text, setText] = useState("");
  const uid = session?.user?.id ?? "";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePick, setImagePick] = useState<{ file: File; url: string } | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const voice = useVoiceRecorder();

  const submitText = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await sendMessage(t, "text");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitText();
    }
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    const url = URL.createObjectURL(f);
    setImagePick({ file: f, url });
    e.target.value = "";
  };

  const clearImagePick = () => {
    if (imagePick?.url) URL.revokeObjectURL(imagePick.url);
    setImagePick(null);
  };

  const uploadAndSendImage = async () => {
    if (!imagePick) return;
    setImageBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", imagePick.file);
      const res = await fetch(`/api/projects/${projectId}/messages/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) return;
      const j = (await res.json()) as { url: string; name: string; mimeType: string };
      URL.revokeObjectURL(imagePick.url);
      setImagePick(null);
      await sendMessage("", "image", j.url, j.name, j.mimeType);
    } finally {
      setImageBusy(false);
    }
  };

  const uploadAndSendVoice = async () => {
    if (!voice.audioBlob) return;
    setImageBusy(true);
    try {
      const file = new File([voice.audioBlob], "voice-message.webm", {
        type: voice.audioBlob.type || "audio/webm",
      });
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/projects/${projectId}/messages/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) return;
      const j = (await res.json()) as { url: string; name: string; mimeType: string };
      voice.clearPreview();
      await sendMessage("Voice message", "voice", j.url, file.name, j.mimeType);
    } finally {
      setImageBusy(false);
    }
  };

  const showVoicePreview = Boolean(voice.audioUrl && !voice.recording);

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-card"
      style={{ height: "calc(100vh - 200px)", minHeight: "320px", maxHeight: "calc(100vh - 120px)" }}
    >
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="font-display text-lg font-semibold text-text-primary">Project chat</h3>
        <p className="text-xs text-text-muted">Updates every few seconds when this tab is visible</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {loading ? (
          <div className="flex flex-col gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <MessageSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {messages.map((m, i) => (
              <MessageRow
                key={m.id}
                msg={m}
                prev={messages[i - 1]}
                uid={uid}
                onImageClick={setLightbox}
                onRetry={retryMessage}
              />
            ))}
            <div ref={listEndRef} />
          </div>
        )}
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          role="presentation"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      <div className="border-t border-border-subtle p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickImage}
        />

        {voice.recording ? (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <span className="text-sm font-medium text-red-300">
              Recording {formatClock(voice.duration)}
            </span>
            <button
              type="button"
              onClick={() => voice.stopRecording()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
              aria-label="Stop recording"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
            <button
              type="button"
              onClick={() => voice.cancelRecording()}
              className="text-sm text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {showVoicePreview ? (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-border-default bg-bg-surface px-3 py-2">
            <audio src={voice.audioUrl ?? undefined} className="hidden" />
            <VoicePreviewPlayer url={voice.audioUrl!} />
            <WaveformBars id="preview-voice" animated />
            <button
              type="button"
              disabled={imageBusy}
              onClick={() => void uploadAndSendVoice()}
              className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg bg-orange-500 px-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
            >
              {imageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              Send
            </button>
            <button
              type="button"
              onClick={() => voice.clearPreview()}
              className="rounded-md p-1 text-text-muted hover:bg-bg-card hover:text-text-primary"
              aria-label="Discard recording"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}

        {imagePick ? (
          <div className="mb-3 flex items-center gap-3">
            <div className="relative h-[60px] w-[60px] overflow-hidden rounded-lg border border-border-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePick.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={clearImagePick}
                className="absolute -right-1 -top-1 rounded-full bg-bg-card p-0.5 text-text-muted shadow hover:text-text-primary"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              disabled={imageBusy}
              onClick={() => void uploadAndSendImage()}
              className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
            >
              {imageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send image"}
            </button>
          </div>
        ) : null}

        <div className="relative flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!!voice.recording || showVoicePreview}
            className="mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-default bg-bg-card text-text-muted hover:border-orange-500/50 hover:text-orange-400 disabled:opacity-40"
            aria-label="Attach image"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message… (Enter to send, Shift+Enter for line)"
            rows={1}
            disabled={voice.recording || showVoicePreview}
            className="max-h-32 min-h-[44px] w-full resize-none rounded-xl border border-border-default bg-bg-card px-3 py-2.5 pr-24 text-sm text-text-primary outline-none focus:border-orange-500 disabled:opacity-50"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />

          <button
            type="button"
            onClick={() => void voice.startRecording()}
            disabled={voice.recording || showVoicePreview || !!imagePick || imageBusy}
            className="absolute bottom-2 right-14 flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-bg-card text-text-muted hover:border-orange-500/50 hover:text-orange-400 disabled:opacity-40"
            aria-label="Record voice"
          >
            <Mic className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => void submitText()}
            disabled={!text.trim() || voice.recording || showVoicePreview}
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-black transition-colors hover:bg-orange-400 disabled:opacity-40"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function VoicePreviewPlayer({ url }: { url: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play().then(() => setPlaying(true)).catch(() => {});
    }
  };
  return (
    <>
      <audio ref={ref} src={url} className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-black hover:bg-orange-400"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
    </>
  );
}

function MessageRow({
  msg,
  prev,
  uid,
  onImageClick,
  onRetry,
}: {
  msg: ChatMessage;
  prev?: ChatMessage;
  uid: string;
  onImageClick: (url: string) => void;
  onRetry: (msg: ChatMessage) => void;
}) {
  const d = new Date(msg.createdAt);
  const pd = prev ? new Date(prev.createdAt) : null;
  const showDateSep = !prev || !pd || !isSameDay(d, pd);
  const own = msg.senderId === uid;
  const showName = !prev || prev.senderId !== msg.senderId;

  return (
    <>
      {showDateSep ? (
        <div className="my-4 flex justify-center">
          <span className="rounded-full bg-bg-elevated px-3 py-1 text-xs font-medium text-text-muted">
            {dateSeparatorLabel(d)}
          </span>
        </div>
      ) : null}
      <div className={cn("mb-2 flex w-full", own ? "justify-end" : "justify-start")}>
        <div className={cn("max-w-[70%]", own ? "items-end" : "items-start", "flex flex-col")}>
          {showName && !own ? (
            <span className="mb-0.5 px-1 text-xs text-text-muted">
              {msg.sender.name}
              {msg.sender.splitCode ? (
                <span className="ml-1 font-mono text-orange-500">#{msg.sender.splitCode}</span>
              ) : null}
            </span>
          ) : null}
          {showName && own ? (
            <span className="mb-0.5 px-1 text-right text-xs text-orange-500/90">You</span>
          ) : null}

          <div
            role={msg._failed && own ? "button" : undefined}
            tabIndex={msg._failed && own ? 0 : undefined}
            onClick={
              msg._failed && own
                ? () => onRetry(msg)
                : undefined
            }
            onKeyDown={
              msg._failed && own
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRetry(msg);
                    }
                  }
                : undefined
            }
            className={cn(
              "rounded-2xl border px-4 py-2 text-sm",
              own
                ? "border-orange-500/30 bg-orange-500/20 text-text-primary"
                : "border-border-subtle bg-bg-surface text-text-primary",
              msg._failed && own && "border-red-500/60 bg-red-500/10",
            )}
          >
            {msg.type === "image" && msg.fileUrl ? (
              <ImageBubbleContent url={msg.fileUrl} name={msg.fileName} onOpen={() => onImageClick(msg.fileUrl!)} />
            ) : msg.type === "voice" && msg.fileUrl ? (
              <VoiceBubble msg={msg} own={own} />
            ) : (
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            )}
          </div>

          {msg._failed && own ? (
            <p className="mt-1 px-1 text-center text-[11px] text-red-400">
              Failed to send — tap to retry
            </p>
          ) : null}

          <span className="mt-0.5 px-1 text-[10px] text-text-muted">{formatMessageTime(d)}</span>
        </div>
      </div>
    </>
  );
}

function ImageBubbleContent({
  url,
  name,
  onOpen,
}: {
  url: string;
  name?: string;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onOpen}
        className="relative block max-w-[240px] overflow-hidden rounded-xl border border-border-subtle bg-black/20"
      >
        {!loaded ? (
          <div className="flex h-[120px] w-[200px] items-center justify-center rounded-xl bg-bg-elevated">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className={cn(
            "max-h-[200px] max-w-[240px] rounded-xl object-cover transition-opacity",
            loaded ? "opacity-100" : "absolute left-0 top-0 opacity-0",
          )}
          onLoad={() => setLoaded(true)}
        />
      </button>
      {name ? <span className="text-[10px] text-text-muted">{name}</span> : null}
    </div>
  );
}

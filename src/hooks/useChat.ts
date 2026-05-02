"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  senderId: string;
  sender: { name: string; splitCode: string };
  content: string;
  type: string;
  fileUrl?: string;
  fileName?: string;
  fileMimeType?: string;
  createdAt: string;
  read: string[];
  _optimistic?: boolean;
  _failed?: boolean;
};

const POLL_MS = 3000;

export function useChat(projectId: string) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const lastMessageTime = useRef<string>("");
  const seenIds = useRef<Set<string>>(new Set());
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = useCallback(async (signal?: AbortSignal) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, { signal });
      if (!res.ok) return;
      const j = (await res.json()) as { data: ChatMessage[] };
      const data = j.data ?? [];
      setMessages(data);
      seenIds.current = new Set(data.map((m) => m.id));
      if (data.length) {
        lastMessageTime.current = data[data.length - 1].createdAt;
      } else {
        lastMessageTime.current = "";
      }
      setLoading(false);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }, [projectId]);

  const pollNewMessages = useCallback(
    async (signal?: AbortSignal) => {
      if (!projectId) return;
      try {
        if (!lastMessageTime.current) {
          await fetchMessages(signal);
          return;
        }
        const res = await fetch(
          `/api/projects/${projectId}/messages?after=${encodeURIComponent(lastMessageTime.current)}`,
          { signal },
        );
        if (!res.ok) return;
        const j = (await res.json()) as { data: ChatMessage[] };
        const data = j.data ?? [];
        if (data.length) {
          setMessages((prev) => {
            const next = [...prev];
            for (const m of data) {
              if (!seenIds.current.has(m.id)) {
                seenIds.current.add(m.id);
                next.push(m);
              }
            }
            return next;
          });
          lastMessageTime.current = data[data.length - 1].createdAt;
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    },
    [projectId, fetchMessages],
  );

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true);
    setMessages([]);
    seenIds.current = new Set();
    lastMessageTime.current = "";
    void fetchMessages(signal);

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void pollNewMessages(signal);
      }
    };
    const interval = setInterval(tick, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void pollNewMessages(signal);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [projectId, fetchMessages, pollNewMessages]);

  const sendMessage = useCallback(
    async (
      content: string,
      type: string = "text",
      fileUrl?: string,
      fileName?: string,
      fileMimeType?: string,
    ) => {
      if (!projectId) return;
      const uid = session?.user?.id;
      if (!uid) return;
      if (type === "text" && !content.trim()) return;

      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: ChatMessage = {
        id: tempId,
        senderId: uid,
        sender: {
          name: session.user?.name ?? "You",
          splitCode: session.user?.splitCode ?? "",
        },
        content: content || (type === "image" ? "Photo" : type === "voice" ? "Voice message" : ""),
        type,
        fileUrl,
        fileName,
        fileMimeType,
        createdAt: new Date().toISOString(),
        read: [],
        _optimistic: true,
      };

      seenIds.current.add(tempId);
      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        const payload: Record<string, unknown> = {
          content: type === "text" ? content.trim() : content || "",
        };
        if (type !== "text") {
          payload.type = type;
          if (fileUrl) payload.fileUrl = fileUrl;
          if (fileName) payload.fileName = fileName;
          if (fileMimeType) payload.fileMimeType = fileMimeType;
        }

        const res = await fetch(`/api/projects/${projectId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("send failed");
        const j = (await res.json()) as { data: ChatMessage };
        const data = j.data;
        if (!data?.id) throw new Error("no data");

        seenIds.current.delete(tempId);
        seenIds.current.add(data.id);
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...data, _optimistic: false } : m)));
        lastMessageTime.current = data.createdAt;
      } catch {
        seenIds.current.delete(tempId);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, _failed: true, _optimistic: false } : m)),
        );
      }
    },
    [projectId, session?.user],
  );

  const retryMessage = useCallback(
    (msg: ChatMessage) => {
      if (!msg._failed) return;
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      seenIds.current.delete(msg.id);
      void sendMessage(msg.content, msg.type, msg.fileUrl, msg.fileName, msg.fileMimeType);
    },
    [sendMessage],
  );

  return { messages, loading, sendMessage, retryMessage, refresh: fetchMessages, listEndRef };
}

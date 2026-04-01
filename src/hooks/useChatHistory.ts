import { useState, useCallback, useEffect } from "react";

type MessageContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: MessageContent;
  generatedImage?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "ai-studio-chat-history";
const MAX_CONVERSATIONS = 50;

function loadConversations(): ChatConversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveConversations(convos: ChatConversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, MAX_CONVERSATIONS)));
  } catch {
    // Storage full - remove oldest
    const trimmed = convos.slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
}

function getTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New Chat";
  const text = typeof first.content === "string"
    ? first.content
    : first.content.filter((p) => p.type === "text").map((p) => (p as any).text).join(" ");
  return text.slice(0, 40) || "New Chat";
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<ChatConversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  const createNew = useCallback(() => {
    const id = crypto.randomUUID();
    setActiveId(id);
    return id;
  }, []);

  const updateMessages = useCallback((id: string, messages: ChatMessage[]) => {
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === id);
      let updated: ChatConversation[];
      if (existing) {
        updated = prev.map((c) =>
          c.id === id ? { ...c, messages, title: getTitle(messages), updatedAt: Date.now() } : c
        );
      } else {
        updated = [{ id, title: getTitle(messages), messages, createdAt: Date.now(), updatedAt: Date.now() }, ...prev];
      }
      updated.sort((a, b) => b.updatedAt - a.updatedAt);
      saveConversations(updated);
      return updated;
    });
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveConversations(updated);
      return updated;
    });
    if (activeId === id) setActiveId(null);
  }, [activeId]);

  const switchTo = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  return { conversations, activeId, activeConversation, createNew, updateMessages, deleteConversation, switchTo };
}

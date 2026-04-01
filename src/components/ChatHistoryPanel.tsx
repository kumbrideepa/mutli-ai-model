import { Plus, MessageSquare, Trash2, X } from "lucide-react";
import type { ChatConversation } from "@/hooks/useChatHistory";

interface ChatHistoryPanelProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
  language: "en" | "hi" | "kn";
}

const labels = {
  en: { newChat: "New Chat", history: "Chat History", noChats: "No conversations yet" },
  hi: { newChat: "नई चैट", history: "चैट इतिहास", noChats: "अभी तक कोई बातचीत नहीं" },
  kn: { newChat: "ಹೊಸ ಚಾಟ್", history: "ಚಾಟ್ ಇತಿಹಾಸ", noChats: "ಇನ್ನೂ ಯಾವುದೇ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ" },
};

function timeAgo(ts: number, lang: string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === "hi" ? "अभी" : lang === "kn" ? "ಈಗ" : "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function ChatHistoryPanel({ conversations, activeId, onSelect, onNew, onDelete, onClose, language }: ChatHistoryPanelProps) {
  const l = labels[language];

  return (
    <div className="flex flex-col h-full bg-background border-r border-border/30">
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{l.history}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            title={l.newChat}
          >
            <Plus className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors md:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">{l.noChats}</p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-border/10 transition-colors ${
                c.id === activeId ? "bg-primary/10" : "hover:bg-muted/30"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate text-foreground">{c.title}</p>
                <p className="text-[10px] text-muted-foreground">{timeAgo(c.updatedAt, language)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

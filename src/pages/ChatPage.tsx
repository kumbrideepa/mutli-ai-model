import { useState } from "react";
import { History } from "lucide-react";
import { AIChat } from "@/components/AIChat";
import { ChatHistoryPanel } from "@/components/ChatHistoryPanel";
import { useChatHistory } from "@/hooks/useChatHistory";

interface ChatPageProps {
  language: "en" | "hi" | "kn";
}

export default function ChatPage({ language }: ChatPageProps) {
  const { conversations, activeId, activeConversation, createNew, updateMessages, deleteConversation, switchTo } = useChatHistory();
  const [showHistory, setShowHistory] = useState(false);

  const handleNewChat = () => {
    createNew();
    setShowHistory(false);
  };

  const handleSelect = (id: string) => {
    switchTo(id);
    setShowHistory(false);
  };

  const handleMessagesChange = (id: string, messages: any[]) => {
    updateMessages(id, messages);
  };

  const currentId = activeId || "pending";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden md:h-full">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/30 px-3 py-3 pl-14 md:px-6 md:py-4 md:pl-6">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-semibold md:text-xl">
            {language === "hi" ? "AI चैट" : language === "kn" ? "AI ಚಾಟ್" : "AI Chat"}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
            {language === "hi" ? "अपना प्रश्न पूछें" : language === "kn" ? "ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಕೇಳಿ" : "Ask anything, get intelligent answers"}
          </p>
        </div>

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="relative shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          title={language === "hi" ? "चैट इतिहास" : language === "kn" ? "ಚಾಟ್ ಇತಿಹಾಸ" : "Chat History"}
        >
          <History className="h-5 w-5" />
          {conversations.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {conversations.length > 9 ? "9+" : conversations.length}
            </span>
          )}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {showHistory && (
          <>
            <div className="absolute inset-0 z-10 bg-background/80 md:hidden" onClick={() => setShowHistory(false)} />
            <div className="absolute left-0 top-0 bottom-0 z-20 w-[85vw] max-w-64 md:relative md:w-56 lg:w-64">
              <ChatHistoryPanel
                conversations={conversations}
                activeId={activeId}
                onSelect={handleSelect}
                onNew={handleNewChat}
                onDelete={deleteConversation}
                onClose={() => setShowHistory(false)}
                language={language}
              />
            </div>
          </>
        )}

        <div className="flex-1 min-w-0 overflow-hidden">
          <AIChat
            key={currentId}
            language={language}
            initialMessages={activeConversation?.messages}
            onMessagesChange={(msgs) => {
              const id = activeId || createNew();
              handleMessagesChange(id, msgs);
            }}
          />
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { AIChat } from "@/components/AIChat";
import { ChatHistoryPanel } from "@/components/ChatHistoryPanel";
import { useChatHistory } from "@/hooks/useChatHistory";
import { History } from "lucide-react";

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

  // Ensure there's always an active chat
  const currentId = activeId || "pending";

  return (
    <div className="h-screen md:h-full flex flex-col">
      <header className="px-4 md:px-6 py-3 md:py-4 border-b border-border/30 pl-14 md:pl-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg md:text-xl font-semibold">
            {language === "hi" ? "AI चैट" : language === "kn" ? "AI ಚಾಟ್" : "AI Chat"}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            {language === "hi" ? "अपना प्रश्न पूछें" : language === "kn" ? "ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಕೇಳಿ" : "Ask anything, get intelligent answers"}
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors relative"
          title={language === "hi" ? "चैट इतिहास" : language === "kn" ? "ಚಾಟ್ ಇತಿಹಾಸ" : "Chat History"}
        >
          <History className="w-5 h-5" />
          {conversations.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {conversations.length > 9 ? "9+" : conversations.length}
            </span>
          )}
        </button>
      </header>
      <div className="flex-1 min-h-0 flex relative">
        {/* History panel - slides in on mobile, sidebar on desktop */}
        {showHistory && (
          <>
            <div className="absolute inset-0 bg-background/80 z-10 md:hidden" onClick={() => setShowHistory(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-64 z-20 md:relative md:w-56 lg:w-64">
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
        <div className="flex-1 min-w-0">
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

import { AIChat } from "@/components/AIChat";

interface ChatPageProps {
  language: "en" | "hi" | "kn";
}

export default function ChatPage({ language }: ChatPageProps) {
  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border/30">
        <h1 className="font-display text-xl font-semibold">
          {language === "hi" ? "AI चैट" : language === "kn" ? "AI ಚಾಟ್" : "AI Chat"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {language === "hi" ? "अपना प्रश्न पूछें" : language === "kn" ? "ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಕೇಳಿ" : "Ask anything, get intelligent answers"}
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <AIChat language={language} />
      </div>
    </div>
  );
}

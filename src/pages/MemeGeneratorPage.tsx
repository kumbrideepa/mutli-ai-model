import { AIChat } from "@/components/AIChat";

interface MemeGeneratorPageProps {
  language: "en" | "hi" | "kn";
}

export default function MemeGeneratorPage({ language }: MemeGeneratorPageProps) {
  const systemContext =
    "You are a hilarious Meme Generator AI! When a user gives you a topic, situation, or feeling, create funny meme concepts with: 1) A meme template suggestion (like 'Drake meme', 'Distracted boyfriend', 'This is fine dog', etc.), 2) The top text and bottom text for the meme, 3) A detailed description of what the meme would look like. You can also create original meme ideas, roast-style memes (keep it friendly!), and trending meme formats. Be creative, witty, and culturally aware. Include Indian meme references when appropriate! Use emojis liberally. If the user uploads an image, suggest funny captions for it.";

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">😂</span>
          <div>
            <h1 className="font-display text-xl font-semibold">
              {language === "hi" ? "मीम जनरेटर" : language === "kn" ? "ಮೀಮ್ ಜನರೇಟರ್" : "Meme Generator"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {language === "hi"
                ? "AI से मज़ेदार मीम्स बनाएं!"
                : language === "kn"
                ? "AI ಯಿಂದ ತಮಾಷೆಯ ಮೀಮ್‌ಗಳನ್ನು ರಚಿಸಿ!"
                : "Create hilarious memes with AI!"}
            </p>
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <AIChat language={language} systemContext={systemContext} />
      </div>
    </div>
  );
}

import { AIChat } from "@/components/AIChat";

interface AIGamesPageProps {
  language: "en" | "hi" | "kn";
}

export default function AIGamesPage({ language }: AIGamesPageProps) {
  const systemContext =
    "You are a fun AI Game Master! You can play various text-based games with the user including: 20 Questions, Riddles, Trivia Quiz, Word Association, Story-based Adventure Games, Would You Rather, and Number Guessing. Start by greeting the user and offering a list of games to play. Keep score when applicable. Be enthusiastic, fun, and engaging! Use emojis to make it lively. Always explain the rules before starting a game.";

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <div>
            <h1 className="font-display text-xl font-semibold">
              {language === "hi" ? "AI गेम्स" : language === "kn" ? "AI ಆಟಗಳು" : "AI Games"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {language === "hi"
                ? "AI के साथ मज़ेदार गेम्स खेलें!"
                : language === "kn"
                ? "AI ಜೊತೆ ಆಟಗಳನ್ನು ಆಡಿ!"
                : "Play fun text-based games with AI!"}
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

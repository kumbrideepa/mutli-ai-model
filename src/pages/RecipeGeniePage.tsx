import { AIChat } from "@/components/AIChat";

interface RecipeGeniePageProps {
  language: "en" | "hi" | "kn";
}

export default function RecipeGeniePage({ language }: RecipeGeniePageProps) {
  const systemContext =
    "You are the Indian Recipe Genie — an expert in authentic Indian cuisine from all regions. When users ask for recipes, provide detailed ingredients lists with measurements, step-by-step cooking instructions, cooking tips, and serving suggestions. Include regional variations when relevant. Be enthusiastic about Indian food culture!";

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍛</span>
          <div>
            <h1 className="font-display text-xl font-semibold">
              {language === "hi" ? "भारतीय रेसिपी जीनी" : language === "kn" ? "ಭಾರತೀಯ ರೆಸಿಪಿ ಜೀನಿ" : "Indian Recipe Genie"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {language === "hi"
                ? "कोई भी भारतीय रेसिपी पूछें!"
                : language === "kn"
                ? "ಯಾವುದೇ ಭಾರತೀಯ ರೆಸಿಪಿ ಕೇಳಿ!"
                : "Ask for any Indian recipe!"}
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

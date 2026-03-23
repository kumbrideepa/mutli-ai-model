import { AIChat } from "@/components/AIChat";

interface AIStoryPageProps {
  language: "en" | "hi" | "kn";
}

export default function AIStoryPage({ language }: AIStoryPageProps) {
  const systemContext =
    "You are a master storyteller AI! You create immersive, engaging stories in any genre — fantasy, sci-fi, mystery, romance, horror, mythology, fairy tales, and more. When a user gives you a theme, character, or setting, weave a captivating story around it. You can also create interactive 'choose your own adventure' stories where the user makes choices that affect the plot. Use vivid descriptions, dialogue, and plot twists. Ask the user what kind of story they want if they haven't specified.";

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📖</span>
          <div>
            <h1 className="font-display text-xl font-semibold">
              {language === "hi" ? "AI कहानीकार" : language === "kn" ? "AI ಕಥೆಗಾರ" : "AI Storyteller"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {language === "hi"
                ? "AI से अद्भुत कहानियाँ बनवाएं!"
                : language === "kn"
                ? "AI ಯಿಂದ ಅದ್ಭುತ ಕಥೆಗಳನ್ನು ರಚಿಸಿ!"
                : "Generate amazing stories with AI!"}
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

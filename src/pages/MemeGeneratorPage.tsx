import { AIChat } from "@/components/AIChat";

interface MemeGeneratorPageProps {
  language: "en" | "hi" | "kn";
}

export default function MemeGeneratorPage({ language }: MemeGeneratorPageProps) {
  const systemContext =
    "You are a hilarious Meme Generator AI! Help the user brainstorm meme ideas. When they describe a concept, the system will generate an actual meme image for them.";

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
                ? "AI से मज़ेदार मीम्स बनाएं! टेक्स्ट लिखें और मीम इमेज पाएं"
                : language === "kn"
                ? "AI ಯಿಂದ ಮೀಮ್ ಚಿತ್ರಗಳನ್ನು ರಚಿಸಿ! ಪಠ್ಯ ಬರೆಯಿರಿ"
                : "Type a prompt and get a funny AI-generated meme image!"}
            </p>
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <AIChat language={language} systemContext={systemContext} enableMemeGeneration />
      </div>
    </div>
  );
}

import { AIChat } from "@/components/AIChat";
import { GraduationCap } from "lucide-react";

interface StudyModePageProps {
  language: "en" | "hi" | "kn";
}

const t = {
  title: { en: "Study / Exam Mode", hi: "पढ़ाई / परीक्षा मोड", kn: "ಅಧ್ಯಯನ / ಪರೀಕ್ಷೆ ಮೋಡ್" },
  desc: { en: "AI-powered study assistant for exam prep", hi: "परीक्षा की तैयारी के लिए AI सहायक", kn: "ಪರೀಕ್ಷೆಗೆ AI ಸಹಾಯಕ" },
};

const studyContext = `You are an expert Study & Exam Preparation AI Tutor. Your capabilities:

📚 STUDY MODE:
- Explain any topic clearly with examples, analogies, and diagrams (using markdown tables/formatting)
- Break complex concepts into simple steps
- Create summary notes and key points
- Suggest study plans and strategies

📝 EXAM MODE:
- Generate practice questions (MCQ, short answer, long answer) on any topic
- Create flashcards: show the question first, then reveal the answer when asked
- Conduct mock quizzes — ask questions one by one, grade answers, and give scores
- Provide previous year question analysis patterns

🧠 FEATURES:
- When user says "quiz me on [topic]", start an interactive quiz (one question at a time, wait for answer, then grade)
- When user says "flashcards on [topic]", create a set of flashcards
- When user says "explain [topic]", give a thorough explanation
- When user says "mock test [topic]", create a timed practice test
- Track score during quizzes and show results at the end

Always be encouraging and supportive. Use emojis to make learning fun! 🎯`;

export default function StudyModePage({ language }: StudyModePageProps) {
  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border/30">
        <h1 className="font-display text-xl font-semibold flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" /> {t.title[language]}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.desc[language]}</p>
      </header>
      <div className="flex-1 min-h-0">
        <AIChat language={language} systemContext={studyContext} />
      </div>
    </div>
  );
}

import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/AppSidebar";
import ChatPage from "@/pages/ChatPage";
import AIGamesPage from "@/pages/AIGamesPage";
import AIStoryPage from "@/pages/AIStoryPage";
import MemeGeneratorPage from "@/pages/MemeGeneratorPage";
import RecipeGeniePage from "@/pages/RecipeGeniePage";
import GroupChatPage from "@/pages/GroupChatPage";
import StudyModePage from "@/pages/StudyModePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

type Language = "en" | "hi" | "kn";

const App = () => {
  const [language, setLanguage] = useState<Language>("en");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="flex min-h-screen w-full">
            <AppSidebar language={language} onLanguageChange={setLanguage} />
            <main className="flex-1 min-h-screen w-full overflow-hidden">
              <Routes>
                <Route path="/" element={<ChatPage language={language} />} />
                <Route path="/ai-games" element={<AIGamesPage language={language} />} />
                <Route path="/ai-story" element={<AIStoryPage language={language} />} />
                <Route path="/meme-generator" element={<MemeGeneratorPage language={language} />} />
                <Route path="/recipe-genie" element={<RecipeGeniePage language={language} />} />
                <Route path="/group-chat" element={<GroupChatPage language={language} userId="guest" />} />
                <Route path="/study-mode" element={<StudyModePage language={language} />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

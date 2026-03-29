import { useState, useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/AppSidebar";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

type Language = "en" | "hi" | "kn";

const App = () => {
  const [language, setLanguage] = useState<Language>("en");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthPage language={language} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="flex min-h-screen w-full">
            <AppSidebar language={language} onLanguageChange={setLanguage} onLogout={() => supabase.auth.signOut()} />
            <main className="flex-1 min-h-screen">
              <Routes>
                <Route path="/" element={<ChatPage language={language} />} />
                <Route path="/ai-games" element={<AIGamesPage language={language} />} />
                <Route path="/ai-story" element={<AIStoryPage language={language} />} />
                <Route path="/meme-generator" element={<MemeGeneratorPage language={language} />} />
                <Route path="/recipe-genie" element={<RecipeGeniePage language={language} />} />
                <Route path="/group-chat" element={<GroupChatPage language={language} userId={session.user.id} />} />
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

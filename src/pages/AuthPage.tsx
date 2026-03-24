import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Mail, Lock, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuthPageProps {
  language: "en" | "hi" | "kn";
}

const t = {
  login: { en: "Log In", hi: "लॉग इन", kn: "ಲಾಗ್ ಇನ್" },
  signup: { en: "Sign Up", hi: "साइन अप", kn: "ಸೈನ್ ಅಪ್" },
  email: { en: "Email", hi: "ईमेल", kn: "ಇಮೇಲ್" },
  password: { en: "Password", hi: "पासवर्ड", kn: "ಪಾಸ್‌ವರ್ಡ್" },
  username: { en: "Username", hi: "यूज़रनेम", kn: "ಬಳಕೆದಾರ ಹೆಸರು" },
  noAccount: { en: "Don't have an account?", hi: "अकाउंट नहीं है?", kn: "ಖಾತೆ ಇಲ್ಲವೇ?" },
  hasAccount: { en: "Already have an account?", hi: "पहले से अकाउंट है?", kn: "ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?" },
  welcome: { en: "Welcome to AI Studio", hi: "AI Studio में आपका स्वागत है", kn: "AI Studio ಗೆ ಸ್ವಾಗತ" },
  checkEmail: { en: "Check your email to verify your account!", hi: "अपना अकाउंट वेरिफाई करने के लिए ईमेल चेक करें!", kn: "ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಪರಿಶೀಲಿಸಲು ಇಮೇಲ್ ಪರಿಶೀಲಿಸಿ!" },
};

export default function AuthPage({ language }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username || email.split("@")[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: t.checkEmail[language] });
      }
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md glass-card rounded-2xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 glow-primary">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold gradient-text">{t.welcome[language]}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.username[language]}
                className="w-full glass-input pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground rounded-lg"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.email[language]}
              required
              className="w-full glass-input pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground rounded-lg"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.password[language]}
              required
              minLength={6}
              className="w-full glass-input pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLogin ? t.login[language] : t.signup[language]}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isLogin ? t.noAccount[language] : t.hasAccount[language]}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
            {isLogin ? t.signup[language] : t.login[language]}
          </button>
        </p>
      </div>
    </div>
  );
}

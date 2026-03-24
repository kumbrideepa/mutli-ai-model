import { useState } from "react";
import { MessageSquare, Gamepad2, BookOpen, Laugh, ChefHat, Sparkles, Globe, ChevronLeft, ChevronRight, Users, GraduationCap, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const navItems = [
  { title: "AI Chat", url: "/", icon: MessageSquare },
  { title: "Group Chat", url: "/group-chat", icon: Users },
  { title: "Study Mode", url: "/study-mode", icon: GraduationCap },
];

const funActivities = [
  { title: "AI Games", url: "/ai-games", icon: Gamepad2 },
  { title: "AI Storyteller", url: "/ai-story", icon: BookOpen },
  { title: "Meme Generator", url: "/meme-generator", icon: Laugh },
  { title: "Indian Recipe Genie", url: "/recipe-genie", icon: ChefHat },
];

type Language = "en" | "hi" | "kn";

const languages: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "kn", label: "ಕನ್ನಡ", flag: "🇮🇳" },
];

interface AppSidebarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onLogout?: () => void;
}

export function AppSidebar({ language, onLanguageChange, onLogout }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`glass-strong flex flex-col h-screen sticky top-0 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/30">
        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center glow-primary shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        {!collapsed && (
          <h1 className="font-display font-bold text-lg gradient-text truncate">
            AI Studio
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
        <div>
          {!collapsed && (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground px-3 mb-2">
              Main
            </p>
          )}
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.url}>
                <NavLink
                  to={item.url}
                  end
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-muted/40 transition-colors"
                  activeClassName="bg-primary/15 text-primary font-medium glow-primary"
                >
                  <item.icon className="w-4.5 h-4.5 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {!collapsed && (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground px-3 mb-2">
              🎉 Fun Activities
            </p>
          )}
          <ul className="space-y-1">
            {funActivities.map((item) => (
              <li key={item.url}>
                <NavLink
                  to={item.url}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-muted/40 transition-colors"
                  activeClassName="bg-accent/15 text-accent font-medium glow-accent"
                >
                  <item.icon className="w-4.5 h-4.5 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Language Selector */}
      <div className="p-3 border-t border-border/30">
        {!collapsed ? (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground px-3 mb-2 flex items-center gap-1.5">
              <Globe className="w-3 h-3" /> Language
            </p>
            <div className="space-y-1">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => onLanguageChange(lang.code)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    language === lang.code
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-sidebar-foreground hover:bg-muted/40"
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              const idx = languages.findIndex((l) => l.code === language);
              onLanguageChange(languages[(idx + 1) % languages.length].code);
            }}
            className="w-full flex justify-center p-2 rounded-lg hover:bg-muted/40 transition-colors"
            title="Switch language"
          >
            <span className="text-lg">{languages.find((l) => l.code === language)?.flag}</span>
          </button>
        )}
      </div>

      {/* Logout */}
      {onLogout && (
        <div className="p-3 border-t border-border/30">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="w-4.5 h-4.5 shrink-0" />
            {!collapsed && <span>{language === "hi" ? "लॉग आउट" : language === "kn" ? "ಲಾಗ್ ಔಟ್" : "Log Out"}</span>}
          </button>
        </div>
      )}
    </aside>
  );
}

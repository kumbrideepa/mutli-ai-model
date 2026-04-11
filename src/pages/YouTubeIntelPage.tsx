import { useState, useRef, useEffect } from "react";
import { Youtube, Send, Loader2, Bot, User, Volume2, VolumeX, LinkIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

type ParsedYouTubeInput = {
  videoId: string;
  url: string;
  question: string;
};

const parseYouTubeInput = (value: string): ParsedYouTubeInput | null => {
  const match = value.match(YOUTUBE_REGEX);
  if (!match) return null;

  const videoId = match[1];
  const matchedUrl = match[0];

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    question: value.replace(matchedUrl, "").trim(),
  };
};

const t = {
  title: { en: "YouTube Intelligence", hi: "YouTube इंटेलिजेंस", kn: "YouTube ಇಂಟೆಲಿಜೆನ್ಸ್" },
  desc: { en: "Paste a YouTube link to get AI summary & ask questions", hi: "YouTube लिंक पेस्ट करें और AI से पूछें", kn: "YouTube ಲಿಂಕ್ ಪೇಸ್ಟ್ ಮಾಡಿ ಮತ್ತು AI ಗೆ ಕೇಳಿ" },
  placeholder: { en: "Paste YouTube URL here...", hi: "YouTube URL यहाँ पेस्ट करें...", kn: "YouTube URL ಇಲ್ಲಿ ಪೇಸ್ಟ್ ಮಾಡಿ..." },
  analyze: { en: "Analyze Video", hi: "वीडियो विश्लेषण करें", kn: "ವೀಡಿಯೋ ವಿಶ್ಲೇಷಿಸಿ" },
  askPlaceholder: { en: "Ask about this video...", hi: "इस वीडियो के बारे में पूछें...", kn: "ಈ ವೀಡಿಯೋ ಬಗ್ಗೆ ಕೇಳಿ..." },
  invalid: { en: "Please enter a valid YouTube URL", hi: "कृपया सही YouTube URL डालें", kn: "ದಯವಿಟ್ಟು ಸರಿಯಾದ YouTube URL ನಮೂದಿಸಿ" },
  newVideo: { en: "New Video", hi: "नया वीडियो", kn: "ಹೊಸ ವೀಡಿಯೋ" },
};

interface Props {
  language: "en" | "hi" | "kn";
}

export default function YouTubeIntelPage({ language }: Props) {
  const [urlInput, setUrlInput] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, [messages, isLoading]);

  const streamSSE = async (resp: Response, onChunk: (text: string) => void) => {
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let done = false;
    while (!done) {
      const { done: d, value } = await reader.read();
      if (d) break;
      buf += decoder.decode(value, { stream: true });
      let ni: number;
      while ((ni = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, ni);
        buf = buf.slice(ni + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") { done = true; break; }
        try {
          const p = JSON.parse(json);
          const c = p.choices?.[0]?.delta?.content;
          if (c) onChunk(c);
        } catch { buf = line + "\n" + buf; break; }
      }
    }
  };

  const analyzeVideo = async () => {
    const parsedInput = parseYouTubeInput(urlInput);
    if (!parsedInput) return;

    const { url, videoId: parsedVideoId, question } = parsedInput;

    setVideoUrl(url);
    setVideoId(parsedVideoId);
    setMessages([]);
    setIsLoading(true);

    const userMsg: Msg = { role: "user", content: urlInput.trim() };
    setMessages([userMsg]);

    let assistantText = "";
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ url, language, question: question || undefined }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      await streamSSE(resp, (chunk) => {
        assistantText += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
          return [...prev, { role: "assistant", content: assistantText }];
        });
      });
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const askFollowUp = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput("");
    setIsLoading(true);

    let assistantText = "";
    try {
      // Use the chat endpoint with full conversation context
      const apiMessages = allMsgs.map(m => ({ role: m.role, content: m.content }));
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "user", content: `Context: The user is asking follow-up questions about a YouTube video. The video URL is ${videoUrl}. The initial summary was already provided in the conversation. Answer questions based on the summary and your knowledge.` },
            ...apiMessages,
          ],
          language,
        }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      await streamSSE(resp, (chunk) => {
        assistantText += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
          return [...prev, { role: "assistant", content: assistantText }];
        });
      });
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = (idx: number, text: string) => {
    if (speaking === idx) { speechSynthesis.cancel(); setSpeaking(null); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language === "hi" ? "hi-IN" : language === "kn" ? "kn-IN" : "en-US";
    u.onend = () => setSpeaking(null);
    speechSynthesis.speak(u);
    setSpeaking(idx);
  };

  const resetToNew = () => {
    setVideoUrl(null);
    setVideoId(null);
    setMessages([]);
    setUrlInput("");
  };

  const isValidUrl = Boolean(parseYouTubeInput(urlInput));

  // URL input screen
  if (!videoUrl) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-border/30 px-3 py-3 pl-14 md:px-6 md:py-4 md:pl-6">
          <h1 className="font-display text-lg font-semibold flex items-center gap-2 md:text-xl">
            <Youtube className="w-5 h-5 text-red-500" /> {t.title[language]}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 md:text-sm">{t.desc[language]}</p>
        </header>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-lg space-y-6 text-center animate-reveal">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <Youtube className="w-10 h-10 text-red-500" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold mb-1">
                {language === "hi" ? "YouTube लिंक पेस्ट करें" : language === "kn" ? "YouTube ಲಿಂಕ್ ಪೇಸ್ಟ್ ಮಾಡಿ" : "Paste a YouTube Link"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {language === "hi" ? "AI वीडियो का सारांश देगा और आपके सवालों का जवाब देगा" : language === "kn" ? "AI ವೀಡಿಯೋ ಸಾರಾಂಶ ನೀಡುತ್ತದೆ ಮತ್ತು ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸುತ್ತದೆ" : "AI will summarize the video and answer your questions"}
              </p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (isValidUrl) analyzeVideo(); }} className="space-y-3">
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder={t.placeholder[language]}
                  className="glass-input w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              {urlInput && !isValidUrl && (
                <p className="text-xs text-destructive">{t.invalid[language]}</p>
              )}
              <button
                type="submit"
                disabled={!isValidUrl}
                className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-red-600 disabled:opacity-40 active:scale-[0.98]"
              >
                <Youtube className="w-4 h-4 inline mr-2" />
                {t.analyze[language]}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border/30 px-3 py-3 pl-14 md:px-6 md:py-4 md:pl-6">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-semibold flex items-center gap-2 md:text-xl">
            <Youtube className="w-5 h-5 text-red-500 shrink-0" /> {t.title[language]}
          </h1>
          {videoId && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              youtube.com/watch?v={videoId}
            </p>
          )}
        </div>
        <button onClick={resetToNew} className="shrink-0 rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors">
          {t.newVideo[language]}
        </button>
      </header>

      {/* Video embed */}
      {videoId && (
        <div className="shrink-0 bg-black/20 flex justify-center p-2">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            className="rounded-lg w-full max-w-md aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 scroll-smooth">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 animate-reveal ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl text-sm leading-relaxed ${
              msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md px-4 py-3" : "glass-card rounded-bl-md"
            }`}>
              {msg.role === "assistant" ? (
                <>
                  <div className="px-4 py-3 prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 break-words">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  <button onClick={() => speakText(i, msg.content)} className="px-4 pb-2 text-xs text-muted-foreground hover:text-primary transition-colors">
                    {speaking === i ? <VolumeX className="w-3.5 h-3.5 inline mr-1" /> : <Volume2 className="w-3.5 h-3.5 inline mr-1" />}
                    {language === "hi" ? "सुनें" : language === "kn" ? "ಕೇಳಿ" : "Listen"}
                  </button>
                </>
              ) : (
                <span className="break-words">{msg.content}</span>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-foreground" />
              </div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3 animate-reveal">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="glass-card px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs text-muted-foreground">
                {language === "hi" ? "📺 वीडियो विश्लेषण कर रहा है..." : language === "kn" ? "📺 ವೀಡಿಯೋ ವಿಶ್ಲೇಷಿಸುತ್ತಿದೆ..." : "📺 Analyzing video..."}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="sticky bottom-0 border-t border-border/30 bg-background/80 p-2 md:p-4 backdrop-blur safe-bottom">
        <form onSubmit={(e) => { e.preventDefault(); askFollowUp(); }} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.askPlaceholder[language]}
            className="glass-input flex-1 min-w-0 rounded-xl px-3 py-2.5 text-[16px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            disabled={isLoading}
            enterKeyHint="send"
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="shrink-0 rounded-xl bg-primary p-2.5 text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 active:scale-95">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

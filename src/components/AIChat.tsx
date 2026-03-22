import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, Paperclip, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

type MessageContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
type Msg = { role: "user" | "assistant"; content: MessageContent };

// Extract display text from a message
const getDisplayText = (content: MessageContent): string => {
  if (typeof content === "string") return content;
  return content.filter((p) => p.type === "text").map((p) => (p as any).text).join("");
};

// Extract images from a message
const getImages = (content: MessageContent): string[] => {
  if (typeof content === "string") return [];
  return content.filter((p) => p.type === "image_url").map((p) => (p as any).image_url.url);
};

interface AIChatProps {
  language: "en" | "hi" | "kn";
  systemContext?: string;
}

export function AIChat({ language, systemContext }: AIChatProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const placeholders: Record<string, string> = {
    en: "Type your message...",
    hi: "अपना संदेश लिखें...",
    kn: "ನಿಮ್ಮ ಸಂದೇಶವನ್ನು ಟೈಪ್ ಮಾಡಿ...",
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB max

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const send = async () => {
    if ((!input.trim() && !imagePreview) || isLoading) return;

    // Build user message content
    let userContent: MessageContent;
    if (imagePreview) {
      const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
      parts.push({ type: "image_url", image_url: { url: imagePreview } });
      parts.push({ type: "text", text: input.trim() || "What do you see in this image? Describe and analyze it." });
      userContent = parts;
    } else {
      userContent = input.trim();
    }

    const userMsg: Msg = { role: "user", content: userContent };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setImagePreview(null);
    setIsLoading(true);

    let assistantSoFar = "";

    // Prepare messages for API — include system context if present
    const apiMessages = systemContext
      ? [{ role: "user" as const, content: `Context: ${systemContext}` }, ...allMessages]
      : allMessages;

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages, language }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${e.message || "Something went wrong. Please try again."}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-reveal">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 glow-primary">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">
              {language === "hi" ? "नमस्ते! मैं AI Studio हूँ" : language === "kn" ? "ನಮಸ್ಕಾರ! ನಾನು AI Studio" : "Hello! I'm AI Studio"}
            </h2>
            <p className="text-muted-foreground text-sm max-w-md">
              {language === "hi"
                ? "मुझसे कुछ भी पूछें या एक तस्वीर अपलोड करें। मैं छवियों का विश्लेषण कर सकता हूँ!"
                : language === "kn"
                ? "ನನ್ನನ್ನು ಏನಾದರೂ ಕೇಳಿ ಅಥವಾ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ. ನಾನು ಚಿತ್ರಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಬಲ್ಲೆ!"
                : "Ask me anything or upload a photo. I can analyze images too!"}
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const text = getDisplayText(msg.content);
          const images = getImages(msg.content);

          return (
            <div
              key={i}
              className={`flex gap-3 animate-reveal ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl text-sm leading-relaxed overflow-hidden ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "glass-card rounded-bl-md"
                }`}
              >
                {/* Attached images */}
                {images.length > 0 && (
                  <div className="p-2 pb-0">
                    {images.map((src, j) => (
                      <img key={j} src={src} alt="Uploaded" className="rounded-lg max-h-48 w-auto object-contain" />
                    ))}
                  </div>
                )}
                <div className="px-4 py-3">
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  ) : (
                    text
                  )}
                </div>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-foreground" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3 animate-reveal">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="glass-card px-4 py-3 rounded-2xl rounded-bl-md">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="px-4 pt-2">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded-lg object-cover border border-border/40" />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80 transition-colors active:scale-95"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border/30">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-center gap-2"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
            className="p-3 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all active:scale-95"
            title={language === "hi" ? "छवि अपलोड करें" : language === "kn" ? "ಚಿತ್ರ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ" : "Upload image"}
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={imagePreview ? (language === "hi" ? "इस छवि के बारे में पूछें..." : language === "kn" ? "ಈ ಚಿತ್ರದ ಬಗ್ಗೆ ಕೇಳಿ..." : "Ask about this image...") : placeholders[language]}
            className="flex-1 glass-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && !imagePreview)}
            className="p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

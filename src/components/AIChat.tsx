import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Bot, User, Paperclip, X, Mic, MicOff, ImagePlus, Brain, Eye, Globe, Sparkles, Volume2, VolumeX } from "lucide-react";
import ReactMarkdown from "react-markdown";

type MessageContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
type Msg = { role: "user" | "assistant"; content: MessageContent; generatedImage?: string };

const getDisplayText = (content: MessageContent): string => {
  if (typeof content === "string") return content;
  return content.filter((p) => p.type === "text").map((p) => (p as any).text).join("");
};

const getImages = (content: MessageContent): string[] => {
  if (typeof content === "string") return [];
  return content.filter((p) => p.type === "image_url").map((p) => (p as any).image_url.url);
};

interface AIChatProps {
  language: "en" | "hi" | "kn";
  systemContext?: string;
  enableMemeGeneration?: boolean;
}

type ThinkingAgent = "brain" | "vision" | "multilingual" | "generation" | null;

const agentLabels: Record<string, Record<string, string>> = {
  brain: { en: "🧠 Brain Agent thinking...", hi: "🧠 ब्रेन एजेंट सोच रहा है...", kn: "🧠 ಬ್ರೈನ್ ಏಜೆಂಟ್ ಯೋಚಿಸುತ್ತಿದೆ..." },
  vision: { en: "👁️ Vision Agent analyzing...", hi: "👁️ विज़न एजेंट विश्लेषण कर रहा है...", kn: "👁️ ವಿಷನ್ ಏಜೆಂಟ್ ವಿಶ್ಲೇಷಿಸುತ್ತಿದೆ..." },
  multilingual: { en: "🌐 Multilingual Agent translating...", hi: "🌐 बहुभाषी एजेंट अनुवाद कर रहा है...", kn: "🌐 ಬಹುಭಾಷಾ ಏಜೆಂಟ್ ಅನುವಾದಿಸುತ್ತಿದೆ..." },
  generation: { en: "🎨 Generation Agent creating meme...", hi: "🎨 जनरेशन एजेंट मीम बना रहा है...", kn: "🎨 ಜನರೇಶನ್ ಏಜೆಂಟ್ ಮೀಮ್ ರಚಿಸುತ್ತಿದೆ..." },
};

export function AIChat({ language, systemContext, enableMemeGeneration }: AIChatProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [thinkingAgent, setThinkingAgent] = useState<ThinkingAgent>(null);
  const [isGeneratingMeme, setIsGeneratingMeme] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinkingAgent]);

  const placeholders: Record<string, string> = {
    en: enableMemeGeneration ? "Describe a meme idea..." : "Type your message...",
    hi: enableMemeGeneration ? "मीम का विचार लिखें..." : "अपना संदेश लिखें...",
    kn: enableMemeGeneration ? "ಮೀಮ್ ಐಡಿಯಾ ಬರೆಯಿರಿ..." : "ನಿಮ್ಮ ಸಂದೇಶವನ್ನು ಟೈಪ್ ಮಾಡಿ...",
  };

  const compressImage = (file: File, maxWidth = 800, quality = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return;
    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(language === "hi" ? "आपका ब्राउज़र वॉइस इनपुट सपोर्ट नहीं करता" : language === "kn" ? "ನಿಮ್ಮ ಬ್ರೌಸರ್ ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಅನ್ನು ಬೆಂಬಲಿಸುವುದಿಲ್ಲ" : "Your browser doesn't support voice input");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = language === "hi" ? "hi-IN" : language === "kn" ? "kn-IN" : "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join("");
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, language]);

  const generateMeme = async (prompt: string) => {
    setIsGeneratingMeme(true);
    setThinkingAgent("generation");
    try {
      const MEME_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meme-generate`;
      const resp = await fetch(MEME_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt, language }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Meme generation failed");
      
      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: data.text || (language === "hi" ? "यहाँ आपका मीम है! 😂" : language === "kn" ? "ಇಲ್ಲಿ ನಿಮ್ಮ ಮೀಮ್! 😂" : "Here's your meme! 😂"),
          generatedImage: data.imageUrl 
        },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${e.message || "Meme generation failed"}` },
      ]);
    } finally {
      setIsGeneratingMeme(false);
      setThinkingAgent(null);
    }
  };

  const send = async () => {
    if ((!input.trim() && !imagePreview) || isLoading || isGeneratingMeme) return;

    let userContent: MessageContent;
    const hasImage = !!imagePreview;

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

    // For meme generator, use the image generation endpoint
    if (enableMemeGeneration && !hasImage) {
      const prompt = typeof userContent === "string" ? userContent : getDisplayText(userContent);
      await generateMeme(prompt);
      return;
    }

    setIsLoading(true);
    
    // Determine which agent is "thinking"
    if (hasImage) {
      setThinkingAgent("vision");
    } else if (language !== "en") {
      setThinkingAgent("multilingual");
    } else {
      setThinkingAgent("brain");
    }

    let assistantSoFar = "";
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
        // Clear thinking once we get first token
        setThinkingAgent(null);
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
      setThinkingAgent(null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${e.message || "Something went wrong. Please try again."}` },
      ]);
    } finally {
      setIsLoading(false);
      setThinkingAgent(null);
    }
  };

  const isBusy = isLoading || isGeneratingMeme;

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-reveal">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 glow-primary">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">
              {language === "hi" ? "नमस्ते! मैं AI Studio हूँ" : language === "kn" ? "ನಮಸ್ಕಾರ! ನಾನು AI Studio" : "Hello! I'm AI Studio"}
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mb-4">
              {language === "hi"
                ? "मुझसे कुछ भी पूछें, तस्वीर भेजें, या माइक बटन दबाकर बोलें!"
                : language === "kn"
                ? "ನನ್ನನ್ನು ಏನಾದರೂ ಕೇಳಿ, ಫೋಟೋ ಕಳುಹಿಸಿ, ಅಥವಾ ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ!"
                : "Ask me anything, send a photo, or tap the mic to speak!"}
            </p>
            {/* Agent badges */}
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {[
                { icon: Brain, label: language === "hi" ? "🧠 ब्रेन" : language === "kn" ? "🧠 ಬ್ರೈನ್" : "🧠 Brain" },
                { icon: Eye, label: language === "hi" ? "👁️ विज़न" : language === "kn" ? "👁️ ವಿಷನ್" : "👁️ Vision" },
                { icon: Globe, label: language === "hi" ? "🌐 बहुभाषी" : language === "kn" ? "🌐 ಬಹುಭಾಷಾ" : "🌐 Multilingual" },
                ...(enableMemeGeneration ? [{ icon: ImagePlus, label: language === "hi" ? "🎨 जनरेशन" : language === "kn" ? "🎨 ಜನರೇಶನ್" : "🎨 Generation" }] : []),
              ].map((agent) => (
                <span key={agent.label} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                  {agent.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const text = getDisplayText(msg.content);
          const images = getImages(msg.content);
          return (
            <div key={i} className={`flex gap-3 animate-reveal ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl text-sm leading-relaxed overflow-hidden ${
                msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "glass-card rounded-bl-md"
              }`}>
                {images.length > 0 && (
                  <div className="p-2 pb-0">
                    {images.map((src, j) => (
                      <img key={j} src={src} alt="Uploaded" className="rounded-lg max-h-48 w-auto object-contain" />
                    ))}
                  </div>
                )}
                {msg.generatedImage && (
                  <div className="p-2 pb-0">
                    <img src={msg.generatedImage} alt="Generated meme" className="rounded-lg max-h-80 w-auto object-contain" />
                  </div>
                )}
                <div className="px-4 py-3">
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  ) : text}
                </div>
                {msg.role === "assistant" && text && (
                  <button
                    onClick={() => {
                      if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
                      const utter = new SpeechSynthesisUtterance(text);
                      utter.lang = language === "hi" ? "hi-IN" : language === "kn" ? "kn-IN" : "en-US";
                      speechSynthesis.speak(utter);
                    }}
                    className="px-4 pb-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                    title={language === "hi" ? "सुनें" : language === "kn" ? "ಕೇಳಿ" : "Listen"}
                  >
                    <Volume2 className="w-3.5 h-3.5 inline mr-1" />
                    {language === "hi" ? "सुनें" : language === "kn" ? "ಕೇಳಿ" : "Listen"}
                  </button>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-foreground" />
                </div>
              )}
            </div>
          );
        })}

        {/* Thinking UI */}
        {thinkingAgent && (
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
              <span className="text-xs text-muted-foreground font-medium">
                {agentLabels[thinkingAgent]?.[language] || agentLabels[thinkingAgent]?.en}
              </span>
            </div>
          </div>
        )}
      </div>

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

      <div className="p-3 md:p-4 border-t border-border/30">
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-1.5 md:gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isBusy}
            className="p-3 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all active:scale-95"
            title={language === "hi" ? "छवि अपलोड करें" : language === "kn" ? "ಚಿತ್ರ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ" : "Upload image"}
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>
          <button
            type="button"
            onClick={toggleVoice}
            disabled={isBusy}
            className={`p-3 rounded-lg transition-all active:scale-95 ${
              isListening
                ? "bg-destructive/20 text-destructive animate-pulse"
                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
            } disabled:opacity-40`}
            title={language === "hi" ? "बोलकर टाइप करें" : language === "kn" ? "ಮಾತನಾಡಿ ಟೈಪ್ ಮಾಡಿ" : "Voice input"}
          >
            {isListening ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? (language === "hi" ? "सुन रहा हूँ..." : language === "kn" ? "ಕೇಳುತ್ತಿದ್ದೇನೆ..." : "Listening...") : imagePreview ? (language === "hi" ? "इस छवि के बारे में पूछें..." : language === "kn" ? "ಈ ಚಿತ್ರದ ಬಗ್ಗೆ ಕೇಳಿ..." : "Ask about this image...") : placeholders[language]}
            className="flex-1 min-w-0 glass-input px-3 md:px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
            disabled={isBusy}
          />
          <button
            type="submit"
            disabled={isBusy || (!input.trim() && !imagePreview)}
            className="p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95"
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : enableMemeGeneration ? <ImagePlus className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Bot, User, Paperclip, X, Mic, MicOff, ImagePlus, Volume2, VolumeX, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import * as pdfjsLib from "pdfjs-dist";

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

type MessageContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
type Msg = { role: "user" | "assistant"; content: MessageContent; generatedImage?: string; pdfNames?: string[] };

const getDisplayText = (content: MessageContent): string => {
  if (typeof content === "string") return content;
  return content.filter((p) => p.type === "text").map((p) => (p as any).text).join("");
};

const getImages = (content: MessageContent): string[] => {
  if (typeof content === "string") return [];
  return content.filter((p) => p.type === "image_url").map((p) => (p as any).image_url.url);
};

const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

interface AIChatProps {
  language: "en" | "hi" | "kn";
  systemContext?: string;
  enableMemeGeneration?: boolean;
  initialMessages?: Msg[];
  onMessagesChange?: (messages: Msg[]) => void;
}

type ThinkingAgent = "brain" | "vision" | "multilingual" | "generation" | "pdf" | "youtube" | null;

const agentLabels: Record<string, Record<string, string>> = {
  brain: { en: "🧠 Brain Agent thinking...", hi: "🧠 ब्रेन एजेंट सोच रहा है...", kn: "🧠 ಬ್ರೈನ್ ಏಜೆಂಟ್ ಯೋಚಿಸುತ್ತಿದೆ..." },
  vision: { en: "👁️ Vision Agent analyzing...", hi: "👁️ विज़न एजेंट विश्लेषण कर रहा है...", kn: "👁️ ವಿಷನ್ ಏಜೆಂಟ್ ವಿಶ್ಲೇಷಿಸುತ್ತಿದೆ..." },
  multilingual: { en: "🌐 Multilingual Agent translating...", hi: "🌐 बहुभाषी एजेंट अनुवाद कर रहा है...", kn: "🌐 ಬಹುಭಾಷಾ ಏಜೆಂಟ್ ಅನುವಾದಿಸುತ್ತಿದೆ..." },
  generation: { en: "🎨 Generation Agent creating meme...", hi: "🎨 जनरेशन एजेंट मीम बना रहा है...", kn: "🎨 ಜನರೇಶನ್ ಏಜೆಂಟ್ ಮೀಮ್ ರಚಿಸುತ್ತಿದೆ..." },
  pdf: { en: "📄 Reading PDF document...", hi: "📄 PDF दस्तावेज़ पढ़ रहा है...", kn: "📄 PDF ಡಾಕ್ಯುಮೆಂಟ್ ಓದುತ್ತಿದೆ..." },
  youtube: { en: "📺 Analyzing YouTube video...", hi: "📺 YouTube वीडियो विश्लेषण कर रहा है...", kn: "📺 YouTube ವೀಡಿಯೋ ವಿಶ್ಲೇಷಿಸುತ್ತಿದೆ..." },
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];
  const maxPages = Math.min(pdf.numPages, 10); // limit to 10 pages
  
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2; // good quality
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.85));
    canvas.remove();
  }
  return images;
}

export function AIChat({ language, systemContext, enableMemeGeneration, initialMessages, onMessagesChange }: AIChatProps) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [thinkingAgent, setThinkingAgent] = useState<ThinkingAgent>(null);
  const [isGeneratingMeme, setIsGeneratingMeme] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendLockRef = useRef(false);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, [messages, thinkingAgent]);

  useEffect(() => {
    if (messages.length > 0) onMessagesChange?.(messages);
  }, [messages]);

  const placeholders: Record<string, string> = {
    en: enableMemeGeneration ? "Describe a meme idea..." : "Type a message or paste a YouTube link...",
    hi: enableMemeGeneration ? "मीम का विचार लिखें..." : "संदेश लिखें या YouTube लिंक पेस्ट करें...",
    kn: enableMemeGeneration ? "ಮೀಮ್ ಐಡಿಯಾ ಬರೆಯಿರಿ..." : "ಸಂದೇಶ ಟೈಪ್ ಮಾಡಿ ಅಥವಾ YouTube ಲಿಂಕ್ ಪೇಸ್ಟ್ ಮಾಡಿ...",
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
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const imageFiles = files.filter(f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024);
    const remaining = 20 - imagePreviews.length;
    const toProcess = imageFiles.slice(0, remaining);
    
    const newPreviews: string[] = [];
    for (const file of toProcess) {
      try {
        const compressed = await compressImage(file);
        newPreviews.push(compressed);
      } catch {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newPreviews.push(dataUrl);
      }
    }
    setImagePreviews(prev => [...prev, ...newPreviews]);
    e.target.value = "";
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pdfs = files.filter(f => f.type === "application/pdf" && f.size <= 20 * 1024 * 1024);
    const remaining = 15 - pdfFiles.length;
    setPdfFiles(prev => [...prev, ...pdfs.slice(0, remaining)]);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removePdf = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ prompt, language }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Meme generation failed");
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.text || (language === "hi" ? "यहाँ आपका मीम है! 😂" : language === "kn" ? "ಇಲ್ಲಿ ನಿಮ್ಮ ಮೀಮ್! 😂" : "Here's your meme! 😂"),
        generatedImage: data.imageUrl,
      }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${e.message || "Meme generation failed"}` }]);
    } finally {
      setIsGeneratingMeme(false);
      setThinkingAgent(null);
    }
  };

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
        } catch {
          buf = line + "\n" + buf;
          break;
        }
      }
    }
  };

  const speakText = (idx: number, text: string) => {
    if (speaking === idx) {
      speechSynthesis.cancel();
      setSpeaking(null);
      return;
    }
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = language === "hi" ? "hi-IN" : language === "kn" ? "kn-IN" : "en-US";
    utter.onend = () => setSpeaking(null);
    speechSynthesis.speak(utter);
    setSpeaking(idx);
  };

  const send = async () => {
    if ((!input.trim() && !imagePreviews.length && !pdfFiles.length) || isLoading || isGeneratingMeme || sendLockRef.current) return;
    sendLockRef.current = true;

    const textInput = input.trim();
    const hasImages = imagePreviews.length > 0;
    const hasPdfs = pdfFiles.length > 0;
    const youtubeMatch = textInput.match(YOUTUBE_REGEX);

    // Build user message content
    let userContent: MessageContent;
    const pdfNames = pdfFiles.map(f => f.name);
    const currentPdfFiles = [...pdfFiles]; // capture before clearing

    if (hasImages) {
      const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
      for (const img of imagePreviews) {
        parts.push({ type: "image_url", image_url: { url: img } });
      }
      parts.push({ type: "text", text: textInput || `What do you see in ${imagePreviews.length > 1 ? "these images" : "this image"}? Describe and analyze.` });
      userContent = parts;
    } else {
      userContent = textInput;
    }

    const userMsg: Msg = { role: "user", content: userContent, pdfNames: pdfNames.length ? pdfNames : undefined };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setImagePreviews([]);
    setPdfFiles([]);

    // Meme generation path
    if (enableMemeGeneration && !hasImages && !hasPdfs && !youtubeMatch) {
      try {
        const prompt = typeof userContent === "string" ? userContent : getDisplayText(userContent);
        await generateMeme(prompt);
      } finally {
        sendLockRef.current = false;
      }
      return;
    }

    // YouTube summary path
    if (youtubeMatch && !hasImages && !hasPdfs) {
      setIsLoading(true);
      setThinkingAgent("youtube");
      let assistantSoFar = "";
      try {
        const YT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-summary`;
        const resp = await fetch(YT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ url: textInput, language }),
        });
        if (!resp.ok || !resp.body) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || `Error ${resp.status}`);
        }
        await streamSSE(resp, (chunk) => {
          assistantSoFar += chunk;
          setThinkingAgent(null);
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
        });
      } catch (e: any) {
        setThinkingAgent(null);
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message || "Could not summarize video"}` }]);
      } finally {
        setIsLoading(false);
        setThinkingAgent(null);
      }
      return;
    }

    // PDF reading path - convert PDF pages to images, then use vision via chat
    if (hasPdfs && !hasImages) {
      setIsLoading(true);
      setThinkingAgent("pdf");
      
      try {
        // Convert all PDF pages to images
        const allPageImages: string[] = [];
        for (const file of currentPdfFiles) {
          try {
            const pageImages = await pdfToImages(file);
            allPageImages.push(...pageImages);
          } catch (e: any) {
            console.error(`Failed to render ${file.name}:`, e);
            setMessages(prev => [...prev, { role: "assistant", content: `⚠️ Could not render ${file.name}: ${e.message}` }]);
          }
        }

        if (allPageImages.length === 0) {
          throw new Error("Could not render any PDF pages");
        }

        // Build vision message with PDF page images
        const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
        for (const img of allPageImages) {
          parts.push({ type: "image_url", image_url: { url: img } });
        }
        const pdfQuestion = textInput || "Please read and summarize this PDF document.";
        parts.push({ type: "text", text: `These are pages from PDF file(s): ${pdfNames.join(", ")}. ${pdfQuestion}` });

        // Send through regular chat endpoint with vision
        const visionMessages = [...messages, { role: "user" as const, content: parts }];
        if (systemContext) {
          visionMessages.unshift({ role: "user" as const, content: `Context: ${systemContext}` } as Msg);
        }

        const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ messages: visionMessages, language }),
        });
        if (!resp.ok || !resp.body) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || `Error ${resp.status}`);
        }
        let assistantSoFar = "";
        await streamSSE(resp, (chunk) => {
          assistantSoFar += chunk;
          setThinkingAgent(null);
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
        });
      } catch (e: any) {
        setThinkingAgent(null);
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message || "Could not read PDF"}` }]);
      }
      setIsLoading(false);
      setThinkingAgent(null);
      return;
    }

    // Regular chat path (with optional images)
    setIsLoading(true);
    if (hasImages) setThinkingAgent("vision");
    else if (language !== "en") setThinkingAgent("multilingual");
    else setThinkingAgent("brain");

    let assistantSoFar = "";
    const apiMessages = [...allMessages];
    if (systemContext) {
      apiMessages.unshift({ role: "user" as const, content: `Context: ${systemContext}` });
    }

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: apiMessages, language }),
      });
      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${resp.status}`);
      }
      await streamSSE(resp, (chunk) => {
        assistantSoFar += chunk;
        setThinkingAgent(null);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      });
    } catch (e: any) {
      setThinkingAgent(null);
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message || "Something went wrong. Please try again."}` }]);
    } finally {
      setIsLoading(false);
      setThinkingAgent(null);
    }
  };

  const isBusy = isLoading || isGeneratingMeme;
  const hasAttachments = imagePreviews.length > 0 || pdfFiles.length > 0;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-x-hidden overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-reveal px-2">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 glow-primary">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">
              {language === "hi" ? "नमस्ते! मैं AI Studio हूँ" : language === "kn" ? "ನಮಸ್ಕಾರ! ನಾನು AI Studio" : "Hello! I'm AI Studio"}
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mb-4">
              {language === "hi"
                ? "मुझसे कुछ भी पूछें, तस्वीरें भेजें, PDF अपलोड करें, या YouTube लिंक पेस्ट करें!"
                : language === "kn"
                ? "ನನ್ನನ್ನು ಏನಾದರೂ ಕೇಳಿ, ಫೋಟೋ ಕಳುಹಿಸಿ, PDF ಅಪ್‌ಲೋಡ್ ಮಾಡಿ, ಅಥವಾ YouTube ಲಿಂಕ್ ಪೇಸ್ಟ್ ಮಾಡಿ!"
                : "Ask anything, upload images/PDFs, or paste a YouTube link!"}
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {[
                { label: language === "hi" ? "🧠 ब्रेन" : language === "kn" ? "🧠 ಬ್ರೈನ್" : "🧠 Brain" },
                { label: language === "hi" ? "👁️ विज़न" : language === "kn" ? "👁️ ವಿಷನ್" : "👁️ Vision" },
                { label: language === "hi" ? "📄 PDF" : language === "kn" ? "📄 PDF" : "📄 PDF" },
                { label: language === "hi" ? "📺 YouTube" : language === "kn" ? "📺 YouTube" : "📺 YouTube" },
                ...(enableMemeGeneration ? [{ label: language === "hi" ? "🎨 मीम" : language === "kn" ? "🎨 ಮೀಮ್" : "🎨 Meme" }] : []),
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
              <div className={`max-w-[calc(100%-2.75rem)] sm:max-w-[85%] md:max-w-[75%] rounded-2xl text-sm leading-relaxed overflow-hidden ${
                msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "glass-card rounded-bl-md"
              }`}>
                {images.length > 0 && (
                  <div className="p-2 pb-0 flex flex-wrap gap-1">
                    {images.map((src, j) => (
                      <img key={j} src={src} alt="Uploaded" className="rounded-lg max-h-32 w-auto object-contain" />
                    ))}
                  </div>
                )}
                {msg.pdfNames && msg.pdfNames.length > 0 && (
                  <div className="p-2 pb-0 flex flex-wrap gap-1">
                    {msg.pdfNames.map((name, j) => (
                      <span key={j} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary/20">
                        <FileText className="w-3 h-3" /> {name}
                      </span>
                    ))}
                  </div>
                )}
                {msg.generatedImage && (
                  <div className="p-2 pb-0">
                    <img src={msg.generatedImage} alt="Generated meme" className="max-w-full rounded-lg max-h-80 w-auto object-contain" />
                  </div>
                )}
                <div className="px-4 py-3 break-words">
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 break-words">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  ) : text}
                </div>
                {msg.role === "assistant" && text && (
                  <button
                    onClick={() => speakText(i, text)}
                    className="px-4 pb-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    {speaking === i ? <VolumeX className="w-3.5 h-3.5 inline mr-1" /> : <Volume2 className="w-3.5 h-3.5 inline mr-1" />}
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

        {thinkingAgent && (
          <div className="flex gap-3 animate-reveal">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="glass-card px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-3 max-w-[calc(100%-2.75rem)]">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs text-muted-foreground font-medium break-words">
                {agentLabels[thinkingAgent]?.[language] || agentLabels[thinkingAgent]?.en}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Attachment previews */}
      {hasAttachments && (
        <div className="px-3 md:px-4 pt-2 overflow-x-auto">
          <div className="flex gap-2 flex-wrap">
            {imagePreviews.map((src, i) => (
              <div key={`img-${i}`} className="relative">
                <img src={src} alt="Preview" className="h-16 w-16 rounded-lg object-cover border border-border/40" />
                <button onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {pdfFiles.map((file, i) => (
              <div key={`pdf-${i}`} className="relative flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50 border border-border/40 text-xs max-w-[120px]">
                <FileText className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span className="truncate">{file.name}</span>
                <button onClick={() => removePdf(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {imagePreviews.length > 0 && `📷 ${imagePreviews.length}/20 images`}
            {imagePreviews.length > 0 && pdfFiles.length > 0 && " · "}
            {pdfFiles.length > 0 && `📄 ${pdfFiles.length}/15 PDFs`}
          </p>
        </div>
      )}

      <div className="sticky bottom-0 border-t border-border/30 bg-background/80 p-2 md:p-4 backdrop-blur safe-bottom">
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex w-full items-center gap-1 md:gap-2">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
          <input ref={pdfRef} type="file" accept=".pdf" multiple className="hidden" onChange={handlePdfSelect} />
          
          <button type="button" onClick={() => fileRef.current?.click()} disabled={isBusy || imagePreviews.length >= 20}
            className="shrink-0 p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all active:scale-95"
            title={language === "hi" ? "छवि अपलोड (20 तक)" : language === "kn" ? "ಚಿತ್ರ ಅಪ್‌ಲೋಡ್ (20 ವರೆಗೆ)" : "Upload images (up to 20)"}>
            <Paperclip className="w-4 h-4" />
          </button>
          
          <button type="button" onClick={() => pdfRef.current?.click()} disabled={isBusy || pdfFiles.length >= 15}
            className="shrink-0 p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all active:scale-95"
            title={language === "hi" ? "PDF अपलोड (15 तक)" : language === "kn" ? "PDF ಅಪ್‌ಲೋಡ್ (15 ವರೆಗೆ)" : "Upload PDFs (up to 15)"}>
            <FileText className="w-4 h-4" />
          </button>

          <button type="button" onClick={toggleVoice} disabled={isBusy}
            className={`shrink-0 p-2 rounded-lg transition-all active:scale-95 ${isListening ? "bg-destructive/20 text-destructive animate-pulse" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"} disabled:opacity-40`}
            title={language === "hi" ? "बोलकर टाइप करें" : language === "kn" ? "ಮಾತನಾಡಿ ಟೈಪ್ ಮಾಡಿ" : "Voice input"}>
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? (language === "hi" ? "सुन रहा हूँ..." : language === "kn" ? "ಕೇಳುತ್ತಿದ್ದೇನೆ..." : "Listening...") : hasAttachments ? (language === "hi" ? "फाइलों के बारे में पूछें..." : language === "kn" ? "ಫೈಲ್‌ಗಳ ಬಗ್ಗೆ ಕೇಳಿ..." : "Ask about these files...") : placeholders[language]}
            className="glass-input flex-1 min-w-0 rounded-xl px-3 py-2.5 text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow md:py-3 md:text-sm"
            disabled={isBusy}
            enterKeyHint="send"
          />

          <button type="submit" disabled={isBusy || (!input.trim() && !hasAttachments)}
            className="shrink-0 rounded-xl bg-primary p-2.5 text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 active:scale-95 md:p-3">
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : enableMemeGeneration ? <ImagePlus className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

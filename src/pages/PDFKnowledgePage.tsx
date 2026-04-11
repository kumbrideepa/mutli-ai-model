import { useState, useRef, useEffect, useCallback } from "react";
import { FileText, Send, Loader2, Bot, User, Upload, X, Volume2, VolumeX, Trash2, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

type Msg = { role: "user" | "assistant"; content: string };

const t = {
  title: { en: "PDF Knowledge Base", hi: "PDF ज्ञान आधार", kn: "PDF ಜ್ಞಾನ ಬೇಸ್" },
  desc: { en: "Upload PDFs & ask questions across all documents", hi: "PDF अपलोड करें और सभी दस्तावेज़ों में खोजें", kn: "PDF ಅಪ್‌ಲೋಡ್ ಮಾಡಿ ಮತ್ತು ಎಲ್ಲಾ ಡಾಕ್ಯುಮೆಂಟ್‌ಗಳಲ್ಲಿ ಹುಡುಕಿ" },
  dropzone: { en: "Drop PDFs here or click to upload", hi: "PDF यहाँ डालें या अपलोड करें", kn: "PDF ಇಲ್ಲಿ ಡ್ರಾಪ್ ಮಾಡಿ ಅಥವಾ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ" },
  limit: { en: "Up to 15 PDFs, 20MB each", hi: "15 PDF तक, 20MB प्रत्येक", kn: "15 PDF ವರೆಗೆ, ಪ್ರತಿ 20MB" },
  process: { en: "Process & Start Chatting", hi: "प्रोसेस करें और चैट करें", kn: "ಪ್ರಕ್ರಿಯೆ ಮಾಡಿ ಮತ್ತು ಚಾಟ್ ಮಾಡಿ" },
  processing: { en: "Processing PDFs...", hi: "PDF प्रोसेस हो रहे हैं...", kn: "PDF ಪ್ರಕ್ರಿಯೆ ಆಗುತ್ತಿದೆ..." },
  ask: { en: "Ask about your documents...", hi: "अपने दस्तावेज़ों के बारे में पूछें...", kn: "ನಿಮ್ಮ ಡಾಕ್ಯುಮೆಂಟ್‌ಗಳ ಬಗ್ಗೆ ಕೇಳಿ..." },
  newSession: { en: "New Session", hi: "नया सत्र", kn: "ಹೊಸ ಸೆಶನ್" },
  filesLoaded: { en: "documents loaded", hi: "दस्तावेज़ लोड हो गए", kn: "ಡಾಕ್ಯುಮೆಂಟ್‌ಗಳು ಲೋಡ್ ಆಗಿವೆ" },
};

async function pdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];
  const maxPages = Math.min(pdf.numPages, 5); // 5 pages per PDF to fit 15 PDFs
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.7));
    canvas.remove();
  }
  return images;
}

interface Props {
  language: "en" | "hi" | "kn";
}

export default function PDFKnowledgePage({ language }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImages, setProcessedImages] = useState<Array<{ type: "image_url"; image_url: { url: string } }>>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processProgress, setProcessProgress] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []).filter(f => f.type === "application/pdf" && f.size <= 20 * 1024 * 1024);
    const remaining = 15 - files.length;
    setFiles(prev => [...prev, ...newFiles.slice(0, remaining)]);
    e.target.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf" && f.size <= 20 * 1024 * 1024);
    const remaining = 15 - files.length;
    setFiles(prev => [...prev, ...newFiles.slice(0, remaining)]);
  }, [files.length]);

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const processFiles = async () => {
    if (!files.length) return;
    setIsProcessing(true);
    const allImages: Array<{ type: "image_url"; image_url: { url: string } }> = [];
    const names: string[] = [];

    for (let f = 0; f < files.length; f++) {
      setProcessProgress(`${f + 1}/${files.length}: ${files[f].name}`);
      try {
        const imgs = await pdfToImages(files[f]);
        for (const img of imgs) {
          allImages.push({ type: "image_url", image_url: { url: img } });
        }
        names.push(files[f].name);
      } catch (e: any) {
        console.error(`Failed to process ${files[f].name}:`, e);
      }
    }

    setProcessedImages(allImages);
    setFileNames(names);
    setIsProcessing(false);
    setProcessProgress("");

    // Auto-generate initial summary
    setIsLoading(true);
    const summaryQuestion = language === "hi"
      ? "इन सभी दस्तावेज़ों का संक्षिप्त सारांश दें। प्रत्येक PDF का नाम और मुख्य विषय बताएं।"
      : language === "kn"
      ? "ಈ ಎಲ್ಲಾ ಡಾಕ್ಯುಮೆಂಟ್‌ಗಳ ಸಂಕ್ಷಿಪ್ತ ಸಾರಾಂಶ ನೀಡಿ. ಪ್ರತಿ PDF ಹೆಸರು ಮತ್ತು ಮುಖ್ಯ ವಿಷಯವನ್ನು ತಿಳಿಸಿ."
      : "Give a brief overview of all these documents. List each PDF name and its main topic.";

    const userMsg: Msg = { role: "user", content: summaryQuestion };
    setMessages([userMsg]);

    let assistantText = "";
    try {
      const parts = [
        ...allImages,
        { type: "text" as const, text: `These are pages from ${names.length} PDF files: ${names.join(", ")}. ${summaryQuestion}` },
      ];
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [{ role: "user", content: parts }],
          language,
        }),
      });
      if (!resp.ok || !resp.body) throw new Error(`Error ${resp.status}`);
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

  const askQuestion = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput("");
    setIsLoading(true);

    let assistantText = "";
    try {
      // Build messages: first message includes images, follow-ups are text only
      const apiMessages: any[] = [];
      
      // First message always includes the PDF images for context
      apiMessages.push({
        role: "user",
        content: [
          ...processedImages,
          { type: "text", text: `These are pages from PDF files: ${fileNames.join(", ")}. Use these documents to answer questions.` },
        ],
      });

      // Add conversation history as text-only
      for (const m of allMsgs) {
        apiMessages.push({ role: m.role, content: m.content });
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: apiMessages, language }),
      });
      if (!resp.ok || !resp.body) throw new Error(`Error ${resp.status}`);
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

  const resetSession = () => {
    setFiles([]);
    setProcessedImages([]);
    setFileNames([]);
    setMessages([]);
  };

  // Upload screen
  if (!processedImages.length) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-border/30 px-3 py-3 pl-14 md:px-6 md:py-4 md:pl-6">
          <h1 className="font-display text-lg font-semibold flex items-center gap-2 md:text-xl">
            <FileText className="w-5 h-5 text-primary" /> {t.title[language]}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 md:text-sm">{t.desc[language]}</p>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center p-4 gap-4">
          <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleFileSelect} />

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border/50 hover:border-primary/50 hover:bg-muted/20"
            }`}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            <p className="font-medium text-sm">{t.dropzone[language]}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.limit[language]}</p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="w-full max-w-lg space-y-2">
              <p className="text-xs text-muted-foreground font-medium">📄 {files.length}/15 PDFs</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                    <button onClick={() => removeFile(i)} className="shrink-0 p-0.5 hover:text-destructive transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={processFiles}
                disabled={isProcessing}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98]"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {processProgress || t.processing[language]}
                  </span>
                ) : (
                  <>
                    <Search className="w-4 h-4 inline mr-2" />
                    {t.process[language]}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border/30 px-3 py-3 pl-14 md:px-6 md:py-4 md:pl-6">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-semibold flex items-center gap-2 md:text-xl">
            <FileText className="w-5 h-5 text-primary shrink-0" /> {t.title[language]}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fileNames.length} {t.filesLoaded[language]}: {fileNames.join(", ")}
          </p>
        </div>
        <button onClick={resetSession} className="shrink-0 rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> {t.newSession[language]}
        </button>
      </header>

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
                {language === "hi" ? "📄 दस्तावेज़ खोज रहा है..." : language === "kn" ? "📄 ಡಾಕ್ಯುಮೆಂಟ್ ಹುಡುಕುತ್ತಿದೆ..." : "📄 Searching documents..."}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="sticky bottom-0 border-t border-border/30 bg-background/80 p-2 md:p-4 backdrop-blur safe-bottom">
        <form onSubmit={(e) => { e.preventDefault(); askQuestion(); }} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.ask[language]}
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

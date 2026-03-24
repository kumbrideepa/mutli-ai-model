import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Send, Bot, User, Loader2, Users, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";

interface GroupChatPageProps {
  language: "en" | "hi" | "kn";
  userId: string;
}

type Room = { id: string; name: string; ai_enabled: boolean; created_by: string };
type Message = { id: string; room_id: string; user_id: string | null; content: string; is_ai: boolean; created_at: string };
type Profile = { id: string; username: string };

const t = {
  title: { en: "Group Chat", hi: "ग्रुप चैट", kn: "ಗ್ರೂಪ್ ಚಾಟ್" },
  createRoom: { en: "New Room", hi: "नया रूम", kn: "ಹೊಸ ಕೋಣೆ" },
  roomName: { en: "Room name...", hi: "रूम का नाम...", kn: "ಕೋಣೆಯ ಹೆಸರು..." },
  typeMsg: { en: "Type a message...", hi: "संदेश लिखें...", kn: "ಸಂದೇಶ ಬರೆಯಿರಿ..." },
  noRooms: { en: "No rooms yet. Create one!", hi: "कोई रूम नहीं। एक बनाएं!", kn: "ಯಾವುದೇ ಕೋಣೆ ಇಲ್ಲ. ಒಂದನ್ನು ರಚಿಸಿ!" },
  aiHint: { en: "Type @ai to ask the AI", hi: "@ai टाइप करें AI से पूछने के लिए", kn: "@ai ಟೈಪ್ ಮಾಡಿ AI ಕೇಳಲು" },
  roomCode: { en: "Room Code", hi: "रूम कोड", kn: "ಕೋಣೆ ಕೋಡ್" },
  joinRoom: { en: "Join Room", hi: "रूम जॉइन करें", kn: "ಕೋಣೆ ಸೇರಿ" },
  joinCode: { en: "Paste room code...", hi: "रूम कोड पेस्ट करें...", kn: "ಕೋಣೆ ಕೋಡ್ ಪೇಸ್ಟ್ ಮಾಡಿ..." },
};

export default function GroupChatPage({ language, userId }: GroupChatPageProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [input, setInput] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch rooms
  const fetchRooms = useCallback(async () => {
    const { data } = await supabase
      .from("chat_rooms")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setRooms(data);
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // Fetch messages for selected room
  useEffect(() => {
    if (!selectedRoom) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", selectedRoom.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) {
        setMessages(data);
        // Fetch profiles for message authors
        const userIds = [...new Set(data.filter(m => m.user_id).map(m => m.user_id!))];
        if (userIds.length) {
          const { data: profs } = await supabase.from("profiles").select("id, username").in("id", userIds);
          if (profs) {
            const map: Record<string, Profile> = {};
            profs.forEach(p => map[p.id] = p);
            setProfiles(prev => ({ ...prev, ...map }));
          }
        }
      }
    };
    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`room-${selectedRoom.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${selectedRoom.id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedRoom]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    const { data, error } = await supabase.from("chat_rooms").insert({ name: newRoomName.trim(), created_by: userId }).select().single();
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    // Add self as member
    await supabase.from("room_members").insert({ room_id: data.id, user_id: userId });
    setNewRoomName("");
    setShowCreate(false);
    fetchRooms();
    setSelectedRoom(data);
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) return;
    const roomId = joinCode.trim();
    const { error } = await supabase.from("room_members").insert({ room_id: roomId, user_id: userId });
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    setJoinCode("");
    fetchRooms();
    toast({ title: language === "hi" ? "रूम जॉइन किया!" : language === "kn" ? "ಕೋಣೆ ಸೇರಿದ್ದೀರಿ!" : "Joined room!" });
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedRoom || loading) return;
    const content = input.trim();
    setInput("");
    
    await supabase.from("chat_messages").insert({ room_id: selectedRoom.id, user_id: userId, content, is_ai: false });

    // If message mentions @ai, get AI response
    if (content.toLowerCase().includes("@ai") && selectedRoom.ai_enabled) {
      setLoading(true);
      try {
        const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({
            messages: [{ role: "user", content: content.replace(/@ai/gi, "").trim() }],
            language,
          }),
        });
        if (!resp.ok || !resp.body) throw new Error("AI error");

        let aiText = "";
        const reader = resp.body.getReader();
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
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") { done = true; break; }
            try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) aiText += c; } catch {}
          }
        }
        if (aiText) {
          await supabase.from("chat_messages").insert({ room_id: selectedRoom.id, user_id: userId, content: aiText, is_ai: true });
        }
      } catch {
        toast({ title: "AI response failed", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const speakText = (msgId: string, text: string) => {
    if (speaking === msgId) {
      speechSynthesis.cancel();
      setSpeaking(null);
      return;
    }
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = language === "hi" ? "hi-IN" : language === "kn" ? "kn-IN" : "en-US";
    utter.onend = () => setSpeaking(null);
    speechSynthesis.speak(utter);
    setSpeaking(msgId);
  };

  // Room list view
  if (!selectedRoom) {
    return (
      <div className="h-full flex flex-col">
        <header className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> {t.title[language]}
            </h1>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {showCreate && (
            <div className="glass-card p-4 rounded-xl space-y-3 animate-reveal">
              <input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder={t.roomName[language]}
                className="w-full glass-input px-4 py-2.5 text-sm rounded-lg text-foreground placeholder:text-muted-foreground" onKeyDown={e => e.key === "Enter" && createRoom()} />
              <button onClick={createRoom} className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">{t.createRoom[language]}</button>
              <div className="flex gap-2">
                <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder={t.joinCode[language]}
                  className="flex-1 glass-input px-4 py-2.5 text-sm rounded-lg text-foreground placeholder:text-muted-foreground" />
                <button onClick={joinRoom} className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90">{t.joinRoom[language]}</button>
              </div>
            </div>
          )}

          {rooms.length === 0 && !showCreate && (
            <p className="text-center text-muted-foreground text-sm mt-12">{t.noRooms[language]}</p>
          )}

          {rooms.map(room => (
            <button key={room.id} onClick={() => setSelectedRoom(room)}
              className="w-full glass-card p-4 rounded-xl text-left hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{room.name}</span>
                {room.ai_enabled && <Bot className="w-4 h-4 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t.roomCode[language]}: {room.id.slice(0, 8)}...</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div className="h-full flex flex-col">
      <header className="px-4 py-3 border-b border-border/30 flex items-center gap-3">
        <button onClick={() => setSelectedRoom(null)} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h2 className="font-display font-semibold text-foreground">{selectedRoom.name}</h2>
          <p className="text-xs text-muted-foreground">{t.aiHint[language]}</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.user_id === userId && !msg.is_ai ? "justify-end" : "justify-start"}`}>
            {(msg.is_ai || msg.user_id !== userId) && (
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1 ${msg.is_ai ? "bg-primary/15" : "bg-secondary"}`}>
                {msg.is_ai ? <Bot className="w-3.5 h-3.5 text-primary" /> : <User className="w-3.5 h-3.5 text-foreground" />}
              </div>
            )}
            <div className={`max-w-[75%] rounded-2xl text-sm ${
              msg.user_id === userId && !msg.is_ai ? "bg-primary text-primary-foreground rounded-br-md" : "glass-card rounded-bl-md"
            }`}>
              {msg.user_id !== userId && !msg.is_ai && (
                <p className="px-3 pt-2 text-xs font-medium text-accent">{profiles[msg.user_id!]?.username || "User"}</p>
              )}
              {msg.is_ai && <p className="px-3 pt-2 text-xs font-medium text-primary">🤖 AI</p>}
              <div className="px-3 py-2">
                {msg.is_ai ? (
                  <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              {msg.is_ai && (
                <button onClick={() => speakText(msg.id, msg.content)} className="px-3 pb-2 text-xs text-muted-foreground hover:text-primary transition-colors">
                  {speaking === msg.id ? <VolumeX className="w-3.5 h-3.5 inline" /> : <Volume2 className="w-3.5 h-3.5 inline" />}
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-primary" /></div>
            <div className="glass-card px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border/30">
        <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder={t.typeMsg[language]} disabled={loading}
            className="flex-1 glass-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <button type="submit" disabled={loading || !input.trim()} className="p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

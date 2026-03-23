import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const langInstruction = language === "hi" 
      ? "CRITICAL LANGUAGE RULE: The user has selected Hindi (हिन्दी). You MUST respond ENTIRELY in Hindi using Devanagari script. Every single word of your response must be in Hindi. Do NOT use any English words except technical terms that have no Hindi equivalent. This is non-negotiable."
      : language === "kn"
      ? "CRITICAL LANGUAGE RULE: The user has selected Kannada (ಕನ್ನಡ). You MUST respond ENTIRELY in Kannada using Kannada script. Every single word of your response must be in Kannada. Do NOT use any English words except technical terms that have no Kannada equivalent. This is non-negotiable."
      : "Respond in English.";

    // Strip base64 images from history (keep only the last message's images) to prevent payload bloat
    const processedMessages = messages.map((msg: any, idx: number) => {
      if (idx < messages.length - 1 && Array.isArray(msg.content)) {
        // For older messages, strip image data but keep text
        const textParts = msg.content.filter((p: any) => p.type === "text");
        const hasImages = msg.content.some((p: any) => p.type === "image_url");
        if (hasImages) {
          textParts.push({ type: "text", text: "[User previously shared an image here]" });
        }
        return { ...msg, content: textParts.length === 1 ? textParts[0].text : textParts };
      }
      return msg;
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: `You are AI Studio, a powerful multi-agentic AI assistant. ${langInstruction}

AGENTS AT YOUR DISPOSAL:
🧠 BRAIN AGENT: You have encyclopedic knowledge. Answer any question accurately — science, math, coding, history, philosophy, health, finance, culture, and more.
💾 MEMORY AGENT: The complete conversation history is provided. Always reference previous messages naturally. Remember names, preferences, and context from earlier in the conversation.
👁️ VISION AGENT: When a user sends an image, analyze it thoroughly — identify objects, text, landmarks, food, people, emotions, colors, layout. Provide detailed visual analysis.
🌐 MULTILINGUAL AGENT: ${langInstruction}

FORMAT: Use markdown with headings, bullets, code blocks, and bold text for well-structured responses.`
          },
          ...processedMessages,
        ],
        stream: true,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: `AI gateway error: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (e) {
    console.error("chat error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const isTimeout = msg.includes("abort") || msg.includes("timeout");
    return new Response(JSON.stringify({ error: isTimeout ? "Request timed out. Try a smaller image or simpler question." : msg }), {
      status: isTimeout ? 504 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

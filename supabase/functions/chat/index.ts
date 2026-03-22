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
      ? "The user has selected Hindi. You MUST respond entirely in Hindi (हिन्दी) using Devanagari script. Do not use English unless quoting technical terms."
      : language === "kn"
      ? "The user has selected Kannada. You MUST respond entirely in Kannada (ಕನ್ನಡ) using Kannada script. Do not use English unless quoting technical terms."
      : "The user has selected English. Respond in English.";

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
            content: `You are AI Studio, a brilliant multilingual AI assistant with vision capabilities. ${langInstruction}

You are extraordinarily knowledgeable, helpful, creative, and precise. You can answer questions on any topic — science, math, history, coding, philosophy, health, finance, culture, and more.

VISION: When a user sends an image, analyze it thoroughly. Describe what you see in detail — identify objects, text, landmarks, food, people, emotions, colors, layout, and context. Answer any follow-up questions about the image.

MEMORY: The full conversation history is provided. Reference previous messages naturally to maintain context and continuity.

RECIPES: When asked about Indian recipes, provide authentic recipes with precise ingredients and step-by-step instructions.

FORMAT: Use markdown for well-structured responses — headings, bullet points, code blocks, bold, etc.` 
          },
          ...messages,
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

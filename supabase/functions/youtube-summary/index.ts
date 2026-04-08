import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchVideoInfo(videoId: string) {
  // Fetch the YouTube page to get title and description
  const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  const html = await resp.text();

  let title = "Unknown Video";
  let description = "";
  let channelName = "";

  // Extract title
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  if (titleMatch) title = titleMatch[1].replace(" - YouTube", "").trim();

  // Extract description from meta
  const descMatch = html.match(/<meta name="description" content="(.*?)"/);
  if (descMatch) description = descMatch[1];

  // Extract channel
  const channelMatch = html.match(/"ownerChannelName":"(.*?)"/);
  if (channelMatch) channelName = channelMatch[1];

  // Try to get captions/transcript
  let transcript = "";
  try {
    const captionMatch = html.match(/"captionTracks":\[(.*?)\]/);
    if (captionMatch) {
      const captionData = JSON.parse(`[${captionMatch[1]}]`);
      const enCaptions = captionData.find((c: any) => c.languageCode === "en") || captionData[0];
      if (enCaptions?.baseUrl) {
        const capResp = await fetch(enCaptions.baseUrl);
        const capXml = await capResp.text();
        // Extract text from XML captions
        const textMatches = capXml.matchAll(/<text[^>]*>(.*?)<\/text>/g);
        const parts: string[] = [];
        for (const m of textMatches) {
          parts.push(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'));
        }
        transcript = parts.join(" ").slice(0, 8000); // Limit transcript size
      }
    }
  } catch (e) {
    console.log("Could not fetch captions:", e);
  }

  return { title, description, channelName, transcript, videoId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url, language } = await req.json();
    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(JSON.stringify({ error: "Invalid YouTube URL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const info = await fetchVideoInfo(videoId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const langInstruction = language === "hi"
      ? "Respond ENTIRELY in Hindi using Devanagari script."
      : language === "kn"
      ? "Respond ENTIRELY in Kannada using Kannada script."
      : "Respond in English.";

    const prompt = info.transcript
      ? `Summarize this YouTube video based on its transcript.\n\nTitle: ${info.title}\nChannel: ${info.channelName}\n\nTranscript:\n${info.transcript}`
      : `Summarize this YouTube video based on the available info.\n\nTitle: ${info.title}\nChannel: ${info.channelName}\nDescription: ${info.description}\n\nNote: No transcript was available, so provide what you can based on the title and description.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: `You summarize YouTube videos in a simple, easy-to-understand way. ${langInstruction}\n\nFormat your response like:\n📺 **Video Title**\n👤 **Channel**\n\n📝 **Summary:**\n(Clear, bullet-point summary)\n\n🔑 **Key Points:**\n(Main takeaways)` },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: `AI error: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("youtube-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

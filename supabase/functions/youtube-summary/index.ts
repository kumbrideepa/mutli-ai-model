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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

async function fetchVideoInfo(videoId: string) {
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let title = "Unknown Video";
  let channelName = "";

  try {
    const oembedResp = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`);
    if (oembedResp.ok) {
      const oembed = await oembedResp.json();
      title = oembed.title || title;
      channelName = oembed.author_name || channelName;
    }
  } catch (e) {
    console.log("Could not fetch oEmbed metadata:", e);
  }

  const resp = await fetch(canonicalUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  const html = await resp.text();

  let description = "";

  if (title === "Unknown Video") {
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    if (titleMatch) title = decodeHtmlEntities(titleMatch[1].replace(" - YouTube", "").trim());
  }

  const shortDescMatch = html.match(/"shortDescription":"(.*?)"/);
  if (shortDescMatch) {
    description = decodeHtmlEntities(shortDescMatch[1].replace(/\\n/g, " ").replace(/\\"/g, '"'));
  } else {
    const descMatch = html.match(/<meta name="description" content="(.*?)"/);
    if (descMatch) description = decodeHtmlEntities(descMatch[1]);
  }

  if (!channelName) {
    const channelMatch = html.match(/"ownerChannelName":"(.*?)"/);
    if (channelMatch) channelName = decodeHtmlEntities(channelMatch[1]);
  }

  let transcript = "";
  try {
    const captionMatch = html.match(/"captionTracks":(\[.*?\])/s);
    if (captionMatch) {
      const captionData = JSON.parse(captionMatch[1].replace(/\\u0026/g, "&"));
      const enCaptions = captionData.find((c: any) => c.languageCode === "en") || captionData[0];
      if (enCaptions?.baseUrl) {
        const capResp = await fetch(enCaptions.baseUrl);
        const capXml = await capResp.text();
        const textMatches = capXml.matchAll(/<text[^>]*>(.*?)<\/text>/g);
        const parts: string[] = [];
        for (const m of textMatches) {
          parts.push(decodeHtmlEntities(m[1]));
        }
        transcript = parts.join(" ").slice(0, 8000);
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
    const { url, language, question } = await req.json();
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

    const questionInstruction = typeof question === "string" && question.trim()
      ? `\n\nThe user also asked this in the first message: ${question.trim()}\nAfter the summary, add a separate **Answer to your question** section that directly answers it based on the video information. If the transcript is unavailable, clearly say your answer is based on the title/description only.`
      : "";

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
          { role: "system", content: `You summarize YouTube videos in a simple, easy-to-understand way. ${langInstruction}\n\nOnly use the provided video information. If any details are missing, say that clearly instead of guessing.\n\nFormat your response like:\n📺 **Video Title**\n👤 **Channel**\n\n📝 **Summary:**\n(Clear, bullet-point summary)${typeof question === "string" && question.trim() ? "\n\n❓ **Answer to your question:**\n(Direct answer)" : ""}\n\n🔑 **Key Points:**\n(Main takeaways)` },
          { role: "user", content: `${prompt}${questionInstruction}` },
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

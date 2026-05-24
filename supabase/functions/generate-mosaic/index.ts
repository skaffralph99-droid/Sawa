import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const { planId } = await req.json();
    if (!planId) {
      return new Response(JSON.stringify({ error: "planId required" }), { status: 400 });
    }

    // Get all submitted photos for this plan
    const { data: members, error } = await supabase
      .from("plan_members")
      .select("user_id, photo_url, profiles!plan_members_user_id_fkey(name)")
      .eq("plan_id", planId)
      .not("photo_url", "is", null);

    if (error || !members || members.length === 0) {
      return new Response(JSON.stringify({ error: "No photos submitted" }), { status: 400 });
    }

    // Download all photos as base64
    const photoData: { name: string; base64: string }[] = [];

    for (const member of members) {
      if (!member.photo_url) continue;
      try {
        const response = await fetch(member.photo_url);
        const buffer = await response.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const name = (member as any).profiles?.name ?? "?";
        photoData.push({ name, base64 });
      } catch {
        continue;
      }
    }

    if (photoData.length === 0) {
      return new Response(JSON.stringify({ error: "Could not download photos" }), { status: 500 });
    }

    // Build mosaic HTML using canvas-like approach
    // We create an SVG mosaic that combines all photos in a grid
    const count = photoData.length;
    const cols = count <= 2 ? count : count <= 4 ? 2 : count <= 6 ? 3 : count <= 9 ? 3 : 4;
    const rows = Math.ceil(count / cols);
    const cellW = 400;
    const cellH = 400;
    const nameH = 40;
    const totalW = cols * cellW;
    const totalH = rows * (cellH + nameH);

    let svgImages = "";
    photoData.forEach((photo, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellW;
      const y = row * (cellH + nameH);
      svgImages += `
        <image href="data:image/jpeg;base64,${photo.base64}" 
               x="${x}" y="${y}" 
               width="${cellW}" height="${cellH}" 
               preserveAspectRatio="xMidYMid slice"/>
        <rect x="${x}" y="${y + cellH - nameH}" 
              width="${cellW}" height="${nameH}" 
              fill="rgba(0,0,0,0.6)"/>
        <text x="${x + cellW / 2}" y="${y + cellH - nameH / 2 + 6}" 
              text-anchor="middle" 
              font-family="Arial, sans-serif" 
              font-size="18" 
              font-weight="bold"
              fill="white">${photo.name}</text>
      `;
    });

    // Add Sawa watermark
    svgImages += `
      <text x="${totalW - 12}" y="${totalH - 12}" 
            text-anchor="end"
            font-family="Arial, sans-serif"
            font-size="14"
            fill="rgba(255,255,255,0.6)">Sawa ◈</text>
    `;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${totalW}" height="${totalH}"
     viewBox="0 0 ${totalW} ${totalH}">
  <rect width="${totalW}" height="${totalH}" fill="#0D0B1E"/>
  ${svgImages}
</svg>`;

    const svgBytes = new TextEncoder().encode(svg);

    // Upload mosaic to Supabase Storage
    const fileName = `mosaics/${planId}/mosaic_${Date.now()}.svg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("photos")
      .upload(fileName, svgBytes, {
        contentType: "image/svg+xml",
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("photos").getPublicUrl(uploadData.path);
    const mosaicUrl = urlData.publicUrl;

    // Update plan with mosaic URL and public_at (24 hours from now)
    const mosaicPublicAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("plans")
      .update({
        mosaic_url: mosaicUrl,
        mosaic_public_at: mosaicPublicAt,
      })
      .eq("id", planId);

    // Notify all members mosaic is ready
    const { data: members2 } = await supabase
      .from("plan_members")
      .select("user_id")
      .eq("plan_id", planId);

    if (members2 && members2.length > 0) {
      const userIds = members2.map((m: { user_id: string }) => m.user_id);
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token")
        .in("user_id", userIds);

      if (tokens && tokens.length > 0) {
        const messages = tokens.map((t: { token: string }) => ({
          to: t.token,
          title: "✨ Your mosaic is ready!",
          body: "See your shared moment now",
          data: { type: "mosaic_ready", planId },
          sound: "default",
        }));

        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messages),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, mosaicUrl }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

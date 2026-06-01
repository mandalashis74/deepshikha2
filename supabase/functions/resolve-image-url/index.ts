import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

serve(async (req) => {
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400 });

    // Google Drive: convert to direct download
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveMatch) {
      return new Response(JSON.stringify({ directUrl: `https://drive.google.com/uc?export=view&id=${driveMatch[1]}` }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Google Photos: fetch page and extract og:image
    const photosMatch = url.match(/photos\.app\.goo\.gl/i);
    if (photosMatch) {
      // Follow redirects to get the actual Google Photos page
      const resp = await fetch(url, { redirect: 'follow' });
      const html = await resp.text();
      
      // Extract og:image meta property
      const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (ogMatch) {
        return new Response(JSON.stringify({ directUrl: ogMatch[1] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Fallback: look for lh3.googleusercontent.com
      const lhMatch = html.match(/https?:\/\/lh3\.googleusercontent\.com\/[^"'\s]+/);
      if (lhMatch) {
        return new Response(JSON.stringify({ directUrl: lhMatch[0] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ error: 'Could not extract image from Google Photos page' }), { status: 422 });
    }

    // Assume it's already a direct URL
    return new Response(JSON.stringify({ directUrl: url }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

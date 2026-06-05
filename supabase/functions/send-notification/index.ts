import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import webpush from 'npm:web-push@3.6.7';

interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  flat_no: string;
  id: number;
}

serve(async (req) => {
  try {
    const { event_id, title, body, building_name, url } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: 'Missing title' }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get VAPID public key from building_config, private key from app_secrets
    const [bCfg, sec] = await Promise.all([
      supabase.from('building_config').select('vapid_public_key').eq('id', 1).single(),
      supabase.from('app_secrets').select('vapid_private_key').eq('id', 1).single()
    ]);

    if (!bCfg.data?.vapid_public_key || !sec.data?.vapid_private_key) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), { status: 400 });
    }

    webpush.setVapidDetails(
      `mailto:admin@${(building_name || 'residence').toLowerCase().replace(/\s/g, '')}.com`,
      bCfg.data.vapid_public_key,
      sec.data.vapid_private_key
    );

    // Get all subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscribers' }), { status: 200 });
    }

    const payload = JSON.stringify({
      title,
      body: body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      url: url || '/'
    });

    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    for (const sub of subscriptions as Subscription[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          payload
        );
        sent++;
      } catch (err: any) {
        failed++;
        // Subscription expired or invalid
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    }

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', staleEndpoints);
    }

    return new Response(
      JSON.stringify({ sent, failed, cleaned: staleEndpoints.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('send-notification error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

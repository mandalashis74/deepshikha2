import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Missing authorization header.")

    const { targetUserId, defaultPassword } = await req.json()
    if (!targetUserId || !defaultPassword) throw new Error("Missing target user ID or default password.")

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 1. Verify caller is an admin
    const { data: userData, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !userData?.user) throw new Error("Invalid session.")

    const callerId = userData.user.id

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .single()

    if (profileError || !profile) throw new Error("Could not verify caller role.")
    
    const role = profile.role
    if (role !== 'admin' && role !== 'admin1' && role !== 'super_admin') {
      throw new Error("Unauthorized. Only administrators can perform this action.")
    }

    // 2. Perform the password reset
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: defaultPassword,
      user_metadata: { force_password_change: true }
    })

    if (updateError) throw updateError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

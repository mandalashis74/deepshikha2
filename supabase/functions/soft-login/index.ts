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
    const { flatNo, verifyCode, mathAnswer, num1, num2 } = await req.json()
    if (!flatNo || !verifyCode) throw new Error("Missing flatNo or verifyCode")

    // Math CAPTCHA Validation
    if (typeof num1 !== 'number' || typeof num2 !== 'number' || typeof mathAnswer !== 'number') {
        throw new Error("Missing Math CAPTCHA payload.")
    }
    if (num1 + num2 !== mathAnswer) {
        throw new Error("Incorrect Math CAPTCHA answer.")
    }

    // Create a Supabase client using Service Role to bypass RLS for checking the code securely
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Verify code
    const { data, error } = await supabaseClient.from('owners')
        .select('contact_no, passcode')
        .eq('flat_no', flatNo)
        .single()

    if (error || !data) throw new Error("Flat not found in registry.")

    // Clean and compare contact number and passcode
    let isMatch = false;
    
    // Check contact_no
    if (data.contact_no) {
        // Just extract digits from contact string using regex
        const dbContact = String(data.contact_no).replace(/\D/g, '');
        const inputClean = String(verifyCode).replace(/\D/g, '');
        if (inputClean && dbContact && dbContact.includes(inputClean)) {
            isMatch = true;
        }
    }
    
    // Check passcode
    if (!isMatch && data.passcode) {
        const dbPasscode = String(data.passcode).trim();
        if (verifyCode && dbPasscode === String(verifyCode).trim()) {
            isMatch = true;
        }
    }

    if (!isMatch) {
        throw new Error("Verification code does not match. Please contact Administrator.")
    }

    // 2. Code is valid, log in to shared account to get a session
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Using the shared credentials on the secure backend
    const SHARED_EMAIL = 'shared_owner@deepsikha.in'
    const SHARED_PASS = 'Deep@2024' // Secured inside Edge Function

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
        email: SHARED_EMAIL,
        password: SHARED_PASS,
    })

    if (authError) throw authError

    // 3. Return the session to the client
    return new Response(
      JSON.stringify({ session: authData.session }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 so the frontend can read the actual error message
    })
  }
})

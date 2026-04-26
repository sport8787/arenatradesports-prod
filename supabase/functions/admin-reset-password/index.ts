// Admin: reseta senha de um usuário existente para uma senha temporária
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email e password obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // localiza usuário (admin API não tem filtro por email)
    const target = String(email).toLowerCase().trim();
    let found: any = null;
    for (let page = 1; page <= 20 && !found; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      found = data.users.find((u) => (u.email || "").toLowerCase() === target);
      if (data.users.length < 1000) break;
    }

    if (!found) {
      return new Response(
        JSON.stringify({ ok: false, error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(found.id, {
      password: String(password),
      email_confirm: true,
      user_metadata: {
        ...(found.user_metadata || {}),
        must_change_password: true,
      },
    });

    if (updErr) {
      return new Response(
        JSON.stringify({ ok: false, error: updErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: found.id,
        email: found.email,
        message: "Senha redefinida. Usuária deve trocar no primeiro login.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

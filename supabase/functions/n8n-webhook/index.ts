import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth via x-n8n-token header
    const token = req.headers.get("x-n8n-token");
    const expectedToken = Deno.env.get("N8N_WEBHOOK_TOKEN");

    if (!expectedToken || token !== expectedToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for internal writes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { type, payload } = await req.json();

    if (!type || !payload) {
      return new Response(
        JSON.stringify({ error: "Missing type or payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- live_match (auto-triggers Mycroft analysis) ----
    if (type === "live_match") {
      const { data, error } = await supabase
        .from("live_matches")
        .upsert(payload, { onConflict: "match_id" })
        .select("*")
        .single();

      if (error) throw error;

      const match = data;
      console.log(`[n8n-webhook] live_match upserted: ${match.home_team} vs ${match.away_team} (${match.minute}')`);

      // Auto-trigger Mycroft analysis if not already done
      if (!match.mycroft_analysis_id) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

          console.log(`[n8n-webhook] Auto-triggering Mycroft analysis for ${match.match_id}`);

          const analysisResponse = await fetch(
            `${supabaseUrl}/functions/v1/mycroft-sports-analysis`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                match: {
                  home: match.home_team,
                  away: match.away_team,
                  scoreHome: match.score_home ?? 0,
                  scoreAway: match.score_away ?? 0,
                  minute: match.minute ?? 0,
                  period: match.period ?? "First Half",
                  championship: match.championship ?? "Unknown",
                  match_id: match.match_id,
                  stats: match.stats ?? {},
                  bankroll: 10000,
                },
              }),
            }
          );

          if (analysisResponse.ok) {
            const analysis = await analysisResponse.json();
            console.log(`[n8n-webhook] Mycroft verdict: ${analysis.verdict} | Confidence: ${analysis.confidence}%`);

            // Save analysis
            const { data: analysisRow } = await supabase
              .from("mycroft_analyses")
              .insert({
                match_id: match.match_id,
                verdict: analysis.verdict || "AGUARDAR",
                market: analysis.market || "N/A",
                thesis: analysis.thesis || "",
                odd: analysis.odd ?? null,
                confidence: analysis.confidence ?? 0,
                risk_management: analysis.risk ?? null,
                alerts: analysis.alerts ?? [],
                fundamentation: { stats: analysis.stats ?? {} },
              })
              .select("id")
              .single();

            if (analysisRow) {
              await supabase
                .from("live_matches")
                .update({
                  mycroft_analysis_id: analysisRow.id,
                  mycroft_status: "done",
                  updated_at: new Date().toISOString(),
                })
                .eq("match_id", match.match_id);

              // Auto-create signal if APROVADO
              if (analysis.verdict === "APROVADO") {
                await supabase.from("signals_sent").insert({
                  match_id: match.match_id,
                  analysis_id: analysisRow.id,
                });
                console.log(`[n8n-webhook] Signal created for ${match.match_id}`);
              }

              return new Response(
                JSON.stringify({ ok: true, inserted_id: match.id, analysis_id: analysisRow.id, verdict: analysis.verdict }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else {
            const errText = await analysisResponse.text();
            console.error(`[n8n-webhook] Mycroft failed [${analysisResponse.status}]:`, errText);
            await supabase.from("live_matches").update({ mycroft_status: "failed" }).eq("match_id", match.match_id);
          }
        } catch (e) {
          console.error("[n8n-webhook] Auto-analysis error:", e);
          await supabase.from("live_matches").update({ mycroft_status: "failed" }).eq("match_id", match.match_id);
        }
      }

      return new Response(
        JSON.stringify({ ok: true, inserted_id: match.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- analyze_match: triggers Mycroft analysis automatically ----
    if (type === "analyze_match") {
      const {
        match_id,
        home_team,
        away_team,
        score_home,
        score_away,
        minute,
        period,
        championship,
        stats,
        bankroll,
      } = payload;

      if (!match_id || !home_team || !away_team) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: match_id, home_team, away_team" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[n8n-webhook] analyze_match: ${home_team} vs ${away_team} (${minute}')`);

      // Call mycroft-sports-analysis edge function
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

      const analysisResponse = await fetch(
        `${supabaseUrl}/functions/v1/mycroft-sports-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            match: {
              home: home_team,
              away: away_team,
              scoreHome: score_home ?? 0,
              scoreAway: score_away ?? 0,
              minute: minute ?? 0,
              period: period ?? "First Half",
              championship: championship ?? "Unknown",
              match_id,
              stats: stats ?? {},
              bankroll: bankroll ?? 500,
            },
          }),
        }
      );

      if (!analysisResponse.ok) {
        const errText = await analysisResponse.text();
        console.error(`[n8n-webhook] Mycroft analysis failed [${analysisResponse.status}]:`, errText);
        
        // Update match status to failed
        await supabase
          .from("live_matches")
          .update({ mycroft_status: "failed" })
          .eq("match_id", match_id);

        return new Response(
          JSON.stringify({ ok: false, error: `Mycroft analysis failed: ${analysisResponse.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const analysis = await analysisResponse.json();
      console.log(`[n8n-webhook] Mycroft verdict: ${analysis.verdict} | Confidence: ${analysis.confidence}%`);

      // Insert analysis into mycroft_analyses
      const { data: analysisRow, error: analysisError } = await supabase
        .from("mycroft_analyses")
        .insert({
          match_id,
          verdict: analysis.verdict || "AGUARDAR",
          market: analysis.market || "N/A",
          thesis: analysis.thesis || "",
          odd: analysis.odd ?? null,
          confidence: analysis.confidence ?? 0,
          risk_management: analysis.risk ?? null,
          alerts: analysis.alerts ?? [],
          fundamentation: {
            stats: analysis.stats ?? {},
          },
        })
        .select("id")
        .single();

      if (analysisError) {
        console.error("[n8n-webhook] Error inserting analysis:", analysisError);
        throw analysisError;
      }

      const analysisId = analysisRow?.id;

      // Update live_match with analysis reference
      await supabase
        .from("live_matches")
        .update({
          mycroft_analysis_id: analysisId,
          mycroft_status: "done",
          updated_at: new Date().toISOString(),
        })
        .eq("match_id", match_id);

      // Auto-create signal if verdict is APROVADO
      if (analysis.verdict === "APROVADO") {
        const { data: signalData } = await supabase
          .from("signals_sent")
          .insert({
            match_id,
            analysis_id: analysisId,
          })
          .select("id")
          .single();

        console.log(`[n8n-webhook] Signal created: ${signalData?.id}`);

        return new Response(
          JSON.stringify({
            ok: true,
            analysis_id: analysisId,
            signal_id: signalData?.id,
            verdict: analysis.verdict,
            confidence: analysis.confidence,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          analysis_id: analysisId,
          verdict: analysis.verdict,
          confidence: analysis.confidence,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- mycroft_analysis (manual insert) ----
    if (type === "mycroft_analysis") {
      const { data, error } = await supabase
        .from("mycroft_analyses")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ ok: true, inserted_id: data?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- signal_sent ----
    if (type === "signal_sent") {
      // Deduplication: check if same match_id + analysis_id exists in last 10 min
      if (payload.match_id && payload.analysis_id) {
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: existing } = await supabase
          .from("signals_sent")
          .select("id")
          .eq("match_id", payload.match_id)
          .eq("analysis_id", payload.analysis_id)
          .gte("created_at", tenMinAgo)
          .limit(1);

        if (existing && existing.length > 0) {
          return new Response(
            JSON.stringify({ ok: true, deduped: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const { data, error } = await supabase
        .from("signals_sent")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ ok: true, inserted_id: data?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown type: ${type}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("n8n-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

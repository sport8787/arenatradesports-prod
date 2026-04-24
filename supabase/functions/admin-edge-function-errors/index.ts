// Returns recent edge function errors/shutdowns for the admin status page.
// Uses Supabase Management API to query analytics (function_edge_logs) for non-2xx responses.
import { corsHeaders } from "@supabase/supabase-js/cors";

const PROJECT_REF = Deno.env.get("SUPABASE_PROJECT_ID") || "affquongjlhmusxzohjl";
const MGMT_TOKEN = Deno.env.get("SUPABASE_MANAGEMENT_TOKEN");

interface ErrorRow {
  id: string;
  timestamp: number;
  function_id: string;
  status_code: number | null;
  method: string | null;
  execution_time_ms: number | null;
  event_message: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const minutes = Math.min(parseInt(url.searchParams.get("minutes") || "60", 10), 1440);

    if (!MGMT_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "missing_management_token",
          message:
            "Defina o secret SUPABASE_MANAGEMENT_TOKEN para habilitar a leitura de logs.",
          rows: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Query analytics: HTTP edge logs with status >= 500 OR shutdowns/errors in messages
    const sql = `
      select id, function_edge_logs.timestamp, event_message,
             response.status_code, request.method, m.function_id, m.execution_time_ms
      from function_edge_logs
        cross join unnest(metadata) as m
        cross join unnest(m.response) as response
        cross join unnest(m.request) as request
      where response.status_code >= 400
        and function_edge_logs.timestamp > timestamp_sub(current_timestamp(), interval ${minutes} minute)
      order by function_edge_logs.timestamp desc
      limit 100
    `.trim();

    const resp = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs.all`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${MGMT_TOKEN}` },
      },
    ).catch(() => null);

    // Fallback: use the documented analytics SQL endpoint
    const apiResp = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`,
      { headers: { Authorization: `Bearer ${MGMT_TOKEN}` } },
    );

    if (!apiResp.ok) {
      const text = await apiResp.text();
      return new Response(
        JSON.stringify({ error: "analytics_failed", status: apiResp.status, detail: text, rows: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await apiResp.json();
    const rows: ErrorRow[] = (json.result || json.data || []).map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      function_id: r.function_id,
      status_code: r.status_code,
      method: r.method,
      execution_time_ms: r.execution_time_ms,
      event_message: r.event_message,
    }));

    return new Response(
      JSON.stringify({ rows, fetched_at: new Date().toISOString(), window_minutes: minutes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message, rows: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

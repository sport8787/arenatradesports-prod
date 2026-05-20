// Wrapper: injeta MIGRATION_TOKEN server-side e encaminha p/ migrate-table-to-mirror
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  const body = await req.text();
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/migrate-table-to-mirror`, {
    method: "POST",
    headers: {
      "X-Migration-Token": Deno.env.get("MIGRATION_TOKEN") ?? "",
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body,
  });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate timestamp 24 hours ago
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24);
    const cutoffTimestamp = cutoffTime.toISOString();

    console.log(`[Cleanup] Starting cleanup for rooms older than ${cutoffTimestamp}`);

    // Step 1: Get old room IDs
    const { data: oldRooms, error: roomsError } = await supabase
      .from("rooms")
      .select("id")
      .lt("created_at", cutoffTimestamp);

    if (roomsError) {
      console.error("[Cleanup] Error fetching old rooms:", roomsError);
      throw roomsError;
    }

    if (!oldRooms || oldRooms.length === 0) {
      console.log("[Cleanup] No old rooms to clean up");
      return new Response(
        JSON.stringify({ message: "No old rooms to clean up", deletedCount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roomIds = oldRooms.map((r) => r.id);
    console.log(`[Cleanup] Found ${roomIds.length} old rooms to delete`);

    // Step 2: Delete votes for old rooms
    const { error: votesError, count: votesCount } = await supabase
      .from("votes")
      .delete({ count: "exact" })
      .in("room_id", roomIds);

    if (votesError) {
      console.error("[Cleanup] Error deleting votes:", votesError);
    } else {
      console.log(`[Cleanup] Deleted ${votesCount || 0} votes`);
    }

    // Step 3: Delete players for old rooms
    const { error: playersError, count: playersCount } = await supabase
      .from("players")
      .delete({ count: "exact" })
      .in("room_id", roomIds);

    if (playersError) {
      console.error("[Cleanup] Error deleting players:", playersError);
    } else {
      console.log(`[Cleanup] Deleted ${playersCount || 0} players`);
    }

    // Step 4: Delete the rooms themselves
    const { error: deleteRoomsError, count: roomsCount } = await supabase
      .from("rooms")
      .delete({ count: "exact" })
      .in("id", roomIds);

    if (deleteRoomsError) {
      console.error("[Cleanup] Error deleting rooms:", deleteRoomsError);
      throw deleteRoomsError;
    }

    console.log(`[Cleanup] Successfully deleted ${roomsCount || 0} rooms`);

    return new Response(
      JSON.stringify({
        message: "Cleanup completed successfully",
        deletedRooms: roomsCount || 0,
        deletedPlayers: playersCount || 0,
        deletedVotes: votesCount || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cleanup] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

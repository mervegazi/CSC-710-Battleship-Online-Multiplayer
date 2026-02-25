import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { Table, TableRequest } from "../types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type TableRole = "none" | "host" | "requester";

interface UseTableReturn {
  tables: Table[];
  myTable: Table | null;
  myRequest: TableRequest | null;
  incomingRequests: TableRequest[];
  role: TableRole;
  loading: boolean;
  error: string | null;
  createTable: () => Promise<void>;
  cancelTable: () => Promise<void>;
  sendJoinRequest: (tableId: string) => Promise<void>;
  cancelJoinRequest: () => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  matchedGameId: string | null;
  matchedOpponent: string | null;
}

async function getDisplayName(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name ?? "Unknown";
}

export function useTable(): UseTableReturn {
  const { user } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [myTable, setMyTable] = useState<Table | null>(null);
  const [myRequest, setMyRequest] = useState<TableRequest | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<TableRequest[]>([]);
  const [role, setRole] = useState<TableRole>("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchedGameId, setMatchedGameId] = useState<string | null>(null);
  const [matchedOpponent, setMatchedOpponent] = useState<string | null>(null);

  const tablesChannelRef = useRef<RealtimeChannel | null>(null);
  const requestsChannelRef = useRef<RealtimeChannel | null>(null);
  const myRequestChannelRef = useRef<RealtimeChannel | null>(null);

  // Fetch all open tables with host names
  const fetchTables = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("tables")
      .select("*, profiles:host_id(display_name)")
      .in("status", ["waiting"])
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Failed to fetch tables:", fetchError);
      return;
    }

    const mapped: Table[] = (data ?? []).map((t: any) => ({
      id: t.id,
      host_id: t.host_id,
      host_name: t.profiles?.display_name ?? "Unknown",
      status: t.status,
      created_at: t.created_at,
    }));

    setTables(mapped);
  }, []);

  // Fetch incoming requests for host's table
  const fetchIncomingRequests = useCallback(
    async (tableId: string) => {
      const { data } = await supabase
        .from("table_requests")
        .select("*, profiles:requester_id(display_name)")
        .eq("table_id", tableId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      const mapped: TableRequest[] = (data ?? []).map((r: any) => ({
        id: r.id,
        table_id: r.table_id,
        requester_id: r.requester_id,
        requester_name: r.profiles?.display_name ?? "Unknown",
        status: r.status,
        created_at: r.created_at,
      }));

      setIncomingRequests(mapped);
    },
    []
  );

  // Subscribe to table changes in the lobby
  useEffect(() => {
    fetchTables();

    const channel = supabase
      .channel("lobby-tables")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables" },
        () => {
          fetchTables();
        }
      )
      .subscribe();

    tablesChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      tablesChannelRef.current = null;
    };
  }, [fetchTables]);

  // Subscribe to incoming requests when hosting
  useEffect(() => {
    if (role !== "host" || !myTable) {
      if (requestsChannelRef.current) {
        supabase.removeChannel(requestsChannelRef.current);
        requestsChannelRef.current = null;
      }
      return;
    }

    fetchIncomingRequests(myTable.id);

    const channel = supabase
      .channel(`table-requests:${myTable.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_requests",
          filter: `table_id=eq.${myTable.id}`,
        },
        () => {
          fetchIncomingRequests(myTable.id);
        }
      )
      .subscribe();

    requestsChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      requestsChannelRef.current = null;
    };
  }, [role, myTable, fetchIncomingRequests]);

  // Subscribe to my request status AND game creation when I'm a requester
  useEffect(() => {
    if (role !== "requester" || !myRequest || !user) {
      if (myRequestChannelRef.current) {
        supabase.removeChannel(myRequestChannelRef.current);
        myRequestChannelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`my-request:${myRequest.id}`)
      // Listen for request rejection
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "table_requests",
          filter: `id=eq.${myRequest.id}`,
        },
        (payload) => {
          const updated = payload.new as { status: string };
          if (updated.status === "rejected") {
            setMyRequest(null);
            setRole("none");
            setError("Your join request was rejected.");
            setTimeout(() => setError(null), 4000);
          }
          // "accepted" is handled by the games_players INSERT below
        }
      )
      // Listen for game creation (host inserts games_players for us)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "games_players",
          filter: `player_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as { game_id: string };

          // Verify this game is linked to our table
          const { data: game } = await supabase
            .from("games")
            .select("id, table_id")
            .eq("id", row.game_id)
            .eq("table_id", myRequest.table_id)
            .maybeSingle();

          if (game) {
            const { data: opponent } = await supabase
              .from("games_players")
              .select("player_id")
              .eq("game_id", game.id)
              .neq("player_id", user.id)
              .maybeSingle();

            const opponentName = opponent
              ? await getDisplayName(opponent.player_id)
              : "Unknown";

            setMatchedGameId(game.id);
            setMatchedOpponent(opponentName);
            setMyRequest(null);
            setRole("none");
          }
        }
      )
      .subscribe();

    myRequestChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      myRequestChannelRef.current = null;
    };
  }, [role, myRequest, user]);

  // Check if user already has an active table or request on mount
  useEffect(() => {
    if (!user) return;

    const checkExisting = async () => {
      // Check if hosting
      const { data: existingTable } = await supabase
        .from("tables")
        .select("*")
        .eq("host_id", user.id)
        .eq("status", "waiting")
        .maybeSingle();

      if (existingTable) {
        setMyTable({
          id: existingTable.id,
          host_id: existingTable.host_id,
          status: existingTable.status,
          created_at: existingTable.created_at,
        });
        setRole("host");
        return;
      }

      // Check if has pending request
      const { data: existingRequest } = await supabase
        .from("table_requests")
        .select("*")
        .eq("requester_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingRequest) {
        setMyRequest({
          id: existingRequest.id,
          table_id: existingRequest.table_id,
          requester_id: existingRequest.requester_id,
          status: existingRequest.status,
          created_at: existingRequest.created_at,
        });
        setRole("requester");
      }
    };

    checkExisting();
  }, [user]);

  const createTable = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from("tables")
        .insert({ host_id: user.id, status: "waiting" })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      setMyTable({
        id: data.id,
        host_id: data.host_id,
        status: data.status,
        created_at: data.created_at,
      });
      setRole("host");
      // Proactively refresh the tables list in case Realtime is slow
      await fetchTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create table");
    } finally {
      setLoading(false);
    }
  }, [user, fetchTables]);

  const cancelTable = useCallback(async () => {
    if (!user || !myTable) return;
    setLoading(true);

    try {
      // Reject all pending requests
      await supabase
        .from("table_requests")
        .update({ status: "rejected" })
        .eq("table_id", myTable.id)
        .eq("status", "pending");

      // Close the table
      await supabase
        .from("tables")
        .update({ status: "closed" })
        .eq("id", myTable.id);

      setMyTable(null);
      setRole("none");
      setIncomingRequests([]);
      // Proactively refresh the tables list in case Realtime is slow
      await fetchTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel table");
    } finally {
      setLoading(false);
    }
  }, [user, myTable, fetchTables]);

  const sendJoinRequest = useCallback(
    async (tableId: string) => {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        const { data, error: insertError } = await supabase
          .from("table_requests")
          .insert({
            table_id: tableId,
            requester_id: user.id,
            status: "pending",
          })
          .select()
          .single();

        if (insertError) {
          if (insertError.message.includes("duplicate")) {
            setError("You already sent a request to this table.");
          } else {
            throw new Error(insertError.message);
          }
          return;
        }

        setMyRequest({
          id: data.id,
          table_id: data.table_id,
          requester_id: data.requester_id,
          status: data.status,
          created_at: data.created_at,
        });
        setRole("requester");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send join request"
        );
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const cancelJoinRequest = useCallback(async () => {
    if (!user || !myRequest) return;
    setLoading(true);

    try {
      await supabase
        .from("table_requests")
        .delete()
        .eq("id", myRequest.id);

      setMyRequest(null);
      setRole("none");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel request"
      );
    } finally {
      setLoading(false);
    }
  }, [user, myRequest]);

  const acceptRequest = useCallback(
    async (requestId: string) => {
      if (!user || !myTable) return;
      setLoading(true);
      setError(null);

      try {
        // Find the request to get requester ID
        const request = incomingRequests.find((r) => r.id === requestId);
        if (!request) throw new Error("Request not found");

        // Accept the request
        await supabase
          .from("table_requests")
          .update({ status: "accepted" })
          .eq("id", requestId);

        // Reject all other pending requests
        await supabase
          .from("table_requests")
          .update({ status: "rejected" })
          .eq("table_id", myTable.id)
          .eq("status", "pending")
          .neq("id", requestId);

        // Update table status
        await supabase
          .from("tables")
          .update({ status: "in_game" })
          .eq("id", myTable.id);

        // Create the game
        const firstPlayer =
          Math.random() < 0.5 ? user.id : request.requester_id;

        const { data: game, error: gameError } = await supabase
          .from("games")
          .insert({
            status: "setup",
            current_turn: firstPlayer,
            table_id: myTable.id,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (gameError || !game) throw new Error("Failed to create game");

        await supabase.from("games_players").insert([
          {
            game_id: game.id,
            player_id: user.id,
            player_number: 1,
            board: { ships: [] },
            ready: false,
          },
          {
            game_id: game.id,
            player_id: request.requester_id,
            player_number: 2,
            board: { ships: [] },
            ready: false,
          },
        ]);

        const opponentName =
          request.requester_name ?? (await getDisplayName(request.requester_id));

        setMatchedGameId(game.id);
        setMatchedOpponent(opponentName);
        setMyTable(null);
        setRole("none");
        setIncomingRequests([]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to accept request"
        );
      } finally {
        setLoading(false);
      }
    },
    [user, myTable, incomingRequests]
  );

  const rejectRequest = useCallback(
    async (requestId: string) => {
      if (!user) return;

      try {
        await supabase
          .from("table_requests")
          .update({ status: "rejected" })
          .eq("id", requestId);

        setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to reject request"
        );
      }
    },
    [user]
  );

  // Cleanup on unmount: close table if hosting
  useEffect(() => {
    return () => {
      if (requestsChannelRef.current) {
        supabase.removeChannel(requestsChannelRef.current);
      }
      if (myRequestChannelRef.current) {
        supabase.removeChannel(myRequestChannelRef.current);
      }
    };
  }, []);

  return {
    tables,
    myTable,
    myRequest,
    incomingRequests,
    role,
    loading,
    error,
    createTable,
    cancelTable,
    sendJoinRequest,
    cancelJoinRequest,
    acceptRequest,
    rejectRequest,
    matchedGameId,
    matchedOpponent,
  };
}

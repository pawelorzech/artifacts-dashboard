"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  lastMessage: WebSocketMessage | null;
}

const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(MIN_RECONNECT_DELAY);
  const mountedRef = useRef(true);
  const queryClient = useQueryClient();

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "character_update":
          queryClient.invalidateQueries({ queryKey: ["characters"] });
          queryClient.invalidateQueries({ queryKey: ["character"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          break;

        case "automation_action": {
          const actionData = message.data as {
            config_id?: number;
            character_name?: string;
            action_type?: string;
            success?: boolean;
          };
          queryClient.invalidateQueries({ queryKey: ["automationLogs"] });
          queryClient.invalidateQueries({ queryKey: ["automationStatuses"] });
          if (actionData.config_id) {
            queryClient.invalidateQueries({
              queryKey: ["automation", actionData.config_id],
            });
          }
          break;
        }

        case "automation_status_changed": {
          const statusData = message.data as {
            config_id?: number;
            character_name?: string;
            status?: string;
          };
          queryClient.invalidateQueries({ queryKey: ["automations"] });
          queryClient.invalidateQueries({ queryKey: ["automationStatuses"] });
          if (statusData.config_id) {
            queryClient.invalidateQueries({
              queryKey: ["automation", statusData.config_id],
            });
          }
          if (statusData.status === "error") {
            toast.error(
              `Automation error for ${statusData.character_name || "unknown character"}`
            );
          }
          if (statusData.status === "running") {
            toast.success(
              `Automation started for ${statusData.character_name || "unknown character"}`
            );
          }
          if (statusData.status === "stopped") {
            toast.info(
              `Automation stopped for ${statusData.character_name || "unknown character"}`
            );
          }
          break;
        }

        case "ws_status":
          // Backend-to-game-server connection status, no cache invalidation needed
          break;

        default:
          if (message.type === "game_event_spawn") {
            const spawnData = message.data as { code?: string };
            if (spawnData.code) {
              toast.info(`Event spawned: ${spawnData.code}`);
            }
          }
          break;
      }
    },
    [queryClient]
  );

  const connect = useCallback(() => {
    // Guard against SSR and unmounted components
    if (typeof window === "undefined" || !mountedRef.current) {
      return;
    }

    // Close any existing connection before reconnecting
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws/live";

    setStatus("connecting");

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }
        setStatus("connected");
        reconnectDelayRef.current = MIN_RECONNECT_DELAY;
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const message = JSON.parse(event.data as string) as WebSocketMessage;
          setLastMessage(message);
          handleMessage(message);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setStatus("disconnected");
        wsRef.current = null;

        // Exponential backoff reconnect
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(
          delay * 2,
          MAX_RECONNECT_DELAY
        );
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, so just let onclose handle reconnection
        ws.close();
      };
    } catch {
      // WebSocket constructor can throw if the URL is invalid
      if (mountedRef.current) {
        setStatus("disconnected");
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(
          delay * 2,
          MAX_RECONNECT_DELAY
        );
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    }
  }, [handleMessage]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        // Remove handlers to prevent reconnect on cleanup close
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { status, lastMessage };
}

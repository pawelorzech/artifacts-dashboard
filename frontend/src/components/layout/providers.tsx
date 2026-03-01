"use client";

import { createContext, useContext, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import {
  useWebSocket,
  type ConnectionStatus,
} from "@/hooks/use-websocket";

interface WebSocketContextValue {
  status: ConnectionStatus;
  lastMessage: unknown | null;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  status: "disconnected",
  lastMessage: null,
});

function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { status, lastMessage } = useWebSocket();

  return (
    <WebSocketContext.Provider value={{ status, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useConnectionStatus(): ConnectionStatus {
  const context = useContext(WebSocketContext);
  return context.status;
}

export function useLastWebSocketMessage(): unknown | null {
  const context = useContext(WebSocketContext);
  return context.lastMessage;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        {children}
        <Toaster theme="dark" position="bottom-right" richColors />
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const client = io(import.meta.env.VITE_API_WS_URL || "http://localhost:4000", {
      transports: ["websocket"],
      autoConnect: false,
    });

    client.connect();
    setSocket(client);

    return () => {
      client.disconnect();
    };
  }, []);

  const value = useMemo(() => ({ socket }), [socket]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
}

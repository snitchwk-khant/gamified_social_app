import { useEffect, useSyncExternalStore } from "react";
import NetworkService from "../services/network_service";

function useNetwork() {
  const network = useSyncExternalStore(
    NetworkService.subscribe,
    NetworkService.getSnapshot,
    NetworkService.getSnapshot
  );

  useEffect(() => {
    NetworkService.start();
  }, []);

  return {
    ...network,
    isOffline: network.status === "offline",
    isOnline: network.status === "online",
    isReconnecting: network.status === "reconnecting",
    retry: NetworkService.retryQueued,
  };
}

export default useNetwork;

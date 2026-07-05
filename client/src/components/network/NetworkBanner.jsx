import { useEffect, useRef, useState } from "react";
import useNetwork from "../../hooks/useNetwork";
import { successNotification } from "../../services/haptics";

function NetworkBanner() {
  const { initialized, status } = useNetwork();
  const [visibleState, setVisibleState] = useState(null);
  const hadOfflineStateRef = useRef(status === "offline");
  const hideTimerRef = useRef(null);

  useEffect(() => {
    if (!initialized) {
      return undefined;
    }

    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (status === "offline") {
      hadOfflineStateRef.current = true;
      setVisibleState("offline");
    } else if (status === "online" && hadOfflineStateRef.current) {
      hadOfflineStateRef.current = false;
      setVisibleState("online");
      successNotification();
      hideTimerRef.current = window.setTimeout(() => {
        setVisibleState(null);
      }, 2000);
    } else if (status === "reconnecting") {
      hadOfflineStateRef.current = true;
      setVisibleState("reconnecting");
    }

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [initialized, status]);

  if (!visibleState) {
    return null;
  }

  const isOffline = visibleState === "offline";
  const isReconnecting = visibleState === "reconnecting";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[140] flex justify-center pl-[calc(0.75rem+var(--safe-area-inset-left))] pr-[calc(0.75rem+var(--safe-area-inset-right))] pt-[calc(0.75rem+var(--safe-area-inset-top))]">
      <div
        className={`pointer-events-auto max-w-md rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl transition duration-200 ${
          isOffline || isReconnecting
            ? "border-amber-400/30 bg-slate-950/95 text-amber-100 shadow-slate-950/30"
            : "border-emerald-400/30 bg-slate-950/95 text-emerald-100 shadow-slate-950/30"
        }`}
        role="status"
        aria-live="polite"
      >
        {isOffline ? (
          <>
            <p>⚠️ You're offline.</p>
            <p className="mt-1 text-xs font-medium text-slate-300">Some features may not be available.</p>
          </>
        ) : null}
        {isReconnecting ? <p>Reconnecting...</p> : null}
        {!isOffline && !isReconnecting ? <p>✅ Back online.</p> : null}
      </div>
    </div>
  );
}

export default NetworkBanner;

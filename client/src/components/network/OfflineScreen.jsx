import { useState } from "react";
import SafeAreaLayout from "../layout/SafeAreaLayout";
import useNetwork from "../../hooks/useNetwork";
import { successNotification } from "../../services/haptics";

function OfflineScreen({ onRecovered }) {
  const { retry, queueSize } = useNetwork();
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState("");

  const handleRetry = async () => {
    setRetrying(true);
    setMessage("");

    try {
      const status = await retry();

      if (status.connected) {
        successNotification();
        setMessage("Connection restored.");
        if (typeof onRecovered === "function") {
          onRecovered();
        }
      } else {
        setMessage("Still offline. Check your connection and try again.");
      }
    } catch {
      setMessage("Unable to check the connection. Try again.");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <SafeAreaLayout className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <section className="mx-4 w-full max-w-sm rounded-[28px] border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl shadow-slate-950/30">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-3xl">
          ⚠️
        </div>
        <h1 className="mt-5 text-2xl font-bold">You're offline.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Gemify needs a connection to load your workspace. Some queued actions will retry automatically when you're back online.
        </p>

        {queueSize ? (
          <p className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-semibold text-slate-300">
            {queueSize} action{queueSize === 1 ? "" : "s"} waiting to sync.
          </p>
        ) : null}

        {message ? <p className="mt-4 text-sm font-semibold text-slate-300">{message}</p> : null}

        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="mt-6 w-full rounded-2xl bg-[#c446ff] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ad32e3] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retrying ? "Checking..." : "Retry"}
        </button>
      </section>
    </SafeAreaLayout>
  );
}

export default OfflineScreen;

import { useEffect, useMemo, useState } from "react";
import { getLeaderboardSettings, saveLeaderboardSettings } from "../../services/leaderboard_settings_service";

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(value) {
  if (!value) {
    return "No month selected";
  }

  const [year, month] = value.split("-").map((part) => Number.parseInt(part, 10));

  if (!year || !month) {
    return "No month selected";
  }

  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function getMonthValueFromSettings(settings) {
  if (!settings?.selected_month || !settings?.selected_year) {
    return getCurrentMonthValue();
  }

  return `${settings.selected_year}-${String(settings.selected_month).padStart(2, "0")}`;
}

function parseMonthValue(value) {
  const [year, month] = value.split("-").map((part) => Number.parseInt(part, 10));
  return { month, year };
}

function LeaderboardSettingsPage() {
  const [displayMonth, setDisplayMonth] = useState(getCurrentMonthValue);
  const [appliedMonth, setAppliedMonth] = useState(getCurrentMonthValue);
  const [savedMonth, setSavedMonth] = useState(getCurrentMonthValue);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedMonthLabel = useMemo(() => formatMonth(displayMonth), [displayMonth]);
  const appliedMonthLabel = useMemo(() => formatMonth(appliedMonth), [appliedMonth]);
  const savedMonthLabel = useMemo(() => formatMonth(savedMonth), [savedMonth]);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setLoading(true);

      try {
        const settings = await getLeaderboardSettings();
        const monthValue = getMonthValueFromSettings(settings);

        if (isMounted) {
          setDisplayMonth(monthValue);
          setAppliedMonth(monthValue);
          setSavedMonth(monthValue);
          setMessage("");
        }
      } catch (error) {
        console.error("Leaderboard settings load error:", error);

        if (isMounted) {
          setMessageType("error");
          setMessage(error?.message || "Unable to load leaderboard settings.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleApply = () => {
    setAppliedMonth(displayMonth);
    setMessageType("success");
    setMessage(`Applied preview month: ${formatMonth(displayMonth)}.`);
  };

  const handleSave = async () => {
    const period = parseMonthValue(displayMonth);
    setSaving(true);

    try {
      const settings = await saveLeaderboardSettings({
        selectedMonth: period.month,
        selectedYear: period.year,
      });
      const monthValue = getMonthValueFromSettings(settings);

      setDisplayMonth(monthValue);
      setSavedMonth(monthValue);
      setAppliedMonth(monthValue);
      setMessageType("success");
      setMessage(`Leaderboard display month saved: ${formatMonth(monthValue)}.`);
    } catch (error) {
      console.error("Leaderboard settings save error:", error);
      setMessageType("error");
      setMessage(error?.message || "Unable to save leaderboard settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Leaderboard Settings</p>
          <h2 className="text-2xl font-semibold text-slate-950">Display Month</h2>
          <p className="max-w-2xl text-sm text-slate-500">
            Choose which month will later power Shop Leaderboard, Welcome Popup, Champions, and Shop Recognition displays.
          </p>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <label className="block text-sm font-semibold text-slate-700" htmlFor="leaderboard-display-month">
              Display Month
            </label>
            <input
              id="leaderboard-display-month"
              type="month"
              value={displayMonth}
              onChange={(event) => {
                setDisplayMonth(event.target.value);
                setMessage("");
              }}
              disabled={loading || saving}
              className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#c446ff] focus:ring-2 focus:ring-[#c446ff]/20 sm:max-w-xs"
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleApply}
                disabled={loading || saving}
                className="min-h-11 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#c446ff] hover:bg-[#f6e8ff] hover:text-[#c446ff]"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || saving}
                className="min-h-11 rounded-2xl bg-[#c446ff] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ad32e3]"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>

            {message ? (
              <p
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                  messageType === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {message}
              </p>
            ) : null}
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current Selection</p>
            <p className="mt-3 text-xl font-bold text-slate-950">{selectedMonthLabel}</p>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-slate-500">Applied Preview</span>
                <span className="font-semibold text-slate-900">{appliedMonthLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-slate-500">Saved Locally</span>
                <span className="font-semibold text-slate-900">{savedMonthLabel}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default LeaderboardSettingsPage;

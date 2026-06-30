import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";
import { getSalesTargets } from "../../services/sales_target_service";
import { getCurrentUserRank } from "../../services/leaderboard_service";

const numberFormatter = new Intl.NumberFormat();
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function getCurrentPeriod() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    label: monthFormatter.format(now),
  };
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function MyPerformanceCard() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const period = useMemo(getCurrentPeriod, []);
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPerformance = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const targets = await getSalesTargets({ month: period.month, year: period.year });
      setTarget(getCurrentUserRank(targets, user.id));
    } catch (err) {
      console.error("My performance load error:", err);
      setError("Unable to load your performance right now.");
    } finally {
      setLoading(false);
    }
  }, [period.month, period.year, user?.id]);

  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);

  const achievement = target?.achievement || 0;
  const progressWidth = Math.min(100, Math.max(0, achievement));

  return (
    <section
      className={`rounded-[1.5rem] border p-5 shadow-sm ${
        isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">My Performance</p>
          <h2 className="mt-1 text-xl font-semibold">{period.label}</h2>
        </div>
      </div>

      {loading ? <p className={isDark ? "mt-4 text-sm text-slate-400" : "mt-4 text-sm text-slate-500"}>Loading performance...</p> : null}

      {!loading && error ? (
        <p className={isDark ? "mt-4 text-sm text-rose-200" : "mt-4 text-sm text-rose-600"}>{error}</p>
      ) : null}

      {!loading && !error && !target ? (
        <p className={isDark ? "mt-4 text-sm text-slate-400" : "mt-4 text-sm text-slate-500"}>
          No sales target has been assigned for this month.
        </p>
      ) : null}

      {!loading && !error && target ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Current Rank" value={`#${target.rank}`} isDark={isDark} />
            <Metric label="Monthly Target" value={formatNumber(target.target_sales)} isDark={isDark} />
            <Metric label="Current Sales" value={formatNumber(target.current_sales)} isDark={isDark} />
            <Metric label="Achievement" value={`${formatNumber(achievement)}%`} isDark={isDark} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className={isDark ? "font-semibold text-slate-300" : "font-semibold text-slate-700"}>Progress</span>
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>{formatNumber(achievement)}%</span>
            </div>
            <div className={isDark ? "h-3 overflow-hidden rounded-full bg-slate-800" : "h-3 overflow-hidden rounded-full bg-slate-100"}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 transition-all"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value, isDark }) {
  return (
    <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-100 bg-slate-50"}`}>
      <p className={isDark ? "text-xs font-semibold uppercase tracking-[0.18em] text-slate-400" : "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"}>
        {label}
      </p>
      <p className={isDark ? "mt-2 text-xl font-semibold text-slate-100" : "mt-2 text-xl font-semibold text-slate-950"}>{value}</p>
    </div>
  );
}

export default MyPerformanceCard;

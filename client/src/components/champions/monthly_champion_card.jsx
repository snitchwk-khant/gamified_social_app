import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";
import {
  formatChampionMonth,
  getMonthlyChampion,
  getMonthStartDate,
  subscribeToMonthlyChampions,
} from "../../services/monthly_champion_service";
import { getProfilePath } from "../../utils/profile_path";

const numberFormatter = new Intl.NumberFormat();
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function getInitials(name, email) {
  const source = name || email || "Champion";
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C"
  );
}

function MonthlyChampionCard() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const month = useMemo(() => getMonthStartDate(), []);
  const [champion, setChampion] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadChampion = useCallback(async () => {
    setLoading(true);

    try {
      const row = await getMonthlyChampion(month);
      setChampion(row);
    } catch (err) {
      console.error("Monthly champion load error:", err);
      setChampion(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadChampion();

    return subscribeToMonthlyChampions((payload) => {
      if (payload.new?.month === month || payload.old?.month === month) {
        loadChampion();
      }
    });
  }, [loadChampion, month]);

  if (loading) {
    return null;
  }

  if (!champion) {
    return null;
  }

  const profile = champion.profile || {};
  const displayName = profile.full_name || profile.email || "Monthly Champion";

  return (
    <section
      className={`overflow-hidden rounded-[1.5rem] border p-5 shadow-sm ${
        isDark
          ? "border-amber-400/30 bg-slate-950 text-slate-100 shadow-amber-950/20"
          : "border-amber-200 bg-white text-slate-900 shadow-amber-100"
      }`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={getProfilePath(champion.user_id, user?.id)}
            aria-label={`Open ${displayName} profile`}
            className="relative h-20 w-20 shrink-0 cursor-pointer rounded-full bg-[#f6e8ff] ring-4 ring-[#FFD700] shadow-[0_0_26px_rgba(255,215,0,0.35)]"
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={displayName} className="h-full w-full rounded-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full text-xl font-bold text-[#c446ff]">
                {getInitials(profile.full_name, profile.email)}
              </div>
            )}
            <span className="absolute -right-2 -top-2 rounded-full bg-[#FFD700] px-2 py-1 text-sm font-black text-slate-950">
              #1
            </span>
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Monthly Champion</p>
            <Link
              to={getProfilePath(champion.user_id, user?.id)}
              className="mt-1 block cursor-pointer truncate text-xl font-bold transition hover:text-[#c446ff]"
            >
              {displayName}
            </Link>
            <p className={isDark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"}>
              {profile.department || "No department"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
          <Metric label="Points" value={numberFormatter.format(champion.total_points)} isDark={isDark} />
          <Metric label="Month" value={monthFormatter.format(new Date(`${formatChampionMonth(champion.month)}-01T00:00:00`))} isDark={isDark} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, isDark }) {
  return (
    <div className={`rounded-2xl border p-3 ${isDark ? "border-slate-800 bg-slate-900" : "border-amber-100 bg-amber-50/70"}`}>
      <p className={isDark ? "text-xs font-semibold uppercase tracking-[0.18em] text-slate-400" : "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"}>
        {label}
      </p>
      <p className={isDark ? "mt-1 text-lg font-bold text-slate-100" : "mt-1 text-lg font-bold text-slate-950"}>{value}</p>
    </div>
  );
}

export default MonthlyChampionCard;

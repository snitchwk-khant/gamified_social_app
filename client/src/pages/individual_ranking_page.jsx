import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSalesTargets, subscribeToSalesTargets } from "../services/sales_target_service";
import { buildLeaderboard } from "../services/leaderboard_service";
import { useAuth } from "../context/auth_context";
import { useTheme } from "../context/theme_context";
import { getProfilePath } from "../utils/profile_path";

const numberFormatter = new Intl.NumberFormat();

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthValue(value) {
  const [year, month] = value.split("-").map((part) => Number.parseInt(part, 10));
  return { month, year };
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function getInitials(name, email) {
  const source = name || email || "Employee";
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "E"
  );
}

function getAchievementClass(achievement, isDark) {
  if (achievement >= 100) {
    return isDark ? "bg-emerald-950 text-emerald-200" : "bg-emerald-50 text-emerald-700";
  }

  if (achievement >= 80) {
    return isDark ? "bg-amber-950 text-amber-200" : "bg-amber-50 text-amber-700";
  }

  return isDark ? "bg-rose-950 text-rose-200" : "bg-rose-50 text-rose-700";
}

function IndividualRankingPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue);
  const [searchTerm, setSearchTerm] = useState("");
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRanking = useCallback(async () => {
    const period = parseMonthValue(monthValue);
    setLoading(true);
    setError("");

    try {
      const rows = await getSalesTargets(period);
      setTargets(rows);
    } catch (err) {
      console.error("Individual ranking load error:", err);
      setError(err?.message || "Unable to load individual ranking.");
    } finally {
      setLoading(false);
    }
  }, [monthValue]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  useEffect(() => {
    return subscribeToSalesTargets(loadRanking);
  }, [loadRanking]);

  const rankingRows = useMemo(() => {
    return buildLeaderboard(targets, { currentUserId: user?.id, searchTerm });
  }, [searchTerm, targets, user?.id]);

  const hasMonthlyRecords = useMemo(() => {
    return buildLeaderboard(targets, { currentUserId: user?.id }).length > 0;
  }, [targets, user?.id]);

  return (
    <section className="space-y-5">
      <div
        className={`rounded-2xl border p-5 shadow-sm ${
          isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Individual Ranking</h1>
            <p className={isDark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"}>
              Employee ranking by individual sales target achievement
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="month"
              value={monthValue}
              onChange={(event) => setMonthValue(event.target.value)}
              className={`h-11 min-w-0 rounded-2xl border px-4 text-sm outline-none transition sm:w-48 ${
                isDark
                  ? "border-slate-800 bg-slate-900 text-slate-100 focus:border-sky-500"
                  : "border-slate-200 bg-slate-50 text-slate-900 focus:border-[#c446ff] focus:bg-white"
              }`}
              aria-label="Select month"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employee"
              className={`h-11 min-w-0 rounded-2xl border px-4 text-sm outline-none transition placeholder:text-slate-400 sm:w-64 ${
                isDark
                  ? "border-slate-800 bg-slate-900 text-slate-100 focus:border-sky-500"
                  : "border-slate-200 bg-slate-50 text-slate-900 focus:border-[#c446ff] focus:bg-white"
              }`}
            />
          </div>
        </div>

        {error ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              isDark ? "border-rose-900 bg-rose-950/40 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {error}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div
          className={`rounded-2xl border px-5 py-8 text-center text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          Loading individual ranking...
        </div>
      ) : null}

      {!loading && rankingRows.length ? (
        <div
          className={`overflow-hidden rounded-2xl border shadow-sm ${
            isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"
          }`}
        >
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead
                className={`border-b text-xs uppercase tracking-[0.18em] ${
                  isDark ? "border-slate-800 bg-slate-900 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <tr>
                  <th className="px-5 py-4 font-semibold">Rank</th>
                  <th className="px-5 py-4 font-semibold">Avatar</th>
                  <th className="px-5 py-4 font-semibold">Employee Name</th>
                  <th className="px-5 py-4 font-semibold">Current Sales</th>
                  <th className="px-5 py-4 font-semibold">Target Sales</th>
                  <th className="px-5 py-4 font-semibold">Achievement %</th>
                </tr>
              </thead>
              <tbody className={isDark ? "divide-y divide-slate-800" : "divide-y divide-slate-100"}>
                {rankingRows.map((target) => (
                  <tr
                    key={target.id}
                    className={
                      target.isCurrentUser
                        ? isDark
                          ? "bg-sky-950/30 text-slate-100"
                          : "bg-[#fdf7ff] text-slate-700"
                        : isDark
                          ? "text-slate-300"
                          : "text-slate-700"
                    }
                  >
                    <td className="px-5 py-4 font-semibold">{target.rank}</td>
                    <td className="px-5 py-4">
                      <Link
                        to={getProfilePath(target.employeeId, user?.id)}
                        aria-label={`Open ${target.displayName} profile`}
                        className="flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[#f6e8ff] text-sm font-bold text-[#c446ff] transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#c446ff]/60"
                      >
                        {target.avatarUrl ? (
                          <img src={target.avatarUrl} alt={target.displayName} className="h-full w-full object-cover" />
                        ) : (
                          getInitials(target.displayName, target.email)
                        )}
                      </Link>
                    </td>
                    <td className={`px-5 py-4 font-semibold ${isDark ? "text-slate-100" : "text-slate-950"}`}>
                      <div className="flex items-center gap-2">
                        <Link
                          to={getProfilePath(target.employeeId, user?.id)}
                          className={`cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-[#c446ff]/40 ${isDark ? "hover:text-sky-300" : "hover:text-[#c446ff]"}`}
                        >
                          {target.displayName}
                        </Link>
                        {target.isCurrentUser ? (
                          <span className="rounded-full bg-[#c446ff] px-2 py-0.5 text-[11px] font-semibold text-white">You</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4">{formatNumber(target.current_sales)}</td>
                    <td className="px-5 py-4">{formatNumber(target.target_sales)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAchievementClass(target.achievement, isDark)}`}>
                        {formatNumber(target.achievement)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && hasMonthlyRecords && !rankingRows.length ? (
        <div
          className={`rounded-2xl border px-5 py-8 text-center text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          No employees match your search.
        </div>
      ) : null}

      {!loading && !hasMonthlyRecords ? (
        <div
          className={`rounded-2xl border px-5 py-8 text-center text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          No individual ranking data for this month.
        </div>
      ) : null}
    </section>
  );
}

export default IndividualRankingPage;

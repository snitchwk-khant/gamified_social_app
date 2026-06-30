import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/auth_context";
import { useTheme } from "../context/theme_context";
import {
  formatChampionMonth,
  getMonthlyChampionHistory,
  subscribeToMonthlyChampions,
} from "../services/monthly_champion_service";
import { getProfilePath } from "../utils/profile_path";

const numberFormatter = new Intl.NumberFormat();

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

function MonthlyChampionsPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [champions, setChampions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadChampions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const rows = await getMonthlyChampionHistory();
      setChampions(rows);
    } catch (err) {
      console.error("Monthly champions history load error:", err);
      setChampions([]);
      setError("Unable to load monthly champions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChampions();
    return subscribeToMonthlyChampions(loadChampions);
  }, [loadChampions]);

  return (
    <section className="space-y-5">
      <div
        className={`rounded-2xl border p-5 shadow-sm ${
          isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Champions</p>
        <h1 className="mt-2 text-2xl font-semibold">Monthly Champions</h1>
      </div>

      {loading ? (
        <div
          className={`rounded-2xl border px-5 py-8 text-center text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          Loading champions...
        </div>
      ) : null}

      {!loading && error ? (
        <div
          className={`rounded-2xl border px-5 py-4 text-sm ${
            isDark ? "border-rose-900 bg-rose-950/40 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {error}
        </div>
      ) : null}

      {!loading && !error && champions.length ? (
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
                  <th className="px-5 py-4 font-semibold">Avatar</th>
                  <th className="px-5 py-4 font-semibold">Name</th>
                  <th className="px-5 py-4 font-semibold">Department</th>
                  <th className="px-5 py-4 font-semibold">Points</th>
                  <th className="px-5 py-4 font-semibold">Month</th>
                </tr>
              </thead>
              <tbody className={isDark ? "divide-y divide-slate-800" : "divide-y divide-slate-100"}>
                {champions.map((champion) => {
                  const profile = champion.profile || {};
                  const displayName = profile.full_name || profile.email || "Monthly Champion";

                  return (
                    <tr key={champion.id} className={isDark ? "text-slate-300" : "text-slate-700"}>
                      <td className="px-5 py-4">
                        <Link
                          to={getProfilePath(champion.user_id, user?.id)}
                          aria-label={`Open ${displayName} profile`}
                          className="flex h-12 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[#f6e8ff] text-sm font-bold text-[#c446ff] ring-2 ring-[#FFD700]"
                        >
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(profile.full_name, profile.email)
                          )}
                        </Link>
                      </td>
                      <td className={`px-5 py-4 font-semibold ${isDark ? "text-slate-100" : "text-slate-950"}`}>
                        <Link
                          to={getProfilePath(champion.user_id, user?.id)}
                          className={`cursor-pointer transition ${isDark ? "hover:text-sky-300" : "hover:text-[#c446ff]"}`}
                        >
                          {displayName}
                        </Link>
                      </td>
                      <td className="px-5 py-4">{profile.department || "No department"}</td>
                      <td className="px-5 py-4 font-semibold">{numberFormatter.format(champion.total_points)}</td>
                      <td className="px-5 py-4">{formatChampionMonth(champion.month)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && !error && !champions.length ? (
        <div
          className={`rounded-2xl border px-5 py-8 text-center text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          No monthly champions yet.
        </div>
      ) : null}
    </section>
  );
}

export default MonthlyChampionsPage;

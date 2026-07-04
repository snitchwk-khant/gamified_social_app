import { useCallback, useEffect, useMemo, useState } from "react";
import ShopLeaderboardTable from "./shop_leaderboard_table";
import ShopTopCards from "./shop_top_cards";
import {
  getShopAssignmentEmployees,
  getShopSalesTargets,
  subscribeToShopAssignments,
  subscribeToShopTargets,
} from "../../services/shop_service";
import { buildShopRankingCards, buildTopShopCards } from "../../services/shop_ranking_service";
import { getLeaderboardDisplayPeriod } from "../../services/leaderboard_settings_service";

function ShopLeaderboardSection({ compact = false, isDark = false }) {
  const [shopTargets, setShopTargets] = useState([]);
  const [shopEmployees, setShopEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const period = await getLeaderboardDisplayPeriod();
      const [targets, employees] = await Promise.all([
        getShopSalesTargets(period),
        getShopAssignmentEmployees(),
      ]);
      setShopTargets(targets);
      setShopEmployees(employees);
    } catch (err) {
      console.error("Shop leaderboard load error:", err);
      setError(err?.message || "Unable to load shop leaderboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    return subscribeToShopTargets(loadLeaderboard);
  }, [loadLeaderboard]);

  useEffect(() => {
    return subscribeToShopAssignments(loadLeaderboard);
  }, [loadLeaderboard]);

  const topShopRows = useMemo(() => buildTopShopCards(shopTargets, shopEmployees), [shopEmployees, shopTargets]);

  const shopLeaderboardRows = useMemo(() => {
    return buildShopRankingCards(shopTargets, shopEmployees);
  }, [shopEmployees, shopTargets]);

  const remainingShopRows = useMemo(() => {
    return shopLeaderboardRows.filter((target) => target.rank > 3);
  }, [shopLeaderboardRows]);

  return (
    <section className="space-y-4 pb-24 sm:space-y-5 sm:pb-0">
      <div
        className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${
          isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Ranking of Site</h1>
          <p className={isDark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"}>
            Monthly site rankings
          </p>
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
          className={`rounded-3xl border px-5 py-8 text-center text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          Loading shop leaderboard...
        </div>
      ) : null}

      {!loading && topShopRows.length ? (
        <div className="space-y-3">
          <p className={isDark ? "text-xs font-semibold uppercase tracking-[0.22em] text-slate-500" : "text-xs font-semibold uppercase tracking-[0.22em] text-slate-400"}>
            Top 3
          </p>
          <ShopTopCards rows={topShopRows} compact={compact} isDark={isDark} />
        </div>
      ) : null}

      {!loading && remainingShopRows.length ? (
        <div className="space-y-3">
          <p className={isDark ? "text-xs font-semibold uppercase tracking-[0.22em] text-slate-500" : "text-xs font-semibold uppercase tracking-[0.22em] text-slate-400"}>
            Remaining Shops
          </p>
          <ShopLeaderboardTable rows={remainingShopRows} isDark={isDark} />
        </div>
      ) : null}

      {!loading && !shopLeaderboardRows.length ? (
        <div
          className={`rounded-3xl border px-5 py-10 text-center text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          No shop recognition data for this month yet.
        </div>
      ) : null}
    </section>
  );
}

export default ShopLeaderboardSection;

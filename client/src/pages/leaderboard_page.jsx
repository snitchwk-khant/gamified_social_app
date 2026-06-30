import { useCallback, useEffect, useMemo, useState } from "react";
import ShopLeaderboardTable from "../components/shops/shop_leaderboard_table";
import ShopTopCards from "../components/shops/shop_top_cards";
import {
  getShopAssignmentEmployees,
  getShopSalesTargets,
  subscribeToShopAssignments,
  subscribeToShopTargets,
} from "../services/shop_service";
import { buildShopRankingCards, buildTopShopCards } from "../services/shop_ranking_service";
import { useTheme } from "../context/theme_context";

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthValue(value) {
  const [year, month] = value.split("-").map((part) => Number.parseInt(part, 10));
  return { month, year };
}

function LeaderboardPage() {
  const { isDark } = useTheme();
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue);
  const [searchTerm, setSearchTerm] = useState("");
  const [shopTargets, setShopTargets] = useState([]);
  const [shopEmployees, setShopEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLeaderboard = useCallback(async () => {
    const period = parseMonthValue(monthValue);
    setLoading(true);
    setError("");

    try {
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
  }, [monthValue]);

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
    return buildShopRankingCards(shopTargets, shopEmployees, { searchTerm });
  }, [searchTerm, shopEmployees, shopTargets]);

  const remainingShopRows = useMemo(() => {
    return shopLeaderboardRows.filter((target) => target.rank > 3);
  }, [shopLeaderboardRows]);

  return (
    <section className="space-y-5">
      <div
        className={`rounded-2xl border p-5 shadow-sm ${
          isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Leaderboard</h1>
            <p className={isDark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"}>
              Shop performance ranking
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
              placeholder="Search shop"
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
          Loading shop leaderboard...
        </div>
      ) : null}

      {!loading ? <ShopTopCards rows={topShopRows} isDark={isDark} /> : null}

      {!loading && remainingShopRows.length ? (
        <ShopLeaderboardTable rows={remainingShopRows} isDark={isDark} />
      ) : null}

      {!loading && !shopLeaderboardRows.length ? (
        <div
          className={`rounded-2xl border px-5 py-8 text-center text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          No shop leaderboard data for this month.
        </div>
      ) : null}
    </section>
  );
}

export default LeaderboardPage;

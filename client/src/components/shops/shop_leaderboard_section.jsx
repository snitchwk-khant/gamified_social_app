import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthValue(period) {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

function parseMonthValue(value) {
  const [year, month] = value.split("-").map((part) => Number.parseInt(part, 10));
  return { month, year };
}

function ShopLeaderboardSection({ compact = false, isDark = false, preview = false }) {
  const [monthValue, setMonthValue] = useState("");
  const [shopTargets, setShopTargets] = useState([]);
  const [shopEmployees, setShopEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLeaderboard = useCallback(async (period) => {
    if (!period?.month || !period?.year) {
      return;
    }

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
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialPeriod() {
      try {
        const period = await getLeaderboardDisplayPeriod();

        if (isMounted) {
          setMonthValue(formatMonthValue(period));
        }
      } catch (err) {
        console.error("Shop leaderboard period load error:", err);

        if (isMounted) {
          setMonthValue(getCurrentMonthValue());
        }
      }
    }

    loadInitialPeriod();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!monthValue) {
      return;
    }

    loadLeaderboard(parseMonthValue(monthValue));
  }, [loadLeaderboard, monthValue]);

  useEffect(() => {
    if (!monthValue) {
      return undefined;
    }

    return subscribeToShopTargets(() => loadLeaderboard(parseMonthValue(monthValue)));
  }, [loadLeaderboard, monthValue]);

  useEffect(() => {
    if (!monthValue) {
      return undefined;
    }

    return subscribeToShopAssignments(() => loadLeaderboard(parseMonthValue(monthValue)));
  }, [loadLeaderboard, monthValue]);

  const topShopRows = useMemo(() => buildTopShopCards(shopTargets, shopEmployees), [shopEmployees, shopTargets]);

  const shopLeaderboardRows = useMemo(() => {
    return buildShopRankingCards(shopTargets, shopEmployees);
  }, [shopEmployees, shopTargets]);

  const remainingShopRows = useMemo(() => {
    return shopLeaderboardRows.filter((target) => target.rank > 3);
  }, [shopLeaderboardRows]);

  if (preview) {
    const previewRows = shopLeaderboardRows.slice(0, 3);

    return (
      <div className="space-y-4">
        {loading ? <p className="rounded-3xl bg-slate-900 p-4 text-sm text-slate-400">Loading leaderboard...</p> : null}

        {!loading && error ? <p className="rounded-3xl bg-rose-950/50 p-4 text-sm text-rose-200">{error}</p> : null}

        {!loading && !error && previewRows.length === 0 ? (
          <p className="rounded-3xl bg-slate-900 p-4 text-sm text-slate-400">No site ranking data yet.</p>
        ) : null}

        {!loading && !error
          ? previewRows.map((shop) => {
              const employee = getPreviewEmployee(shop);
              const progressWidth = getPreviewProgressWidth(shop.achievement);

              return (
                <Link
                  key={shop.id || shop.shop_id}
                  to="/leaderboard"
                  className="block rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4 text-slate-200 transition duration-200 hover:-translate-y-0.5 hover:border-[#B84DFF]/50 hover:bg-slate-900"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black shadow-sm ${getPreviewRankBadgeClass(shop.rank)}`}
                    >
                      {formatPreviewRank(shop.rank)}
                    </span>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-sm font-bold text-slate-200 ring-1 ring-white/10">
                      {employee?.avatar_url ? (
                        <img
                          src={employee.avatar_url}
                          alt={employee.full_name || employee.email || shop.shopName || "Leaderboard avatar"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getPreviewInitials(shop.shopName)
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold leading-5 text-slate-100">{shop.shopName || "Unnamed shop"}</p>
                          <p className="truncate text-xs font-medium leading-5 text-slate-400">{getPreviewSubtitle(shop)}</p>
                        </div>
                        <span className="shrink-0 text-sm font-black tabular-nums text-[#B84DFF]">
                          {formatPreviewAchievement(shop.achievement)}
                        </span>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#B84DFF] via-fuchsia-500 to-violet-400 transition-[width] duration-500 ease-out"
                          style={{ width: progressWidth }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          : null}

        <Link
          to="/leaderboard"
          className="block w-full rounded-2xl border border-slate-800 px-4 py-3 text-center text-sm font-semibold text-slate-200 transition hover:border-[#B84DFF] hover:text-white"
        >
          View Leaderboard
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-4 pb-24 sm:space-y-5 sm:pb-0">
      <div
        className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${
          isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Ranking of Site</h1>
            <p className={isDark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"}>
              Monthly site rankings
            </p>
          </div>
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

function formatPreviewRank(rank) {
  return rank ? `#${rank}` : "#-";
}

function formatPreviewAchievement(value) {
  const numericValue = Number(value || 0);
  return `${Number.isFinite(numericValue) ? numericValue.toFixed(1).replace(/\.0$/, "") : "0"}%`;
}

function getPreviewProgressWidth(value) {
  const numericValue = Number(value || 0);
  const clampedValue = Number.isFinite(numericValue) ? Math.min(100, Math.max(0, numericValue)) : 0;
  return `${clampedValue}%`;
}

function getPreviewRankBadgeClass(rank) {
  if (rank === 1) {
    return "bg-amber-400 text-amber-950";
  }

  if (rank === 2) {
    return "bg-slate-300 text-slate-950";
  }

  if (rank === 3) {
    return "bg-orange-500 text-orange-950";
  }

  return "bg-slate-800 text-slate-300";
}

function getPreviewEmployee(shop) {
  return shop.employees?.[0] || null;
}

function getPreviewSubtitle(shop) {
  const employee = getPreviewEmployee(shop);
  return employee?.full_name || employee?.email || employee?.role || `${shop.employeeCount || 0} employees`;
}

function getPreviewInitials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";
}

export default ShopLeaderboardSection;

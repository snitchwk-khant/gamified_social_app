import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ShopAvatar from "../components/shops/shop_avatar";
import { useTheme } from "../context/theme_context";
import { getLeaderboardDisplayPeriod } from "../services/leaderboard_settings_service";
import { calculateChampionCount } from "../services/shop_history_calculation_service";
import { buildShopRankingCards } from "../services/shop_ranking_service";
import {
  getShopAssignmentEmployees,
  getShops,
  getShopSalesTargets,
  subscribeToShopAssignments,
  subscribeToShops,
  subscribeToShopTargets,
} from "../services/shop_service";
import { getShopPath } from "../utils/shop_path";

function getShopEmployeeCounts(employees = []) {
  return employees.reduce((counts, employee) => {
    const shopId = employee.current_shop_id || employee.shop_id;

    if (!shopId) {
      return counts;
    }

    counts[shopId] = (counts[shopId] || 0) + 1;
    return counts;
  }, {});
}

function getEmployeesByShop(employees = []) {
  return employees.reduce((groups, employee) => {
    const shopId = employee.current_shop_id || employee.shop_id;

    if (!shopId) {
      return groups;
    }

    groups[shopId] = groups[shopId] || [];
    groups[shopId].push(employee);
    return groups;
  }, {});
}

function getInitials(primary = "", fallback = "") {
  const source = (primary || fallback || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function getEmployeeName(employee) {
  return employee?.full_name || employee?.email || "Employee";
}

function getShopAchievement(shop) {
  const rawValue =
    shop?.achievement_percent ??
    shop?.achievement_percentage ??
    shop?.achievementPercentage ??
    shop?.achievement ??
    null;
  const value = Number(rawValue);

  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function normalizeShopName(name) {
  return name?.toString().trim().toLowerCase() || "";
}

function getLeaderboardRowsByShopId(rows = []) {
  return rows.reduce((map, row) => {
    const shopId = row.shop_id || row.shopId || row.shop?.id || row.id;

    if (shopId) {
      map[shopId] = row;
    }

    return map;
  }, {});
}

function getLeaderboardRowsByShopName(rows = []) {
  return rows.reduce((map, row) => {
    const shopName = normalizeShopName(row.shopName || row.shop?.name || row.name);

    if (shopName) {
      map[shopName] = row;
    }

    return map;
  }, {});
}

function isSameLeaderboardPeriod(record, period) {
  return String(record?.month) === String(period?.month) && String(record?.year) === String(period?.year);
}

function getShopCurrentRank(shop, leaderboardRowsByShopId = {}, leaderboardRowsByShopName = {}) {
  const leaderboardRow =
    leaderboardRowsByShopId[shop?.id] || leaderboardRowsByShopName[normalizeShopName(shop?.name)] || null;
  const rawValue = leaderboardRow?.rank ?? shop?.current_rank ?? shop?.currentRank ?? shop?.rank ?? null;
  const value = Number.parseInt(rawValue, 10);

  return Number.isFinite(value) && value > 0 ? value : null;
}

function getShopChampionCount(shop, shopHistoryRecords = []) {
  if (shop?.id) {
    return calculateChampionCount(shop.id, shopHistoryRecords);
  }

  const rawValue = shop?.champion_count ?? shop?.championCount ?? shop?.champions ?? 0;
  const value = Number.parseInt(rawValue, 10);

  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function formatEmployeeCount(count) {
  return `${count} ${count === 1 ? "Employee" : "Employees"}`;
}

function ShopsPage() {
  const { isDark } = useTheme();
  const [shops, setShops] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [shopHistoryRecords, setShopHistoryRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadShops = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [leaderboardPeriod, shopRows, employeeRows, shopTargetRows] = await Promise.all([
        getLeaderboardDisplayPeriod(),
        getShops(),
        getShopAssignmentEmployees(),
        getShopSalesTargets(),
      ]);
      const leaderboardTargetRows = shopTargetRows.filter((target) => isSameLeaderboardPeriod(target, leaderboardPeriod));

      setShops(shopRows);
      setEmployees(employeeRows);
      setLeaderboardRows(buildShopRankingCards(leaderboardTargetRows, employeeRows));
      setShopHistoryRecords(shopTargetRows);
    } catch (err) {
      console.error("Shop list load error:", err);
      setError(err?.message || "Unable to load shops.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    return subscribeToShopAssignments(loadShops);
  }, [loadShops]);

  useEffect(() => {
    return subscribeToShopTargets(loadShops);
  }, [loadShops]);

  useEffect(() => {
    return subscribeToShops(loadShops);
  }, [loadShops]);

  const employeeCounts = useMemo(() => getShopEmployeeCounts(employees), [employees]);
  const employeesByShop = useMemo(() => getEmployeesByShop(employees), [employees]);
  const leaderboardRowsByShopId = useMemo(() => getLeaderboardRowsByShopId(leaderboardRows), [leaderboardRows]);
  const leaderboardRowsByShopName = useMemo(() => getLeaderboardRowsByShopName(leaderboardRows), [leaderboardRows]);
  const filteredShops = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return shops;
    }

    return shops.filter((shop) =>
      [shop.name, shop.code].some((value) => value?.toString().toLowerCase().includes(normalizedSearch))
    );
  }, [searchTerm, shops]);

  return (
    <section className="space-y-5 xl:w-full xl:max-w-none">
      <div
        className={`rounded-[22px] border p-5 shadow-sm ${
          isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-2xl font-semibold">Shops</h1>
              <p className={isDark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"}>
                Browse shops and open details
              </p>
            </div>
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                isDark ? "bg-violet-500/15 text-violet-200" : "bg-[#f4e5ff] text-[#9a2fd8]"
              }`}
            >
              {shops.length} {shops.length === 1 ? "Shop" : "Shops"}
            </span>
          </div>
          <div className="relative sm:w-72">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
              fill="none"
            >
              <path
                d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search shop"
              className={`h-12 w-full min-w-0 rounded-full border pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 ${
                isDark
                  ? "border-slate-800 bg-slate-900 text-slate-100 shadow-inner shadow-black/20 focus:border-violet-400"
                  : "border-slate-200 bg-slate-50 text-slate-900 shadow-sm focus:border-[#c446ff] focus:bg-white"
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
          Loading shops...
        </div>
      ) : null}

      {!loading && filteredShops.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] xl:gap-6">
          {filteredShops.map((shop) => {
            const shopEmployees = employeesByShop[shop.id] || [];
            const visibleEmployees = shopEmployees.slice(0, 5);
            const hiddenEmployeeCount = Math.max(0, shopEmployees.length - visibleEmployees.length);
            const employeeCount = employeeCounts[shop.id] || 0;
            const achievement = getShopAchievement(shop);
            const progressValue = Math.min(100, achievement ?? 0);
            const currentRank = getShopCurrentRank(shop, leaderboardRowsByShopId, leaderboardRowsByShopName);
            const championCount = getShopChampionCount(shop, shopHistoryRecords);

            return (
              <Link
                key={shop.id}
                to={getShopPath(shop.id)}
                className={`group flex min-h-[260px] flex-col gap-4 rounded-[18px] border p-5 shadow-lg transition duration-300 hover:-translate-y-1 hover:border-[#c446ff]/50 hover:shadow-2xl ${
                  isDark
                    ? "border-slate-800 bg-slate-950 text-slate-100 shadow-black/20"
                    : "border-slate-100 bg-white text-slate-900 shadow-slate-200/70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ShopAvatar shop={shop} size="md" isDark={isDark} />
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold">{shop.name}</h2>
                      {shop.code ? (
                        <p
                          className={
                            isDark ? "mt-0.5 truncate text-xs text-slate-400" : "mt-0.5 truncate text-xs text-slate-500"
                          }
                        >
                          {shop.code}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      shop.is_active
                        ? isDark
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-emerald-50 text-emerald-700"
                        : isDark
                          ? "bg-slate-800 text-slate-300"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {shop.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex min-h-10 items-center">
                  {visibleEmployees.length ? (
                    <div className="flex -space-x-2">
                      {visibleEmployees.map((employee) => {
                        const employeeName = getEmployeeName(employee);

                        return (
                          <div
                            key={employee.id}
                            className={`h-9 w-9 overflow-hidden rounded-full border-2 transition duration-200 group-hover:scale-105 ${
                              isDark ? "border-slate-950 bg-slate-800" : "border-white bg-slate-100"
                            }`}
                            title={employeeName}
                          >
                            {employee.avatar_url ? (
                              <img
                                src={employee.avatar_url}
                                alt={employeeName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-bold text-slate-700">
                                {getInitials(employee.full_name, employee.email)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {hiddenEmployeeCount > 0 ? (
                        <span
                          className={`flex h-9 min-w-9 items-center justify-center rounded-full border-2 px-2 text-xs font-bold transition duration-200 group-hover:scale-105 ${
                            isDark
                              ? "border-slate-950 bg-slate-800 text-slate-200"
                              : "border-white bg-slate-100 text-slate-700"
                          }`}
                        >
                          +{hiddenEmployeeCount}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className={isDark ? "text-sm text-slate-500" : "text-sm text-slate-400"}>
                      No employees yet
                    </span>
                  )}
                </div>

                <p className={isDark ? "text-sm font-medium text-slate-300 xl:hidden" : "text-sm font-medium text-slate-600 xl:hidden"}>
                  {formatEmployeeCount(employeeCount)}
                </p>

                <div
                  className={`mt-auto hidden grid-cols-2 overflow-hidden rounded-2xl border xl:grid ${
                    isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50/80"
                  }`}
                >
                  <div className="px-3 py-3 text-center">
                    <p className={isDark ? "text-xs font-semibold text-slate-400" : "text-xs font-semibold text-slate-500"}>
                      Current Rank
                    </p>
                    <p className="mt-1 text-2xl font-black leading-none text-[#b84dff]">
                      {currentRank ? `#${currentRank}` : "—"}
                    </p>
                  </div>
                  <div
                    className={`border-l px-3 py-3 text-center ${
                      isDark ? "border-slate-800" : "border-slate-200"
                    }`}
                  >
                    <p className={isDark ? "text-xs font-semibold text-slate-400" : "text-xs font-semibold text-slate-500"}>
                      Champions
                    </p>
                    <p className="mt-1 flex items-center justify-center gap-1 text-2xl font-black leading-none text-[#b84dff]">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                        <path d="M18 4h2.5a1.5 1.5 0 0 1 1.5 1.5V7a5 5 0 0 1-5 5h-.2A6.02 6.02 0 0 1 13 15.92V18h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.08A6.02 6.02 0 0 1 7.2 12H7a5 5 0 0 1-5-5V5.5A1.5 1.5 0 0 1 3.5 4H6V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1Zm0 2v3.83A3 3 0 0 0 20 7V6h-2ZM4 6v1a3 3 0 0 0 2 2.83V6H4Z" />
                      </svg>
                      {championCount}
                    </p>
                  </div>
                </div>

                <div className="mt-auto space-y-2 xl:hidden">
                  <div className="flex items-center justify-between text-sm">
                    <span className={isDark ? "font-medium text-slate-400" : "font-medium text-slate-500"}>
                      Achievement Progress
                    </span>
                    <span className="font-bold text-[#b84dff]">
                      {achievement === null ? "0%" : `${Math.round(achievement)}%`}
                    </span>
                  </div>
                  <div
                    className={
                      isDark ? "h-3 overflow-hidden rounded-full bg-slate-800" : "h-3 overflow-hidden rounded-full bg-slate-100"
                    }
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#8a3ffc] via-[#b84dff] to-[#df7cff] transition-all duration-700"
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}

      {!loading && !filteredShops.length ? (
        <div
          className={`rounded-2xl border px-5 py-8 text-center text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          No shops found.
        </div>
      ) : null}
    </section>
  );
}

export default ShopsPage;

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/auth_context";
import { useTheme } from "../context/theme_context";
import {
  buildShopLeaderboard,
  calculateAchievement,
  getShopById,
  getShopChampionHistory,
  getShopEmployees,
  getShopSalesTargets,
  subscribeToShopAssignments,
  subscribeToShopTargets,
} from "../services/shop_service";
import { formatChampionMonth } from "../services/monthly_champion_service";
import { getProfilePath } from "../utils/profile_path";

const numberFormatter = new Intl.NumberFormat();

function getCurrentPeriod() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
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

function ShopProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const period = useMemo(getCurrentPeriod, []);
  const [shop, setShop] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [target, setTarget] = useState(null);
  const [rank, setRank] = useState(null);
  const [championHistory, setChampionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadShop = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [shopRow, employeeRows, targetRows, championRows] = await Promise.all([
        getShopById(id),
        getShopEmployees(id),
        getShopSalesTargets({ month: period.month, year: period.year }),
        getShopChampionHistory({ shopId: id }),
      ]);
      const currentTarget = targetRows.find((item) => item.shop_id === id) || null;
      const currentRank = buildShopLeaderboard(targetRows).find((item) => item.shop_id === id)?.rank || null;

      setShop(shopRow);
      setEmployees(employeeRows);
      setTarget(currentTarget);
      setRank(currentRank);
      setChampionHistory(championRows);
    } catch (err) {
      console.error("Shop profile load error:", err);
      setError("Unable to load shop profile.");
    } finally {
      setLoading(false);
    }
  }, [id, period.month, period.year]);

  useEffect(() => {
    loadShop();
    return subscribeToShopTargets(loadShop);
  }, [loadShop]);

  useEffect(() => {
    return subscribeToShopAssignments(loadShop);
  }, [loadShop]);

  if (loading) {
    return (
      <div className={`rounded-2xl border p-8 text-center ${isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"}`}>
        Loading shop...
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className={`rounded-2xl border p-8 text-center ${isDark ? "border-rose-900 bg-rose-950/40 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
        {error || "Shop not found."}
      </div>
    );
  }

  const achievement = calculateAchievement(target?.target_sales, target?.current_sales);

  return (
    <section className="space-y-5">
      <div className={`rounded-2xl border p-5 shadow-sm ${isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Shop Profile</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{shop.name}</h1>
            <p className={isDark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"}>
              {shop.location || "No location"}
            </p>
          </div>
          <span className="rounded-full bg-[#f6e8ff] px-4 py-2 text-sm font-semibold text-[#c446ff]">
            {rank ? `Shop Rank #${rank}` : "Unranked"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Employee Count" value={formatNumber(employees.length)} isDark={isDark} />
        <Metric label="Current Sales" value={formatNumber(target?.current_sales)} isDark={isDark} />
        <Metric label="Target" value={formatNumber(target?.target_sales)} isDark={isDark} />
        <Metric label="Achievement" value={`${formatNumber(achievement)}%`} isDark={isDark} />
      </div>

      <section className={`rounded-2xl border p-5 shadow-sm ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
        <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-950"}`}>Employees</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {employees.length ? (
            employees.map((employee) => (
              <div key={employee.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-100 bg-slate-50"}`}>
                <Link
                  to={getProfilePath(employee.id, user?.id)}
                  aria-label={`Open ${employee.full_name || employee.email || "employee"} profile`}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[#f6e8ff] text-sm font-bold text-[#c446ff] transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#c446ff]/60"
                >
                  {employee.avatar_url ? (
                    <img src={employee.avatar_url} alt={employee.full_name || employee.email} className="h-full w-full object-cover" />
                  ) : (
                    getInitials(employee.full_name, employee.email)
                  )}
                </Link>
                <Link
                  to={getProfilePath(employee.id, user?.id)}
                  className={`cursor-pointer font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#c446ff]/40 ${isDark ? "text-slate-100 hover:text-sky-300" : "text-slate-800 hover:text-[#c446ff]"}`}
                >
                  {employee.full_name || employee.email || "Unnamed employee"}
                </Link>
              </div>
            ))
          ) : (
            <p className={isDark ? "text-sm text-slate-400" : "text-sm text-slate-500"}>No employees assigned to this shop.</p>
          )}
        </div>
      </section>

      <section className={`rounded-2xl border p-5 shadow-sm ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
        <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-950"}`}>Champion History</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {championHistory.length ? (
            championHistory.map((champion) => (
              <span key={champion.id} className={isDark ? "rounded-full bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-200" : "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"}>
                {formatChampionMonth(champion.month)}
              </span>
            ))
          ) : (
            <p className={isDark ? "text-sm text-slate-400" : "text-sm text-slate-500"}>No shop champion wins yet.</p>
          )}
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value, isDark }) {
  return (
    <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
      <p className={isDark ? "text-xs font-semibold uppercase tracking-[0.18em] text-slate-400" : "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"}>{label}</p>
      <p className={isDark ? "mt-2 text-xl font-semibold text-slate-100" : "mt-2 text-xl font-semibold text-slate-950"}>{value}</p>
    </div>
  );
}

export default ShopProfilePage;

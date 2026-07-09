import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ShopAvatar from "../../components/shops/shop_avatar";
import { buildLeaderboard } from "../../services/leaderboard_service";
import { getSalesTargets } from "../../services/sales_target_service";
import {
  getShopAssignmentEmployees,
  getShopSalesTargets,
  getShops,
  subscribeToShops,
} from "../../services/shop_service";
import { buildShopRankingCards } from "../../services/shop_ranking_service";

const numberFormatter = new Intl.NumberFormat();
const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

const quickActions = [
  { label: "Employee Targets", to: "/admin/sales-targets/employees", icon: "🎯" },
  { label: "Shop Targets", to: "/admin/sales-targets/shops", icon: "🏪" },
  { label: "Shop Management", to: "/admin/manage-shops", icon: "🛠" },
  { label: "Reports", to: "/admin/reports", icon: "📄" },
];

const activityItems = [
  "Shop targets reviewed for the current month.",
  "Employee target updates are ready for approval.",
  "Recognition dashboard refreshed with latest rankings.",
];

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

function formatAchievement(value) {
  return `${formatNumber(value)}%`;
}

function getInitials(name) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "G"
  );
}

function AdminDashboardContent() {
  const period = useMemo(getCurrentPeriod, []);
  const [shops, setShops] = useState([]);
  const [shopTargets, setShopTargets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeTargets, setEmployeeTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [shopRows, shopTargetRows, employeeRows, employeeTargetRows] = await Promise.all([
        getShops(),
        getShopSalesTargets(period),
        getShopAssignmentEmployees(),
        getSalesTargets(period),
      ]);

      setShops(shopRows);
      setShopTargets(shopTargetRows);
      setEmployees(employeeRows);
      setEmployeeTargets(employeeTargetRows);
    } catch (err) {
      console.error("Admin dashboard load error:", err);
      setError(err?.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadDashboard();

    return subscribeToShops(loadDashboard);
  }, [loadDashboard]);

  const shopRanking = useMemo(
    () => buildShopRankingCards(shopTargets, employees),
    [employees, shopTargets]
  );
  const employeeRanking = useMemo(
    () => buildLeaderboard(employeeTargets),
    [employeeTargets]
  );
  const averageAchievement = useMemo(() => {
    if (!shopRanking.length) {
      return 0;
    }

    const total = shopRanking.reduce((sum, shop) => sum + Number(shop.achievement || 0), 0);
    return Math.round(total / shopRanking.length);
  }, [shopRanking]);
  const topShop = shopRanking[0] || null;
  const periodLabel = monthFormatter.format(new Date(period.year, period.month - 1, 1));

  if (loading) {
    return (
      <section className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        Loading dashboard...
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Management Dashboard</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Company Overview</h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">{periodLabel}</p>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewCard label="Total Shops" value={formatNumber(shops.length)} />
          <OverviewCard label="Total Employees" value={formatNumber(employees.length)} />
          <OverviewCard label="Average Achievement" value={formatAchievement(averageAchievement)} />
          <OverviewCard label="Top Shop" value={topShop?.shopName || "--"} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardPanel title="Top Shop Ranking" subtitle="Top 3 shops by achievement">
          <div className="space-y-3">
            {shopRanking.slice(0, 3).map((shop) => (
              <ShopRankRow key={shop.id} shop={shop} />
            ))}
            {!shopRanking.length ? <EmptyText>No shop ranking data for this month.</EmptyText> : null}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Top Employee Ranking" subtitle="Top 3 employees by individual targets">
          <div className="space-y-3">
            {employeeRanking.slice(0, 3).map((employee) => (
              <EmployeeRankRow key={employee.id} employee={employee} />
            ))}
            {!employeeRanking.length ? <EmptyText>No employee ranking data for this month.</EmptyText> : null}
          </div>
        </DashboardPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardPanel title="Monthly Trend" subtitle="Performance movement preview">
          <PlaceholderChart />
        </DashboardPanel>

        <DashboardPanel title="Recent Activity" subtitle="Latest management signals">
          <div className="space-y-3">
            {activityItems.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f6e8ff] text-sm font-bold text-[#c446ff]">
                  {index + 1}
                </span>
                <p className="text-sm font-medium text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </div>

      <DashboardPanel title="Quick Actions" subtitle="Jump into common management workflows">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#c446ff] hover:bg-[#fdf7ff]"
            >
              <span className="text-2xl" aria-hidden="true">{action.icon}</span>
              <p className="mt-3 text-sm font-bold text-slate-950 group-hover:text-[#c446ff]">{action.label}</p>
            </Link>
          ))}
        </div>
      </DashboardPanel>
    </section>
  );
}

function OverviewCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 break-words text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function DashboardPanel({ children, subtitle, title }) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ShopRankRow({ shop }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <RankBadge rank={shop.rank} />
      <ShopAvatar src={shop.shopAvatarUrl} name={shop.shopName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-950">{shop.shopName}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{formatNumber(shop.employeeCount)} employees</p>
      </div>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        {formatAchievement(shop.achievement)}
      </span>
    </div>
  );
}

function EmployeeRankRow({ employee }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <RankBadge rank={employee.rank} />
      <Avatar name={employee.displayName} src={employee.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-950">{employee.displayName}</p>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{employee.email || "Employee"}</p>
      </div>
      <span className="rounded-full bg-[#f6e8ff] px-3 py-1 text-xs font-bold text-[#c446ff]">
        {formatAchievement(employee.achievement)}
      </span>
    </div>
  );
}

function RankBadge({ rank }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
      #{rank}
    </span>
  );
}

function Avatar({ name, src }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6e8ff] text-sm font-bold text-[#c446ff]">
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : getInitials(name)}
    </div>
  );
}

function PlaceholderChart() {
  const bars = [45, 62, 56, 78, 72, 88];

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
      <div className="flex h-48 items-end gap-3">
        {bars.map((height, index) => (
          <div key={height} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-t-2xl bg-gradient-to-t from-[#c446ff] to-violet-300"
              style={{ height: `${height}%` }}
            />
            <span className="text-xs font-semibold text-slate-400">M{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyText({ children }) {
  return <p className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{children}</p>;
}

export default AdminDashboardContent;

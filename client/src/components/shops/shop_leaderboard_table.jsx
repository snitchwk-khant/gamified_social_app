import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import { getProfilePath } from "../../utils/profile_path";
import { getShopPath } from "../../utils/shop_path";

const numberFormatter = new Intl.NumberFormat();

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatRank(rank) {
  return `#${rank}`;
}

function getRankBadgeClass(isDark) {
  return isDark ? "bg-slate-900 text-slate-300" : "bg-slate-100 text-slate-600";
}

function getProgressWidth(achievement) {
  return `${Math.min(100, Math.max(0, Number(achievement || 0)))}%`;
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

function ShopLeaderboardTable({ rows = [], isDark = false }) {
  const navigate = useNavigate();

  const handleOpenShop = (event, shopId) => {
    if (event.target.closest("a")) {
      return;
    }

    navigate(getShopPath(shopId));
  };

  return (
    <div className="space-y-3">
      {rows.map((target) => (
        <div
          key={target.id}
          role="link"
          tabIndex={0}
          onClick={(event) => handleOpenShop(event, target.shop_id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              navigate(getShopPath(target.shop_id));
            }
          }}
          className={`cursor-pointer rounded-3xl border p-4 transition hover:-translate-y-0.5 hover:border-[#c446ff]/50 ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <Link
              to={getShopPath(target.shop_id)}
              className={`min-w-0 truncate text-xl font-bold transition hover:text-[#c446ff] ${isDark ? "text-slate-100" : "text-slate-950"}`}
            >
              🏪 {target.shopName}
            </Link>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${getRankBadgeClass(isDark)}`}>
              {formatRank(target.rank)}
            </span>
          </div>
          <div className="mt-4">
            <AvatarGroup employees={target.employees} isDark={isDark} size="sm" />
          </div>
          <div className="mt-4">
            <p className={isDark ? "text-xs font-semibold text-slate-400" : "text-xs font-semibold text-slate-500"}>Progress</p>
            <div className={`mt-2 h-2.5 overflow-hidden rounded-full ${isDark ? "bg-slate-900" : "bg-slate-100"}`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#c446ff] to-sky-400"
                style={{ width: getProgressWidth(target.achievement) }}
              />
            </div>
            <p className={`mt-2 text-center text-2xl font-black leading-none ${isDark ? "text-slate-100" : "text-slate-950"}`}>
              {formatNumber(target.achievement)}%
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ShopLeaderboardTable;

export function AvatarGroup({ employees = [], isDark = false, size = "md" }) {
  const { user } = useAuth();
  const avatarSizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-12 w-12 text-sm";

  return (
    <div className={size === "sm" ? "flex min-h-8 items-center" : "flex min-h-12 items-center"}>
      <div className={size === "sm" ? "flex -space-x-2" : "flex -space-x-3"}>
        {employees.map((employee) => {
          const employeeName = employee.full_name || employee.email || "Employee";

          return (
            <Link
              to={getProfilePath(employee.id, user?.id)}
              key={employee.id}
              className={`relative flex ${avatarSizeClass} cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 bg-[#f6e8ff] font-bold text-[#c446ff] shadow-sm transition hover:z-10 hover:-translate-y-0.5 focus:z-10 focus:outline-none focus:ring-2 focus:ring-[#c446ff]/60 ${
                isDark ? "border-slate-950" : "border-white"
              }`}
              aria-label={`Open ${employeeName} profile`}
              title={employeeName}
            >
              {employee.avatar_url ? (
                <img src={employee.avatar_url} alt={employeeName} className="h-full w-full object-cover" />
              ) : (
                getInitials(employee.full_name, employee.email)
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

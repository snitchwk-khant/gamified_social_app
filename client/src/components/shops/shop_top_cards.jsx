import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import { getProfilePath } from "../../utils/profile_path";
import { getShopPath } from "../../utils/shop_path";

const numberFormatter = new Intl.NumberFormat();

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatRank(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return rank;
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

function ShopTopCards({ rows = [], isDark = false }) {
  const navigate = useNavigate();

  if (!rows.length) {
    return null;
  }

  const handleOpenShop = (event, shopId) => {
    if (event.target.closest("a")) {
      return;
    }

    navigate(getShopPath(shopId));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
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
          className={`cursor-pointer rounded-2xl border p-5 transition hover:-translate-y-0.5 ${
            isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <Link
              to={getShopPath(target.shop_id)}
              className={`min-w-0 truncate text-lg font-semibold transition hover:text-[#c446ff] ${isDark ? "text-slate-100" : "text-slate-950"}`}
            >
              {target.shopName}
            </Link>
            <span className="shrink-0 text-3xl">{formatRank(target.rank)}</span>
          </div>
          <div className="mt-5 space-y-4">
            <AvatarGroup employees={target.employees} isDark={isDark} />
            <div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAchievementClass(target.achievement, isDark)}`}>
                {formatNumber(target.achievement)}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ShopTopCards;

function AvatarGroup({ employees = [], isDark = false }) {
  const { user } = useAuth();
  const visibleEmployees = employees.slice(0, 3);
  const hiddenCount = Math.max(0, employees.length - visibleEmployees.length);

  return (
    <div className="flex items-center">
      <div className="flex -space-x-3">
        {visibleEmployees.map((employee) => {
          const employeeName = employee.full_name || employee.email || "Employee";

          return (
            <Link
              to={getProfilePath(employee.id, user?.id)}
              key={employee.id}
              className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 bg-[#f6e8ff] text-sm font-bold text-[#c446ff] shadow-sm ${
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
      {hiddenCount ? (
        <span
          className={`ml-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
          }`}
        >
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import { getProfilePath } from "../../utils/profile_path";
import { getShopPath } from "../../utils/shop_path";

const numberFormatter = new Intl.NumberFormat();

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
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

function formatRank(rank) {
  return `#${rank}`;
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
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[680px] w-full text-left text-sm">
        <thead
          className={`border-b text-xs uppercase tracking-[0.18em] ${
            isDark ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-500"
          }`}
        >
          <tr>
            <th className="px-4 py-3 font-semibold">Rank</th>
            <th className="px-4 py-3 font-semibold">Shop Name</th>
            <th className="px-4 py-3 font-semibold">Employee Avatar Group</th>
            <th className="px-4 py-3 text-right font-semibold">Achievement %</th>
          </tr>
        </thead>
        <tbody className={isDark ? "divide-y divide-slate-800" : "divide-y divide-slate-100"}>
          {rows.map((target) => (
            <tr key={target.id} className={isDark ? "text-slate-300" : "text-slate-700"}>
              <td className="px-4 py-4 font-semibold">{formatRank(target.rank)}</td>
              <td className={`px-4 py-4 font-semibold ${isDark ? "text-slate-100" : "text-slate-950"}`}>
                <Link to={getShopPath(target.shop_id)} className="transition hover:text-[#c446ff]">
                  {target.shopName}
                </Link>
              </td>
              <td className="px-4 py-4">
                <AvatarGroup employees={target.employees} isDark={isDark} />
              </td>
              <td className="px-4 py-4 text-right">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAchievementClass(target.achievement, isDark)}`}>
                  {formatNumber(target.achievement)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ShopLeaderboardTable;

function AvatarGroup({ employees = [], isDark = false }) {
  const { user } = useAuth();
  const visibleEmployees = employees.slice(0, 3);
  const hiddenCount = Math.max(0, employees.length - visibleEmployees.length);

  return (
    <div className="flex min-h-12 items-center">
      <div className="flex -space-x-3">
        {visibleEmployees.map((employee) => {
          const employeeName = employee.full_name || employee.email || "Employee";

          return (
            <Link
              to={getProfilePath(employee.id, user?.id)}
              key={employee.id}
              className={`relative flex h-12 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 bg-[#f6e8ff] text-sm font-bold text-[#c446ff] shadow-sm transition hover:z-10 hover:-translate-y-0.5 focus:z-10 focus:outline-none focus:ring-2 focus:ring-[#c446ff]/60 ${
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

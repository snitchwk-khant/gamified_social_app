import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/auth_context";
import { useTheme } from "../context/theme_context";
import { getMockShopProfile } from "../mocks/shop_profile_mock";
import { getProfilePath } from "../utils/profile_path";

const tabs = ["Recognition", "Employees", "History", "Records"];

function getInitials(name) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "S"
  );
}

function getEmployeeName(employee) {
  return employee?.name || employee?.full_name || employee?.email || "Employee";
}

function ShopProfilePage() {
  const { id, shopId } = useParams();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("Recognition");
  const routeShopId = shopId || id;
  const profileData = useMemo(() => getMockShopProfile(routeShopId), [routeShopId]);

  return (
    <section className="space-y-5">
      <HeroHeader shop={profileData} isDark={isDark} userId={user?.id} />
      <EmployeeOfTheMonthCard employee={profileData.employeeOfMonth} isDark={isDark} userId={user?.id} />

      <div className={`rounded-2xl border p-2 ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4 ${
                activeTab === tab
                  ? "bg-[#c446ff] text-white"
                  : isDark
                    ? "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Recognition" ? <RecognitionTab shop={profileData} isDark={isDark} /> : null}
      {activeTab === "Employees" ? <EmployeesTab employees={profileData.employees} isDark={isDark} userId={user?.id} /> : null}
      {activeTab === "History" ? <HistoryTab items={profileData.history} isDark={isDark} userId={user?.id} /> : null}
      {activeTab === "Records" ? <RecordsTab records={profileData.records} isDark={isDark} /> : null}
    </section>
  );
}

function HeroHeader({ shop, isDark, userId }) {
  return (
    <section
      className={`overflow-hidden rounded-[28px] border p-5 shadow-sm ${
        isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[26px] bg-gradient-to-br from-[#c446ff] to-violet-600 text-3xl font-black text-white shadow-lg shadow-fuchsia-900/20">
            {getInitials(shop.name)}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Shop Recognition</p>
            <h1 className="mt-2 text-3xl font-bold">{shop.name}</h1>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge label={`${shop.achievement} Achievement`} isDark={isDark} />
              <Badge label={`${shop.rank} Current Rank`} isDark={isDark} />
            </div>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <AvatarGroup employees={shop.employees} isDark={isDark} size="lg" userId={userId} />
        </div>
      </div>
    </section>
  );
}

function EmployeeOfTheMonthCard({ employee, isDark, userId }) {
  if (!employee) {
    return null;
  }

  return (
    <section
      className={`overflow-hidden rounded-[28px] border p-5 shadow-sm ${
        isDark
          ? "border-amber-500/30 bg-amber-950/20 text-slate-100"
          : "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-[#f6e8ff] text-slate-950"
      }`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <EmployeeAvatar employee={employee} isDark={isDark} sizeClass="h-24 w-24" userId={userId} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-500">⭐ Employee of the Month</p>
            <Link
              to={getProfilePath(employee.id, userId)}
              className={`mt-2 block truncate text-2xl font-bold transition hover:text-[#c446ff] ${isDark ? "text-slate-100" : "text-slate-950"}`}
            >
              {employee.name}
            </Link>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${isDark ? "bg-emerald-950 text-emerald-200" : "bg-emerald-50 text-emerald-700"}`}>
                {employee.achievement} Achievement
              </span>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-700"}`}>
                {employee.month}
              </span>
            </div>
          </div>
        </div>
        <span className={`self-center rounded-full px-4 py-2 text-sm font-bold ${isDark ? "bg-amber-500/20 text-amber-200" : "bg-amber-100 text-amber-700"}`}>
          {employee.badge}
        </span>
      </div>
    </section>
  );
}

function RecognitionTab({ shop, isDark }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="Highest Achievement" value={shop.highestAchievement} isDark={isDark} />
      <SummaryCard label="Champion Count" value={`${shop.championCount}x`} isDark={isDark} />
      <SummaryCard label="Best Month" value={shop.bestMonth} isDark={isDark} />
      <SummaryCard label="Current Champion" value={shop.currentChampion} isDark={isDark} />
    </section>
  );
}

function EmployeesTab({ employees, isDark, userId }) {
  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-950"}`}>Employees</h2>
        <p className={`text-sm font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {employees.length} Members
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {employees.map((employee) => (
          <div
            key={employee.id}
            className={`flex items-center gap-3 rounded-2xl border p-4 transition hover:border-[#c446ff]/50 ${
              isDark ? "border-slate-800 bg-slate-900" : "border-slate-100 bg-slate-50"
            }`}
          >
            <EmployeeAvatar employee={employee} isDark={isDark} userId={userId} />
            <div className="min-w-0">
              <Link
                to={getProfilePath(employee.id, userId)}
                className={`block truncate text-sm font-semibold transition hover:text-[#c446ff] ${isDark ? "text-slate-100" : "text-slate-900"}`}
              >
                {getEmployeeName(employee)}
              </Link>
              <p className={isDark ? "mt-1 truncate text-xs text-slate-400" : "mt-1 truncate text-xs text-slate-500"}>
                {employee.role}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoryTab({ items, isDark, userId }) {
  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
      <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-950"}`}>History</h2>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="h-3 w-3 rounded-full bg-[#c446ff]" />
              <span className={isDark ? "mt-1 h-full w-px bg-slate-800" : "mt-1 h-full w-px bg-slate-200"} />
            </div>
            <div className={`flex-1 rounded-2xl border p-4 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-100 bg-slate-50"}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{item.label}</p>
                  <p className={isDark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"}>
                    {item.achievement} Achievement
                  </p>
                  <p className={isDark ? "mt-3 text-sm text-slate-300" : "mt-3 text-sm text-slate-600"}>
                    {item.notes}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <AvatarGroup employees={item.employees} isDark={isDark} userId={userId} />
                  <div className={`rounded-2xl px-3 py-2 ${isDark ? "bg-slate-950" : "bg-white"}`}>
                    <p className={isDark ? "text-xs font-semibold text-slate-500" : "text-xs font-semibold text-slate-400"}>
                      Employee of the Month
                    </p>
                    <p className={isDark ? "mt-1 text-sm font-semibold text-slate-100" : "mt-1 text-sm font-semibold text-slate-900"}>
                      {getEmployeeName(item.employeeOfMonth)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecordsTab({ records, isDark }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="Highest Score" value={records.highestScore} isDark={isDark} />
      <SummaryCard label="Best Employee" value={records.bestEmployee} isDark={isDark} />
      <SummaryCard label="Champion Count" value={records.championCount} isDark={isDark} />
      <SummaryCard label="Best Month" value={records.bestMonth} isDark={isDark} />
    </section>
  );
}

function SummaryCard({ label, value, isDark }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-3 break-words text-2xl font-semibold ${isDark ? "text-slate-100" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function Badge({ label, isDark }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isDark ? "bg-slate-900 text-slate-200" : "bg-[#f6e8ff] text-[#c446ff]"}`}>
      {label}
    </span>
  );
}

function AvatarGroup({ employees = [], isDark = false, size = "md", userId = "" }) {
  const visibleEmployees = employees.slice(0, 3);
  const hiddenCount = Math.max(0, employees.length - visibleEmployees.length);
  const sizeClass = size === "lg" ? "h-14 w-14" : "h-11 w-11";

  return (
    <div className="flex min-h-12 items-center">
      <div className="flex -space-x-3">
        {visibleEmployees.map((employee) => (
          <EmployeeAvatar key={employee.id} employee={employee} isDark={isDark} sizeClass={sizeClass} userId={userId} />
        ))}
      </div>
      {hiddenCount ? (
        <span className={`ml-2 rounded-full px-2.5 py-1 text-xs font-semibold ${isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"}`}>
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function EmployeeAvatar({ employee, isDark = false, sizeClass = "h-11 w-11", userId = "" }) {
  const employeeName = getEmployeeName(employee);
  const avatarUrl = employee?.avatarUrl || employee?.avatar_url;

  return (
    <Link
      to={getProfilePath(employee.id, userId)}
      aria-label={`Open ${employeeName} profile`}
      className={`flex ${sizeClass} cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 bg-[#f6e8ff] text-sm font-bold text-[#c446ff] shadow-sm transition hover:z-10 hover:-translate-y-0.5 focus:z-10 focus:outline-none focus:ring-2 focus:ring-[#c446ff]/60 ${
        isDark ? "border-slate-950" : "border-white"
      }`}
      title={employeeName}
    >
      {avatarUrl ? <img src={avatarUrl} alt={employeeName} className="h-full w-full object-cover" /> : getInitials(employeeName)}
    </Link>
  );
}

export default ShopProfilePage;

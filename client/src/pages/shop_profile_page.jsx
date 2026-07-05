import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/auth_context";
import { useTheme } from "../context/theme_context";
import { getMockShopProfile } from "../mocks/shop_profile_mock";
import {
  getSharedShopHistoryRecords,
  getShopById,
  getShopEmployees,
  subscribeToShopAssignments,
  subscribeToShopHistoryEmployees,
  subscribeToShopTargets,
} from "../services/shop_service";
import {
  calculateChampionCount,
  calculateCurrentRank,
  calculateEmployeeOfTheMonth,
  calculateHighestAchievement,
} from "../services/shop_history_calculation_service";
import { getSalesTargets } from "../services/sales_target_service";
import { getProfilePath } from "../utils/profile_path";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function getAchievementNumber(value) {
  return Math.max(0, Number.parseFloat(value) || 0);
}

function formatChampionCount(value) {
  const championCount = Number.parseInt(value, 10);

  if (Number.isNaN(championCount) || championCount < 1) {
    return "0x";
  }

  return `${championCount}x`;
}

function formatHistoryMonth(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function formatAchievement(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function formatOptionalAchievement(value) {
  if (value == null || value === "") {
    return null;
  }

  return formatAchievement(value);
}

function getHistoryLabel(record) {
  return new Date(Number(record.year), Number(record.month) - 1, 1).toISOString();
}

function mapSharedHistoryToProfileItems(records = []) {
  return records.map((record) => ({
    achievement: formatAchievement(record.achievement_percent),
    employees: record.employees || [],
    id: record.id,
    label: getHistoryLabel(record),
  }));
}

function getBestHistoryRecord(records = []) {
  return records.reduce((bestRecord, record) => {
    if (!bestRecord) {
      return record;
    }

    return getAchievementNumber(record.achievement_percent) > getAchievementNumber(bestRecord.achievement_percent) ? record : bestRecord;
  }, null);
}

function ShopProfilePage() {
  const { id, shopId } = useParams();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const routeShopId = shopId || id;
  const mockProfileData = useMemo(() => getMockShopProfile(routeShopId), [routeShopId]);
  const [currentEmployees, setCurrentEmployees] = useState(null);
  const [employeeTargets, setEmployeeTargets] = useState([]);
  const [shopRecord, setShopRecord] = useState(null);
  const [sharedHistoryRecords, setSharedHistoryRecords] = useState(null);
  const [allSharedHistoryRecords, setAllSharedHistoryRecords] = useState(null);
  const [historyItems, setHistoryItems] = useState(null);
  const shouldLoadSharedHistory = uuidPattern.test(routeShopId || "");

  useEffect(() => {
    if (!shouldLoadSharedHistory) {
      setCurrentEmployees(null);
      setShopRecord(null);
      setAllSharedHistoryRecords(null);
      setHistoryItems(null);
      return undefined;
    }

    let isMounted = true;

    async function loadSharedShopHistory() {
      try {
        const [shop, historyRecords, shopEmployees, employeeTargetRows] = await Promise.all([
          getShopById(routeShopId),
          getSharedShopHistoryRecords(),
          getShopEmployees(routeShopId),
          getSalesTargets(),
        ]);
        const selectedShopHistoryRecords = historyRecords.filter((record) => record.shop_id === routeShopId);

        if (isMounted) {
          setCurrentEmployees(shopEmployees);
          setEmployeeTargets(employeeTargetRows);
          setShopRecord(shop);
          setSharedHistoryRecords(selectedShopHistoryRecords);
          setAllSharedHistoryRecords(historyRecords);
          setHistoryItems(mapSharedHistoryToProfileItems(selectedShopHistoryRecords));
        }
      } catch (err) {
        console.error("Shop profile history load error:", err);

        if (isMounted) {
          setCurrentEmployees([]);
          setEmployeeTargets([]);
          setShopRecord(null);
          setSharedHistoryRecords([]);
          setAllSharedHistoryRecords([]);
          setHistoryItems([]);
        }
      }
    }

    loadSharedShopHistory();

    const unsubscribeTargets = subscribeToShopTargets(loadSharedShopHistory);
    const unsubscribeHistoryEmployees = subscribeToShopHistoryEmployees((payload) => {
      const row = payload.new || payload.old;

      if (row?.shop_id === routeShopId) {
        loadSharedShopHistory();
      }
    });
    const unsubscribeShopAssignments = subscribeToShopAssignments((payload) => {
      const oldShopId = payload.old?.shop_id;
      const newShopId = payload.new?.shop_id;

      if (oldShopId === routeShopId || newShopId === routeShopId) {
        loadSharedShopHistory();
      }
    });

    return () => {
      isMounted = false;
      unsubscribeTargets();
      unsubscribeHistoryEmployees();
      unsubscribeShopAssignments();
    };
  }, [routeShopId, shouldLoadSharedHistory]);

  const latestHistoryRecord = sharedHistoryRecords?.[0];
  const latestAchievement = formatOptionalAchievement(latestHistoryRecord?.achievement_percent);
  const shopProfileCalculations = useMemo(() => {
    const employeeOfMonthTarget = latestHistoryRecord
      ? calculateEmployeeOfTheMonth({
          employeeTargets,
          employees: currentEmployees || [],
          month: latestHistoryRecord.month,
          shopId: routeShopId,
          year: latestHistoryRecord.year,
        })
      : null;
    const highestAchievement = latestHistoryRecord
      ? calculateHighestAchievement({
          employeeTargets,
          employees: currentEmployees || [],
          month: latestHistoryRecord.month,
          shopId: routeShopId,
          year: latestHistoryRecord.year,
        })
      : 0;
    const currentRank = latestHistoryRecord
      ? calculateCurrentRank(
          routeShopId,
          (allSharedHistoryRecords || []).filter((record) => {
            return String(record.month) === String(latestHistoryRecord.month) && String(record.year) === String(latestHistoryRecord.year);
          })
        )
      : null;

    return {
      championCount: calculateChampionCount(routeShopId, sharedHistoryRecords || []),
      currentRank,
      employeeOfMonth: employeeOfMonthTarget?.profile
        ? {
            ...employeeOfMonthTarget.profile,
            achievement: formatAchievement(employeeOfMonthTarget.achievement),
          }
        : null,
      highestAchievement: highestAchievement ? formatAchievement(highestAchievement) : null,
    };
  }, [allSharedHistoryRecords, currentEmployees, employeeTargets, latestHistoryRecord, routeShopId, sharedHistoryRecords]);
  const profileData = useMemo(
    () => {
      return {
        ...mockProfileData,
        achievement: latestAchievement || mockProfileData.achievement,
        bestMonth: latestHistoryRecord ? formatHistoryMonth(getHistoryLabel(latestHistoryRecord)) : mockProfileData.bestMonth,
        championCount: shopProfileCalculations.championCount,
        employeeOfMonth: shopProfileCalculations.employeeOfMonth || mockProfileData.employeeOfMonth,
        employees: currentEmployees ?? mockProfileData.employees,
        highestAchievement: shopProfileCalculations.highestAchievement || mockProfileData.highestAchievement,
        name: shopRecord?.name || mockProfileData.name,
        rank: shopProfileCalculations.currentRank ? `#${shopProfileCalculations.currentRank}` : mockProfileData.rank,
      };
    },
    [currentEmployees, latestAchievement, latestHistoryRecord, mockProfileData, shopProfileCalculations, shopRecord]
  );
  const monthlyHistoryItems = historyItems ?? mockProfileData.history;
  const bestOfMonth = useMemo(() => {
    const bestRecord = getBestHistoryRecord(sharedHistoryRecords || []);

    if (bestRecord) {
      return {
        achievement: formatAchievement(bestRecord.achievement_percent),
        month: formatHistoryMonth(getHistoryLabel(bestRecord)),
      };
    }

    const bestMockRecord = [...mockProfileData.history].sort(
      (first, second) => getAchievementNumber(second.achievement) - getAchievementNumber(first.achievement)
    )[0];

    if (!bestMockRecord) {
      return null;
    }

    return {
      achievement: bestMockRecord.achievement,
      month: formatHistoryMonth(bestMockRecord.label),
    };
  }, [mockProfileData.history, sharedHistoryRecords]);

  return (
    <section className="space-y-6">
      <ShopHeader shop={profileData} isDark={isDark} userId={user?.id} />
      <ProgressSection shop={profileData} isDark={isDark} />
      <BestOfTheMonthSection bestOfMonth={bestOfMonth} employees={profileData.employees} isDark={isDark} userId={user?.id} />
      <MonthlyHistorySection items={monthlyHistoryItems} isDark={isDark} userId={user?.id} />
    </section>
  );
}

function ShopHeader({ shop, isDark, userId }) {
  return (
    <section
      className={`overflow-hidden rounded-[30px] border p-5 shadow-2xl sm:p-7 ${
        isDark ? "border-slate-800 bg-slate-950 text-slate-100 shadow-slate-950/20" : "border-slate-200 bg-white text-slate-950 shadow-slate-200/70"
      }`}
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[34px] bg-gradient-to-br from-[#c446ff] via-fuchsia-500 to-violet-700 text-4xl font-black text-white shadow-2xl shadow-fuchsia-900/30 sm:h-32 sm:w-32">
            {getInitials(shop.name)}
          </div>

          <div className="min-w-0">
            <h1 className="break-words text-4xl font-black leading-tight sm:text-5xl">{shop.name}</h1>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MetricBlock label="Champion Count" value={formatChampionCount(shop.championCount)} isDark={isDark} />
              <MetricBlock label="Current Rank" value={shop.rank} isDark={isDark} />
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

function ProgressSection({ shop, isDark }) {
  const progressWidth = `${Math.min(100, getAchievementNumber(shop.achievement))}%`;

  return (
    <section
      className={`rounded-[30px] border p-5 shadow-xl sm:p-6 ${
        isDark ? "border-slate-800 bg-slate-950 text-slate-100 shadow-slate-950/20" : "border-slate-200 bg-white text-slate-950 shadow-slate-200/70"
      }`}
    >
      <div className="mb-5">
        <p className={`text-sm font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Achievement</p>
        <p className="mt-1 text-3xl font-black text-[#c446ff]">{shop.achievement}</p>
      </div>
      <div className={`h-2.5 overflow-hidden rounded-full ${isDark ? "bg-slate-900" : "bg-slate-100"}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#c446ff] to-fuchsia-400 shadow-[0_0_24px_rgba(196,70,255,0.45)] transition-[width] duration-700 ease-out"
          style={{ width: progressWidth }}
        />
      </div>
    </section>
  );
}

function BestOfTheMonthSection({ bestOfMonth, employees = [], isDark, userId }) {
  return (
    <section
      className={`relative overflow-hidden rounded-[30px] border p-6 text-center shadow-2xl transition duration-300 hover:-translate-y-0.5 sm:p-7 ${
        isDark ? "border-slate-800 bg-slate-950 text-slate-100 shadow-slate-950/20" : "border-slate-200 bg-white text-slate-950 shadow-slate-200/70"
      }`}
    >
      <div className="relative">
        <h2 className="text-xl font-bold">Best of the Month</h2>

        {bestOfMonth ? (
          <div className="mt-6 flex flex-col items-center">
            <div className="px-4 py-3">
              <AvatarGroup employees={employees} isDark={isDark} userId={userId} size="team" maxVisible={6} />
            </div>

            <p className="mt-5 text-4xl font-black text-[#c446ff]">{bestOfMonth.achievement}</p>
            <p className={`mt-2 text-sm font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{bestOfMonth.month}</p>
          </div>
        ) : (
          <p className={`mt-5 text-sm font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>No history yet</p>
        )}
      </div>
    </section>
  );
}

function MonthlyHistorySection({ items, isDark, userId }) {
  const sortedItems = [...items].sort((first, second) => new Date(second.label).getTime() - new Date(first.label).getTime());

  return (
    <section
      className={`rounded-[30px] border p-5 shadow-2xl sm:p-6 ${
        isDark ? "border-slate-800 bg-slate-950 text-slate-100 shadow-slate-950/20" : "border-slate-200 bg-white text-slate-950 shadow-slate-200/70"
      }`}
    >
      <h2 className="text-xl font-bold">Monthly Performance</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-y-3 text-left text-sm">
          <thead className={isDark ? "text-slate-400" : "text-slate-500"}>
            <tr className="text-xs uppercase tracking-[0.18em]">
              <th className="px-3 py-3 font-semibold sm:px-4">Month</th>
              <th className="px-3 py-3 font-semibold sm:px-4">Employees</th>
              <th className="px-3 py-3 text-right font-semibold sm:px-4">Achievement %</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item) => (
              <tr
                key={item.id}
                className={`transition duration-200 hover:-translate-y-0.5 ${
                  isDark ? "bg-slate-900/80 text-slate-200 hover:bg-slate-900" : "bg-slate-50 text-slate-700 hover:bg-white"
                }`}
              >
                <td className="rounded-l-2xl px-3 py-4 font-semibold sm:px-4">{formatHistoryMonth(item.label)}</td>
                <td className="px-3 py-4 sm:px-4">
                  <AvatarGroup employees={item.employees} isDark={isDark} userId={userId} compact />
                </td>
                <td className="rounded-r-2xl px-3 py-4 text-right font-bold text-[#c446ff] sm:px-4">{item.achievement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetricBlock({ label, value, isDark }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-100 bg-[#f6e8ff]"}`}>
      <p className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className="mt-1 text-xl font-black text-[#c446ff]">{value}</p>
    </div>
  );
}

function AvatarGroup({ employees = [], isDark = false, size = "md", userId = "", compact = false, maxVisible = 5 }) {
  const visibleEmployees = employees.slice(0, maxVisible);
  const hiddenCount = Math.max(0, employees.length - visibleEmployees.length);
  const sizeClass = size === "lg" ? "h-14 w-14" : size === "team" ? "h-12 w-12" : compact ? "h-9 w-9 text-xs" : "h-10 w-10";

  return (
    <div className="flex min-h-10 items-center">
      <div className="flex -space-x-2.5">
        {visibleEmployees.map((employee) => (
          <EmployeeAvatar key={employee.id} employee={employee} isDark={isDark} sizeClass={sizeClass} userId={userId} />
        ))}
      </div>
      {hiddenCount ? (
        <span className={`ml-2 flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-xs font-bold ${isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"}`}>
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function EmployeeAvatar({ employee, isDark = false, sizeClass = "h-10 w-10", userId = "", accentBorder = false }) {
  const employeeName = getEmployeeName(employee);
  const avatarUrl = employee?.avatarUrl || employee?.avatar_url;

  return (
    <Link
      to={getProfilePath(employee.id, userId)}
      aria-label={`Open ${employeeName} profile`}
      className={`relative flex ${sizeClass} cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 bg-[#f6e8ff] text-sm font-bold text-[#c446ff] shadow-sm transition hover:z-10 hover:-translate-y-0.5 active:scale-95 focus:z-10 focus:outline-none focus:ring-2 focus:ring-[#c446ff]/60 ${
        accentBorder ? "border-[#c446ff]" : isDark ? "border-slate-950" : "border-white"
      }`}
      title={employeeName}
    >
      {avatarUrl ? <img src={avatarUrl} alt={employeeName} className="h-full w-full object-cover" /> : getInitials(employeeName)}
    </Link>
  );
}

export default ShopProfilePage;

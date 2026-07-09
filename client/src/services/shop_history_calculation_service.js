import {
  buildPerformanceRanking,
  calculateAchievement as baseCalculateAchievement,
} from "./ranking_service";

function isSamePeriod(target, month, year) {
  return String(target?.month) === String(month) && String(target?.year) === String(year);
}

function getShopEmployeeIds(employees = [], shopId) {
  if (!shopId) {
    return new Set();
  }

  return new Set(
    employees
      .filter((employee) => (employee.current_shop_id || employee.shop_id) === shopId)
      .map((employee) => employee.id)
  );
}

function getRankedEmployeeTargets({ employees = [], employeeTargets = [], month, shopId, year }) {
  const shopEmployeeIds = getShopEmployeeIds(employees, shopId);

  if (!shopEmployeeIds.size) {
    return [];
  }

  return employeeTargets
    .filter((target) => shopEmployeeIds.has(target.user_id) && isSamePeriod(target, month, year))
    .map((target) => ({
      ...target,
      achievement: calculateAchievement(target.target_sales, target.current_sales),
    }))
    .sort((left, right) => {
      if (right.achievement !== left.achievement) {
        return right.achievement - left.achievement;
      }

      return Number(right.current_sales || 0) - Number(left.current_sales || 0);
    });
}

export function calculateAchievement(targetSales, currentSales) {
  return baseCalculateAchievement(targetSales, currentSales);
}

export function calculateChampionCount(shopId, historyRecords = []) {
  return historyRecords.filter((record) => {
    if (shopId && record.shop_id !== shopId) {
      return false;
    }

    const achievement = record.achievement_percent ?? calculateAchievement(record.target_sales, record.current_sales);

    return Number(achievement || 0) >= 100;
  }).length;
}

export function buildShopHistoryRanking(historyRecords = [], { searchTerm = "" } = {}) {
  return buildPerformanceRanking(
    historyRecords.map((record) => {
      const achievement = record.achievement_percent ?? calculateAchievement(record.target_sales, record.current_sales);

      return {
        ...record,
        current_sales: achievement,
        target_sales: 100,
      };
    }),
    {
      searchTerm,
      useUpdatedAtTieBreaker: true,
      getName: (record) => record.shop?.name || "Unnamed shop",
    }
  ).map((record) => ({
    ...record,
    achievement: record.achievement_percent ?? record.achievement,
    shopAvatarUrl: record.shop?.avatar_url || record.shop?.avatarUrl || null,
    shopName: record.shop?.name || "Unnamed shop",
  }));
}

export function calculateCurrentRank(shopId, historyRecords = []) {
  const rankedRecord = buildShopHistoryRanking(historyRecords).find((record) => record.shop_id === shopId);

  return rankedRecord?.rank || null;
}

export function calculateHighestAchievement({ employees = [], employeeTargets = [], month, shopId, year }) {
  const [topTarget] = getRankedEmployeeTargets({
    employees,
    employeeTargets,
    month,
    shopId,
    year,
  });

  return topTarget?.achievement || 0;
}

export function calculateEmployeeOfTheMonth({ employees = [], employeeTargets = [], month, shopId, year }) {
  const [topTarget] = getRankedEmployeeTargets({
    employees,
    employeeTargets,
    month,
    shopId,
    year,
  });

  return topTarget || null;
}

export function getShopHistoryEmployeeIds(employees = [], shopId) {
  return [...getShopEmployeeIds(employees, shopId)];
}

export default {
  calculateAchievement,
  calculateChampionCount,
  calculateCurrentRank,
  calculateEmployeeOfTheMonth,
  calculateHighestAchievement,
  buildShopHistoryRanking,
  getShopHistoryEmployeeIds,
};

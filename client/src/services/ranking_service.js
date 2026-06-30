const nameCollator = new Intl.Collator(undefined, { sensitivity: "base" });

function normalizeSalesValue(value) {
  return Math.max(0, Number(value) || 0);
}

export function calculateAchievement(targetSales, currentSales) {
  const target = normalizeSalesValue(targetSales);
  const current = normalizeSalesValue(currentSales);

  if (target <= 0) {
    return 0;
  }

  return Number(((current / target) * 100).toFixed(2));
}

export function buildPerformanceRanking(items = [], { getName, searchTerm = "", useUpdatedAtTieBreaker = false } = {}) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  return items
    .map((item) => ({
      ...item,
      achievement: calculateAchievement(item.target_sales, item.current_sales),
      rankingName: getName?.(item) || "",
    }))
    .filter((item) => {
      if (!normalizedSearch) {
        return true;
      }

      return item.rankingName.toLowerCase().includes(normalizedSearch);
    })
    .sort((left, right) => {
      if (right.achievement !== left.achievement) {
        return right.achievement - left.achievement;
      }

      if (Number(right.current_sales || 0) !== Number(left.current_sales || 0)) {
        return Number(right.current_sales || 0) - Number(left.current_sales || 0);
      }

      const leftUpdated = useUpdatedAtTieBreaker ? new Date(left.updated_at || 0).getTime() : 0;
      const rightUpdated = useUpdatedAtTieBreaker ? new Date(right.updated_at || 0).getTime() : 0;

      if (leftUpdated !== rightUpdated) {
        return leftUpdated - rightUpdated;
      }

      return nameCollator.compare(left.rankingName, right.rankingName);
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
}

export default {
  buildPerformanceRanking,
  calculateAchievement,
};

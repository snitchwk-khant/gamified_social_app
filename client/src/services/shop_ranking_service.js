import { buildShopLeaderboard } from "./shop_service";

function getEmployeesByShop(employees = []) {
  return employees.reduce((groups, employee) => {
    const shopId = employee.current_shop_id || employee.shop_id;

    if (!shopId) {
      return groups;
    }

    if (!groups.has(shopId)) {
      groups.set(shopId, []);
    }

    groups.get(shopId).push(employee);
    return groups;
  }, new Map());
}

function sortEmployeesByName(employees = []) {
  return [...employees].sort((left, right) =>
    (left.full_name || left.email || "").localeCompare(right.full_name || right.email || "")
  );
}

export function buildEmployeeShopLeaderboard(shopTargets = [], employees = [], { currentUserId = "", searchTerm = "" } = {}) {
  const employeesByShop = getEmployeesByShop(employees);
  const rows = [];

  buildShopLeaderboard(shopTargets).forEach((shopTarget) => {
    const shopEmployees = sortEmployeesByName(employeesByShop.get(shopTarget.shop_id) || []);

    if (!shopEmployees.length) {
      return;
    }

    const rank = rows.length + 1;

    shopEmployees.forEach((employee) => {
      rows.push({
        id: `${shopTarget.id}-${employee.id}`,
        employeeId: employee.id,
        displayName: employee.full_name || employee.email || "Unnamed employee",
        email: employee.email,
        avatarUrl: employee.avatar_url,
        shopName: shopTarget.shopName,
        achievement: shopTarget.achievement,
        rank,
        isCurrentUser: employee.id === currentUserId,
      });
    });
  });

  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return rows;
  }

  return rows.filter((row) =>
    [row.displayName, row.email, row.shopName].some((value) =>
      value?.toString().toLowerCase().includes(normalizedSearch)
    )
  );
}

export function buildTopShopCards(shopTargets = [], employees = []) {
  return buildShopRankingCards(shopTargets, employees).slice(0, 3);
}

export function buildShopRankingCards(shopTargets = [], employees = [], { searchTerm = "" } = {}) {
  const employeesByShop = getEmployeesByShop(employees);

  return buildShopLeaderboard(shopTargets, { searchTerm }).map((shopTarget) => {
    const shopEmployees = sortEmployeesByName(employeesByShop.get(shopTarget.shop_id) || []);

    return {
      ...shopTarget,
      employees: shopEmployees,
      employeeCount: shopEmployees.length,
    };
  });
}

export default {
  buildEmployeeShopLeaderboard,
  buildShopRankingCards,
  buildTopShopCards,
};

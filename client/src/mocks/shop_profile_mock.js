const mockEmployees = [
  { id: "employee-1", avatarUrl: "", name: "Bhone Pyae", role: "Sales Executive" },
  { id: "employee-2", avatarUrl: "", name: "Sai", role: "Sales Executive" },
  { id: "employee-3", avatarUrl: "", name: "HMS", role: "Senior Sales" },
  { id: "employee-4", avatarUrl: "", name: "Jue Jue", role: "Sales Assistant" },
  { id: "employee-5", avatarUrl: "", name: "Ko Ko Kyaw", role: "Sales Executive" },
];

const mockShopProfiles = [
  {
    id: "official",
    achievement: "135%",
    bestMonth: "June 2026",
    championCount: 4,
    currentChampion: "Official",
    highestAchievement: "142%",
    name: "Official",
    rank: "#1",
  },
  {
    id: "myanmar",
    achievement: "118%",
    bestMonth: "May 2026",
    championCount: 2,
    currentChampion: "Myanmar",
    highestAchievement: "126%",
    name: "Myanmar",
    rank: "#2",
  },
  {
    id: "sb",
    achievement: "104%",
    bestMonth: "April 2026",
    championCount: 1,
    currentChampion: "SB",
    highestAchievement: "112%",
    name: "SB",
    rank: "#3",
  },
];

const mockHistory = [
  {
    achievement: "135%",
    employeeIds: ["employee-1", "employee-2", "employee-4"],
    employeeOfMonthId: "employee-1",
    id: "history-1",
    label: "June 2026",
    notes: "A standout month driven by fast follow-up, strong closing discipline, and team support.",
  },
  {
    achievement: "121%",
    employeeIds: ["employee-2", "employee-3"],
    employeeOfMonthId: "employee-2",
    id: "history-2",
    label: "May 2026",
    notes: "Consistent weekly progress with a strong finish in the final sales window.",
  },
  {
    achievement: "109%",
    employeeIds: ["employee-1", "employee-5"],
    employeeOfMonthId: "employee-5",
    id: "history-3",
    label: "April 2026",
    notes: "Healthy target performance and improved customer retention.",
  },
];

export function getMockShopProfile(routeShopId) {
  const normalizedId = routeShopId?.toString().trim().toLowerCase();
  const matchedShop = mockShopProfiles.find((shop) => shop.id === normalizedId) || getMockShopByRouteId(normalizedId);
  const employees = normalizedId === "myanmar"
    ? mockEmployees.slice(1, 5)
    : normalizedId === "sb"
      ? [mockEmployees[2], mockEmployees[4], mockEmployees[0]]
      : mockEmployees;
  const employeeOfMonth = employees[0];

  return {
    ...matchedShop,
    employeeOfMonth: {
      ...employeeOfMonth,
      achievement: matchedShop.achievement,
      badge: "Top Seller",
      month: "July 2026",
    },
    employees,
    history: mockHistory.map((item) => ({
      ...item,
      employeeOfMonth: mockEmployees.find((employee) => employee.id === item.employeeOfMonthId),
      employees: item.employeeIds
        .map((employeeId) => mockEmployees.find((employee) => employee.id === employeeId))
        .filter(Boolean),
    })),
    records: {
      bestEmployee: employeeOfMonth.name,
      bestMonth: matchedShop.bestMonth,
      championCount: `${matchedShop.championCount}x`,
      highestAchievement: matchedShop.highestAchievement,
      highestScore: "3,450",
    },
  };
}

function getMockShopByRouteId(routeShopId = "") {
  if (!routeShopId) {
    return mockShopProfiles[0];
  }

  const routeHash = [...routeShopId].reduce((total, character) => total + character.charCodeAt(0), 0);
  return mockShopProfiles[routeHash % mockShopProfiles.length];
}

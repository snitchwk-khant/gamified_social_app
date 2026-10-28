import { buildPerformanceRanking, calculateAchievement } from "./ranking_service";

function normalizeRole(role) {
  return role?.toString().trim().toLowerCase() || "";
}

export { calculateAchievement };

export function buildLeaderboard(targets = [], { currentUserId = "", searchTerm = "" } = {}) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const employeeTargets = targets.filter((target) => normalizeRole(target.profile?.role) === "employee");

  const rankedTargets = employeeTargets.map((target) => {
    const profile = target.profile || {};

    return {
      ...target,
      employeeId: target.user_id,
      displayName: profile.full_name || profile.email || "Unnamed employee",
      email: profile.email || "",
      avatarUrl: profile.avatar_url || "",
      isCurrentUser: target.user_id === currentUserId,
    };
  });

  const searchedTargets = rankedTargets.filter((target) => {
    if (!normalizedSearch) {
      return true;
    }

    return [target.displayName, target.email].some((value) =>
      value?.toString().toLowerCase().includes(normalizedSearch)
    );
  });

  const leaderboardRows = buildPerformanceRanking(searchedTargets, {
    getName: (target) => target.displayName,
    useUpdatedAtTieBreaker: true,
  });

  return leaderboardRows;
}

export function getCurrentUserRank(targets = [], currentUserId = "") {
  return buildLeaderboard(targets, { currentUserId }).find((target) => target.isCurrentUser) || null;
}

export function getTopThree(leaderboardRows = []) {
  return leaderboardRows.slice(0, 3);
}

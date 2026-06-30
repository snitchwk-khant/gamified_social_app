import { supabase } from "../lib/supabase";
import { buildPerformanceRanking, calculateAchievement } from "./ranking_service";

const POST_SCORE = 10;
const STORY_SCORE = 25;

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
  });

  return leaderboardRows;
}

export function getCurrentUserRank(targets = [], currentUserId = "") {
  return buildLeaderboard(targets, { currentUserId }).find((target) => target.isCurrentUser) || null;
}

export function getTopThree(leaderboardRows = []) {
  return leaderboardRows.slice(0, 3);
}

export async function getLeaderboardMembers({ limit = 10 } = {}) {
  const now = new Date().toISOString();

  const [profilesResult, postsResult, storiesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,email,avatar_url,level,xp,is_active")
      .order("xp", { ascending: false })
      .limit(100),
    supabase
      .from("posts")
      .select("user_id")
      .eq("is_anonymous", false),
    supabase
      .from("stories")
      .select("user_id")
      .or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);

  if (profilesResult.error) {
    console.error("getLeaderboardMembers Profiles Error:", profilesResult.error);
    throw profilesResult.error;
  }

  if (postsResult.error) {
    console.error("getLeaderboardMembers Posts Error:", postsResult.error);
    throw postsResult.error;
  }

  if (storiesResult.error) {
    console.error("getLeaderboardMembers Stories Error:", storiesResult.error);
    throw storiesResult.error;
  }

  const postCounts = countRowsByUserId(postsResult.data);
  const storyCounts = countRowsByUserId(storiesResult.data);

  return (profilesResult.data || [])
    .filter((profile) => profile?.id && profile.is_active !== false)
    .map((profile) => {
      const xp = Number(profile.xp) || 0;
      const postsScore = (postCounts[profile.id] || 0) * POST_SCORE;
      const storiesScore = (storyCounts[profile.id] || 0) * STORY_SCORE;
      const score = xp + postsScore + storiesScore;

      return {
        id: profile.id,
        avatarUrl: profile.avatar_url || "",
        displayName: getProfileDisplayName(profile),
        level: Number(profile.level) || 1,
        score,
      };
    })
    .sort((leftMember, rightMember) => rightMember.score - leftMember.score)
    .slice(0, limit)
    .map((member, index) => ({
      ...member,
      rank: index + 1,
    }));
}

export function subscribeToLeaderboardChanges(onChange) {
  const channel = supabase
    .channel("leaderboard-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "posts" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "stories" },
      onChange,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

function countRowsByUserId(rows = []) {
  return rows.reduce((counts, row) => {
    if (!row?.user_id) {
      return counts;
    }

    counts[row.user_id] = (counts[row.user_id] || 0) + 1;
    return counts;
  }, {});
}

function getProfileDisplayName(profile) {
  const emailPrefix = profile.email?.split("@")[0] || "";
  return profile.full_name || emailPrefix || "Team member";
}

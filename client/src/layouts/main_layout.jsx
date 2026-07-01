import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import DesktopLayout from "../components/layout/desktop_layout";
import LeftSidebar from "../components/sidebar/left_sidebar";
import { AvatarGroup } from "../components/shops/shop_leaderboard_table";
import UserSearch from "../components/user_search/user_search";
import { useAuth } from "../context/auth_context";
import { useTheme } from "../context/theme_context";
import { getShopAssignmentEmployees, getShopSalesTargets } from "../services/shop_service";
import { buildShopRankingCards } from "../services/shop_ranking_service";
import { getShopPath } from "../utils/shop_path";

const LEADERBOARD_STORAGE_KEY = "gemify-show-welcome-leaderboard";
const achievementFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const PLACEHOLDER_LEADERBOARD = [
  {
    achievement: 128,
    employees: [],
    id: "placeholder-shop-1",
    rank: 1,
    shopName: "Official",
    shop_id: "",
  },
  {
    achievement: 116,
    employees: [],
    id: "placeholder-shop-2",
    rank: 2,
    shopName: "Myanmar",
    shop_id: "",
  },
  {
    achievement: 109,
    employees: [],
    id: "placeholder-shop-3",
    rank: 3,
    shopName: "T1",
    shop_id: "",
  },
  {
    achievement: 98,
    employees: [],
    id: "placeholder-shop-4",
    rank: 4,
    shopName: "SB",
    shop_id: "",
  },
  {
    achievement: 91,
    employees: [],
    id: "placeholder-shop-5",
    rank: 5,
    shopName: "Downtown",
    shop_id: "",
  },
];

function getCurrentPeriod() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function formatPeriodLabel(period) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(period.year, period.month - 1, 1));
}

function formatAchievement(value) {
  return `${achievementFormatter.format(Number(value || 0))}%`;
}

function formatRank(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function getUserShopSummary(rows = [], employees = [], userId = "") {
  const employee = employees.find((item) => item.id === userId);
  const shopId = employee?.current_shop_id || employee?.shop_id;

  if (!shopId) {
    return null;
  }

  const rankedShop = rows.find((row) => row.shop_id === shopId);

  return rankedShop || {
    achievement: null,
    rank: null,
    shopName: employee.current_shop?.name || "Your shop",
    shop_id: shopId,
  };
}

function MainLayout() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [showHighlights, setShowHighlights] = useState(false);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [userShopSummary, setUserShopSummary] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardPeriod] = useState(getCurrentPeriod);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const pendingHighlights = window.sessionStorage.getItem(LEADERBOARD_STORAGE_KEY);

    if (pendingHighlights && (pendingHighlights === "true" || pendingHighlights === user.id)) {
      window.sessionStorage.removeItem(LEADERBOARD_STORAGE_KEY);
      setShowHighlights(true);
    }
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadWelcomeLeaderboard() {
      if (!showHighlights || !user?.id) {
        return;
      }

      setLeaderboardLoading(true);

      try {
        const [targets, employees] = await Promise.all([
          getShopSalesTargets(leaderboardPeriod),
          getShopAssignmentEmployees(),
        ]);
        const rows = buildShopRankingCards(targets, employees);

        if (!isMounted) {
          return;
        }

        setLeaderboardRows(rows.length ? rows : PLACEHOLDER_LEADERBOARD);
        setUserShopSummary(getUserShopSummary(rows, employees, user.id));
      } catch (error) {
        console.error("Welcome leaderboard load error:", error);

        if (isMounted) {
          setLeaderboardRows(PLACEHOLDER_LEADERBOARD);
          setUserShopSummary(null);
        }
      } finally {
        if (isMounted) {
          setLeaderboardLoading(false);
        }
      }
    }

    loadWelcomeLeaderboard();

    return () => {
      isMounted = false;
    };
  }, [leaderboardPeriod, showHighlights, user?.id]);

  const handleCloseHighlights = () => {
    setShowHighlights(false);
    navigate("/");
  };

  const handleViewLeaderboard = () => {
    setShowHighlights(false);
    navigate("/shops");
  };

  const topFiveRows = leaderboardRows.slice(0, 5);

  const handleOpenShop = (event, shopId) => {
    if (!shopId || event.target.closest("a")) {
      return;
    }

    setShowHighlights(false);
    navigate(getShopPath(shopId));
  };

  return (
    <>
      <DesktopLayout
        left={<LeftSidebar />}
        center={
          <div className="flex h-full min-w-0 flex-col gap-4 sm:gap-5">
            <div className="xl:hidden">
              <UserSearch inputId="mobile-user-search" />
            </div>
            <div className="min-w-0 flex-1 overflow-auto pb-4">
              <Outlet />
            </div>
          </div>
        }
        right={null}
      />

      {showHighlights ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-leaderboard-title"
            className={`animate-[welcome-leaderboard-in_200ms_ease-out] w-full max-w-xl rounded-[28px] border p-5 shadow-2xl sm:p-6 ${
              isDark ? "border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-950"
            }`}
          >
            <div className="text-center">
              <h2 id="welcome-leaderboard-title" className="text-2xl font-bold">
                🏆 Welcome Back
              </h2>
              <p className="mt-2 text-sm font-semibold text-[#c446ff]">{formatPeriodLabel(leaderboardPeriod)}</p>
            </div>

            <div className="mt-5 space-y-3">
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Top 5 Shops
              </p>

              {leaderboardLoading ? (
                <div className={`rounded-2xl border px-4 py-8 text-center text-sm ${isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                  Loading leaderboard...
                </div>
              ) : null}

              {!leaderboardLoading
                ? topFiveRows.map((row) => (
                    <div
                      key={row.id || row.employeeId}
                      role={row.shop_id ? "link" : undefined}
                      tabIndex={row.shop_id ? 0 : undefined}
                      onClick={(event) => handleOpenShop(event, row.shop_id)}
                      onKeyDown={(event) => {
                        if (!row.shop_id) {
                          return;
                        }

                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setShowHighlights(false);
                          navigate(getShopPath(row.shop_id));
                        }
                      }}
                      className={`grid gap-3 rounded-2xl border p-4 transition sm:grid-cols-[48px_1fr_auto] sm:items-center ${
                        row.shop_id ? "cursor-pointer hover:-translate-y-0.5" : ""
                      } ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="text-3xl sm:text-center">{formatRank(row.rank)}</div>
                      <div className="min-w-0">
                        {row.shop_id ? (
                          <a
                            href={getShopPath(row.shop_id)}
                            onClick={(event) => {
                              event.preventDefault();
                              setShowHighlights(false);
                              navigate(getShopPath(row.shop_id));
                            }}
                            className={`truncate text-base font-semibold transition hover:text-[#c446ff] ${
                              isDark ? "text-slate-100" : "text-slate-950"
                            }`}
                          >
                            {row.shopName}
                          </a>
                        ) : (
                          <p className={`truncate text-base font-semibold ${isDark ? "text-slate-100" : "text-slate-950"}`}>
                            {row.shopName}
                          </p>
                        )}
                        <div className="mt-3">
                          <AvatarGroup employees={row.employees} isDark={isDark} />
                        </div>
                      </div>
                      <div
                        className={`w-fit rounded-full px-3 py-1 text-sm font-semibold sm:justify-self-end ${
                          row.achievement >= 100
                            ? isDark
                              ? "bg-emerald-950 text-emerald-200"
                              : "bg-emerald-50 text-emerald-700"
                            : row.achievement >= 80
                              ? isDark
                                ? "bg-amber-950 text-amber-200"
                                : "bg-amber-50 text-amber-700"
                              : isDark
                                ? "bg-rose-950 text-rose-200"
                                : "bg-rose-50 text-rose-700"
                      }`}
                    >
                        {formatAchievement(row.achievement)}
                      </div>
                    </div>
                  ))
                : null}

              {!leaderboardLoading ? (
                <div
                  role={userShopSummary?.shop_id ? "link" : undefined}
                  tabIndex={userShopSummary?.shop_id ? 0 : undefined}
                  onClick={(event) => handleOpenShop(event, userShopSummary?.shop_id)}
                  onKeyDown={(event) => {
                    if (!userShopSummary?.shop_id) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setShowHighlights(false);
                      navigate(getShopPath(userShopSummary.shop_id));
                    }
                  }}
                  className={`rounded-2xl border p-4 transition ${
                    userShopSummary?.shop_id ? "cursor-pointer hover:-translate-y-0.5" : ""
                  } ${isDark ? "border-[#c446ff]/40 bg-[#c446ff]/10" : "border-[#e8b7ff] bg-[#fdf7ff]"}`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                    🏪 Your Shop
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      {userShopSummary?.shop_id ? (
                        <a
                          href={getShopPath(userShopSummary.shop_id)}
                          onClick={(event) => {
                            event.preventDefault();
                            setShowHighlights(false);
                            navigate(getShopPath(userShopSummary.shop_id));
                          }}
                          className={`truncate text-lg font-semibold transition hover:text-[#c446ff] ${
                            isDark ? "text-slate-100" : "text-slate-950"
                          }`}
                        >
                          {userShopSummary.shopName}
                        </a>
                      ) : (
                        <p className={`truncate text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-950"}`}>
                          Unassigned
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-700"}`}>
                        Rank {userShopSummary?.rank ? `#${userShopSummary.rank}` : "--"}
                      </span>
                      <span className="rounded-full bg-[#c446ff] px-3 py-1 text-xs font-semibold text-white">
                        Achievement {userShopSummary?.achievement != null ? formatAchievement(userShopSummary.achievement) : "--"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCloseHighlights}
                className={`rounded-full border px-5 py-3 text-sm font-semibold transition ${
                  isDark
                    ? "border-slate-700 text-slate-200 hover:bg-slate-800"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Continue
              </button>
              <button
                type="button"
                onClick={handleViewLeaderboard}
                className="rounded-full bg-[#c446ff] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ad32e3]"
              >
                View Leaderboard
              </button>
            </div>
          </div>
          <style>
            {`@keyframes welcome-leaderboard-in {
              from {
                opacity: 0;
                transform: scale(0.98);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }`}
          </style>
        </div>
      ) : null}
    </>
  );
}

export default MainLayout;

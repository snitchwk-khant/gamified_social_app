import { useSearchParams } from "react-router-dom";
import ShopLeaderboardSection from "../components/shops/shop_leaderboard_section";
import { useTheme } from "../context/theme_context";
import MonthlyChampionsPage from "./monthly_champions_page";
import IndividualRankingPage from "./individual_ranking_page";

const LEADERBOARD_TABS = [
  { id: "ranking", label: "Ranking of Site" },
  { id: "champions", label: "Champions" },
  { id: "soft-skills", label: "Soft Skills" },
];

function LeaderboardPage() {
  const { isDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = LEADERBOARD_TABS.some((tab) => tab.id === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "ranking";

  function handleTabChange(tabId) {
    if (tabId === "ranking") {
      setSearchParams({});
      return;
    }

    setSearchParams({ tab: tabId });
  }

  return (
    <section className="space-y-5 xl:w-full xl:max-w-none">
      <div className={`grid grid-cols-3 rounded-2xl p-1 ${isDark ? "bg-slate-900" : "bg-slate-100"}`}>
        {LEADERBOARD_TABS.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`min-h-10 rounded-xl px-2 text-center text-xs font-semibold transition sm:px-3 sm:text-sm ${
                isActive
                  ? "bg-[#c446ff] text-white shadow-sm"
                  : isDark
                    ? "text-slate-300 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="transition-opacity duration-200">
        {activeTab === "ranking" ? <ShopLeaderboardSection isDark={isDark} /> : null}
        {activeTab === "champions" ? <MonthlyChampionsPage /> : null}
        {activeTab === "soft-skills" ? <IndividualRankingPage /> : null}
      </div>
    </section>
  );
}

export default LeaderboardPage;

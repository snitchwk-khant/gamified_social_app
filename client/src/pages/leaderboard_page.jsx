import ShopLeaderboardSection from "../components/shops/shop_leaderboard_section";
import { useTheme } from "../context/theme_context";

function LeaderboardPage() {
  const { isDark } = useTheme();

  return <ShopLeaderboardSection isDark={isDark} />;
}

export default LeaderboardPage;

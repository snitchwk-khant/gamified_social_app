import { Link } from "react-router-dom";
import ShopLeaderboardSection from "../shops/shop_leaderboard_section";

function LeaderboardCard() {
  return (
    <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-950/20">
      <Link to="/leaderboard" className="mb-5 block transition hover:opacity-90">
        <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Leaderboard</p>
        <h2 className="text-xl font-semibold text-slate-100">Ranking of Site</h2>
      </Link>

      <ShopLeaderboardSection compact isDark preview />
    </div>
  );
}

export default LeaderboardCard;

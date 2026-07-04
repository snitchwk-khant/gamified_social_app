import { Link, useNavigate } from "react-router-dom";
import { AvatarGroup } from "./shop_leaderboard_table";
import { getShopPath } from "../../utils/shop_path";

const numberFormatter = new Intl.NumberFormat();

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatRank(rank) {
  return `#${rank}`;
}

function formatRankBadge(rank) {
  if (rank === 1) {
    return "🥇 #1";
  }

  if (rank === 2) {
    return "🥈 #2";
  }

  if (rank === 3) {
    return "🥉 #3";
  }

  return formatRank(rank);
}

function getRankBadgeClass(rank, isDark) {
  if (rank === 1) {
    return isDark ? "bg-yellow-500/15 text-yellow-200" : "bg-yellow-50 text-yellow-700";
  }

  if (rank === 2) {
    return isDark ? "bg-slate-700 text-slate-100" : "bg-slate-100 text-slate-700";
  }

  if (rank === 3) {
    return isDark ? "bg-orange-500/15 text-orange-200" : "bg-orange-50 text-orange-700";
  }

  return isDark ? "bg-slate-900 text-slate-300" : "bg-slate-100 text-slate-600";
}

function getProgressWidth(achievement) {
  return `${Math.min(100, Math.max(0, Number(achievement || 0)))}%`;
}

function ShopTopCards({ rows = [], isDark = false }) {
  const navigate = useNavigate();

  if (!rows.length) {
    return null;
  }

  const handleOpenShop = (event, shopId) => {
    if (event.target.closest("a")) {
      return;
    }

    navigate(getShopPath(shopId));
  };

  const renderTopCard = (target) => (
    <div
      key={target.id}
      role="link"
      tabIndex={0}
      onClick={(event) => handleOpenShop(event, target.shop_id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(getShopPath(target.shop_id));
        }
      }}
      className={`flex min-h-[190px] cursor-pointer flex-col rounded-2xl border p-3 text-center shadow-sm transition hover:-translate-y-0.5 sm:min-h-[200px] sm:p-4 ${
        isDark
          ? target.rank === 1
            ? "border-[#c446ff]/40 bg-gradient-to-br from-slate-950 via-slate-950 to-[#241333] shadow-[#c446ff]/10"
            : "border-[#c446ff]/25 bg-slate-950 shadow-[#c446ff]/5"
          : target.rank === 1
            ? "border-[#c446ff]/30 bg-gradient-to-br from-white via-white to-[#fbf4ff] shadow-[#c446ff]/10"
            : "border-[#c446ff]/20 bg-white shadow-[#c446ff]/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold sm:text-xs ${getRankBadgeClass(target.rank, isDark)}`}
          aria-label={`Rank ${target.rank}`}
        >
          {formatRankBadge(target.rank)}
        </span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
            isDark ? "bg-[#c446ff]/15 text-purple-100" : "bg-[#f6e8ff] text-[#c446ff]"
          }`}
          aria-hidden="true"
        >
          🏆
        </span>
      </div>

      <div className="mt-3 flex justify-center">
        <AvatarGroup employees={target.employees} isDark={isDark} size="sm" />
      </div>

      <Link
        to={getShopPath(target.shop_id)}
        className={`mx-auto mt-3 block max-w-full truncate text-sm font-bold transition hover:text-[#c446ff] sm:text-base ${
          isDark ? "text-slate-100" : "text-slate-950"
        }`}
      >
        {target.shopName}
      </Link>

      <p className={`mt-2 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Achievement</p>

      <div className="mt-1 flex justify-center">
        <span
          className={`rounded-full px-3 py-1 text-lg font-black leading-none sm:text-xl ${
            isDark ? "bg-[#c446ff]/15 text-slate-100" : "bg-[#f6e8ff] text-[#c446ff]"
          }`}
        >
          {formatNumber(target.achievement)}%
        </span>
      </div>

      <div className={`mt-auto h-1.5 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-900" : "bg-slate-100"}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#c446ff] to-sky-400"
          style={{ width: getProgressWidth(target.achievement) }}
        />
      </div>
    </div>
  );

  const [featuredShop, ...secondaryShops] = rows;

  return (
    <div className="space-y-3">
      {featuredShop ? renderTopCard(featuredShop) : null}
      {secondaryShops.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {secondaryShops.map((target) => renderTopCard(target))}
        </div>
      ) : null}
    </div>
  );
}

export default ShopTopCards;

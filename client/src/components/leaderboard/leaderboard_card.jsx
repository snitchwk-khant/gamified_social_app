import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import { getLeaderboardMembers, subscribeToLeaderboardChanges } from "../../services/leaderboard_service";
import { getProfilePath } from "../../utils/profile_path";

function LeaderboardCard() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshTimerRef = useRef(null);

  const loadLeaderboard = useCallback(async () => {
    setError("");

    try {
      const leaderboardMembers = await getLeaderboardMembers({ limit: 10 });
      setMembers(leaderboardMembers);
    } catch (loadError) {
      setMembers([]);
      setError(loadError?.message || "Unable to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();

    const unsubscribe = subscribeToLeaderboardChanges(() => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(loadLeaderboard, 250);
    });

    return () => {
      window.clearTimeout(refreshTimerRef.current);
      unsubscribe();
    };
  }, [loadLeaderboard]);

  return (
    <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-950/20">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Leaderboard</p>
          <h2 className="text-xl font-semibold text-slate-100">Top contributors</h2>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? <p className="rounded-3xl bg-slate-900 p-4 text-sm text-slate-400">Loading leaderboard...</p> : null}

        {!loading && error ? <p className="rounded-3xl bg-rose-950/50 p-4 text-sm text-rose-200">{error}</p> : null}

        {!loading && !error && members.length === 0 ? (
          <p className="rounded-3xl bg-slate-900 p-4 text-sm text-slate-400">No leaderboard data yet.</p>
        ) : null}

        {!loading && !error
          ? members.map((member) => (
              <div key={member.id} className="rounded-3xl bg-slate-900 p-4 text-slate-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="min-w-7 text-lg font-semibold">{formatRank(member.rank)}</span>
                    <Link to={getProfilePath(member.id, user?.id)} aria-label={`Open ${member.displayName} profile`} className="cursor-pointer">
                      <LeaderboardAvatar member={member} />
                    </Link>
                    <div className="min-w-0">
                      <Link
                        to={getProfilePath(member.id, user?.id)}
                        className="block cursor-pointer truncate text-sm font-semibold transition hover:text-sky-300"
                      >
                        {member.displayName}
                      </Link>
                      <p className="text-xs text-slate-400">Level {member.level}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-slate-950">
                    ⭐ {member.score.toLocaleString()} Score
                  </span>
                </div>
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

function LeaderboardAvatar({ member }) {
  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt={member.displayName}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-slate-950">
      {getInitials(member.displayName)}
    </span>
  );
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";
}

function formatRank(rank) {
  if (rank === 1) {
    return "🥇";
  }

  if (rank === 2) {
    return "🥈";
  }

  if (rank === 3) {
    return "🥉";
  }

  return `${rank}.`;
}

export default LeaderboardCard;

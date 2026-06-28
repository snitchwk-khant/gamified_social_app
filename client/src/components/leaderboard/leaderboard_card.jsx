function LeaderboardCard() {
  const teammates = [
    { name: "Maya", points: 980, badge: "Innovator" },
    { name: "Luca", points: 845, badge: "Connector" },
    { name: "Aria", points: 760, badge: "Mentor" },
  ];

  return (
    <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-950/20">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Leaderboard</p>
          <h2 className="text-xl font-semibold text-slate-100">Top contributors</h2>
        </div>
      </div>

      <div className="space-y-4">
        {teammates.map((member) => (
          <div key={member.name} className="rounded-3xl bg-slate-900 p-4 text-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{member.name}</p>
                <p className="text-xs text-slate-400">{member.badge}</p>
              </div>
              <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-slate-950">
                {member.points} pts
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LeaderboardCard;

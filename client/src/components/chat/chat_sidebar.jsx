import { useTheme } from "../../context/theme_context";

function ChatSidebar() {
  const { isDark } = useTheme();

  const members = [
    { name: "Mia", role: "Designer", status: "online" },
    { name: "Noah", role: "Product", status: "online" },
    { name: "Ava", role: "Engineering", status: "offline" },
  ];

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isDark ? "border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/20" : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-[0.28em] text-slate-500">Channels</h3>
        <span className="text-xs text-slate-500">3 online</span>
      </div>
      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.name}
            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
              isDark
                ? "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <div>
              <p className={`font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{member.name}</p>
              <p className="text-xs text-slate-500">{member.role}</p>
            </div>
            <span
              className={`h-2.5 w-2.5 rounded-full ${member.status === "online" ? "bg-emerald-500" : isDark ? "bg-slate-600" : "bg-slate-400"}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatSidebar;

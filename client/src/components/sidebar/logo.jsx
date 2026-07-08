import { useTheme } from "../../context/theme_context";

function Logo() {
  const { isDark } = useTheme();

  return (
    <div
      className={`overflow-hidden rounded-2xl border p-5 text-center ${
        isDark
          ? "border-slate-800 bg-slate-950 text-slate-100 shadow-lg shadow-slate-950/20"
          : "border-slate-200 bg-white text-slate-800 shadow-sm"
      }`}
    >
      <h1 className={`bg-clip-text text-3xl font-extrabold tracking-tight text-transparent ${
        isDark
          ? "bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-500"
          : "bg-gradient-to-r from-[#c446ff] to-[#8f26c7]"
      }`}>
        Gemify
      </h1>
    </div>
  );
}

export default Logo;

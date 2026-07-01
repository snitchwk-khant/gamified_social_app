import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth_context";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const nextUser = await signIn({ email, password });
      window.sessionStorage.setItem("gemify-show-welcome-leaderboard", nextUser?.id || "true");
      navigate(nextUser?.must_change_password ? "/change-password" : "/", { replace: true });
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center overflow-x-hidden bg-slate-950 px-3 py-6 text-slate-100 sm:px-4 sm:py-10">
      <div className="w-full max-w-md rounded-[24px] border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-slate-950/20 sm:rounded-[32px] sm:p-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-400 sm:text-sm sm:tracking-[0.28em]">Company network</p>
          <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Sign in to your workspace</h1>
          <p className="mt-2 text-sm text-slate-400">Connect with peers, share updates, and earn rewards.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-200">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-500"
              required
            />
          </label>

          <label className="block text-sm text-slate-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-500"
              required
            />
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-3xl px-4 py-3 text-sm font-semibold text-slate-950 transition ${
              loading ? "bg-slate-700 cursor-not-allowed" : "bg-sky-500 hover:bg-sky-400"
            }`}
          >
            {loading ? "Signing in..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;

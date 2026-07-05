import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SafeAreaLayout from "../components/layout/SafeAreaLayout";
import { useAuth } from "../context/auth_context";
import { supabase } from "../lib/supabase";

function ChangePasswordPage() {
  const { user, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password must match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const email = user?.email;

      if (!email) {
        throw new Error("Unable to identify the current account.");
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (verifyError) {
        throw new Error(verifyError.message || "Current password is incorrect.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message || "Unable to update password.");
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) {
        await supabase.auth.updateUser({
          password: currentPassword,
        });
        throw new Error(profileError.message || "Unable to update profile.");
      }

      await refreshUserProfile({
        ...user,
        must_change_password: false,
      });
      navigate("/home", { replace: true });
    } catch (submitError) {
      setError(submitError?.message || "Unable to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaLayout className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="w-full px-4 py-10">
        <div className="mx-auto w-full max-w-lg rounded-[32px] border border-slate-800 bg-slate-900 p-8 shadow-xl shadow-slate-950/20">
        <p className="text-sm uppercase tracking-[0.28em] text-sky-400">Secure account</p>
        <h1 className="mt-3 text-3xl font-semibold">Change your temporary password</h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter your current password, choose a new password, and continue to your workspace.
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-200">
            Current Password
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-500"
              required
            />
          </label>

          <label className="block text-sm text-slate-200">
            New Password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-500"
              required
            />
          </label>

          <label className="block text-sm text-slate-200">
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-500"
              required
            />
          </label>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-3xl px-4 py-3 text-sm font-semibold text-slate-950 transition ${
              loading ? "cursor-not-allowed bg-slate-700" : "bg-sky-500 hover:bg-sky-400"
            }`}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
        </div>
      </div>
    </SafeAreaLayout>
  );
}

export default ChangePasswordPage;

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/auth_context";
import { useTheme } from "../context/theme_context";
import {
  formatSkillsForDisplay,
  getProfile,
  saveProfile,
  uploadAvatar,
} from "../services/profile_service";

function ProfilePage() {
  const { user, refreshUserProfile } = useAuth();
  const { isDark } = useTheme();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    bio: "",
    phone: "",
    birthday: "",
    location: "",
    skills: "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const readOnlyFields = useMemo(
    () => ({
      employee_id: profile?.employee_id || "N/A",
      department: profile?.department || "N/A",
      position: profile?.position || "N/A",
      email: profile?.email || user?.email || "N/A",
      role: profile?.role || "N/A",
    }),
    [profile, user?.email]
  );

  useEffect(() => {
    async function load() {
      if (!user?.id) {
        setLoading(false);
        setError(null);
        setProfile(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const profileData = await getProfile();
        setProfile(profileData);
        setForm({
          full_name: profileData?.full_name || user?.name || "",
          bio: profileData?.bio || "",
          phone: profileData?.phone || "",
          birthday: profileData?.birthday || "",
          location: profileData?.location || "",
          skills: formatSkillsForDisplay(profileData?.skills),
        });
        setAvatarPreview(profileData?.avatar_url || null);
      } catch (err) {
        console.error("Profile Load Error:", err);
        if (err?.message === "No profile found for the current user.") {
          setError("No profile was found for this account yet. Please contact support.");
        } else {
          setError("Unable to load profile. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  useEffect(() => {
    if (!avatarFile) return;
    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  const handleChange = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      setAvatarFile(file);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updates = {
        full_name: form.full_name,
        bio: form.bio,
        phone: form.phone,
        birthday: form.birthday ? form.birthday : null,
        location: form.location,
        skills: form.skills,
      };

      const savedProfile = await saveProfile(user.id, updates, avatarFile);
      setProfile(savedProfile);
      setAvatarFile(null);
      setAvatarPreview(savedProfile?.avatar_url || null);
      await refreshUserProfile(savedProfile);
      setSuccess("Profile saved successfully.");
    } catch (err) {
      console.error("Profile Save Error:", err);
      setError("Unable to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`flex min-h-[70vh] items-center justify-center rounded-2xl border p-10 ${
          isDark ? "border-slate-800 bg-slate-900 text-slate-200" : "border-slate-200 bg-white text-slate-600"
        }`}
      >
        Loading profile...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section
        className={`rounded-2xl border p-6 ${
          isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
        }`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Profile</p>
            <h2 className={`mt-2 text-2xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Your profile
            </h2>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Update your public avatar, bio, skills, and contact details. Read-only fields
              are managed by HR and cannot be changed here.
            </p>
          </div>
          <div
            className={`rounded-full px-4 py-3 text-sm font-medium ${
              isDark ? "bg-slate-950 text-slate-300" : "bg-[#f6e8ff] text-[#c446ff]"
            }`}
          >
            Employee ID: {readOnlyFields.employee_id}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div
          className={`rounded-2xl border p-6 ${
            isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
          }`}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={`relative h-28 w-28 overflow-hidden rounded-full border ${
                isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-100"
              }`}
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl text-slate-500">
                  {form.full_name?.charAt(0) || user?.name?.charAt(0) || "U"}
                </div>
              )}
            </div>
            <p className={`mt-4 text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              {form.full_name || user?.name}
            </p>
            <p className={`mt-2 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {readOnlyFields.department}
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Upload avatar
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className={`w-full rounded-2xl border px-4 py-3 text-sm file:rounded-full file:border-0 file:px-4 file:py-2 ${
                isDark
                  ? "border-slate-700 bg-slate-950 text-slate-200 file:bg-slate-800 file:text-slate-100"
                  : "border-slate-300 bg-slate-50 text-slate-700 file:bg-slate-200 file:text-slate-700"
              }`}
            />
            <p className="text-xs text-slate-500">
              Supported formats: JPG, PNG, GIF. Avatar will be stored in Supabase
              Storage and served publicly.
            </p>
          </div>
        </div>

        <div
          className={`min-w-0 rounded-2xl border p-6 ${
            isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
          }`}
        >
          {error && (
            <div className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Full Name"
              value={form.full_name}
              onChange={handleChange("full_name")}
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={handleChange("phone")}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Birthday"
              type="date"
              value={form.birthday}
              onChange={handleChange("birthday")}
            />
            <Field
              label="Location"
              value={form.location}
              onChange={handleChange("location")}
            />
          </div>

          <div className="mt-4">
            <label className={`mb-2 block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Bio
            </label>
            <textarea
              value={form.bio}
              onChange={handleChange("bio")}
              rows={4}
              className={`w-full rounded-2xl border p-4 text-sm outline-none transition ${
                isDark
                  ? "border-slate-700 bg-slate-950 text-slate-200 focus:border-sky-500"
                  : "border-slate-300 bg-slate-50 text-slate-800 focus:border-[#c446ff] focus:bg-white"
              }`}
            />
          </div>

          <div className="mt-4">
            <label className={`mb-2 block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Skills
            </label>
            <input
              type="text"
              value={form.skills}
              onChange={handleChange("skills")}
              placeholder="e.g. Design, Product, Marketing"
              className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
                isDark
                  ? "border-slate-700 bg-slate-950 text-slate-200 focus:border-sky-500"
                  : "border-slate-300 bg-slate-50 text-slate-800 focus:border-[#c446ff] focus:bg-white"
              }`}
            />
            <p className="mt-2 text-xs text-slate-500">
              Separate skills with commas.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label="Email" value={readOnlyFields.email} />
            <ReadOnlyField label="Role" value={readOnlyFields.role} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label="Department" value={readOnlyFields.department} />
            <ReadOnlyField label="Position" value={readOnlyFields.position} />
          </div>

          <div className="mt-4">
            <ReadOnlyField label="Employee ID" value={readOnlyFields.employee_id} />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {saving ? "Saving changes..." : "Remember to save your updates."}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                isDark
                  ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                  : "bg-[#c446ff] text-white hover:bg-[#ad32e3]"
              }`}
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  const { isDark } = useTheme();

  return (
    <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
          isDark
            ? "border-slate-700 bg-slate-950 text-slate-200 focus:border-sky-500"
            : "border-slate-300 bg-slate-50 text-slate-800 focus:border-[#c446ff] focus:bg-white"
        }`}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }) {
  const { isDark } = useTheme();

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isDark
          ? "border-slate-800 bg-slate-950 text-slate-200"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-2 break-all text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
        {value || "-"}
      </p>
    </div>
  );
}

export default ProfilePage;

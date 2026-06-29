import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/auth_context";
import { useTheme } from "../context/theme_context";
import {
  deleteProfileAlbumImage,
  getProfile,
  getProfileAlbumImages,
  getProfileById,
  getProfileStats,
  saveProfile,
  updateProfileAvatar,
  uploadProfileAlbumImage,
} from "../services/profile_service";

const EMPTY_FORM = {
  full_name: "",
  bio: "",
  hobby: "",
  relationship_status: "",
  zodiac_sign: "",
  phone: "",
  telegram_username: "",
  birthday: "",
  favorite_music: "",
};

const RELATIONSHIP_OPTIONS = ["Single", "Relationship", "Situationship"];
const ZODIAC_OPTIONS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

function ProfilePage() {
  const { userId: routeUserId } = useParams();
  const { user, refreshUserProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const avatarInputRef = useRef(null);
  const albumInputRef = useRef(null);
  const profileUserId = routeUserId || user?.id || "";
  const isOwnProfile = Boolean(user?.id && profileUserId === user.id);

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ postsCount: 0, storiesCount: 0 });
  const [form, setForm] = useState(EMPTY_FORM);
  const [albumImages, setAlbumImages] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [albumUploading, setAlbumUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const displayName = profile?.full_name || profile?.email?.split("@")[0] || user?.name || "Team member";
  const initials = getInitials(displayName);
  const telegramUrl = getTelegramUrl(profile?.telegram_username);
  const musicUrl = getYouTubeUrl(getProfileMusicValue(profile));
  const zodiacSign = getProfileZodiacValue(profile);
  const activeViewerImage = viewerIndex !== null ? albumImages[viewerIndex] : null;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!profileUserId) {
        setLoading(false);
        setError(null);
        setProfile(null);
        setAlbumImages([]);
        return;
      }

      setLoading(true);
      setError(null);
      setSuccess(null);
      setEditing(false);

      try {
        const [profileData, statsData, albumData] = await Promise.all([
          isOwnProfile ? getProfile() : getProfileById(profileUserId),
          getProfileStats(profileUserId),
          getProfileAlbumImages(profileUserId),
        ]);

        if (!isMounted) {
          return;
        }

        if (!profileData) {
          setProfile(null);
          setStats({ postsCount: 0, storiesCount: 0 });
          setForm(EMPTY_FORM);
          setAlbumImages([]);
          setError("Unable to find this profile.");
          return;
        }

        setProfile(profileData);
        setStats(statsData);
        setForm({
          full_name: profileData.full_name || user?.name || "",
          bio: profileData.bio || "",
          hobby: profileData.hobby || "",
          relationship_status: profileData.relationship_status || "",
          zodiac_sign: getProfileZodiacValue(profileData),
          phone: profileData.phone || "",
          telegram_username: profileData.telegram_username || "",
          birthday: profileData.birthday || "",
          favorite_music: getProfileMusicValue(profileData),
        });
        setAlbumImages(albumData);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        console.error("Profile Load Error:", err);
        setProfile(null);
        setError("Unable to load profile. Please try again.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [isOwnProfile, profileUserId, user?.name]);

  const handleChange = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const buildProfileUpdates = (overrides = {}) => ({
    avatar_url: profile?.avatar_url || null,
    full_name: form.full_name.trim(),
    bio: form.bio.trim(),
    hobby: form.hobby.trim(),
    relationship_status: form.relationship_status || null,
    zodiac_sign: form.zodiac_sign || null,
    phone: form.phone.trim(),
    telegram_username: normalizeTelegramUsername(form.telegram_username),
    birthday: form.birthday ? form.birthday : null,
    favorite_music: form.favorite_music.trim(),
    location: profile?.location || "",
    skills: profile?.skills || "",
    ...overrides,
  });

  const handleSave = async () => {
    if (!isOwnProfile || !user?.id) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const validationMessage = validateProfileForm(form);

      if (validationMessage) {
        setError(validationMessage);
        setSaving(false);
        return;
      }

      const savedProfile = await saveProfile(user.id, buildProfileUpdates());
      const nextStats = await getProfileStats(user.id);

      setProfile(savedProfile);
      setStats(nextStats);
      setEditing(false);
      await refreshUserProfile(savedProfile);
      setSuccess("Profile saved successfully.");
    } catch (err) {
      console.error("Profile Save Error:", err);
      setError("Unable to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAvatarPicker = () => {
    if (!isOwnProfile || avatarUploading) {
      return;
    }

    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0] || null;

    if (!file || !isOwnProfile || !user?.id) {
      return;
    }

    setAvatarUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const savedProfile = await updateProfileAvatar(user.id, file, profile?.avatar_url || "");

      setProfile(savedProfile);
      await refreshUserProfile(savedProfile);
      setSuccess("Profile picture updated.");
    } catch (err) {
      console.error("Profile Avatar Upload Error:", err);
      setError(err?.message || "Unable to update profile picture. Please try again.");
    } finally {
      input.value = "";
      setAvatarUploading(false);
    }
  };

  const handleOpenAlbumPicker = () => {
    if (!isOwnProfile || albumUploading || albumImages.length >= 6) {
      return;
    }

    albumInputRef.current?.click();
  };

  const handleAlbumFileChange = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0] || null;

    if (!file || !isOwnProfile || !user?.id) {
      return;
    }

    if (albumImages.length >= 6) {
      setError("Maximum 6 profile photos allowed.");
      input.value = "";
      return;
    }

    setAlbumUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const albumImage = await uploadProfileAlbumImage(user.id, file);

      if (albumImage) {
        setAlbumImages((current) => [...current, albumImage].slice(0, 6));
      }

      setSuccess("Photo added to Profile Album.");
    } catch (err) {
      console.error("Profile Album Upload Error:", err);
      setError(err?.message === "Maximum 6 profile photos allowed." ? err.message : "Unable to add photo. Please try again.");
    } finally {
      input.value = "";
      setAlbumUploading(false);
    }
  };

  const handleDeleteAlbumImage = async (albumImage) => {
    if (!isOwnProfile || !albumImage?.id) {
      return;
    }

    const previousAlbumImages = albumImages;

    setAlbumImages((current) => current.filter((item) => item.id !== albumImage.id));
    setViewerIndex((current) => {
      if (current === null) {
        return current;
      }

      const nextAlbumImages = previousAlbumImages.filter((item) => item.id !== albumImage.id);

      if (nextAlbumImages.length === 0) {
        return null;
      }

      return Math.min(current, nextAlbumImages.length - 1);
    });
    setError(null);
    setSuccess(null);

    try {
      await deleteProfileAlbumImage(albumImage);
      setSuccess("Photo removed from Profile Album.");
    } catch (err) {
      console.error("Profile Album Delete Error:", err);
      setAlbumImages(previousAlbumImages);
      setError("Unable to delete photo. Please try again.");
    }
  };

  const handleCloseViewer = () => {
    setViewerIndex(null);
  };

  const handlePreviousViewerImage = () => {
    setViewerIndex((current) => {
      if (current === null || albumImages.length === 0) {
        return current;
      }

      return current === 0 ? albumImages.length - 1 : current - 1;
    });
  };

  const handleNextViewerImage = () => {
    setViewerIndex((current) => {
      if (current === null || albumImages.length === 0) {
        return current;
      }

      return current === albumImages.length - 1 ? 0 : current + 1;
    });
  };

  useEffect(() => {
    if (viewerIndex === null) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setViewerIndex(null);
      }

      if (event.key === "ArrowLeft") {
        setViewerIndex((current) => {
          if (current === null || albumImages.length === 0) {
            return current;
          }

          return current === 0 ? albumImages.length - 1 : current - 1;
        });
      }

      if (event.key === "ArrowRight") {
        setViewerIndex((current) => {
          if (current === null || albumImages.length === 0) {
            return current;
          }

          return current === albumImages.length - 1 ? 0 : current + 1;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [albumImages.length, viewerIndex]);

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
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {error ? (
        <div className={`rounded-2xl border p-4 text-sm ${isDark ? "border-rose-900 bg-rose-950/40 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {error}
        </div>
      ) : null}

      {success ? (
        <div className={`rounded-2xl border p-4 text-sm ${isDark ? "border-emerald-900 bg-emerald-950/40 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {success}
        </div>
      ) : null}

      {profile ? (
        <>
          <section
            className={`rounded-2xl border p-4 sm:p-6 ${
              isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
            }`}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
                <button
                  type="button"
                  onClick={handleOpenAvatarPicker}
                  disabled={!isOwnProfile || avatarUploading}
                  aria-label={isOwnProfile ? "Upload profile picture" : `${displayName} profile picture`}
                  className={`group relative h-28 w-28 shrink-0 overflow-hidden rounded-full border transition ${
                    isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-100"
                  } ${isOwnProfile ? "cursor-pointer hover:opacity-95" : "cursor-default"} disabled:cursor-not-allowed`}
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-slate-500">
                      {initials}
                    </span>
                  )}

                  {isOwnProfile ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55 px-3 text-center text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100 group-disabled:opacity-100">
                      {avatarUploading ? "Uploading..." : "Change photo"}
                    </span>
                  ) : null}
                </button>

                <div className="min-w-0 max-w-full">
                  <h2 className={`break-words text-2xl font-semibold sm:truncate sm:text-3xl ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                    {displayName}
                  </h2>
                  {profile.relationship_status ? (
                    <span
                      className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        isDark ? "bg-slate-800 text-sky-200" : "bg-[#f6e8ff] text-[#c446ff]"
                      }`}
                    >
                      {profile.relationship_status}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:min-w-[240px] lg:w-auto">
                <StatCard label="Posts" value={stats.postsCount} />
                <StatCard label="Stories" value={stats.storiesCount} />
              </div>
            </div>

            {isOwnProfile ? (
              <div className="mt-6 flex justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditing((current) => !current)}
                  className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                    isDark
                      ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                      : "bg-[#c446ff] text-white hover:bg-[#ad32e3]"
                  }`}
                >
                  {editing ? "View Profile" : "Edit Profile"}
                </button>
              </div>
            ) : null}

            {isOwnProfile ? (
              <input
                ref={avatarInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
            ) : null}
          </section>

          {musicUrl ? (
            <section
              className={`rounded-2xl border p-4 sm:p-6 ${
                isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div className="flex justify-center">
                <a
                  href={musicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition ${
                    isDark
                      ? "bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-500 text-slate-950 hover:opacity-90"
                      : "bg-gradient-to-r from-[#c446ff] to-[#8f26c7] text-white hover:opacity-90"
                  }`}
                >
                  🎵 Now Listening
                </a>
              </div>
            </section>
          ) : null}

          <section
            className={`rounded-2xl border p-4 sm:p-6 ${
              isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
            }`}
          >
            <div className="space-y-4">
              <InfoLine icon={getZodiacIcon(zodiacSign)} text={zodiacSign || "N/A"} />
              <InfoLine icon="📱" text={profile.phone || "N/A"} />
              <InfoLine icon="🎂" text={formatBirthday(profile.birthday)} />
              <InfoLine icon="✈" text={profile.telegram_username || "N/A"} href={telegramUrl} />
              <InfoLine icon="🎯" text={profile.hobby || "N/A"} />
            </div>
          </section>

          <section
            className={`rounded-2xl border p-4 text-center sm:p-6 ${
              isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
            }`}
          >
            {isOwnProfile ? (
              <h3 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Bio</h3>
            ) : null}
            <p className={`mx-auto mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              {profile.bio || "N/A"}
            </p>
          </section>

          <section
            className={`rounded-2xl border p-4 sm:p-6 ${
              isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
            }`}
          >
            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3">
              {albumImages.map((albumImage, index) => (
                <div key={albumImage.id} className="relative aspect-square">
                  <button
                    type="button"
                    onClick={() => setViewerIndex(index)}
                    className="h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
                  >
                    <img src={albumImage.image_url} alt={`Profile album ${index + 1}`} className="h-full w-full object-cover" />
                  </button>

                  {isOwnProfile ? (
                    <button
                      type="button"
                      aria-label={`Delete profile album ${index + 1}`}
                      onClick={() => handleDeleteAlbumImage(albumImage)}
                      className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-black"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              ))}

              {isOwnProfile && albumImages.length < 6 ? (
                <button
                  type="button"
                  key="album-add-photo"
                  onClick={handleOpenAlbumPicker}
                  disabled={albumUploading}
                  className={`aspect-square rounded-2xl border border-dashed text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                    isDark
                      ? "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
                      : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {albumUploading ? "Adding..." : "+ Add Photo"}
                </button>
              ) : null}
            </div>

            <input
              ref={albumInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAlbumFileChange}
            />
          </section>

          {isOwnProfile ? (
            <div className="flex justify-center">
              <div
                className={`w-full max-w-md rounded-full border p-1 shadow-lg backdrop-blur-md ${
                  isDark
                    ? "border-sky-500/30 bg-slate-900/85 shadow-slate-950/30"
                    : "border-[#c446ff]/30 bg-white/90 shadow-slate-200/70"
                }`}
              >
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-pressed={isDark}
                  className="relative flex h-12 w-full items-center rounded-full"
                >
                  <span
                    className={`absolute h-10 w-[calc(50%-0.25rem)] rounded-full bg-gradient-to-r from-[#c446ff] to-violet-600 shadow-lg shadow-fuchsia-950/20 transition-transform ${
                      isDark ? "translate-x-full" : "translate-x-0"
                    }`}
                  />
                  <span
                    className={`relative z-10 flex flex-1 items-center justify-center gap-2 text-sm font-semibold transition ${
                      isDark ? "text-slate-400" : "text-white"
                    }`}
                  >
                    ☀️ Light Mode
                  </span>
                  <span
                    className={`relative z-10 flex flex-1 items-center justify-center gap-2 text-sm font-semibold transition ${
                      isDark ? "text-white" : "text-slate-500"
                    }`}
                  >
                    🌙 Dark Mode
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          {isOwnProfile && editing ? (
            <section
              className={`rounded-2xl border p-4 sm:p-6 ${
                isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" value={form.full_name} onChange={handleChange("full_name")} required />
                <SelectField
                  label="Relationship Status"
                  value={form.relationship_status}
                  onChange={handleChange("relationship_status")}
                  options={RELATIONSHIP_OPTIONS}
                />
                <SelectField
                  label="Zodiac Sign"
                  value={form.zodiac_sign}
                  onChange={handleChange("zodiac_sign")}
                  options={ZODIAC_OPTIONS}
                />
                <Field label="Phone" value={form.phone} onChange={handleChange("phone")} />
                <Field label="Birthday" type="date" value={form.birthday} onChange={handleChange("birthday")} />
                <Field label="Telegram Username" value={form.telegram_username} onChange={handleChange("telegram_username")} />
                <Field label="Hobby" value={form.hobby} onChange={handleChange("hobby")} maxLength={100} />
                <Field label="Now Listening (YouTube Link)" value={form.favorite_music} onChange={handleChange("favorite_music")} />
              </div>

              <div className="mt-4">
                <label className={`mb-2 block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Bio
                </label>
                <textarea
                  value={form.bio}
                  onChange={handleChange("bio")}
                  maxLength={300}
                  rows={4}
                  className={`w-full rounded-2xl border p-4 text-sm outline-none transition ${
                    isDark
                      ? "border-slate-700 bg-slate-950 text-slate-200 focus:border-sky-500"
                      : "border-slate-300 bg-slate-50 text-slate-800 focus:border-[#c446ff] focus:bg-white"
                  }`}
                />
                <p className="mt-2 text-xs text-slate-500">{form.bio.length}/300 characters</p>
              </div>

              <div className="mt-6 flex justify-center sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className={`inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto ${
                    isDark
                      ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                      : "bg-[#c446ff] text-white hover:bg-[#ad32e3]"
                  }`}
                >
                  {saving ? "Saving..." : "Save profile"}
                </button>
              </div>
            </section>
          ) : null}

          {activeViewerImage ? (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-4"
              onClick={handleCloseViewer}
            >
              <button
                type="button"
                aria-label="Close album viewer"
                onClick={handleCloseViewer}
                className="absolute right-4 top-4 rounded-full border border-white/40 bg-black/40 px-4 py-2 text-sm font-semibold text-white"
              >
                Close
              </button>

              {albumImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handlePreviousViewerImage();
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/40 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleNextViewerImage();
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/40 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Next
                  </button>
                </>
              ) : null}

              <img
                src={activeViewerImage.image_url}
                alt="Profile album fullscreen"
                className="max-h-full max-w-full rounded-2xl object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function getInitials(name) {
  const parts = name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2) || [];

  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "U";
}

function formatBirthday(value) {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeTelegramUsername(value) {
  return value
    .trim()
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "")
    .replace(/^@/, "");
}

function getTelegramUrl(value) {
  const username = normalizeTelegramUsername(value || "");
  return username ? `https://t.me/${username}` : "";
}

function getProfileMusicValue(profile) {
  const value = profile?.favorite_music;

  if (typeof value === "string") {
    return value.trim();
  }

  return value ? String(value).trim() : "";
}

function getProfileZodiacValue(profile) {
  const value = profile?.zodiac_sign;

  if (typeof value === "string") {
    return value.trim();
  }

  return value ? String(value).trim() : "";
}

function getYouTubeUrl(value) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "";
  }

  const candidates = getYouTubeUrlCandidates(trimmed);

  for (const candidateValue of candidates) {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(candidateValue) ? candidateValue : `https://${candidateValue}`;

    try {
      const url = new URL(candidate);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      const isYouTubeHost =
        host === "youtube.com" ||
        host.endsWith(".youtube.com") ||
        host === "youtu.be" ||
        host.endsWith(".youtu.be");

      if (isYouTubeHost) {
        return url.toString();
      }
    } catch {
      // Try the next candidate.
    }
  }

  return "";
}

function getYouTubeUrlCandidates(value) {
  const matches = value.match(/(?:https?:\/\/)?(?:[\w-]+\.)*(?:youtube\.com|youtu\.be)[^\s<>"')\]]*/gi) || [];
  const candidates = [value, ...matches].map((candidate) => candidate.replace(/[),.;]+$/, ""));

  return [...new Set(candidates)];
}

function getZodiacIcon(value) {
  const zodiacIcons = {
    Aries: "♈",
    Taurus: "♉",
    Gemini: "♊",
    Cancer: "♋",
    Leo: "♌",
    Virgo: "♍",
    Libra: "♎",
    Scorpio: "♏",
    Sagittarius: "♐",
    Capricorn: "♑",
    Aquarius: "♒",
    Pisces: "♓",
  };

  return zodiacIcons[value] || "☆";
}

function validateProfileForm(form) {
  if (!form.full_name.trim()) {
    return "Full Name is required.";
  }

  if (form.bio.length > 300) {
    return "Bio must be 300 characters or fewer.";
  }

  if (form.hobby.length > 100) {
    return "Hobby must be 100 characters or fewer.";
  }

  if (form.relationship_status && !RELATIONSHIP_OPTIONS.includes(form.relationship_status)) {
    return "Choose a valid relationship status.";
  }

  if (form.favorite_music.trim() && !getYouTubeUrl(form.favorite_music)) {
    return "Now Listening must be a valid YouTube URL.";
  }

  return "";
}

function StatCard({ label, value }) {
  const { isDark } = useTheme();

  return (
    <div
      className={`rounded-2xl border p-4 text-center ${
        isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
      }`}
    >
      <p className="text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function InfoLine({ icon, text, href = "" }) {
  const { isDark } = useTheme();
  const content = (
    <>
      <span className="w-6 shrink-0 text-center text-base">{icon}</span>
      <span className="min-w-0 flex-1 break-words text-sm font-medium">{text}</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={`flex items-center gap-2 rounded-2xl px-1 py-2 transition ${
          isDark
            ? "text-sky-200 hover:bg-slate-800/70"
            : "text-[#c446ff] hover:bg-slate-100"
        }`}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl px-1 py-2 ${
        isDark
          ? "text-slate-200"
          : "text-slate-700"
      }`}
    >
      {content}
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  const { isDark } = useTheme();

  return (
    <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
      <span>{label}</span>
      <select
        value={value}
        onChange={onChange}
        className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
          isDark
            ? "border-slate-700 bg-slate-950 text-slate-200 focus:border-sky-500"
            : "border-slate-300 bg-slate-50 text-slate-800 focus:border-[#c446ff] focus:bg-white"
        }`}
      >
        <option value="">Not specified</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({ label, value, onChange, type = "text", required = false, maxLength }) {
  const { isDark } = useTheme();

  return (
    <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        maxLength={maxLength}
        className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
          isDark
            ? "border-slate-700 bg-slate-950 text-slate-200 focus:border-sky-500"
            : "border-slate-300 bg-slate-50 text-slate-800 focus:border-[#c446ff] focus:bg-white"
        }`}
      />
    </label>
  );
}

export default ProfilePage;

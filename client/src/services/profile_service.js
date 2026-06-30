import { supabase } from "../lib/supabase";
import { getActiveStoryCountByUserId } from "./stories_service";

export function formatSkillsForDisplay(skills) {
  if (Array.isArray(skills)) {
    return skills.join(", ");
  }

  if (typeof skills !== "string") {
    return "";
  }

  const trimmed = skills.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.join(", ");
    }
  } catch {
    // Keep the original text if it is not valid JSON.
  }

  return trimmed;
}

const MAX_PROFILE_ALBUM_IMAGES = 6;
const MAX_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const AVATAR_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const AVATAR_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function normalizeSkillsForStorage(skillsValue) {
  return formatSkillsForDisplay(skillsValue)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

const PROFILE_FIELDS = "*";
const PROFILE_ALBUM_FIELDS = "id,user_id,image_url,sort_order,created_at";
const PROFILE_SEARCH_FIELDS = "id,avatar_url,full_name,employee_id,department,email";
const PROFILE_ROLES = new Set(["admin", "hr", "accountant", "employee"]);
const PROFILE_VIEW_SESSION_PREFIX = "gemify-profile-view";

function normalizeRoleForProfile(value) {
  const role = value?.toString().trim().toLowerCase();
  return PROFILE_ROLES.has(role) ? role : "employee";
}

function getInitialMustChangePassword(user, role) {
  const appMetadataValue = user?.app_metadata?.must_change_password;

  if (typeof appMetadataValue === "boolean") {
    return appMetadataValue;
  }

  if (typeof appMetadataValue === "string") {
    return appMetadataValue.trim().toLowerCase() === "true";
  }

  const userMetadataValue = user?.user_metadata?.must_change_password;

  if (
    userMetadataValue === true ||
    (typeof userMetadataValue === "string" && userMetadataValue.trim().toLowerCase() === "true")
  ) {
    return true;
  }

  return role !== "admin";
}

function normalizeProfileMusicValue(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  return value ? String(value).trim() : "";
}

function normalizeProfile(profile) {
  if (!profile) {
    return profile;
  }

  return {
    ...profile,
    favorite_music: normalizeProfileMusicValue(profile.favorite_music),
  };
}

function buildDefaultProfile(user, overrides = {}) {
  const role = normalizeRoleForProfile(overrides.role ?? user?.app_metadata?.role);
  const email = overrides.email ?? user?.email ?? "";
  const emailPrefix = email.split("@")[0] || "user";
  const fullName =
    overrides.full_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? emailPrefix;

  return {
    id: overrides.id ?? user.id,
    email,
    full_name: fullName,
    role,
    must_change_password: getInitialMustChangePassword(user, role),
  };
}

async function createDefaultProfile(user) {
  const defaultPayload = buildDefaultProfile(user);

  const { data, error } = await supabase
    .from("profiles")
    .insert(defaultPayload)
    .select(PROFILE_FIELDS)
    .single();

  if (!error) {
    return normalizeProfile(data);
  }

  if (error.code === "23505") {
    const { data: existingProfile, error: existingError } = await supabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", user.id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingProfile) {
      return normalizeProfile(existingProfile);
    }
  }

  throw error;
}

export async function getProfile() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("getProfile Auth Error:", authError);
    throw authError;
  }

  if (!user?.id) {
    throw new Error("No authenticated user found.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getProfile Error:", error);
    throw error;
  }

  if (!data) {
    try {
      return await createDefaultProfile(user);
    } catch (createError) {
      console.error("getProfile Missing Profile Create Error:", {
        userId: user.id,
        createError,
      });
      throw createError;
    }
  }

  return normalizeProfile(data);
}

export async function getProfileById(userId) {
  if (!userId) {
    throw new Error("Missing user ID");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getProfileById Error:", error);
    throw error;
  }

  return normalizeProfile(data);
}

export async function searchProfiles(searchTerm, { excludeUserId = null } = {}) {
  const normalizedSearch = searchTerm?.toString().trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ");

  if (!normalizedSearch) {
    return [];
  }

  const searchPattern = `%${normalizedSearch}%`;

  function buildSearchQuery(column) {
    let query = supabase
      .from("profiles")
      .select(PROFILE_SEARCH_FIELDS)
      .ilike(column, searchPattern)
      .order("full_name", { ascending: true })
      .limit(20);

    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }

    return query;
  }

  const results = await Promise.all([
    buildSearchQuery("full_name"),
    buildSearchQuery("employee_id"),
    buildSearchQuery("email"),
  ]);

  const failedResult = results.find((result) => result.error);

  if (failedResult?.error) {
    console.error("searchProfiles Error:", failedResult.error);
    throw failedResult.error;
  }

  const profilesById = new Map();

  results.forEach((result) => {
    (result.data || []).forEach((profile) => {
      if (profile?.id && !profilesById.has(profile.id)) {
        profilesById.set(profile.id, normalizeProfile(profile));
      }
    });
  });

  return Array.from(profilesById.values()).slice(0, 20);
}

export async function getProfileStats(userId, stories = null) {
  if (!userId) {
    return {
      postsCount: 0,
      storiesCount: 0,
      profileViewsCount: 0,
    };
  }

  const [
    { count: postsCount, error: postsError },
    storiesCount,
    { count: profileViewsCount, error: profileViewsError },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_anonymous", false),
    getActiveStoryCountByUserId(userId, stories),
    getProfileViewsCountResult(userId),
  ]);

  if (postsError) {
    console.error("getProfileStats Posts Error:", postsError);
  }

  if (profileViewsError) {
    console.error("getProfileStats Profile Views Error:", profileViewsError);
  }

  return {
    postsCount: postsError ? 0 : postsCount || 0,
    storiesCount,
    profileViewsCount: profileViewsError ? 0 : profileViewsCount || 0,
  };
}

export async function recordProfileView(profileId) {
  if (!profileId) {
    return false;
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("recordProfileView Auth Error:", authError);
    throw authError;
  }

  if (!user?.id || user.id === profileId) {
    return false;
  }

  const sessionKey = getProfileViewSessionKey(profileId, user.id);

  if (hasSessionProfileView(sessionKey)) {
    return false;
  }

  const viewedSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: recentViewError } = await supabase
    .from("profile_views")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("viewer_id", user.id)
    .gte("viewed_at", viewedSince);

  if (recentViewError) {
    console.error("recordProfileView Recent View Error:", recentViewError);
    throw recentViewError;
  }

  if ((count || 0) > 0) {
    setSessionProfileView(sessionKey);
    return false;
  }

  const { data, error } = await supabase
    .from("profile_views")
    .insert({
      profile_id: profileId,
      viewer_id: user.id,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("recordProfileView Insert Error:", error);
    throw error;
  }

  setSessionProfileView(sessionKey);

  return Boolean(data?.id);
}

export function subscribeToProfileViews(profileId, onProfileView) {
  if (!profileId || typeof onProfileView !== "function") {
    return null;
  }

  const channel = supabase
    .channel(`profile-views:${profileId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "profile_views",
        filter: `profile_id=eq.${profileId}`,
      },
      (payload) => {
        onProfileView(payload.new);
      },
    )
    .subscribe();

  return channel;
}

function getProfileViewsCountResult(userId) {
  return supabase
    .from("profile_views")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", userId);
}

function getProfileViewSessionKey(profileId, viewerId) {
  return `${PROFILE_VIEW_SESSION_PREFIX}:${profileId}:${viewerId}`;
}

function hasSessionProfileView(sessionKey) {
  try {
    return window.sessionStorage.getItem(sessionKey) === "1";
  } catch {
    return false;
  }
}

function setSessionProfileView(sessionKey) {
  try {
    window.sessionStorage.setItem(sessionKey, "1");
  } catch {
    // Session storage can be unavailable in private or restricted browser modes.
  }
}

export async function uploadAvatar(userId, file) {
  if (!file || !userId) {
    return null;
  }

  const extension = validateAvatarFile(file);
  const timestamp = Date.now();
  const filePath = `${userId}/avatar-${timestamp}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Avatar upload failed:", uploadError);
    throw uploadError;
  }

  const { data: publicUrlData, error: urlError } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  if (urlError) {
    console.error("Avatar public URL error:", urlError);
    throw urlError;
  }

  return publicUrlData?.publicUrl || null;
}

export async function updateProfileAvatar(userId, file, previousAvatarUrl = "") {
  if (!userId) {
    throw new Error("Missing user ID");
  }

  const extension = validateAvatarFile(file);
  const timestamp = Date.now();
  const filePath = `${userId}/avatar-${timestamp}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Avatar upload failed:", uploadError);
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
  const publicUrl = publicUrlData?.publicUrl || null;

  if (!publicUrl) {
    await supabase.storage.from("avatars").remove([filePath]);
    throw new Error("Unable to create avatar URL.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(PROFILE_FIELDS)
    .single();

  if (error) {
    await supabase.storage.from("avatars").remove([filePath]);
    console.error("Avatar profile update failed:", error);
    throw error;
  }

  const previousStoragePath = getAvatarStoragePath(previousAvatarUrl, userId);

  if (previousStoragePath && previousStoragePath !== filePath) {
    const { error: removeError } = await supabase.storage.from("avatars").remove([previousStoragePath]);

    if (removeError) {
      console.error("Previous avatar delete failed:", removeError);
    }
  }

  return normalizeProfile(data);
}

export async function uploadProfileAlbumImage(userId, file) {
  if (!file || !userId) {
    return null;
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Profile album uploads must be images.");
  }

  const { count, error: countError } = await supabase
    .from("profile_albums")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) {
    console.error("Profile album count failed:", countError);
    throw countError;
  }

  if ((count || 0) >= MAX_PROFILE_ALBUM_IMAGES) {
    throw new Error("Maximum 6 profile photos allowed.");
  }

  const extension = file.name.split(".").pop() || "jpg";
  const timestamp = Date.now();
  const filePath = `${userId}/album/${timestamp}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Profile album upload failed:", uploadError);
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);

  const publicUrl = publicUrlData?.publicUrl || null;

  if (!publicUrl) {
    throw new Error("Unable to create profile album image URL.");
  }

  const { data, error } = await supabase
    .from("profile_albums")
    .insert({
      user_id: userId,
      image_url: publicUrl,
      sort_order: count || 0,
    })
    .select(PROFILE_ALBUM_FIELDS)
    .single();

  if (error) {
    console.error("Profile album insert failed:", error);
    throw error;
  }

  return data;
}

export async function getProfileAlbumImages(userId) {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("profile_albums")
    .select(PROFILE_ALBUM_FIELDS)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_PROFILE_ALBUM_IMAGES);

  if (error) {
    console.error("getProfileAlbumImages Error:", error);
    throw error;
  }

  return data || [];
}

export async function deleteProfileAlbumImage(albumImage) {
  if (!albumImage?.id) {
    throw new Error("Missing profile album image.");
  }

  const { error } = await supabase
    .from("profile_albums")
    .delete()
    .eq("id", albumImage.id);

  if (error) {
    console.error("deleteProfileAlbumImage Error:", error);
    throw error;
  }

  const storagePath = getProfileAlbumStoragePath(albumImage.image_url);

  if (storagePath) {
    const { error: removeError } = await supabase.storage.from("avatars").remove([storagePath]);

    if (removeError) {
      console.error("Profile album storage delete failed:", removeError);
    }
  }

  return albumImage.id;
}

function getProfileAlbumStoragePath(imageUrl) {
  if (!imageUrl) {
    return "";
  }

  try {
    const url = new URL(imageUrl);
    const marker = "/storage/v1/object/public/avatars/";
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return "";
    }

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return "";
  }
}

function validateAvatarFile(file) {
  if (!file) {
    throw new Error("Choose an image to upload.");
  }

  if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
    throw new Error("Profile picture must be 5 MB or smaller.");
  }

  const extension = (file.name.split(".").pop() || "").toLowerCase();

  if (!AVATAR_ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Profile picture must be JPG, JPEG, PNG, or WEBP.");
  }

  if (file.type && !AVATAR_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Profile picture must be JPG, JPEG, PNG, or WEBP.");
  }

  return extension;
}

function getAvatarStoragePath(imageUrl, userId) {
  if (!imageUrl || !userId) {
    return "";
  }

  try {
    const url = new URL(imageUrl);
    const marker = "/storage/v1/object/public/avatars/";
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return "";
    }

    const storagePath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));

    if (!storagePath.startsWith(`${userId}/avatar-`)) {
      return "";
    }

    return storagePath;
  } catch {
    return "";
  }
}

export async function saveProfile(userId, profileData, avatarFile) {
  if (!userId) {
    throw new Error("Missing user ID");
  }

  let avatar_url = profileData.avatar_url;
  let uploadedAvatarUrl = "";

  if (avatarFile) {
    avatar_url = await uploadAvatar(userId, avatarFile);
    uploadedAvatarUrl = avatar_url;
  }

  const skills = normalizeSkillsForStorage(profileData.skills);

  const updatePayload = {
    avatar_url,
    full_name: profileData.full_name,
    bio: profileData.bio,
    hobby: profileData.hobby,
    relationship_status: profileData.relationship_status,
    zodiac_sign: profileData.zodiac_sign,
    personality: profileData.personality,
    phone: profileData.phone,
    telegram_username: profileData.telegram_username,
    birthday: profileData.birthday,
    favorite_music: normalizeProfileMusicValue(profileData.favorite_music),
    
    skills,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select(PROFILE_FIELDS)
    .maybeSingle();

  if (error) {
    if (uploadedAvatarUrl) {
      const uploadedStoragePath = getAvatarStoragePath(uploadedAvatarUrl, userId);

      if (uploadedStoragePath) {
        await supabase.storage.from("avatars").remove([uploadedStoragePath]);
      }
    }

    console.error("saveProfile Error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      error,
    });

    throw error;
  }

  if (!data) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const defaultPayload = buildDefaultProfile(user?.id === userId ? user : null, {
      id: userId,
      email: profileData.email,
      full_name: profileData.full_name,
      role: profileData.role,
    });

    const { data: insertedProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        ...defaultPayload,
        ...updatePayload,
        must_change_password: defaultPayload.must_change_password,
      })
      .select(PROFILE_FIELDS)
      .single();

    if (insertError) {
      if (uploadedAvatarUrl) {
        const uploadedStoragePath = getAvatarStoragePath(uploadedAvatarUrl, userId);

        if (uploadedStoragePath) {
          await supabase.storage.from("avatars").remove([uploadedStoragePath]);
        }
      }

      console.error("saveProfile Insert Error:", insertError);
      throw insertError;
    }

    if (uploadedAvatarUrl) {
      const previousStoragePath = getAvatarStoragePath(profileData.avatar_url, userId);
      const uploadedStoragePath = getAvatarStoragePath(uploadedAvatarUrl, userId);

      if (previousStoragePath && previousStoragePath !== uploadedStoragePath) {
        const { error: removeError } = await supabase.storage.from("avatars").remove([previousStoragePath]);

        if (removeError) {
          console.error("Previous avatar delete failed:", removeError);
        }
      }
    }

    return normalizeProfile(insertedProfile);
  }

  if (uploadedAvatarUrl) {
    const previousStoragePath = getAvatarStoragePath(profileData.avatar_url, userId);
    const uploadedStoragePath = getAvatarStoragePath(uploadedAvatarUrl, userId);

    if (previousStoragePath && previousStoragePath !== uploadedStoragePath) {
      const { error: removeError } = await supabase.storage.from("avatars").remove([previousStoragePath]);

      if (removeError) {
        console.error("Previous avatar delete failed:", removeError);
      }
    }
  }

  return normalizeProfile(data);
}

export default {
  deleteProfileAlbumImage,
  getProfile,
  getProfileAlbumImages,
  getProfileById,
  getProfileStats,
  recordProfileView,
  saveProfile,
  searchProfiles,
  subscribeToProfileViews,
  updateProfileAvatar,
  uploadAvatar,
  uploadProfileAlbumImage,
};

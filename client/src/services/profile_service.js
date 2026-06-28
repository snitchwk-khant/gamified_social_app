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

function normalizeSkillsForStorage(skillsValue) {
  return formatSkillsForDisplay(skillsValue)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

export function parseProfileAlbumUrls(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).slice(0, 6);
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean).slice(0, 6);
    }
  } catch {
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  return [];
}

const PROFILE_FIELDS = "*";

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

function buildDefaultProfile(user) {
  const email = user?.email || "";
  const emailPrefix = email.split("@")[0] || "user";
  const fullName = user?.user_metadata?.name || emailPrefix;

  return {
    id: user.id,
    email,
    full_name: fullName,
    role: "employee",
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

export async function getProfileStats(userId, stories = null) {
  if (!userId) {
    return {
      postsCount: 0,
      storiesCount: 0,
    };
  }

  const [{ count: postsCount, error: postsError }, storiesCount] = await Promise.all([
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_anonymous", false),
    getActiveStoryCountByUserId(userId, stories),
  ]);

  if (postsError) {
    console.error("getProfileStats Posts Error:", postsError);
  }

  return {
    postsCount: postsError ? 0 : postsCount || 0,
    storiesCount,
  };
}

export async function uploadAvatar(userId, file) {
  if (!file || !userId) {
    return null;
  }

  const extension = file.name.split(".").pop();
  const timestamp = Date.now();
  const filePath = `${userId}/avatar-${timestamp}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
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

export async function uploadProfileAlbumImage(userId, file) {
  if (!file || !userId) {
    return null;
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Profile album uploads must be images.");
  }

  const extension = file.name.split(".").pop() || "jpg";
  const timestamp = Date.now();
  const filePath = `${userId}/album-${timestamp}.${extension}`;

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

  return publicUrlData?.publicUrl || null;
}

export async function saveProfile(userId, profileData, avatarFile) {
  if (!userId) {
    throw new Error("Missing user ID");
  }

  let avatar_url = profileData.avatar_url;

  if (avatarFile) {
    avatar_url = await uploadAvatar(userId, avatarFile);
  }

  const skills = normalizeSkillsForStorage(profileData.skills);

  const updatePayload = {
    avatar_url,
    full_name: profileData.full_name,
    bio: profileData.bio,
    hobby: profileData.hobby,
    relationship_status: profileData.relationship_status,
    zodiac_sign: profileData.zodiac_sign,
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
    const { data: insertedProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({ id: userId, ...updatePayload })
      .select(PROFILE_FIELDS)
      .single();

    if (insertError) {
      console.error("saveProfile Insert Error:", insertError);
      throw insertError;
    }

    return normalizeProfile(insertedProfile);
  }

  return normalizeProfile(data);
}

export default {
  getProfile,
  getProfileById,
  getProfileStats,
  parseProfileAlbumUrls,
  saveProfile,
  uploadAvatar,
  uploadProfileAlbumImage,
};

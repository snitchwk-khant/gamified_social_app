import { supabase } from "../lib/supabase";

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

const PROFILE_FIELDS = "*";

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
    return data;
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
      return existingProfile;
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

  return data;
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
    phone: profileData.phone,
    birthday: profileData.birthday,
    location: profileData.location,
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
    console.error("saveProfile Error:", error);
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

    return insertedProfile;
  }

  return data;
}

export default {
  getProfile,
  saveProfile,
  uploadAvatar,
};

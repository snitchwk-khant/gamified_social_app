import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = new Set(["admin", "hr", "accountant", "employee"]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeRole(value: unknown) {
  return (value || "").toString().trim().toLowerCase();
}

function generateTemporaryPassword() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("") + "A1!";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ success: false, message: "Server configuration is missing." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";

  if (!authHeader) {
    return jsonResponse({ success: false, message: "Unauthorized request." }, 401);
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user: callerUser },
    error: callerError,
  } = await supabaseClient.auth.getUser();

  if (callerError || !callerUser?.id) {
    return jsonResponse({ success: false, message: "Unauthorized request." }, 401);
  }

  const { data: callerProfile, error: callerProfileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", callerUser.id)
    .maybeSingle();

  if (callerProfileError) {
    return jsonResponse({ success: false, message: "Unable to verify admin access." }, 500);
  }

  if (normalizeRole(callerProfile?.role) !== "admin") {
    return jsonResponse({ success: false, message: "Admin access is required." }, 403);
  }

  let payload: Record<string, unknown>;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ success: false, message: "Invalid request body." }, 400);
  }

  const fullName = (payload.full_name || "").toString().trim();
  const email = (payload.email || "").toString().trim().toLowerCase();
  const department = (payload.department || "").toString().trim();
  const position = (payload.position || "").toString().trim();
  const role = normalizeRole(payload.role);

  if (!fullName || !email || !department || !position || !role) {
    return jsonResponse({ success: false, message: "All required fields must be provided." }, 400);
  }

  if (!ALLOWED_ROLES.has(role)) {
    return jsonResponse({ success: false, message: "Invalid role value." }, 400);
  }

  const temporaryPassword = generateTemporaryPassword();

  const { data: createdUserData, error: createUserError } = await serviceClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    user_metadata: {
      full_name: fullName,
      name: fullName,
    },
  });

  if (createUserError || !createdUserData?.user?.id) {
    const duplicateEmail =
      createUserError?.status === 422 ||
      createUserError?.code === "email_exists" ||
      createUserError?.message?.toLowerCase().includes("already");

    return jsonResponse(
      {
        success: false,
        message: duplicateEmail ? "A user with this email already exists." : "Unable to create auth user.",
      },
      duplicateEmail ? 409 : 400
    );
  }

  const createdUserId = createdUserData.user.id;
  const profilePayload = {
    id: createdUserId,
    full_name: fullName,
    email,
    department,
    position,
    role,
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await serviceClient.from("profiles").upsert(profilePayload, { onConflict: "id" });

  if (profileError) {
    await serviceClient.auth.admin.deleteUser(createdUserId);
    return jsonResponse({ success: false, message: "Unable to create user profile." }, 500);
  }

  return jsonResponse({ success: true });
});

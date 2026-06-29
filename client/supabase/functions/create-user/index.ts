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

function diagnosticResponse(error: { message?: string }, details: unknown = error) {
  return new Response(
    JSON.stringify({
      error: error.message,
      details,
    }),
    {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

function diagnosticError(message: string, details: Record<string, unknown> = {}) {
  return {
    message,
    ...details,
  };
}

function normalizeRole(value: unknown) {
  return (value || "").toString().trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    const error = diagnosticError("Server configuration is missing.", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseAnonKey: Boolean(supabaseAnonKey),
      hasSupabaseServiceRoleKey: Boolean(serviceRoleKey),
    });
    return diagnosticResponse(error);
  }

  const authHeader = req.headers.get("Authorization") || "";

  if (!authHeader) {
    const error = diagnosticError("Unauthorized request.", {
      reason: "Missing Authorization header.",
    });
    return diagnosticResponse(error);
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
    const error =
      callerError ||
      diagnosticError("Unauthorized request.", {
        reason: "No authenticated user returned from access token.",
      });
    return diagnosticResponse(error);
  }

  const { data: callerProfile, error: callerProfileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", callerUser.id)
    .maybeSingle();

  if (callerProfileError) {
    return diagnosticResponse(callerProfileError);
  }

  if (normalizeRole(callerProfile?.role) !== "admin") {
    const error = diagnosticError("Admin access is required.", {
      callerUserId: callerUser.id,
      callerRole: callerProfile?.role || null,
    });
    return diagnosticResponse(error);
  }

  let payload: Record<string, unknown>;

  try {
    payload = await req.json();
  } catch (error) {
    return diagnosticResponse(error instanceof Error ? error : diagnosticError("Invalid request body."));
  }

  const fullName = (payload.full_name || "").toString().trim();
  const email = (payload.email || "").toString().trim().toLowerCase();
  const password = (payload.password || "").toString();
  const department = (payload.department || "").toString().trim();
  const position = (payload.position || "").toString().trim();
  const requestedRole = normalizeRole(payload.role);
  const role = requestedRole === "user" ? "employee" : requestedRole;

  if (!fullName || !email || !password || !role) {
    const error = diagnosticError("All required fields must be provided.", {
      hasFullName: Boolean(fullName),
      hasEmail: Boolean(email),
      hasPassword: Boolean(password),
      hasRole: Boolean(role),
    });
    return diagnosticResponse(error);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return diagnosticResponse(diagnosticError("A valid email address is required.", { email }));
  }

  if (password.length < 8) {
    return diagnosticResponse(diagnosticError("Password must be at least 8 characters."));
  }

  if (!ALLOWED_ROLES.has(role)) {
    return diagnosticResponse(diagnosticError("Invalid role value.", { role }));
  }

  const mustChangePassword = role !== "admin";

  const { data: createdUserData, error: createUserError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role,
      must_change_password: mustChangePassword,
    },
    user_metadata: {
      full_name: fullName,
      name: fullName,
    },
  });

  if (createUserError || !createdUserData?.user?.id) {
    const error =
      createUserError ||
      diagnosticError("Unable to create auth user.", {
        reason: "Supabase Admin API did not return a user id.",
        createdUserData,
      });
    return diagnosticResponse(error);
  }

  const createdAuthUser = createdUserData.user;
  const createdUserId = createdAuthUser.id;
  const createdUserEmail = (createdAuthUser.email || "").toString().trim().toLowerCase();

  if (createdUserEmail !== email) {
    const { error: cleanupError } = await serviceClient.auth.admin.deleteUser(createdUserId);
    const error = diagnosticError("Created auth user email does not match requested email.", {
      requestedEmail: email,
      createdUserEmail,
      createdUserId,
      cleanupError,
    });
    return diagnosticResponse(error);
  }

  const profilePayload = {
    id: createdUserId,
    full_name: fullName,
    email,
    department,
    position,
    role,
    must_change_password: mustChangePassword,
    updated_at: new Date().toISOString(),
  };

  const { data: insertedProfile, error: profileError } = await serviceClient
    .from("profiles")
    .insert(profilePayload)
    .select("id,email,full_name,role,must_change_password")
    .single();

  if (profileError || !insertedProfile) {
    const { error: cleanupError } = await serviceClient.auth.admin.deleteUser(createdUserId);
    const error =
      profileError ||
      diagnosticError("Profile insert did not return an inserted row.", {
        createdUserId,
      });
    return diagnosticResponse(error, {
      profileError,
      insertedProfile,
      cleanupError,
      createdAuthUser,
      profilePayload,
    });
  }

  if (insertedProfile.id !== createdUserId) {
    const { error: cleanupError } = await serviceClient.auth.admin.deleteUser(createdUserId);
    const error = diagnosticError("Inserted profile id does not match created auth user id.", {
      insertedProfileId: insertedProfile.id,
      createdUserId,
      cleanupError,
    });
    return diagnosticResponse(error, {
      insertedProfile,
      createdAuthUser,
      profilePayload,
    });
  }

  if ((insertedProfile.email || "").toString().trim().toLowerCase() !== createdUserEmail) {
    const { error: cleanupError } = await serviceClient.auth.admin.deleteUser(createdUserId);
    const error = diagnosticError("Inserted profile email does not match created auth user email.", {
      insertedProfileEmail: insertedProfile.email || null,
      createdUserEmail,
      cleanupError,
    });
    return diagnosticResponse(error, {
      insertedProfile,
      createdAuthUser,
      profilePayload,
    });
  }

  if (Boolean(insertedProfile.must_change_password) !== mustChangePassword) {
    const { error: cleanupError } = await serviceClient.auth.admin.deleteUser(createdUserId);
    const error = diagnosticError("Inserted profile must_change_password does not match payload.", {
      expectedMustChangePassword: mustChangePassword,
      insertedMustChangePassword: insertedProfile.must_change_password,
      cleanupError,
    });
    return diagnosticResponse(error, {
      insertedProfile,
      createdAuthUser,
      profilePayload,
    });
  }

  return jsonResponse({ success: true, user: createdAuthUser, profile: insertedProfile });
});

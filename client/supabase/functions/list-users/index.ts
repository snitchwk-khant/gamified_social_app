import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USER_FIELDS = "id,avatar_url,full_name,email,role,created_at";

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

  const { data: users, error: usersError } = await serviceClient
    .from("profiles")
    .select(USER_FIELDS)
    .order("created_at", { ascending: false });

  if (usersError) {
    return diagnosticResponse(usersError);
  }

  return jsonResponse({
    success: true,
    users: (users || []).map((user) => ({
      ...user,
      is_active: true,
      status: "Active",
    })),
  });
});

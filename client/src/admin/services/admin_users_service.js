import { supabase } from "../../lib/supabase";

async function getFunctionErrorMessage(error) {
  const response = error?.context;

  if (response && typeof response.json === "function") {
    try {
      const body = await response.json();
      return body?.error || body?.message || error.message;
    } catch {
      return error.message;
    }
  }

  return error?.message || "Unable to create user.";
}

export async function getAdminUsers() {
  const { data, error } = await supabase.functions.invoke("list-users");

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!data?.success) {
    throw new Error(data?.error || data?.message || "Unable to load users.");
  }

  return data.users || [];
}

export async function createAdminUser({ fullName, email, password, role }) {
  const normalizedRole = ["admin", "accountant"].includes(role) ? role : "employee";

  const { data, error } = await supabase.functions.invoke("create-user", {
    body: {
      full_name: fullName,
      email,
      password,
      role: normalizedRole,
    },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!data?.success) {
    throw new Error(data?.message || "Unable to create user.");
  }

  return data;
}

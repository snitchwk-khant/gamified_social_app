import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdminUser, getAdminUsers } from "../services/admin_users_service";

const DEFAULT_FORM = {
  fullName: "",
  email: "",
  password: "",
  role: "employee",
};

function formatRole(role) {
  return role === "admin" ? "Admin" : "User";
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(name, email) {
  const source = name || email || "User";
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function validateForm(form) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!form.fullName.trim()) {
    errors.fullName = "Full name is required.";
  }

  if (!form.email.trim()) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!form.password) {
    errors.password = "Password is required.";
  } else if (form.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!["employee", "admin"].includes(form.role)) {
    errors.role = "Select a valid role.";
  }

  return errors;
}

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [createError, setCreateError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const rows = await getAdminUsers();
      setUsers(rows);
    } catch (err) {
      console.error("Admin users load error:", err);
      setError(err?.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) => {
      const status = user.is_active === false ? "inactive" : "active";
      const role = formatRole(user.role).toLowerCase();
      return [user.full_name, user.email, role, status].some((value) =>
        value?.toString().toLowerCase().includes(normalizedSearch)
      );
    });
  }, [searchTerm, users]);

  const openModal = () => {
    setForm(DEFAULT_FORM);
    setFormErrors({});
    setCreateError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isCreating) {
      setIsModalOpen(false);
    }
  };

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setFormErrors((current) => ({
      ...current,
      [field]: "",
    }));
    setCreateError("");
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();

    const errors = validateForm(form);
    setFormErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    setIsCreating(true);
    setCreateError("");
    setNotice("");

    try {
      await createAdminUser({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      });

      setIsModalOpen(false);
      setForm(DEFAULT_FORM);
      setNotice("User created successfully.");
      await loadUsers();
    } catch (err) {
      console.error("Admin create user error:", err);
      setCreateError(err?.message || "Unable to create user.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Users</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search users"
              className="h-11 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c446ff] focus:bg-white sm:w-64"
            />
            <button
              type="button"
              onClick={loadUsers}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#c446ff] hover:text-[#c446ff]"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={openModal}
              className="h-11 rounded-2xl bg-[#c446ff] px-4 text-sm font-semibold text-white transition hover:bg-[#ad32e3]"
            >
              New User
            </button>
          </div>
        </div>

        {notice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Avatar</th>
                <th className="px-5 py-4 font-semibold">Name</th>
                <th className="px-5 py-4 font-semibold">Email</th>
                <th className="px-5 py-4 font-semibold">Role</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Created At</th>
                <th className="px-5 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length ? (
                filteredUsers.map((user) => {
                  const isActive = user.is_active !== false;
                  const initials = getInitials(user.full_name, user.email);

                  return (
                    <tr key={user.id} className="text-slate-700">
                      <td className="px-5 py-4">
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#f6e8ff] text-sm font-bold text-[#c446ff]">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.full_name || user.email} className="h-full w-full object-cover" />
                          ) : (
                            initials
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-950">{user.full_name || "Unnamed user"}</td>
                      <td className="px-5 py-4">{user.email || "N/A"}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#f6e8ff] px-3 py-1 text-xs font-semibold text-[#c446ff]">
                          {formatRole(user.role)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4">{formatDate(user.created_at)}</td>
                      <td className="px-5 py-4 text-slate-400">Phase 2</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">New User</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">Create user</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleCreateUser}>
              <label className="block text-sm font-medium text-slate-700">
                Full Name
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(event) => updateForm("fullName", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                />
                {formErrors.fullName ? <p className="mt-1 text-xs text-rose-600">{formErrors.fullName}</p> : null}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                />
                {formErrors.email ? <p className="mt-1 text-xs text-rose-600">{formErrors.email}</p> : null}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Password
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateForm("password", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                />
                {formErrors.password ? <p className="mt-1 text-xs text-rose-600">{formErrors.password}</p> : null}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Role
                <select
                  value={form.role}
                  onChange={(event) => updateForm("role", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                >
                  <option value="employee">User</option>
                  <option value="admin">Admin</option>
                </select>
                {formErrors.role ? <p className="mt-1 text-xs text-rose-600">{formErrors.role}</p> : null}
              </label>

              {createError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {createError}
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isCreating}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="h-11 rounded-2xl bg-[#c446ff] px-5 text-sm font-semibold text-white transition hover:bg-[#ad32e3] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AdminUsersPage;

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../context/theme_context";
import { useAuth } from "../context/auth_context";
import { supabase } from "../lib/supabase";

const USER_FIELDS =
  "id, avatar_url, full_name, email, employee_id, department, position, role, can_manage_announcements, can_manage_sales";
const EDITABLE_ROLES = ["admin", "hr", "accountant", "employee"];
const MODERATION_LIMIT = 12;
const CREATE_USER_DEFAULTS = {
  full_name: "",
  email: "",
  department: "",
  position: "",
  role: "employee",
};

async function getTableCount(tableName) {
  const { count, error } = await supabase.from(tableName).select("id", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getMaskedCount(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select("id", { count: "exact", head: true })
    .eq("is_anonymous", true);

  if (error) {
    // If is_anonymous is not available for a table, keep the metric optional.
    if (error.code === "PGRST204" || error.code === "42703") {
      return null;
    }

    throw error;
  }

  return count ?? 0;
}

function StatCard({ title, value, subtitle, isDark }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        isDark
          ? "border-slate-800 bg-slate-950 text-slate-100 shadow-lg shadow-slate-950/20"
          : "border-slate-200 bg-white text-slate-900 shadow-sm"
      }`}
    >
      <p className={`text-xs uppercase tracking-[0.24em] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
        {title}
      </p>
      <p className={`mt-3 text-3xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{value}</p>
      <p className={`mt-2 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>{subtitle}</p>
    </div>
  );
}

function ContentTypeBadge({ type, isDark }) {
  const isPost = type === "post";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${
        isPost
          ? isDark
            ? "border-sky-900 bg-sky-950/40 text-sky-200"
            : "border-sky-200 bg-sky-50 text-sky-700"
          : isDark
            ? "border-amber-900 bg-amber-950/40 text-amber-200"
            : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {type}
    </span>
  );
}

function formatAdminDate(value) {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString();
}

function AdminPage() {
  const { isDark } = useTheme();
  const { user: currentUser, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editableUsers, setEditableUsers] = useState({});
  const [savingById, setSavingById] = useState({});
  const [saveSuccessById, setSaveSuccessById] = useState({});
  const [saveErrorById, setSaveErrorById] = useState({});
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [createUserDraft, setCreateUserDraft] = useState(CREATE_USER_DEFAULTS);
  const [createUserErrors, setCreateUserErrors] = useState({});
  const [createUserNotice, setCreateUserNotice] = useState("");
  const [createUserResultNotice, setCreateUserResultNotice] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [moderationLoading, setModerationLoading] = useState(true);
  const [moderationError, setModerationError] = useState("");
  const [moderationNotice, setModerationNotice] = useState("");
  const [moderationItems, setModerationItems] = useState([]);
  const [contentSearchTerm, setContentSearchTerm] = useState("");
  const [contentActionByKey, setContentActionByKey] = useState({});
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    totalComments: 0,
    maskedPosts: null,
    maskedComments: null,
  });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [totalUsers, totalPosts, totalComments, maskedPosts, maskedComments] = await Promise.all([
        getTableCount("profiles"),
        getTableCount("posts"),
        getTableCount("comments"),
        getMaskedCount("posts"),
        getMaskedCount("comments"),
      ]);

      setStats({
        totalUsers,
        totalPosts,
        totalComments,
        maskedPosts,
        maskedComments,
      });
    } catch (err) {
      console.error("Admin summary load error:", err);
      setError("Unable to load admin summary right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");

    try {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select(USER_FIELDS)
        .order("full_name", { ascending: true });

      if (profilesError) {
        throw profilesError;
      }

      const rows = data || [];
      setUsers(rows);

      const editableMap = {};
      rows.forEach((row) => {
        editableMap[row.id] = {
          department: row.department || "",
          position: row.position || "",
          role: (row.role || "employee").toString().trim().toLowerCase(),
          can_manage_announcements: Boolean(row.can_manage_announcements),
          can_manage_sales: Boolean(row.can_manage_sales),
        };
      });

      setEditableUsers(editableMap);
      setSaveSuccessById({});
      setSaveErrorById({});
    } catch (err) {
      console.error("Admin users load error:", err);
      setUsersError("Unable to load users right now. Please try again.");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const loadModerationItems = useCallback(async () => {
    setModerationLoading(true);
    setModerationError("");

    try {
      const [postsResult, commentsResult] = await Promise.all([
        supabase
          .from("posts")
          .select("id, user_id, content, created_at, is_anonymous, image_url")
          .order("created_at", { ascending: false })
          .limit(MODERATION_LIMIT),
        supabase
          .from("comments")
          .select("id, post_id, user_id, content, created_at, is_anonymous")
          .order("created_at", { ascending: false })
          .limit(MODERATION_LIMIT),
      ]);

      if (postsResult.error) {
        throw postsResult.error;
      }

      if (commentsResult.error) {
        throw commentsResult.error;
      }

      const posts = postsResult.data || [];
      const comments = commentsResult.data || [];
      const authorIds = [
        ...new Set(
          [...posts, ...comments]
            .filter((item) => !item.is_anonymous && item.user_id)
            .map((item) => item.user_id)
        ),
      ];
      let profilesById = {};

      if (authorIds.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", authorIds);

        if (profilesError) {
          throw profilesError;
        }

        profilesById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
      }

      const buildAuthor = (item) => {
        if (item.is_anonymous) {
          return "Masked";
        }

        const profile = profilesById[item.user_id];
        return profile?.full_name || profile?.email || "User";
      };

      const formattedPosts = posts.map((post) => ({
        id: post.id,
        key: `post-${post.id}`,
        type: "post",
        content: post.content || "",
        author: buildAuthor(post),
        created_at: post.created_at,
        is_anonymous: Boolean(post.is_anonymous),
        meta: post.image_url ? "Includes image" : "Text post",
      }));

      const formattedComments = comments.map((comment) => ({
        id: comment.id,
        key: `comment-${comment.id}`,
        post_id: comment.post_id,
        type: "comment",
        content: comment.content || "",
        author: buildAuthor(comment),
        created_at: comment.created_at,
        is_anonymous: Boolean(comment.is_anonymous),
        meta: comment.post_id ? `Post ${comment.post_id}` : "Comment",
      }));

      setModerationItems(
        [...formattedPosts, ...formattedComments].sort(
          (first, second) => new Date(second.created_at) - new Date(first.created_at)
        )
      );
    } catch (err) {
      console.error("Admin moderation load error:", err);
      setModerationError("Unable to load moderation content right now. Please try again.");
    } finally {
      setModerationLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModerationItems();
  }, [loadModerationItems]);

  const handleEditableChange = (userId, field, value) => {
    setEditableUsers((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] || {
          department: "",
          position: "",
          role: "employee",
          can_manage_announcements: false,
          can_manage_sales: false,
        }),
        [field]: value,
      },
    }));

    setSaveSuccessById((current) => ({
      ...current,
      [userId]: "",
    }));
    setSaveErrorById((current) => ({
      ...current,
      [userId]: "",
    }));
  };

  const handleSaveUser = async (userId) => {
    const draft = editableUsers[userId];
    if (!draft) {
      return;
    }

    const isSelf = currentUser?.id === userId;
    const isCurrentUserAdmin = currentUser?.role?.toString().trim().toLowerCase() === "admin";
    const normalizedRole = (draft.role || "employee").toString().trim().toLowerCase();
    const payload = {
      department: draft.department?.trim() || null,
      position: draft.position?.trim() || null,
      role:
        isSelf && isCurrentUserAdmin
          ? "admin"
          : EDITABLE_ROLES.includes(normalizedRole)
            ? normalizedRole
            : "employee",
      can_manage_announcements: Boolean(draft.can_manage_announcements),
      can_manage_sales: Boolean(draft.can_manage_sales),
      updated_at: new Date().toISOString(),
    };

    setSavingById((current) => ({ ...current, [userId]: true }));
    setSaveSuccessById((current) => ({ ...current, [userId]: "" }));
    setSaveErrorById((current) => ({ ...current, [userId]: "" }));

    try {
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", userId)
        .select(USER_FIELDS)
        .single();

      if (updateError) {
        throw updateError;
      }

      setUsers((current) => current.map((user) => (user.id === userId ? data : user)));
      setEditableUsers((current) => ({
        ...current,
        [userId]: {
          department: data.department || "",
          position: data.position || "",
          role: (data.role || "employee").toString().trim().toLowerCase(),
          can_manage_announcements: Boolean(data.can_manage_announcements),
          can_manage_sales: Boolean(data.can_manage_sales),
        },
      }));
      if (currentUser?.id === userId) {
        await refreshUserProfile(data);
      }
      setSaveSuccessById((current) => ({
        ...current,
        [userId]: "User updated successfully.",
      }));
      setStats((current) => ({
        ...current,
        totalUsers: Math.max(current.totalUsers, users.length),
      }));
    } catch (err) {
      console.error("Admin user save error:", err);
      setSaveErrorById((current) => ({
        ...current,
        [userId]: "Failed to save changes.",
      }));
    } finally {
      setSavingById((current) => ({ ...current, [userId]: false }));
    }
  };

  const openCreateUserModal = () => {
    setCreateUserDraft(CREATE_USER_DEFAULTS);
    setCreateUserErrors({});
    setCreateUserNotice("");
    setIsCreateUserModalOpen(true);
  };

  const closeCreateUserModal = () => {
    setIsCreateUserModalOpen(false);
  };

  const handleCreateUserChange = (field, value) => {
    setCreateUserDraft((current) => ({
      ...current,
      [field]: value,
    }));

    setCreateUserErrors((current) => ({
      ...current,
      [field]: "",
    }));
    setCreateUserNotice("");
  };

  const handleCreateUserSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};
    ["full_name", "email", "department", "position", "role"].forEach((field) => {
      if (!createUserDraft[field]?.toString().trim()) {
        nextErrors[field] = "This field is required.";
      }
    });

    if (Object.keys(nextErrors).length) {
      setCreateUserErrors(nextErrors);
      setCreateUserNotice("");
      return;
    }

    const role = (createUserDraft.role || "employee").toString().trim().toLowerCase();
    if (!EDITABLE_ROLES.includes(role)) {
      setCreateUserErrors({ role: "Please select a valid role." });
      setCreateUserNotice("");
      return;
    }

    setCreateUserErrors({});
    setCreateUserNotice("");
    setCreateUserResultNotice("");
    setIsCreatingUser(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("create-user", {
        body: {
          full_name: createUserDraft.full_name.toString().trim(),
          email: createUserDraft.email.toString().trim().toLowerCase(),
          department: createUserDraft.department.toString().trim(),
          position: createUserDraft.position.toString().trim(),
          role,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || "Failed to create user.");
      }

      if (!data?.success) {
        throw new Error(data?.message || "Failed to create user.");
      }

      closeCreateUserModal();
      setCreateUserDraft(CREATE_USER_DEFAULTS);
      setCreateUserResultNotice("User created successfully.");
      await loadUsers();
      loadSummary();
    } catch (submitError) {
      setCreateUserNotice(submitError?.message || "Failed to create user.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleRemoveContent = async (item) => {
    if (!item?.id || !item?.type) {
      return;
    }

    const label = item.type === "post" ? "post" : "comment";
    const shouldRemove = window.confirm(`Remove this ${label}? This action cannot be undone.`);

    if (!shouldRemove) {
      return;
    }

    setContentActionByKey((current) => ({ ...current, [item.key]: true }));
    setModerationNotice("");

    try {
      if (item.type === "post") {
        const { error: commentDeleteError } = await supabase.from("comments").delete().eq("post_id", item.id);

        if (commentDeleteError) {
          throw commentDeleteError;
        }

        const { error: postDeleteError } = await supabase.from("posts").delete().eq("id", item.id);

        if (postDeleteError) {
          throw postDeleteError;
        }
      } else {
        const { error: commentDeleteError } = await supabase.from("comments").delete().eq("id", item.id);

        if (commentDeleteError) {
          throw commentDeleteError;
        }
      }

      setModerationItems((current) => current.filter((contentItem) => contentItem.key !== item.key));
      setModerationNotice(`${label.charAt(0).toUpperCase()}${label.slice(1)} removed.`);
      loadSummary();
    } catch (err) {
      console.error("Admin moderation remove error:", err);
      setModerationError(`Unable to remove this ${label}. Please try again.`);
    } finally {
      setContentActionByKey((current) => ({ ...current, [item.key]: false }));
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (!normalizedSearch) {
      return true;
    }

    const searchableValues = [
      user.full_name,
      user.email,
      user.employee_id,
      editableUsers[user.id]?.department ?? user.department,
      editableUsers[user.id]?.position ?? user.position,
      editableUsers[user.id]?.role ?? user.role,
    ];

    return searchableValues
      .filter((value) => value !== null && value !== undefined)
      .some((value) => value.toString().toLowerCase().includes(normalizedSearch));
  });
  const normalizedContentSearch = contentSearchTerm.trim().toLowerCase();
  const filteredModerationItems = moderationItems.filter((item) => {
    if (!normalizedContentSearch) {
      return true;
    }

    return [item.type, item.author, item.content, item.meta]
      .filter((value) => value !== null && value !== undefined)
      .some((value) => value.toString().toLowerCase().includes(normalizedContentSearch));
  });

  const getInitials = (name, email) => {
    const fallback = (email || "user").split("@")[0] || "user";
    const source = (name || fallback).trim();
    const parts = source.split(/\s+/).filter(Boolean);

    if (!parts.length) {
      return "U";
    }

    return parts
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  };

  return (
    <div className="space-y-6">
      <div
        className={`rounded-2xl border p-6 ${
          isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
        }`}
      >
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Admin dashboard</p>
        <h2 className={`mt-2 text-2xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
          Platform summary
        </h2>
        <p className={`mt-3 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          Read-only overview from Supabase.
        </p>
      </div>

      {loading ? (
        <div
          className={`rounded-2xl border p-6 text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-300" : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          Loading dashboard summary...
        </div>
      ) : null}

      {!loading && error ? (
        <div
          className={`rounded-2xl border p-6 ${
            isDark ? "border-rose-900 bg-rose-950/30 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <p className="text-sm font-medium">{error}</p>
          <button
            type="button"
            onClick={loadSummary}
            className={`mt-4 rounded-full border px-4 py-2 text-sm font-medium transition ${
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Total users"
              value={stats.totalUsers}
              subtitle="All registered profiles"
              isDark={isDark}
            />
            <StatCard
              title="Total posts"
              value={stats.totalPosts}
              subtitle="All posts in the feed"
              isDark={isDark}
            />
            <StatCard
              title="Total comments"
              value={stats.totalComments}
              subtitle="All comment records"
              isDark={isDark}
            />
            <StatCard
              title="Masked posts"
              value={stats.maskedPosts ?? "N/A"}
              subtitle={stats.maskedPosts === null ? "is_anonymous not available" : "Posts with masking enabled"}
              isDark={isDark}
            />
            <StatCard
              title="Masked comments"
              value={stats.maskedComments ?? "N/A"}
              subtitle={
                stats.maskedComments === null ? "is_anonymous not available" : "Comments with masking enabled"
              }
              isDark={isDark}
            />
          </div>

          <section
            className={`rounded-2xl border p-6 ${
              isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
            }`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500">User management</p>
                <h3 className={`mt-2 text-xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  Manage team roles and assignments
                </h3>
                {createUserResultNotice ? (
                  <p className={`mt-2 text-sm ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                    {createUserResultNotice}
                  </p>
                ) : null}
              </div>
              <div className="w-full space-y-3 md:max-w-sm">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={openCreateUserModal}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      isDark
                        ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Create User
                  </button>
                </div>
                <label
                  htmlFor="admin-user-search"
                  className={`mb-2 block text-xs uppercase tracking-[0.24em] ${
                    isDark ? "text-slate-500" : "text-slate-500"
                  }`}
                >
                  Search users
                </label>
                <input
                  id="admin-user-search"
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Name, email, employee ID, department, position, role"
                  className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition ${
                    isDark
                      ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
                      : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-500"
                  }`}
                />
              </div>
            </div>

            {usersLoading ? (
              <div
                className={`mt-6 rounded-2xl border p-4 text-sm ${
                  isDark
                    ? "border-slate-800 bg-slate-950 text-slate-300"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                Loading users...
              </div>
            ) : null}

            {!usersLoading && usersError ? (
              <div
                className={`mt-6 rounded-2xl border p-4 ${
                  isDark ? "border-rose-900 bg-rose-950/30 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                <p className="text-sm font-medium">{usersError}</p>
                <button
                  type="button"
                  onClick={loadUsers}
                  className={`mt-3 rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Reload users
                </button>
              </div>
            ) : null}

            {!usersLoading && !usersError ? (
              <div className="mt-6 space-y-4">
                {filteredUsers.length ? (
                  filteredUsers.map((user) => {
                    const draft = editableUsers[user.id] || {
                      department: user.department || "",
                      position: user.position || "",
                      role: (user.role || "employee").toString().trim().toLowerCase(),
                      can_manage_announcements: Boolean(user.can_manage_announcements),
                      can_manage_sales: Boolean(user.can_manage_sales),
                    };
                    const isSelf = currentUser?.id === user.id;
                    const isCurrentUserAdmin = currentUser?.role?.toString().trim().toLowerCase() === "admin";
                    const lockSelfAdminRole = isSelf && isCurrentUserAdmin;

                    const isSaving = Boolean(savingById[user.id]);
                    const saveSuccess = saveSuccessById[user.id];
                    const saveError = saveErrorById[user.id];
                    const displayName = user.full_name || user.email?.split("@")[0] || "Team member";

                    return (
                      <div
                        key={user.id}
                        className={`rounded-2xl border p-4 ${
                          isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border ${
                                isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
                              }`}
                            >
                              {user.avatar_url ? (
                                <img
                                  src={user.avatar_url}
                                  alt={displayName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className={`text-xs font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                                  {getInitials(user.full_name, user.email)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                                {displayName}
                              </p>
                              <p className={`truncate text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                                {user.email || "N/A"}
                              </p>
                              <p className={`truncate text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                                Employee ID: {user.employee_id || "N/A"}
                              </p>
                            </div>
                          </div>

                          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3 xl:max-w-3xl">
                            <label className="text-xs">
                              <span className={`mb-1 block uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                                Department
                              </span>
                              <input
                                type="text"
                                value={draft.department}
                                onChange={(event) => handleEditableChange(user.id, "department", event.target.value)}
                                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                                  isDark
                                    ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
                                    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-500"
                                }`}
                              />
                            </label>
                            <label className="text-xs">
                              <span className={`mb-1 block uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                                Position
                              </span>
                              <input
                                type="text"
                                value={draft.position}
                                onChange={(event) => handleEditableChange(user.id, "position", event.target.value)}
                                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                                  isDark
                                    ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
                                    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-500"
                                }`}
                              />
                            </label>
                            <label className="text-xs">
                              <span className={`mb-1 block uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                                Role
                              </span>
                              <select
                                value={lockSelfAdminRole ? "admin" : draft.role}
                                onChange={(event) => handleEditableChange(user.id, "role", event.target.value)}
                                disabled={lockSelfAdminRole}
                                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                                  isDark
                                    ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-sky-500"
                                    : "border-slate-300 bg-white text-slate-900 focus:border-sky-500"
                                }`}
                              >
                                {EDITABLE_ROLES.map((roleOption) => (
                                  <option key={roleOption} value={roleOption}>
                                    {roleOption}
                                  </option>
                                ))}
                              </select>
                              {lockSelfAdminRole ? (
                                <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                                  You cannot change your own admin role.
                                </p>
                              ) : null}
                            </label>
                            <label className="text-xs md:col-span-3">
                              <span className={`mb-2 block uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                                Permissions
                              </span>
                              <div className="flex flex-wrap gap-4">
                                <label className={`flex items-center gap-2 text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(draft.can_manage_announcements)}
                                    onChange={(event) =>
                                      handleEditableChange(user.id, "can_manage_announcements", event.target.checked)
                                    }
                                  />
                                  <span>Can Manage Announcements</span>
                                </label>
                                <label className={`flex items-center gap-2 text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(draft.can_manage_sales)}
                                    onChange={(event) =>
                                      handleEditableChange(user.id, "can_manage_sales", event.target.checked)
                                    }
                                  />
                                  <span>Can Manage Sales</span>
                                </label>
                              </div>
                            </label>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleSaveUser(user.id)}
                            disabled={isSaving}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                              isDark
                                ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 disabled:opacity-60"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                            }`}
                          >
                            {isSaving ? "Saving..." : "Save changes"}
                          </button>
                          {saveSuccess ? (
                            <p className={`text-sm ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>{saveSuccess}</p>
                          ) : null}
                          {saveError ? (
                            <p className={`text-sm ${isDark ? "text-rose-300" : "text-rose-700"}`}>{saveError}</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div
                    className={`rounded-2xl border p-4 text-sm ${
                      isDark
                        ? "border-slate-800 bg-slate-950 text-slate-300"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    No users match your search.
                  </div>
                )}
              </div>
            ) : null}
          </section>

          <section
            className={`rounded-2xl border p-6 ${
              isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
            }`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Content moderation</p>
                <h3 className={`mt-2 text-xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  Review recent posts and comments
                </h3>
              </div>
              <div className="w-full md:max-w-sm">
                <label
                  htmlFor="admin-content-search"
                  className={`mb-2 block text-xs uppercase tracking-[0.24em] ${
                    isDark ? "text-slate-500" : "text-slate-500"
                  }`}
                >
                  Search content
                </label>
                <input
                  id="admin-content-search"
                  type="text"
                  value={contentSearchTerm}
                  onChange={(event) => setContentSearchTerm(event.target.value)}
                  placeholder="Type, author, text, or source"
                  className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition ${
                    isDark
                      ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
                      : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-500"
                  }`}
                />
              </div>
            </div>

            {moderationNotice ? (
              <div
                className={`mt-6 rounded-2xl border p-4 text-sm ${
                  isDark
                    ? "border-emerald-900 bg-emerald-950/30 text-emerald-200"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {moderationNotice}
              </div>
            ) : null}

            {moderationLoading ? (
              <div
                className={`mt-6 rounded-2xl border p-4 text-sm ${
                  isDark
                    ? "border-slate-800 bg-slate-950 text-slate-300"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                Loading content queue...
              </div>
            ) : null}

            {!moderationLoading && moderationError ? (
              <div
                className={`mt-6 rounded-2xl border p-4 ${
                  isDark ? "border-rose-900 bg-rose-950/30 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                <p className="text-sm font-medium">{moderationError}</p>
                <button
                  type="button"
                  onClick={loadModerationItems}
                  className={`mt-3 rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Reload content
                </button>
              </div>
            ) : null}

            {!moderationLoading && !moderationError ? (
              <div className="mt-6 space-y-4">
                {filteredModerationItems.length ? (
                  filteredModerationItems.map((item) => {
                    const isRemoving = Boolean(contentActionByKey[item.key]);

                    return (
                      <div
                        key={item.key}
                        className={`rounded-2xl border p-4 ${
                          isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <ContentTypeBadge type={item.type} isDark={isDark} />
                              <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                                {formatAdminDate(item.created_at)}
                              </span>
                              <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                                {item.is_anonymous ? "Masked author" : item.author}
                              </span>
                            </div>
                            <p className={`break-words text-sm leading-6 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                              {item.content || "No content"}
                            </p>
                            <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>{item.meta}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveContent(item)}
                            disabled={isRemoving}
                            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                              isDark
                                ? "border-rose-900 bg-rose-950/30 text-rose-200 hover:bg-rose-950 disabled:opacity-60"
                                : "border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            }`}
                          >
                            {isRemoving ? "Removing..." : "Remove"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div
                    className={`rounded-2xl border p-4 text-sm ${
                      isDark
                        ? "border-slate-800 bg-slate-950 text-slate-300"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    No content matches your search.
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {isCreateUserModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div
            className={`w-full max-w-2xl rounded-2xl border p-6 ${
              isDark ? "border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Create user</p>
                <h3 className={`mt-2 text-xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  New account details
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCreateUserModal}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleCreateUserSubmit}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-xs">
                  <span className={`mb-1 block uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                    Full name
                  </span>
                  <input
                    type="text"
                    value={createUserDraft.full_name}
                    onChange={(event) => handleCreateUserChange("full_name", event.target.value)}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                      isDark
                        ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
                        : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-500"
                    }`}
                  />
                  {createUserErrors.full_name ? (
                    <p className={`mt-1 text-xs ${isDark ? "text-rose-300" : "text-rose-700"}`}>{createUserErrors.full_name}</p>
                  ) : null}
                </label>

                <label className="text-xs">
                  <span className={`mb-1 block uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                    Email
                  </span>
                  <input
                    type="email"
                    value={createUserDraft.email}
                    onChange={(event) => handleCreateUserChange("email", event.target.value)}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                      isDark
                        ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
                        : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-500"
                    }`}
                  />
                  {createUserErrors.email ? (
                    <p className={`mt-1 text-xs ${isDark ? "text-rose-300" : "text-rose-700"}`}>{createUserErrors.email}</p>
                  ) : null}
                </label>

                <label className="text-xs">
                  <span className={`mb-1 block uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                    Department
                  </span>
                  <input
                    type="text"
                    value={createUserDraft.department}
                    onChange={(event) => handleCreateUserChange("department", event.target.value)}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                      isDark
                        ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
                        : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-500"
                    }`}
                  />
                  {createUserErrors.department ? (
                    <p className={`mt-1 text-xs ${isDark ? "text-rose-300" : "text-rose-700"}`}>{createUserErrors.department}</p>
                  ) : null}
                </label>

                <label className="text-xs">
                  <span className={`mb-1 block uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                    Position
                  </span>
                  <input
                    type="text"
                    value={createUserDraft.position}
                    onChange={(event) => handleCreateUserChange("position", event.target.value)}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                      isDark
                        ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
                        : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-500"
                    }`}
                  />
                  {createUserErrors.position ? (
                    <p className={`mt-1 text-xs ${isDark ? "text-rose-300" : "text-rose-700"}`}>{createUserErrors.position}</p>
                  ) : null}
                </label>

                <label className="text-xs md:col-span-2">
                  <span className={`mb-1 block uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                    Role
                  </span>
                  <select
                    value={createUserDraft.role}
                    onChange={(event) => handleCreateUserChange("role", event.target.value)}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                      isDark
                        ? "border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-500"
                        : "border-slate-300 bg-white text-slate-900 focus:border-sky-500"
                    }`}
                  >
                    {EDITABLE_ROLES.map((roleOption) => (
                      <option key={roleOption} value={roleOption}>
                        {roleOption}
                      </option>
                    ))}
                  </select>
                  {createUserErrors.role ? (
                    <p className={`mt-1 text-xs ${isDark ? "text-rose-300" : "text-rose-700"}`}>{createUserErrors.role}</p>
                  ) : null}
                </label>
              </div>

              {createUserNotice ? (
                <div
                  className={`rounded-2xl border p-3 text-sm ${
                    isDark
                      ? "border-rose-900 bg-rose-950/30 text-rose-200"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  {createUserNotice}
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreateUserModal}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isDark
                      ? "border-slate-700 bg-slate-100 text-slate-900 hover:bg-slate-200"
                      : "border-slate-900 bg-slate-900 text-white hover:bg-slate-700"
                  }`}
                >
                  {isCreatingUser ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AdminPage;

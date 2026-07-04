import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminUsers } from "../services/admin_users_service";
import { getShopEmployees, getShops } from "../../services/shop_service";
import {
  createAdminNotifications,
  deleteAdminNotificationGroup,
  getAdminNotificationGroups,
  replaceAdminNotificationGroup,
  updateAdminNotificationPublishState,
} from "../../services/notifications_service";

const CATEGORIES = ["Announcement", "Achievement", "Reward", "Warning", "System"];
const PRIORITIES = ["normal", "high", "urgent"];
const TARGETS = [
  { value: "everyone", label: "Everyone" },
  { value: "user", label: "Individual Employee" },
  { value: "shop", label: "Shop" },
];

const DEFAULT_FORM = {
  title: "",
  message: "",
  category: "Announcement",
  target: "everyone",
  userId: "",
  shopId: "",
  priority: "normal",
  publish: true,
};

function validateForm(form) {
  const errors = {};

  if (!form.title.trim()) {
    errors.title = "Title is required.";
  }

  if (!form.message.trim()) {
    errors.message = "Message is required.";
  }

  if (form.target === "user" && !form.userId) {
    errors.userId = "Select an employee.";
  }

  if (form.target === "shop" && !form.shopId) {
    errors.shopId = "Select a shop.";
  }

  return errors;
}

function formatPriority(priority) {
  return priority ? priority[0].toUpperCase() + priority.slice(1) : "Normal";
}

function formatDate(value) {
  if (!value) {
    return "Draft";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function NotificationsAdminPage() {
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [editingNotification, setEditingNotification] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setError("");

    try {
      const [userRows, shopRows] = await Promise.all([
        getAdminUsers(),
        getShops({ activeOnly: false }),
      ]);

      setUsers(userRows || []);
      setShops(shopRows || []);
    } catch (err) {
      console.error("Notification options load error:", err);
      setError(err?.message || "Unable to load notification targets.");
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    setError("");

    try {
      const rows = await getAdminNotificationGroups();
      setNotifications(rows);
    } catch (err) {
      console.error("Admin notifications load error:", err);
      setError(err?.message || "Unable to load notifications.");
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
    loadNotifications();
  }, [loadNotifications, loadOptions]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aName = a.full_name || a.email || "";
      const bName = b.full_name || b.email || "";
      return aName.localeCompare(bName);
    });
  }, [users]);

  const shopsById = useMemo(() => {
    return Object.fromEntries(shops.map((shop) => [shop.id, shop]));
  }, [shops]);

  const usersById = useMemo(() => {
    return Object.fromEntries(users.map((user) => [user.id, user]));
  }, [users]);

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setFormErrors((current) => ({
      ...current,
      [field]: "",
    }));
    setNotice("");
    setError("");
  };

  const getRecipientIds = async () => {
    if (form.target === "user") {
      return form.userId ? [form.userId] : [];
    }

    if (form.target === "shop") {
      const employees = await getShopEmployees(form.shopId);
      return employees.map((employee) => employee.id);
    }

    return sortedUsers.map((user) => user.id);
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setFormErrors({});
    setEditingNotification(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const errors = validateForm(form);
    setFormErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    setSaving(true);
    setNotice("");
    setError("");

    try {
      const recipients = await getRecipientIds();
      const payload = {
        title: form.title,
        message: form.message,
        category: form.category,
        priority: form.priority,
        recipientType: form.target,
        recipientId: form.target === "shop" ? form.shopId : form.target === "user" ? form.userId : null,
        recipients,
        isPublished: form.publish,
      };

      if (editingNotification) {
        await replaceAdminNotificationGroup(editingNotification.notification_group_id, {
          ...payload,
          notificationGroupId: editingNotification.notification_group_id,
        });
        setNotice("Notification updated successfully.");
      } else {
        await createAdminNotifications(payload);
        setNotice(form.publish ? "Notification published successfully." : "Notification saved as unpublished.");
      }

      resetForm();
      await loadNotifications();
    } catch (err) {
      console.error("Notification save error:", err);
      setError(err?.message || "Unable to save notification.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (notification) => {
    setEditingNotification(notification);
    setForm({
      title: notification.title || "",
      message: notification.message || notification.body || "",
      category: notification.category || "Announcement",
      target: notification.recipient_type || "everyone",
      userId: notification.recipient_type === "user" ? notification.recipient_id || notification.user_id || "" : "",
      shopId: notification.recipient_type === "shop" ? notification.recipient_id || "" : "",
      priority: notification.priority || "normal",
      publish: notification.is_published !== false,
    });
    setFormErrors({});
    setNotice("");
    setError("");
  };

  const handleDelete = async (notification) => {
    const confirmed = window.confirm("Delete this notification? This action cannot be undone.");

    if (!confirmed) {
      return;
    }

    setActionId(notification.notification_group_id);
    setNotice("");
    setError("");

    try {
      await deleteAdminNotificationGroup(notification.notification_group_id);
      if (editingNotification?.notification_group_id === notification.notification_group_id) {
        resetForm();
      }
      setNotice("Notification deleted successfully.");
      await loadNotifications();
    } catch (err) {
      console.error("Notification delete error:", err);
      setError(err?.message || "Unable to delete notification.");
    } finally {
      setActionId("");
    }
  };

  const handleTogglePublish = async (notification) => {
    const nextPublishedState = !notification.is_published;
    setActionId(notification.notification_group_id);
    setNotice("");
    setError("");

    try {
      await updateAdminNotificationPublishState(notification.notification_group_id, nextPublishedState);
      setNotice(nextPublishedState ? "Notification published." : "Notification unpublished.");
      await loadNotifications();
    } catch (err) {
      console.error("Notification publish update error:", err);
      setError(err?.message || "Unable to update notification.");
    } finally {
      setActionId("");
    }
  };

  const getTargetLabel = (notification) => {
    if (notification.recipient_type === "shop") {
      return shopsById[notification.recipient_id]?.name || "Shop";
    }

    if (notification.recipient_type === "user") {
      const user = usersById[notification.recipient_id || notification.user_id];
      return user?.full_name || user?.email || "Employee";
    }

    return "Everyone";
  };

  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">
              {editingNotification ? "Edit Notification" : "Create Notification"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Manage in-app updates for Gemify employees.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              loadOptions();
              loadNotifications();
            }}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#c446ff] hover:text-[#c446ff]"
          >
            Refresh
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Title
            <input
              type="text"
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c446ff] focus:bg-white"
              placeholder="Monthly leaderboard has been updated"
            />
            {formErrors.title ? <p className="mt-1 text-xs text-rose-500">{formErrors.title}</p> : null}
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Category
            <select
              value={form.category}
              onChange={(event) => updateForm("category", event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-[#c446ff] focus:bg-white"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Target
            <select
              value={form.target}
              onChange={(event) => updateForm("target", event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-[#c446ff] focus:bg-white"
            >
              {TARGETS.map((target) => (
                <option key={target.value} value={target.value}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Priority
            <select
              value={form.priority}
              onChange={(event) => updateForm("priority", event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-[#c446ff] focus:bg-white"
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {formatPriority(priority)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {form.target === "user" ? (
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Individual Employee
            <select
              value={form.userId}
              onChange={(event) => updateForm("userId", event.target.value)}
              disabled={loadingOptions}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-[#c446ff] focus:bg-white disabled:opacity-60"
            >
              <option value="">Select employee</option>
              {sortedUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.email}
                </option>
              ))}
            </select>
            {formErrors.userId ? <p className="mt-1 text-xs text-rose-500">{formErrors.userId}</p> : null}
          </label>
        ) : null}

        {form.target === "shop" ? (
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Shop
            <select
              value={form.shopId}
              onChange={(event) => updateForm("shopId", event.target.value)}
              disabled={loadingOptions}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-[#c446ff] focus:bg-white disabled:opacity-60"
            >
              <option value="">Select shop</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
            {formErrors.shopId ? <p className="mt-1 text-xs text-rose-500">{formErrors.shopId}</p> : null}
          </label>
        ) : null}

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Message
          <textarea
            value={form.message}
            onChange={(event) => updateForm("message", event.target.value)}
            rows={7}
            className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c446ff] focus:bg-white"
            placeholder="Write the full notification message..."
          />
          {formErrors.message ? <p className="mt-1 text-xs text-rose-500">{formErrors.message}</p> : null}
        </label>

        <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={form.publish}
            onChange={(event) => updateForm("publish", event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#c446ff] focus:ring-[#c446ff]"
          />
          Publish
        </label>

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

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={saving || loadingOptions}
            className="h-11 rounded-2xl bg-[#c446ff] px-5 text-sm font-semibold text-white transition hover:bg-[#ad32e3] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : editingNotification ? "Update Notification" : "Create Notification"}
          </button>
          {editingNotification ? (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-[#c446ff] hover:text-[#c446ff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">Notifications</h3>
            <p className="mt-1 text-sm text-slate-500">Edit, publish, unpublish, or delete notifications.</p>
          </div>
        </div>

        {loadingNotifications ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Loading notifications...
          </div>
        ) : null}

        {!loadingNotifications && !notifications.length ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No notifications yet.
          </div>
        ) : null}

        {!loadingNotifications && notifications.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Published</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <tr key={notification.notification_group_id} className="text-slate-700">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">{notification.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{notification.message || notification.body}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-[#f6e8ff] px-3 py-1 text-xs font-semibold text-[#c446ff]">
                        {notification.category}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold">{getTargetLabel(notification)}</p>
                      <p className="mt-1 text-xs text-slate-500">{notification.recipient_count} recipient(s)</p>
                    </td>
                    <td className="px-4 py-4">{formatPriority(notification.priority)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          notification.is_published
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {notification.is_published ? "Published" : "Unpublished"}
                      </span>
                    </td>
                    <td className="px-4 py-4">{formatDate(notification.published_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(notification)}
                          className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-[#c446ff] hover:text-[#c446ff]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(notification)}
                          disabled={actionId === notification.notification_group_id}
                          className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-[#c446ff] hover:text-[#c446ff] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {notification.is_published ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(notification)}
                          disabled={actionId === notification.notification_group_id}
                          className="h-9 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default NotificationsAdminPage;

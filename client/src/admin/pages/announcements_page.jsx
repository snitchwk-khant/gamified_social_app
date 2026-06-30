import { useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveAnnouncement,
  createAnnouncement,
  getAnnouncements,
  updateAnnouncement,
  validateAnnouncementDraft,
} from "../../services/announcement_service";

const DEFAULT_FORM = {
  title: "",
  body: "",
  is_pinned: false,
  expires_at: "",
};

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateTimeLocalValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getCreatorName(announcement) {
  const creator = announcement.creator;
  return creator?.full_name || creator?.email || announcement.created_by || "N/A";
}

function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const rows = await getAnnouncements();
      setAnnouncements(rows);
    } catch (err) {
      console.error("Announcements load error:", err);
      setError(err?.message || "Unable to load announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const filteredAnnouncements = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return announcements.filter((announcement) => {
      if (statusFilter === "active" && !announcement.is_active) {
        return false;
      }

      if (statusFilter === "archived" && announcement.is_active) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [announcement.title, announcement.body].some((value) =>
        value?.toString().toLowerCase().includes(normalizedSearch)
      );
    });
  }, [announcements, searchTerm, statusFilter]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingAnnouncement(null);
    setForm(DEFAULT_FORM);
    setFormErrors({});
    setFormError("");
  };

  const openEditModal = (announcement) => {
    setModalMode("edit");
    setEditingAnnouncement(announcement);
    setForm({
      title: announcement.title || "",
      body: announcement.body || "",
      is_pinned: Boolean(announcement.is_pinned),
      expires_at: toDateTimeLocalValue(announcement.expires_at),
    });
    setFormErrors({});
    setFormError("");
  };

  const closeModal = () => {
    if (!saving) {
      setModalMode(null);
      setEditingAnnouncement(null);
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
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const errors = validateAnnouncementDraft(form);
    setFormErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      is_pinned: form.is_pinned,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };

    setSaving(true);
    setFormError("");
    setNotice("");

    try {
      if (modalMode === "edit" && editingAnnouncement?.id) {
        await updateAnnouncement(editingAnnouncement.id, payload);
        setNotice("Announcement updated successfully.");
      } else {
        await createAnnouncement(payload);
        setNotice("Announcement published successfully.");
      }

      setModalMode(null);
      setEditingAnnouncement(null);
      await loadAnnouncements();
    } catch (err) {
      console.error("Announcement save error:", err);
      setFormError(err?.message || "Unable to save announcement.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (announcement) => {
    setArchivingId(announcement.id);
    setError("");
    setNotice("");

    try {
      await archiveAnnouncement(announcement.id);
      setNotice("Announcement archived successfully.");
      await loadAnnouncements();
    } catch (err) {
      console.error("Announcement archive error:", err);
      setError(err?.message || "Unable to archive announcement.");
    } finally {
      setArchivingId("");
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Company Announcements</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openCreateModal}
              className="h-11 rounded-2xl bg-[#c446ff] px-5 text-sm font-semibold text-white transition hover:bg-[#ad32e3]"
            >
              Create Announcement
            </button>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search announcements"
              className="h-11 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c446ff] focus:bg-white sm:w-64"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-[#c446ff] focus:bg-white"
              aria-label="Filter announcements"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
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
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Title</th>
                <th className="px-5 py-4 font-semibold">Created By</th>
                <th className="px-5 py-4 font-semibold">Created At</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Pinned</th>
                <th className="px-5 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                    Loading announcements...
                  </td>
                </tr>
              ) : filteredAnnouncements.length ? (
                filteredAnnouncements.map((announcement) => (
                  <tr key={announcement.id} className="text-slate-700">
                    <td className="px-5 py-4 font-semibold text-slate-950">{announcement.title}</td>
                    <td className="px-5 py-4">{getCreatorName(announcement)}</td>
                    <td className="px-5 py-4">{formatDate(announcement.created_at)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          announcement.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {announcement.is_active ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-5 py-4">{announcement.is_pinned ? "Yes" : "No"}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(announcement)}
                          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-[#c446ff] hover:bg-[#f6e8ff] hover:text-[#c446ff]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(announcement)}
                          disabled={!announcement.is_active || archivingId === announcement.id}
                          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {archivingId === announcement.id ? "Archiving..." : "Archive"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                    No announcements found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Announcements</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">
                  {modalMode === "edit" ? "Edit Announcement" : "Create Announcement"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-slate-700">
                Title
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                />
                {formErrors.title ? <p className="mt-1 text-xs text-rose-600">{formErrors.title}</p> : null}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Body
                <textarea
                  value={form.body}
                  onChange={(event) => updateForm("body", event.target.value)}
                  rows={5}
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                />
                {formErrors.body ? <p className="mt-1 text-xs text-rose-600">{formErrors.body}</p> : null}
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={(event) => updateForm("is_pinned", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#c446ff] focus:ring-[#c446ff]"
                />
                Pin Announcement
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Expiry Date
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(event) => updateForm("expires_at", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                />
              </label>

              {formError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 rounded-2xl bg-[#c446ff] px-5 text-sm font-semibold text-white transition hover:bg-[#ad32e3] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : modalMode === "edit" ? "Save" : "Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AnnouncementsPage;

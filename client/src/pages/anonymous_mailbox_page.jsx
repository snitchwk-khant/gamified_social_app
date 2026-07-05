import { useState } from "react";
import { useTheme } from "../context/theme_context";
import {
  createAnonymousMailboxMessage,
  validateAnonymousMailboxDraft,
} from "../services/anonymous_mailbox_service";

const DEFAULT_FORM = {
  category: "General",
  subject: "Anonymous message",
  message: "",
};

const MESSAGE_TABS = [
  { id: "mailbox", label: "Mailbox" },
  { id: "gemify-room", label: "Gemify Room" },
];

function AnonymousMailboxPage() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("mailbox");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

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
    setNotice("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const errors = validateAnonymousMailboxDraft(form);
    setFormErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    setSaving(true);
    setFormError("");
    setNotice("");

    try {
      await createAnonymousMailboxMessage(form);
      setForm(DEFAULT_FORM);
      setNotice("Anonymous message submitted successfully.");
    } catch (error) {
      console.error("Anonymous mailbox submit error:", error);
      setFormError(error?.message || "Unable to submit anonymous message.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 pb-20 sm:pb-0">
      <div
        className={`rounded-3xl border p-4 shadow-sm ${
          isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <h1 className="text-2xl font-bold">Messages</h1>
        <div className={`mt-4 grid grid-cols-2 rounded-2xl p-1 ${isDark ? "bg-slate-900" : "bg-slate-100"}`}>
          {MESSAGE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`h-10 rounded-xl px-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#c446ff] text-white shadow-sm"
                    : isDark
                      ? "text-slate-300 hover:bg-slate-800"
                      : "text-slate-600 hover:bg-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "mailbox" ? (
        <div className="transition-opacity duration-200">
      <div
        className={`rounded-3xl border p-5 shadow-sm ${
          isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Anonymous Mailbox</p>
        <h1 className="mt-2 text-2xl font-bold">Send a private message</h1>
        <p className={isDark ? "mt-2 text-sm text-slate-400" : "mt-2 text-sm text-slate-500"}>
          Your identity is hidden from reviewers. Messages always appear as Masked Employee.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`rounded-3xl border p-5 shadow-sm ${
          isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="space-y-4">
          <label className={`block text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
            Message
            <textarea
              value={form.message}
              onChange={(event) => updateForm("message", event.target.value)}
              rows={7}
              placeholder="Write your anonymous message..."
              className={`mt-2 w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 ${
                isDark
                  ? "border-slate-800 bg-slate-900 text-slate-100 focus:border-sky-500"
                  : "border-slate-200 bg-slate-50 text-slate-900 focus:border-[#c446ff] focus:bg-white"
              }`}
            />
            {formErrors.message ? <p className="mt-1 text-xs text-rose-500">{formErrors.message}</p> : null}
          </label>
        </div>

        {notice ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-emerald-900 bg-emerald-950/40 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {notice}
          </div>
        ) : null}

        {formError ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-rose-900 bg-rose-950/40 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
            {formError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="mt-5 h-12 w-full rounded-2xl bg-[#c446ff] px-5 text-sm font-semibold text-white transition hover:bg-[#ad32e3] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Anonymous Message"}
        </button>
      </form>
        </div>
      ) : (
        <GemifyRoomPlaceholder isDark={isDark} />
      )}
    </section>
  );
}

function GemifyRoomPlaceholder({ isDark }) {
  return (
    <div
      className={`rounded-3xl border p-8 text-center shadow-sm transition-opacity duration-200 ${
        isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <div className="text-4xl" aria-hidden="true">
        💬
      </div>
      <h2 className="mt-4 text-xl font-bold">Gemify Room</h2>
      <p className={isDark ? "mt-2 text-sm text-slate-400" : "mt-2 text-sm text-slate-500"}>
        Coming Soon
      </p>
    </div>
  );
}

export default AnonymousMailboxPage;

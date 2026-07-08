import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTheme } from "../context/theme_context";
import {
  createAnonymousMailboxMessage,
  getAnonymousMailboxRecipients,
  validateAnonymousMailboxDraft,
} from "../services/anonymous_mailbox_service";

const DEFAULT_FORM = {
  category: "General",
  is_anonymous: true,
  subject: "Anonymous message",
  message: "",
  recipient_id: "",
};

const MESSAGE_TABS = [
  { id: "mailbox", label: "Mailbox" },
  { id: "gemify-room", label: "Gemify Room" },
];

function AnonymousMailboxPage() {
  const { isDark } = useTheme();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get("conversation");
  const [activeTab, setActiveTab] = useState(conversationId ? "gemify-room" : "mailbox");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (conversationId) {
      setActiveTab("gemify-room");
    }
  }, [conversationId]);

  useEffect(() => {
    if (activeTab !== "mailbox") {
      return undefined;
    }

    let isMounted = true;

    async function loadRecipients() {
      setRecipientsLoading(true);
      setFormError("");

      try {
        const rows = await getAnonymousMailboxRecipients();

        if (isMounted) {
          setRecipients(rows);
        }
      } catch (error) {
        console.error("Anonymous mailbox recipients load error:", error);

        if (isMounted) {
          setRecipients([]);
          setFormError(error?.message || "Unable to load recipients.");
        }
      } finally {
        if (isMounted) {
          setRecipientsLoading(false);
        }
      }
    }

    loadRecipients();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

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
      setRecipientSearch("");
      setNotice("Anonymous message submitted successfully.");
    } catch (error) {
      console.error("Anonymous mailbox submit error:", error);
      setFormError(error?.message || "Unable to submit anonymous message.");
    } finally {
      setSaving(false);
    }
  };

  const selectedRecipient = recipients.find((recipient) => recipient.id === form.recipient_id) || null;
  const filteredRecipients = recipients.filter((recipient) => {
    const searchValue = recipientSearch.trim().toLowerCase();
    const displayName = recipient.full_name || recipient.email || "Reviewer";

    if (!searchValue) {
      return true;
    }

    return [displayName, recipient.email, recipient.role].some((value) =>
      value?.toString().toLowerCase().includes(searchValue)
    );
  });

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
          Choose whether this message appears as Masked Employee or from your account.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`rounded-3xl border p-5 shadow-sm ${
          isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="space-y-4">
          <fieldset>
            <legend className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>Send As</legend>
            <div className={`mt-2 grid gap-2 rounded-2xl border p-2 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
              {[
                { value: true, label: "Masked Employee" },
                { value: false, label: "My Account" },
              ].map((option) => {
                const isSelected = form.is_anonymous === option.value;

                return (
                  <label
                    key={option.label}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      isSelected
                        ? "bg-[#c446ff] text-white shadow-sm"
                        : isDark
                          ? "text-slate-300 hover:bg-slate-800"
                          : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mailbox-send-as"
                      checked={isSelected}
                      onChange={() => updateForm("is_anonymous", option.value)}
                      className="h-4 w-4 accent-[#c446ff]"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className={`block text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
            Recipient
            <input
              type="search"
              value={recipientSearch}
              onChange={(event) => setRecipientSearch(event.target.value)}
              placeholder={selectedRecipient ? selectedRecipient.full_name || selectedRecipient.email : "Search admins and accountants"}
              disabled={recipientsLoading}
              className={`mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none transition placeholder:text-slate-400 ${
                isDark
                  ? "border-slate-800 bg-slate-900 text-slate-100 focus:border-sky-500"
                  : "border-slate-200 bg-slate-50 text-slate-900 focus:border-[#c446ff] focus:bg-white"
              }`}
            />
            {selectedRecipient ? (
              <div className={`mt-2 rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-slate-800 bg-slate-900 text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}>
                Sending to <span className="font-semibold">{selectedRecipient.full_name || selectedRecipient.email}</span>
              </div>
            ) : null}
            <div className={`mt-2 max-h-48 overflow-y-auto rounded-2xl border p-2 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
              {recipientsLoading ? (
                <p className={isDark ? "px-3 py-4 text-sm text-slate-400" : "px-3 py-4 text-sm text-slate-500"}>Loading recipients...</p>
              ) : filteredRecipients.length ? (
                filteredRecipients.map((recipient) => {
                  const isSelected = recipient.id === form.recipient_id;
                  const name = recipient.full_name || recipient.email || "Reviewer";

                  return (
                    <button
                      key={recipient.id}
                      type="button"
                      onClick={() => {
                        updateForm("recipient_id", recipient.id);
                        setRecipientSearch("");
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition ${
                        isSelected
                          ? "bg-[#f6e8ff] text-[#9f25d0]"
                          : isDark
                            ? "text-slate-200 hover:bg-slate-800"
                            : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{name}</span>
                        <span className={isDark ? "block text-xs capitalize text-slate-400" : "block text-xs capitalize text-slate-500"}>
                          {recipient.role}
                        </span>
                      </span>
                      <span aria-hidden="true">{isSelected ? "•" : ""}</span>
                    </button>
                  );
                })
              ) : (
                <p className={isDark ? "px-3 py-4 text-sm text-slate-400" : "px-3 py-4 text-sm text-slate-500"}>No recipients found.</p>
              )}
            </div>
            {formErrors.recipient_id ? <p className="mt-1 text-xs text-rose-500">{formErrors.recipient_id}</p> : null}
          </label>

          <label className={`block text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
            Message
            <textarea
              value={form.message}
              onChange={(event) => updateForm("message", event.target.value)}
              rows={7}
              placeholder={form.is_anonymous ? "Write your anonymous message..." : "Write your message..."}
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
          {saving ? "Submitting..." : form.is_anonymous ? "Submit Anonymous Message" : "Submit Message"}
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

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAnonymousMailboxMessages } from "../../services/anonymous_mailbox_service";

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

function AnonymousMailboxAdminPage() {
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const rows = await getAnonymousMailboxMessages();
      setMessages(rows);
    } catch (err) {
      console.error("Anonymous mailbox load error:", err);
      setError(err?.message || "Unable to load anonymous messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const categories = useMemo(() => {
    return [...new Set(messages.map((message) => message.category).filter(Boolean))].sort();
  }, [messages]);

  const filteredMessages = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return messages.filter((message) => {
      if (categoryFilter !== "all" && message.category !== categoryFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [message.category, message.subject, message.message].some((value) =>
        value?.toString().toLowerCase().includes(normalizedSearch)
      );
    });
  }, [categoryFilter, messages, searchTerm]);

  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Anonymous Mailbox</h2>
            <p className="mt-1 text-sm text-slate-500">Review one-way anonymous employee messages.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search messages"
              className="h-11 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c446ff] focus:bg-white sm:w-64"
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-[#c446ff] focus:bg-white"
              aria-label="Filter mailbox category"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="space-y-3 lg:hidden">
        {loading ? (
          <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
            Loading anonymous messages...
          </div>
        ) : null}

        {!loading && filteredMessages.length ? (
          filteredMessages.map((message) => (
            <article key={message.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Masked Employee</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(message.created_at)}</p>
                </div>
                <span className="rounded-full bg-[#f6e8ff] px-3 py-1 text-xs font-semibold text-[#c446ff]">
                  {message.category}
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">{message.subject}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{message.message}</p>
            </article>
          ))
        ) : null}

        {!loading && !filteredMessages.length ? (
          <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
            No anonymous messages found.
          </div>
        ) : null}
      </div>

      <div className="hidden overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Sender</th>
                <th className="px-5 py-4 font-semibold">Category</th>
                <th className="px-5 py-4 font-semibold">Subject</th>
                <th className="px-5 py-4 font-semibold">Message</th>
                <th className="px-5 py-4 font-semibold">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={5}>
                    Loading anonymous messages...
                  </td>
                </tr>
              ) : filteredMessages.length ? (
                filteredMessages.map((message) => (
                  <tr key={message.id} className="align-top text-slate-700">
                    <td className="px-5 py-4 font-semibold text-slate-950">Masked Employee</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-[#f6e8ff] px-3 py-1 text-xs font-semibold text-[#c446ff]">
                        {message.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-950">{message.subject}</td>
                    <td className="max-w-md px-5 py-4">
                      <p className="whitespace-pre-wrap leading-6">{message.message}</p>
                    </td>
                    <td className="px-5 py-4">{formatDate(message.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={5}>
                    No anonymous messages found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default AnonymousMailboxAdminPage;

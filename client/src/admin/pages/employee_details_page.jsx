import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import { supabase } from "../../lib/supabase";
import { getProfilePath } from "../../utils/profile_path";

const EMPLOYEE_DETAIL_FIELDS = "id,avatar_url,full_name,email,role,employment_start_date";

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDateValue(value) {
  return value ? value.toString().slice(0, 10) : "";
}

function formatRole(role) {
  if (role === "admin") {
    return "Admin";
  }

  if (role === "accountant") {
    return "Accountant";
  }

  if (role === "hr") {
    return "HR";
  }

  return "Employee";
}

function getInitials(name, email) {
  const source = name || email || "Employee";
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "E"
  );
}

function EmployeeDetailsPage() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [savingId, setSavingId] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: loadError } = await supabase
        .from("profiles")
        .select(EMPLOYEE_DETAIL_FIELDS)
        .order("full_name", { ascending: true });

      if (loadError) {
        throw loadError;
      }

      setEmployees(data || []);
    } catch (err) {
      console.error("Employee details load error:", err);
      setError(err?.message || "Unable to load employee details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return employees;
    }

    return employees.filter((employee) =>
      [employee.full_name, employee.email, formatRole(employee.role)].some((value) =>
        value?.toString().toLowerCase().includes(normalizedSearch)
      )
    );
  }, [employees, searchTerm]);

  const startEditing = (employee) => {
    setEditingId(employee.id);
    setDraftStartDate(normalizeDateValue(employee.employment_start_date));
    setFieldError("");
    setNotice("");
    setError("");
  };

  const cancelEditing = () => {
    setEditingId("");
    setDraftStartDate("");
    setFieldError("");
  };

  const saveStartDate = async (employee) => {
    if (draftStartDate && draftStartDate > getTodayDateValue()) {
      setFieldError("Start Date cannot be in the future.");
      return;
    }

    setSavingId(employee.id);
    setFieldError("");
    setNotice("");
    setError("");

    try {
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          employment_start_date: draftStartDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employee.id)
        .select(EMPLOYEE_DETAIL_FIELDS)
        .single();

      if (updateError) {
        throw updateError;
      }

      setEmployees((current) => current.map((item) => (item.id === employee.id ? data : item)));
      setEditingId("");
      setDraftStartDate("");
      setNotice("Employment start date saved.");
    } catch (err) {
      console.error("Employee start date save error:", err);
      setFieldError(err?.message || "Unable to save employment start date.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Employee Details</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Employment Start Dates</h2>
            <p className="mt-2 text-sm text-slate-500">Manage each employee's profile start date.</p>
          </div>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search employee"
            className="h-11 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c446ff] focus:bg-white sm:w-72"
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Avatar</th>
                <th className="px-5 py-4 font-semibold">Employee Name</th>
                <th className="px-5 py-4 font-semibold">Role</th>
                <th className="px-5 py-4 font-semibold">Employment Start Date</th>
                <th className="px-5 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={5}>
                    Loading employee details...
                  </td>
                </tr>
              ) : filteredEmployees.length ? (
                filteredEmployees.map((employee) => {
                  const isEditing = editingId === employee.id;
                  const isSaving = savingId === employee.id;
                  const displayName = employee.full_name || employee.email || "Unnamed employee";

                  return (
                    <tr key={employee.id} className="text-slate-700">
                      <td className="px-5 py-4">
                        <Link
                          to={getProfilePath(employee.id, currentUser?.id)}
                          aria-label={`Open ${displayName} profile`}
                          className="flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[#f6e8ff] text-sm font-bold text-[#c446ff]"
                        >
                          {employee.avatar_url ? (
                            <img src={employee.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(employee.full_name, employee.email)
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-950">
                        <Link to={getProfilePath(employee.id, currentUser?.id)} className="cursor-pointer transition hover:text-[#c446ff]">
                          {displayName}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#f6e8ff] px-3 py-1 text-xs font-semibold text-[#c446ff]">
                          {formatRole(employee.role)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <>
                            <input
                              type="date"
                              max={getTodayDateValue()}
                              value={draftStartDate}
                              onChange={(event) => {
                                setDraftStartDate(event.target.value);
                                setFieldError("");
                              }}
                              className="h-10 w-44 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                              aria-label={`${displayName} employment start date`}
                            />
                            {fieldError ? <p className="mt-1 text-xs text-rose-600">{fieldError}</p> : null}
                          </>
                        ) : (
                          normalizeDateValue(employee.employment_start_date) || "—"
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => saveStartDate(employee)}
                              disabled={isSaving}
                              className="h-10 rounded-2xl bg-[#c446ff] px-4 text-sm font-semibold text-white transition hover:bg-[#ad32e3] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              disabled={isSaving}
                              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditing(employee)}
                            className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={5}>
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDetailsPage;

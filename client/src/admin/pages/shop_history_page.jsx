import { useEffect, useMemo, useState } from "react";
import { getShops } from "../../services/shop_service";

const numberFormatter = new Intl.NumberFormat();
const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
const monthOptions = [
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];

const mockEmployees = [
  { id: "employee-1", full_name: "Bhone Pyae", email: "bhone@gemify.local" },
  { id: "employee-2", full_name: "Sai", email: "sai@gemify.local" },
  { id: "employee-3", full_name: "HMS", email: "hms@gemify.local" },
  { id: "employee-4", full_name: "Jue Jue", email: "jue@gemify.local" },
  { id: "employee-5", full_name: "Ko Ko Kyaw", email: "koko@gemify.local" },
];

function getDefaultHistoryPeriod() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);

  return {
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  };
}

function getInitialForm() {
  const period = getDefaultHistoryPeriod();

  return {
    employeeOfMonthId: "",
    month: period.month,
    notes: "",
    reachedSales: "1280",
    recordId: "",
    shopId: "",
    targetSales: "1000",
    year: period.year,
  };
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatMonth(month, year) {
  if (!month || !year) {
    return "--";
  }

  return monthFormatter.format(new Date(Number(year), Number(month) - 1, 1));
}

function calculateAchievement(targetSales, reachedSales) {
  const target = Number(targetSales || 0);

  if (target <= 0) {
    return 0;
  }

  return Math.round((Number(reachedSales || 0) / target) * 100);
}

function getEmployeeName(employee) {
  return employee?.full_name || employee?.email || "Unnamed employee";
}

function buildMockHistoryRecords() {
  return [
    {
      employeeIds: ["employee-1", "employee-2", "employee-4"],
      employeeOfMonthId: "employee-1",
      id: "history-1",
      month: "6",
      notes: "Strong closing week and excellent team follow-up after the mid-month push.",
      reachedSales: "1280",
      shopId: "official",
      targetSales: "1000",
      year: "2026",
    },
    {
      employeeIds: ["employee-3", "employee-5"],
      employeeOfMonthId: "employee-3",
      id: "history-2",
      month: "5",
      notes: "Consistent daily activity with a late-month improvement in conversion.",
      reachedSales: "890",
      shopId: "myanmar",
      targetSales: "900",
      year: "2026",
    },
  ];
}

function ShopHistoryPage() {
  const [records, setRecords] = useState(buildMockHistoryRecords);
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [shopsError, setShopsError] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [form, setForm] = useState(getInitialForm);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");

  const isEditing = Boolean(form.recordId);

  useEffect(() => {
    let isMounted = true;

    async function loadShops() {
      setShopsLoading(true);
      setShopsError("");

      try {
        const shopRows = await getShops();

        if (isMounted) {
          setShops(shopRows);
        }
      } catch (err) {
        console.error("Shop history shops load error:", err);

        if (isMounted) {
          setShopsError(err?.message || "Unable to load shops.");
        }
      } finally {
        if (isMounted) {
          setShopsLoading(false);
        }
      }
    }

    loadShops();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = employeeSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return mockEmployees;
    }

    return mockEmployees.filter((employee) =>
      [employee.full_name, employee.email].some((value) =>
        value?.toString().toLowerCase().includes(normalizedSearch)
      )
    );
  }, [employeeSearch]);

  const employeeOfMonthOptions = useMemo(() => {
    if (!selectedEmployeeIds.length) {
      return mockEmployees;
    }

    return mockEmployees.filter((employee) => selectedEmployeeIds.includes(employee.id));
  }, [selectedEmployeeIds]);

  const visibleRows = useMemo(() => {
    if (!form.shopId) {
      return records;
    }

    return records.filter((record) => record.shopId === form.shopId);
  }, [form.shopId, records]);

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setErrors((current) => ({
      ...current,
      [field]: "",
    }));
    setNotice("");
  };

  const resetForm = () => {
    setForm(getInitialForm());
    setSelectedEmployeeIds([]);
    setEmployeeSearch("");
    setErrors({});
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.shopId) {
      nextErrors.shopId = "Shop is required.";
    }

    if (!form.month) {
      nextErrors.month = "Month is required.";
    }

    if (!form.year) {
      nextErrors.year = "Year is required.";
    }

    if (form.targetSales === "" || !Number.isFinite(Number(form.targetSales)) || Number(form.targetSales) < 0) {
      nextErrors.targetSales = "Target Sales must be 0 or more.";
    }

    if (form.reachedSales === "" || !Number.isFinite(Number(form.reachedSales)) || Number(form.reachedSales) < 0) {
      nextErrors.reachedSales = "Reached Sales must be 0 or more.";
    }

    return nextErrors;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    const nextRecord = {
      employeeIds: selectedEmployeeIds,
      employeeOfMonthId: form.employeeOfMonthId,
      id: form.recordId || `history-${Date.now()}`,
      month: form.month,
      notes: form.notes.trim(),
      reachedSales: form.reachedSales,
      shopId: form.shopId,
      targetSales: form.targetSales,
      year: form.year,
    };

    setRecords((current) =>
      isEditing
        ? current.map((record) => (record.id === form.recordId ? nextRecord : record))
        : [nextRecord, ...current]
    );
    resetForm();
    setNotice(isEditing ? "Shop history updated in preview." : "Shop history saved in preview.");
  };

  const handleEdit = (record) => {
    setForm({
      employeeOfMonthId: record.employeeOfMonthId,
      month: record.month,
      notes: record.notes,
      reachedSales: record.reachedSales,
      recordId: record.id,
      shopId: record.shopId,
      targetSales: record.targetSales,
      year: record.year,
    });
    setSelectedEmployeeIds(record.employeeIds);
    setEmployeeSearch("");
    setErrors({});
    setNotice("");
  };

  const toggleEmployee = (employeeId) => {
    setSelectedEmployeeIds((current) => {
      const hasEmployee = current.includes(employeeId);
      const nextEmployeeIds = hasEmployee
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId];

      if (hasEmployee && form.employeeOfMonthId === employeeId) {
        setForm((currentForm) => ({
          ...currentForm,
          employeeOfMonthId: "",
        }));
      }

      return nextEmployeeIds;
    });
  };

  const handleEmployeeOfMonthChange = (employeeId) => {
    setForm((current) => ({
      ...current,
      employeeOfMonthId: employeeId,
    }));

    if (employeeId) {
      setSelectedEmployeeIds((current) =>
        current.includes(employeeId) ? current : [...current, employeeId]
      );
    }
  };

  const handleDelete = (recordId) => {
    setRecords((current) => current.filter((record) => record.id !== recordId));

    if (form.recordId === recordId) {
      resetForm();
    }

    setNotice("Shop history removed from preview.");
  };

  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Shop History</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Historical Shop Performance</h2>
          <p className="mt-2 text-sm text-slate-500">
            Preview monthly recognition details before the backend is connected.
          </p>
        </div>

        {notice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="grid gap-4 lg:grid-cols-6">
          <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
            Shop
            <select
              value={form.shopId}
              onChange={(event) => updateForm("shopId", event.target.value)}
              disabled={shopsLoading}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
            >
              <option value="">{shopsLoading ? "Loading shops..." : "Select shop"}</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
            {shopsError ? <p className="mt-1 text-xs text-rose-600">{shopsError}</p> : null}
            {errors.shopId ? <p className="mt-1 text-xs text-rose-600">{errors.shopId}</p> : null}
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Month
            <select
              value={form.month}
              onChange={(event) => updateForm("month", event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
            >
              {monthOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.month ? <p className="mt-1 text-xs text-rose-600">{errors.month}</p> : null}
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Year
            <input
              type="number"
              min="2000"
              value={form.year}
              onChange={(event) => updateForm("year", event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
            />
            {errors.year ? <p className="mt-1 text-xs text-rose-600">{errors.year}</p> : null}
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Target Sales
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.targetSales}
              onChange={(event) => updateForm("targetSales", event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
            />
            {errors.targetSales ? <p className="mt-1 text-xs text-rose-600">{errors.targetSales}</p> : null}
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Reached Sales
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.reachedSales}
              onChange={(event) => updateForm("reachedSales", event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
            />
            {errors.reachedSales ? <p className="mt-1 text-xs text-rose-600">{errors.reachedSales}</p> : null}
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">Employees</p>
              <p className="mt-1 text-xs text-slate-500">
                Select employees who worked in this shop for the historical month.
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {selectedEmployeeIds.length} selected
            </p>
          </div>

          <input
            type="search"
            value={employeeSearch}
            onChange={(event) => setEmployeeSearch(event.target.value)}
            placeholder="Search employees"
            className="mt-4 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#c446ff]"
          />

          <div className="mt-4 max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-white">
            {filteredEmployees.length ? (
              filteredEmployees.map((employee) => {
                const displayName = getEmployeeName(employee);

                return (
                  <label
                    key={employee.id}
                    className="flex cursor-pointer items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">{displayName}</span>
                      <span className="block truncate text-xs text-slate-500">{employee.email}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedEmployeeIds.includes(employee.id)}
                      onChange={() => toggleEmployee(employee.id)}
                      className="h-4 w-4 accent-[#c446ff]"
                    />
                  </label>
                );
              })
            ) : (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No employees found.</p>
            )}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Employee of the Month
              <select
                value={form.employeeOfMonthId}
                onChange={(event) => handleEmployeeOfMonthChange(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff]"
              >
                <option value="">Select employee</option>
                {employeeOfMonthOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {getEmployeeName(employee)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Notes
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                rows={3}
                className="mt-2 min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#c446ff]"
                placeholder="Add monthly context or recognition notes"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Achievement: {formatNumber(calculateAchievement(form.targetSales, form.reachedSales))}%
          </p>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {isEditing ? (
              <button
                type="button"
                onClick={resetForm}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel Edit
              </button>
            ) : null}
            <button
              type="submit"
              className="h-11 rounded-2xl bg-[#c446ff] px-5 text-sm font-semibold text-white transition hover:bg-[#ad32e3]"
            >
              {isEditing ? "Update History" : "Save History"}
            </button>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-xl font-semibold text-slate-950">History Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Month</th>
                <th className="px-5 py-4 font-semibold">Target Sales</th>
                <th className="px-5 py-4 font-semibold">Reached Sales</th>
                <th className="px-5 py-4 font-semibold">Achievement %</th>
                <th className="px-5 py-4 font-semibold">Employee of Month</th>
                <th className="px-5 py-4 font-semibold">Edit</th>
                <th className="px-5 py-4 font-semibold">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length ? (
                visibleRows.map((record) => {
                  const achievement = calculateAchievement(record.targetSales, record.reachedSales);
                  const employeeOfMonth = mockEmployees.find((employee) => employee.id === record.employeeOfMonthId);

                  return (
                    <tr key={record.id} className="text-slate-700">
                      <td className="px-5 py-4 font-semibold text-slate-950">{formatMonth(record.month, record.year)}</td>
                      <td className="px-5 py-4">{formatNumber(record.targetSales)}</td>
                      <td className="px-5 py-4">{formatNumber(record.reachedSales)}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#f6e8ff] px-3 py-1 text-xs font-semibold text-[#c446ff]">
                          {formatNumber(achievement)}%
                        </span>
                      </td>
                      <td className="px-5 py-4">{employeeOfMonth ? getEmployeeName(employeeOfMonth) : "--"}</td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => handleEdit(record)}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Edit
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => handleDelete(record.id)}
                          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                    No historical shop records found.
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

export default ShopHistoryPage;

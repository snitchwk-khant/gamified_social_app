import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  buildSharedShopHistoryRecords,
  deleteShopHistoryEmployees,
  deleteShopSalesTarget,
  getShopEmployees,
  getSharedShopHistoryRecords,
  getShops,
  saveShopHistoryEmployees,
  upsertShopSalesTarget,
} from "../../services/shop_service";
import {
  calculateAchievement,
  calculateChampionCount,
  calculateCurrentRank,
} from "../../services/shop_history_calculation_service";
import { useAuth } from "../../context/auth_context";
import { getProfilePath } from "../../utils/profile_path";

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
    month: period.month,
    reachedSales: "",
    recordId: "",
    shopId: "",
    targetSales: "",
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

function getShopName(shops, shopId) {
  const shop = shops.find((item) => item.id === shopId);

  return shop?.name || shopId || "Unassigned shop";
}

function getRecordShopName(record, shops) {
  return record.shopName || getShopName(shops, record.shopId);
}

function getEmployeeName(employee) {
  return employee?.full_name || employee?.name || employee?.email || "Employee";
}

function getInitials(name) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "E"
  );
}

function getRecordEmployees(record, employees) {
  if (record.employees?.length) {
    return record.employees;
  }

  return employees.filter((employee) => record.employeeIds.includes(employee.id));
}

function buildHistoryRecords(sharedRecords = []) {
  return sharedRecords.map((target) => {
    return {
      employeeIds: target.employeeIds || [],
      employees: target.employees || [],
      id: target.id,
      month: String(target.month),
      reachedSales: String(target.current_sales ?? ""),
      shop: target.shop || null,
      shopId: target.shop_id,
      shopName: target.shop?.name || "",
      targetSales: String(target.target_sales ?? ""),
      year: String(target.year),
    };
  });
}

function ShopHistoryPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [shopsError, setShopsError] = useState("");
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [form, setForm] = useState(getInitialForm);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordMonthFilter, setRecordMonthFilter] = useState("");
  const [recordYearFilter, setRecordYearFilter] = useState("");

  const isEditing = Boolean(form.recordId);

  useEffect(() => {
    let isMounted = true;

    async function loadShops() {
      setShopsLoading(true);
      setShopsError("");

      try {
        const shopRows = await getShops({ activeOnly: true });

        if (isMounted) {
          setShops(shopRows);
        }
      } catch (err) {
        console.error("Shop load error:", err);

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

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedShopEmployees() {
      if (!form.shopId) {
        setEmployees([]);
        return;
      }

      try {
        const employeeRows = await getShopEmployees(form.shopId);

        if (isMounted) {
          setEmployees(employeeRows);
        }
      } catch (err) {
        console.error("Shop employees load error:", err);

        if (isMounted) {
          setEmployees([]);
          setRecordsError(err?.message || "Unable to load shop employees.");
        }
      }
    }

    loadSelectedShopEmployees();

    return () => {
      isMounted = false;
    };
  }, [form.shopId]);

  useEffect(() => {
    let isMounted = true;

    async function loadHistoryRecords() {
      setRecordsLoading(true);
      setRecordsError("");

      try {
        const historyRows = await getSharedShopHistoryRecords();

        if (isMounted) {
          setRecords(buildHistoryRecords(historyRows));
          setRecordsLoading(false);
        }
      } catch (err) {
        console.error("Shop history load error:", err);

        if (isMounted) {
          setRecords([]);
          setRecordsError(err?.message || "Unable to load shop history.");
          setRecordsLoading(false);
        }
      }
    }

    loadHistoryRecords();

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleRows = useMemo(() => {
    const normalizedSearch = recordSearch.trim().toLowerCase();

    return [...records]
      .filter((record) => {
        const shopName = getRecordShopName(record, shops).toLowerCase();
        const matchesSearch = !normalizedSearch || shopName.includes(normalizedSearch);
        const matchesMonth = !recordMonthFilter || record.month === recordMonthFilter;
        const matchesYear = !recordYearFilter || record.year === recordYearFilter;

        return matchesSearch && matchesMonth && matchesYear;
      })
      .sort((first, second) => {
        if (Number(second.year) !== Number(first.year)) {
          return Number(second.year) - Number(first.year);
        }

        return Number(second.month) - Number(first.month);
      });
  }, [recordMonthFilter, recordSearch, recordYearFilter, records, shops]);
  const recordYearOptions = useMemo(() => {
    return [...new Set(records.map((record) => record.year).filter(Boolean))].sort((left, right) => Number(right) - Number(left));
  }, [records]);
  const selectedEmployees = useMemo(
    () => selectedEmployeeIds
      .map((employeeId) => employees.find((employee) => employee.id === employeeId))
      .filter(Boolean),
    [employees, selectedEmployeeIds]
  );
  const availableEmployees = useMemo(() => {
    const normalizedSearch = employeeSearch.trim().toLowerCase();

    return employees.filter((employee) => {
      if (selectedEmployeeIds.includes(employee.id)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return getEmployeeName(employee).toLowerCase().includes(normalizedSearch);
    });
  }, [employeeSearch, employees, selectedEmployeeIds]);

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      recordId: ["month", "shopId", "year"].includes(field) ? "" : current.recordId,
      [field]: value,
    }));
    setErrors((current) => ({
      ...current,
      [field]: "",
    }));
    setNotice("");

    if (field === "shopId") {
      setSelectedEmployeeIds([]);
      setEmployeePickerOpen(false);
      setEmployeeSearch("");
    }
  };

  const resetForm = () => {
    setForm(getInitialForm());
    setErrors({});
    setSelectedEmployeeIds([]);
    setEmployeePickerOpen(false);
    setEmployeeSearch("");
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

    if (!selectedEmployeeIds.length) {
      nextErrors.employees = "Select at least one employee.";
    }

    const validEmployeeIds = new Set(employees.map((employee) => employee.id));
    const hasInvalidEmployee = selectedEmployeeIds.some((employeeId) => !validEmployeeIds.has(employeeId));

    if (hasInvalidEmployee) {
      nextErrors.employees = "Only employees assigned to this shop can be selected.";
    }

    return nextErrors;
  };

  const addEmployee = (employeeId) => {
    if (!employees.some((employee) => employee.id === employeeId)) {
      return;
    }

    setSelectedEmployeeIds((current) => (current.includes(employeeId) ? current : [...current, employeeId]));
    setErrors((current) => ({
      ...current,
      employees: "",
    }));
    setEmployeeSearch("");
  };

  const removeEmployee = (employeeId) => {
    setSelectedEmployeeIds((current) => current.filter((id) => id !== employeeId));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setRecordsError("");

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    try {
      const savedTarget = await upsertShopSalesTarget({
        currentSales: form.reachedSales,
        month: form.month,
        shopId: form.shopId,
        targetSales: form.targetSales,
        year: form.year,
      });
      const savedEmployees = await saveShopHistoryEmployees({
        employeeIds: selectedEmployeeIds,
        month: form.month,
        shopId: form.shopId,
        year: form.year,
      });
      const nextRecord = buildHistoryRecords(buildSharedShopHistoryRecords([savedTarget], savedEmployees))[0];

      setRecords((current) => {
        const withoutExistingPeriod = current.filter((record) => {
          return !(record.shopId === nextRecord.shopId && record.month === nextRecord.month && record.year === nextRecord.year);
        });

        return [nextRecord, ...withoutExistingPeriod];
      });
      resetForm();
      setNotice(isEditing ? "Shop history updated." : "Shop history saved.");
    } catch (err) {
      console.error("Shop history save error:", err);
      setRecordsError(err?.message || "Unable to save shop history.");
    }
  };

  const handleEdit = (record) => {
    setForm({
      month: record.month,
      reachedSales: record.reachedSales,
      recordId: record.id,
      shopId: record.shopId,
      targetSales: record.targetSales,
      year: record.year,
    });
    setSelectedEmployeeIds(record.employeeIds || []);
    setEmployeePickerOpen(false);
    setEmployeeSearch("");
    setErrors({});
    setNotice("");
  };

  const handleDelete = async (recordId) => {
    setRecordsError("");
    const record = records.find((item) => item.id === recordId);

    if (!record) {
      return;
    }

    if (!window.confirm("Delete this history record?")) {
      return;
    }

    try {
      await deleteShopHistoryEmployees({
        month: record.month,
        shopId: record.shopId,
        year: record.year,
      });
      await deleteShopSalesTarget(recordId);
      setRecords((current) => current.filter((item) => item.id !== recordId));

      if (form.recordId === recordId) {
        resetForm();
      }

      setNotice("Shop history removed.");
    } catch (err) {
      console.error("Shop history delete error:", err);
      setRecordsError(err?.message || "Unable to delete shop history.");
    }
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

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Employees</p>
              <p className="mt-1 text-xs text-slate-500">Select employees currently assigned to this shop.</p>
            </div>
            <button
              type="button"
              onClick={() => setEmployeePickerOpen((current) => !current)}
              disabled={!form.shopId || recordsLoading}
              className="h-10 rounded-2xl bg-[#c446ff] px-4 text-sm font-semibold text-white transition hover:bg-[#ad32e3] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              + Add Employee
            </button>
          </div>

          {selectedEmployees.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedEmployees.map((employee) => (
                <EmployeeChip key={employee.id} employee={employee} onRemove={() => removeEmployee(employee.id)} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-500">
              No employees selected.
            </div>
          )}

          {employeePickerOpen ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <input
                type="search"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                placeholder="Search employees"
                className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
              />
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                {availableEmployees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => addEmployee(employee.id)}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-[#f6e8ff]"
                  >
                    <EmployeeAvatar employee={employee} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{getEmployeeName(employee)}</span>
                  </button>
                ))}

                {!availableEmployees.length ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                    {employees.length ? "No more employees available." : "No employees assigned to this shop."}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {errors.employees ? <p className="mt-2 text-xs text-rose-600">{errors.employees}</p> : null}
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

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">History Records</h3>
            <p className="mt-1 text-sm text-slate-500">Manage saved monthly shop history records.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[620px]">
            <input
              type="search"
              value={recordSearch}
              onChange={(event) => setRecordSearch(event.target.value)}
              placeholder="Search shop"
              className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
            />
            <select
              value={recordMonthFilter}
              onChange={(event) => setRecordMonthFilter(event.target.value)}
              className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
            >
              <option value="">All months</option>
              {monthOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={recordYearFilter}
              onChange={(event) => setRecordYearFilter(event.target.value)}
              className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
            >
              <option value="">All years</option>
              {recordYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {recordsError ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              {recordsError}
            </div>
          ) : null}

          {recordsLoading ? (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
              Loading shop history...
            </div>
          ) : null}

          {!recordsLoading && visibleRows.length ? (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[980px] border-separate border-spacing-y-3 text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Month</th>
                      <th className="px-4 py-3 font-semibold">Shop</th>
                      <th className="px-4 py-3 font-semibold">Achievement %</th>
                      <th className="px-4 py-3 font-semibold">Current Rank</th>
                      <th className="px-4 py-3 font-semibold">Champion Count</th>
                      <th className="px-4 py-3 font-semibold">Employees</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((record) => {
                      const achievement = calculateAchievement(record.targetSales, record.reachedSales);
                      const periodRecords = records.filter((item) => item.month === record.month && item.year === record.year);
                      const currentRank = calculateCurrentRank(record.shopId, periodRecords);
                      const championCount = calculateChampionCount(record.shopId, records);
                      const recordEmployees = getRecordEmployees(record, employees);

                      return (
                        <tr key={record.id} className="bg-slate-50 text-slate-700 transition hover:-translate-y-0.5 hover:bg-[#fdf7ff]">
                          <td className="rounded-l-2xl px-4 py-4 font-semibold text-slate-900">{formatMonth(record.month, record.year)}</td>
                          <td className="px-4 py-4 font-semibold text-slate-900">{getRecordShopName(record, shops)}</td>
                          <td className="px-4 py-4 font-bold text-[#c446ff]">{formatNumber(achievement)}%</td>
                          <td className="px-4 py-4 font-semibold">{currentRank ? `#${currentRank}` : "--"}</td>
                          <td className="px-4 py-4 font-semibold">{formatNumber(championCount)}x</td>
                          <td className="px-4 py-4">
                            <HistoryEmployeeAvatars employees={recordEmployees} userId={user?.id} />
                          </td>
                          <td className="rounded-r-2xl px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleEdit(record)}
                                className="h-9 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(record.id)}
                                className="h-9 rounded-2xl border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {visibleRows.map((record) => {
                  const achievement = calculateAchievement(record.targetSales, record.reachedSales);
                  const periodRecords = records.filter((item) => item.month === record.month && item.year === record.year);
                  const currentRank = calculateCurrentRank(record.shopId, periodRecords);
                  const championCount = calculateChampionCount(record.shopId, records);
                  const recordEmployees = getRecordEmployees(record, employees);

                  return (
                    <article key={record.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-500">{formatMonth(record.month, record.year)}</p>
                          <h4 className="mt-1 truncate text-lg font-bold text-slate-950">{getRecordShopName(record, shops)}</h4>
                        </div>
                        <p className="shrink-0 rounded-full bg-[#f6e8ff] px-3 py-1 text-xs font-bold text-[#c446ff]">
                          {formatNumber(achievement)}%
                        </p>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-white p-3">
                          <dt className="text-xs font-semibold text-slate-500">Current Rank</dt>
                          <dd className="mt-1 font-bold text-slate-900">{currentRank ? `#${currentRank}` : "--"}</dd>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <dt className="text-xs font-semibold text-slate-500">Champion Count</dt>
                          <dd className="mt-1 font-bold text-slate-900">{formatNumber(championCount)}x</dd>
                        </div>
                      </dl>

                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold text-slate-500">Employees</p>
                        <HistoryEmployeeAvatars employees={recordEmployees} userId={user?.id} />
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(record)}
                          className="h-10 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(record.id)}
                          className="h-10 flex-1 rounded-2xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : null}

          {!recordsLoading && !visibleRows.length ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <p className="text-4xl" aria-hidden="true">📊</p>
              <h4 className="mt-3 text-lg font-bold text-slate-950">
                {records.length ? "No matching history records." : "No history records yet."}
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                {records.length ? "Adjust your search or filters." : "Create your first monthly history above."}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function EmployeeAvatar({ employee }) {
  const employeeName = getEmployeeName(employee);
  const avatarUrl = employee?.avatar_url || employee?.avatarUrl;

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#f6e8ff] text-xs font-bold text-[#c446ff] shadow-sm">
      {avatarUrl ? <img src={avatarUrl} alt={employeeName} className="h-full w-full object-cover" /> : getInitials(employeeName)}
    </span>
  );
}

function HistoryEmployeeAvatars({ employees = [], userId }) {
  const visibleEmployees = employees.slice(0, 6);
  const hiddenCount = Math.max(0, employees.length - visibleEmployees.length);

  return (
    <div className="flex min-h-9 items-center">
      <div className="flex -space-x-2">
        {visibleEmployees.map((employee) => {
          const employeeName = getEmployeeName(employee);
          const avatarUrl = employee?.avatar_url || employee?.avatarUrl;

          return (
            <Link
              key={employee.id}
              to={getProfilePath(employee.id, userId)}
              aria-label={`Open ${employeeName} profile`}
              title={employeeName}
              className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#f6e8ff] text-xs font-bold text-[#c446ff] shadow-sm transition hover:z-10 hover:-translate-y-0.5 focus:z-10 focus:outline-none focus:ring-2 focus:ring-[#c446ff]/60"
            >
              {avatarUrl ? <img src={avatarUrl} alt={employeeName} className="h-full w-full object-cover" /> : getInitials(employeeName)}
            </Link>
          );
        })}
      </div>
      {hiddenCount ? (
        <span className="ml-2 flex h-9 min-w-9 items-center justify-center rounded-full bg-slate-200 px-2 text-xs font-bold text-slate-700">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function EmployeeChip({ employee, onRemove }) {
  const employeeName = getEmployeeName(employee);

  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white py-1 pl-1 pr-2 shadow-sm">
      <EmployeeAvatar employee={employee} />
      <span className="max-w-40 truncate text-sm font-semibold text-slate-800">{employeeName}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${employeeName}`}
        className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
      >
        x
      </button>
    </span>
  );
}

export default ShopHistoryPage;

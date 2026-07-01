import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import {
  assignSalesTarget,
  calculateAchievement,
  getSalesTargetEmployees,
  getSalesTargets,
  upsertSalesTarget,
} from "../../services/sales_target_service";
import {
  buildShopLeaderboard,
  createShop,
  deleteShop,
  getShopAssignmentEmployees,
  getShopEmployeeCounts,
  getShopSalesTargets,
  getShops,
  updateShop,
  updateShopEmployees,
  upsertShopSalesTarget,
} from "../../services/shop_service";
import { getProfilePath } from "../../utils/profile_path";

const numberFormatter = new Intl.NumberFormat();

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthValue(value) {
  const [year, month] = value.split("-").map((part) => Number.parseInt(part, 10));
  return { month, year };
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

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function normalizeInputValue(value) {
  return value?.toString() ?? "0";
}

function validateDraft(draft) {
  const errors = {};

  if (draft.targetSales === "") {
    errors.targetSales = "Monthly Target is required.";
  } else if (!Number.isFinite(Number(draft.targetSales))) {
    errors.targetSales = "Monthly Target must be a number.";
  } else if (Number(draft.targetSales) < 0) {
    errors.targetSales = "Monthly Target must be 0 or more.";
  }

  if (draft.currentSales === "") {
    errors.currentSales = "Current Sales is required.";
  } else if (!Number.isFinite(Number(draft.currentSales))) {
    errors.currentSales = "Current Sales must be a number.";
  } else if (Number(draft.currentSales) < 0) {
    errors.currentSales = "Current Sales must be 0 or more.";
  }

  return errors;
}

function SalesTargetsPage({ mode = "employees" }) {
  const { user } = useAuth();
  const shopManagementFormRef = useRef(null);
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue);
  const [searchTerm, setSearchTerm] = useState("");
  const [targets, setTargets] = useState([]);
  const [shops, setShops] = useState([]);
  const [shopEmployees, setShopEmployees] = useState([]);
  const [shopTargets, setShopTargets] = useState([]);
  const [shopManagementForm, setShopManagementForm] = useState({
    shopId: "new",
    code: "",
    name: "",
    is_active: true,
  });
  const [selectedShopEmployeeIds, setSelectedShopEmployeeIds] = useState([]);
  const [shopEmployeeSearch, setShopEmployeeSearch] = useState("");
  const [shopForm, setShopForm] = useState({
    shopId: "",
    targetSales: "0",
    currentSales: "0",
  });
  const [shopErrors, setShopErrors] = useState({});
  const [employees, setEmployees] = useState([]);
  const [pendingChanges, setPendingChanges] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [assignForm, setAssignForm] = useState({
    userId: "",
    monthValue: getCurrentMonthValue(),
    targetSales: "0",
  });
  const [assignErrors, setAssignErrors] = useState({});
  const [assignError, setAssignError] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopManagementSaving, setShopManagementSaving] = useState(false);
  const [shopStatusSavingId, setShopStatusSavingId] = useState("");
  const [shopDeleteDialog, setShopDeleteDialog] = useState(null);
  const [shopDeleting, setShopDeleting] = useState(false);
  const [shopSaving, setShopSaving] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pendingEntries = useMemo(() => Object.entries(pendingChanges), [pendingChanges]);
  const hasPendingChanges = pendingEntries.length > 0;
  const isEditingShop = shopManagementForm.shopId !== "new";
  const isEmployeeMode = mode === "employees";
  const isShopMode = mode === "shops";
  const isManageShopsMode = mode === "manage-shops";
  const pageTitle = isEmployeeMode ? "Employee Targets" : isShopMode ? "Shop Targets" : "Manage Shops";

  const loadTargets = useCallback(async () => {
    const period = parseMonthValue(monthValue);
    setLoading(true);
    setError("");

    try {
      const rows = await getSalesTargets(period);
      setTargets(rows);
    } catch (err) {
      console.error("Sales targets load error:", err);
      setError(err?.message || "Unable to load sales targets.");
    } finally {
      setLoading(false);
    }
  }, [monthValue]);

  useEffect(() => {
    if (!isEmployeeMode) {
      return;
    }

    loadTargets();
  }, [isEmployeeMode, loadTargets]);

  const loadShopTargets = useCallback(async () => {
    const period = parseMonthValue(monthValue);
    setShopsLoading(true);
    setError("");

    try {
      const [shopRows, employeeRows, targetRows] = await Promise.all([
        getShops(),
        getShopAssignmentEmployees(),
        getShopSalesTargets(period),
      ]);
      setShops(shopRows);
      setShopEmployees(employeeRows);
      setShopTargets(targetRows);
    } catch (err) {
      console.error("Shop targets load error:", err);
      setError(err?.message || "Unable to load shop targets.");
    } finally {
      setShopsLoading(false);
    }
  }, [monthValue]);

  useEffect(() => {
    if (!isShopMode && !isManageShopsMode) {
      return;
    }

    loadShopTargets();
  }, [isManageShopsMode, isShopMode, loadShopTargets]);

  const loadEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    setAssignError("");

    try {
      const rows = await getSalesTargetEmployees();
      setEmployees(rows);
    } catch (err) {
      console.error("Sales target employees load error:", err);
      setAssignError(err?.message || "Unable to load employees.");
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasPendingChanges) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasPendingChanges]);

  useEffect(() => {
    if (!hasPendingChanges) {
      return undefined;
    }

    const handleDocumentClick = (event) => {
      const link = event.target.closest?.("a[href]");

      if (!link || link.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const nextUrl = new URL(link.href);
      const currentUrl = new URL(window.location.href);
      const isSamePage =
        nextUrl.origin === currentUrl.origin &&
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash;

      if (nextUrl.origin !== currentUrl.origin || isSamePage) {
        return;
      }

      if (!window.confirm("You have unsaved sales target changes. Leave without saving?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasPendingChanges]);

  const filteredTargets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return targets;
    }

    return targets.filter((target) => {
      const profile = target.profile || {};
      return [profile.full_name, profile.email].some((value) =>
        value?.toString().toLowerCase().includes(normalizedSearch)
      );
    });
  }, [searchTerm, targets]);

  const shopLeaderboardRows = useMemo(() => {
    const employeeCounts = getShopEmployeeCounts(shopEmployees);

    return buildShopLeaderboard(shopTargets, { searchTerm }).map((target) => ({
      ...target,
      employeeCount: employeeCounts[target.shop_id] || 0,
    }));
  }, [searchTerm, shopEmployees, shopTargets]);

  const shopManagementRows = useMemo(() => {
    const employeeCounts = getShopEmployeeCounts(shopEmployees);

    return shops.map((shop) => ({
      ...shop,
      employeeCount: employeeCounts[shop.id] || 0,
    }));
  }, [shopEmployees, shops]);

  const filteredShopManagementRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return shopManagementRows;
    }

    return shopManagementRows.filter((shop) =>
      [shop.name, shop.code].some((value) =>
        value?.toString().toLowerCase().includes(normalizedSearch)
      )
    );
  }, [searchTerm, shopManagementRows]);

  const filteredShopEmployees = useMemo(() => {
    const normalizedSearch = shopEmployeeSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return shopEmployees;
    }

    return shopEmployees.filter((employee) =>
      [employee.full_name, employee.email].some((value) =>
        value?.toString().toLowerCase().includes(normalizedSearch)
      )
    );
  }, [shopEmployeeSearch, shopEmployees]);

  const selectedShopTarget = useMemo(() => {
    if (!shopForm.shopId) {
      return null;
    }

    return shopTargets.find((target) => target.shop_id === shopForm.shopId) || null;
  }, [shopForm.shopId, shopTargets]);

  const selectedManagementShop = useMemo(() => {
    if (shopManagementForm.shopId === "new") {
      return null;
    }

    return shops.find((shop) => shop.id === shopManagementForm.shopId) || null;
  }, [shopManagementForm.shopId, shops]);
  const editingShopName = isEditingShop ? selectedManagementShop?.name || shopManagementForm.name : "";

  const getDraft = (target) =>
    pendingChanges[target.id] || {
      targetSales: normalizeInputValue(target.target_sales),
      currentSales: normalizeInputValue(target.current_sales),
    };

  const getEmployeeIdsForShop = useCallback(
    (shopId) =>
      shopEmployees
        .filter((employee) => employee.current_shop_id === shopId)
        .map((employee) => employee.id),
    [shopEmployees]
  );

  const populateShopManagementForm = useCallback(
    (shop) => {
      if (!shop) {
        return;
      }

      setShopManagementForm({
        shopId: shop.id,
        code: shop.code || "",
        name: shop.name || "",
        is_active: shop.is_active !== false,
      });
      setSelectedShopEmployeeIds(getEmployeeIdsForShop(shop.id));
    },
    [getEmployeeIdsForShop]
  );

  const resetShopManagementForm = () => {
    setShopManagementForm({
      shopId: "new",
      code: "",
      name: "",
      is_active: true,
    });
    setSelectedShopEmployeeIds([]);
    setShopEmployeeSearch("");
  };

  useEffect(() => {
    if (!shopForm.shopId) {
      return;
    }

    setShopForm((current) => ({
      ...current,
      targetSales: normalizeInputValue(selectedShopTarget?.target_sales),
      currentSales: normalizeInputValue(selectedShopTarget?.current_sales),
    }));
  }, [selectedShopTarget, shopForm.shopId]);

  useEffect(() => {
    if (!selectedManagementShop) {
      return;
    }

    populateShopManagementForm(selectedManagementShop);
  }, [populateShopManagementForm, selectedManagementShop]);

  const handleMonthChange = (value) => {
    if (hasPendingChanges && !window.confirm("You have unsaved sales target changes. Change month without saving?")) {
      return;
    }

    setPendingChanges({});
    setFormErrors({});
    setNotice("");
    setMonthValue(value);
  };

  const openAssignModal = () => {
    setAssignForm({
      userId: "",
      monthValue: getCurrentMonthValue(),
      targetSales: "0",
    });
    setAssignErrors({});
    setAssignError("");
    setAssignModalOpen(true);
    loadEmployees();
  };

  const closeAssignModal = () => {
    if (!assigning) {
      setAssignModalOpen(false);
    }
  };

  const updateAssignForm = (field, value) => {
    setAssignForm((current) => ({
      ...current,
      [field]: value,
    }));
    setAssignErrors((current) => ({
      ...current,
      [field]: "",
    }));
    setAssignError("");
  };

  const validateAssignForm = () => {
    const errors = {};

    if (!assignForm.userId) {
      errors.userId = "Employee is required.";
    }

    if (!assignForm.monthValue) {
      errors.monthValue = "Month is required.";
    }

    if (assignForm.targetSales === "") {
      errors.targetSales = "Monthly Target is required.";
    } else if (!Number.isFinite(Number(assignForm.targetSales))) {
      errors.targetSales = "Monthly Target must be a number.";
    } else if (Number(assignForm.targetSales) < 0) {
      errors.targetSales = "Monthly Target must be 0 or more.";
    }

    return errors;
  };

  const updateTargetDraft = (target, field, value) => {
    const originalDraft = {
      targetSales: normalizeInputValue(target.target_sales),
      currentSales: normalizeInputValue(target.current_sales),
    };
    const currentDraft = pendingChanges[target.id] || originalDraft;
    const nextDraft = {
      ...currentDraft,
      [field]: value,
    };

    setPendingChanges((current) => {
      const nextChanges = { ...current };

      if (
        nextDraft.targetSales === originalDraft.targetSales &&
        nextDraft.currentSales === originalDraft.currentSales
      ) {
        delete nextChanges[target.id];
      } else {
        nextChanges[target.id] = {
          ...nextDraft,
          target,
        };
      }

      return nextChanges;
    });

    setFormErrors((current) => ({
      ...current,
      [target.id]: {
        ...current[target.id],
        [field]: "",
      },
    }));
    setError("");
    setNotice("");
  };

  const validatePendingChanges = () => {
    const nextErrors = {};

    pendingEntries.forEach(([targetId, draft]) => {
      const errors = validateDraft(draft);

      if (Object.keys(errors).length) {
        nextErrors[targetId] = errors;
      }
    });

    return nextErrors;
  };

  const handleSaveAll = async () => {
    const nextErrors = validatePendingChanges();
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await Promise.all(
        pendingEntries.map(([, draft]) =>
          upsertSalesTarget({
            userId: draft.target.user_id,
            month: draft.target.month,
            year: draft.target.year,
            targetSales: draft.targetSales,
            currentSales: draft.currentSales,
          })
        )
      );
      await loadTargets();
      setPendingChanges({});
      setFormErrors({});
      setNotice("Sales target changes saved successfully.");
    } catch (err) {
      console.error("Sales target bulk save error:", err);
      setError(err?.message || "Unable to save sales target changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignTarget = async (event) => {
    event.preventDefault();

    const errors = validateAssignForm();
    setAssignErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    const period = parseMonthValue(assignForm.monthValue);
    setAssigning(true);
    setAssignError("");
    setNotice("");

    try {
      await assignSalesTarget({
        userId: assignForm.userId,
        month: period.month,
        year: period.year,
        targetSales: assignForm.targetSales,
      });
      await loadTargets();
      setAssignModalOpen(false);
      setNotice("Sales target assigned successfully.");
    } catch (err) {
      console.error("Sales target assign error:", err);
      setAssignError(err?.message || "Unable to assign sales target.");
    } finally {
      setAssigning(false);
    }
  };

  const updateShopForm = (field, value) => {
    setShopForm((current) => ({
      ...current,
      [field]: value,
    }));
    setShopErrors((current) => ({
      ...current,
      [field]: "",
    }));
    setError("");
    setNotice("");
  };

  const updateShopManagementForm = (field, value) => {
    setShopManagementForm((current) => ({
      ...current,
      [field]: value,
    }));
    setShopErrors((current) => ({
      ...current,
      [field]: "",
    }));
    setError("");
    setNotice("");
  };

  const handleSelectManagementShop = (shopId) => {
    if (shopId === "new") {
      resetShopManagementForm();
      return;
    }

    const shop = shops.find((shopRow) => shopRow.id === shopId);
    populateShopManagementForm(shop);
  };

  const handleEditShop = (shopId) => {
    const shop = shops.find((shopRow) => shopRow.id === shopId);
    populateShopManagementForm(shop);
    setNotice("");
    setError("");
    window.requestAnimationFrame(() => {
      shopManagementFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleCancelShopEdit = () => {
    resetShopManagementForm();
    setShopErrors({});
    setError("");
    setNotice("");
  };

  const toggleShopEmployee = (employeeId) => {
    setSelectedShopEmployeeIds((current) => {
      const hasEmployee = current.includes(employeeId);

      return hasEmployee
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId];
    });
  };

  const handleSaveShopManagement = async (event) => {
    event.preventDefault();

    const errors = {};

    if (!shopManagementForm.name.trim()) {
      errors.name = "Shop name is required.";
    }

    setShopErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    setShopManagementSaving(true);
    setError("");
    setNotice("");

    try {
      const wasCreatingShop = shopManagementForm.shopId === "new";
      const savedShop =
        wasCreatingShop
          ? await createShop(shopManagementForm)
          : await updateShop(shopManagementForm.shopId, shopManagementForm);

      await updateShopEmployees(savedShop.id, selectedShopEmployeeIds);
      await loadShopTargets();
      resetShopManagementForm();
      setNotice(wasCreatingShop ? "Shop created successfully." : "Shop updated successfully.");
    } catch (err) {
      console.error("Shop management save error:", err);
      setError(err?.message || "Unable to save shop.");
    } finally {
      setShopManagementSaving(false);
    }
  };

  const openDeleteShopDialog = (shop) => {
    setShopDeleteDialog(shop);
    setError("");
    setNotice("");
  };

  const closeDeleteShopDialog = () => {
    if (!shopDeleting) {
      setShopDeleteDialog(null);
    }
  };

  const handleDeleteShop = async () => {
    if (!shopDeleteDialog?.id || shopDeleting) {
      return;
    }

    setShopStatusSavingId(shopDeleteDialog.id);
    setShopDeleting(true);
    setError("");
    setNotice("");

    try {
      await deleteShop(shopDeleteDialog.id);
      await loadShopTargets();
      if (shopManagementForm.shopId === shopDeleteDialog.id) {
        resetShopManagementForm();
      }
      if (shopForm.shopId === shopDeleteDialog.id) {
        setShopForm({
          shopId: "",
          targetSales: "0",
          currentSales: "0",
        });
      }
      setShopDeleteDialog(null);
      setNotice("Shop deleted successfully.");
    } catch (err) {
      console.error("Shop delete error:", err);
      setError(err?.message || "Unable to delete shop.");
    } finally {
      setShopStatusSavingId("");
      setShopDeleting(false);
    }
  };

  const handleSaveShopTarget = async (event) => {
    event.preventDefault();

    const errors = {};

    if (!shopForm.shopId) {
      errors.shopId = "Shop is required.";
    }

    const draftErrors = validateDraft(shopForm);

    Object.assign(errors, draftErrors);
    setShopErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    const period = parseMonthValue(monthValue);
    setShopSaving(true);
    setError("");
    setNotice("");

    try {
      await upsertShopSalesTarget({
        shopId: shopForm.shopId,
        month: period.month,
        year: period.year,
        targetSales: shopForm.targetSales,
        currentSales: shopForm.currentSales,
      });
      await loadShopTargets();
      setNotice("Shop target saved successfully.");
    } catch (err) {
      console.error("Shop target save error:", err);
      setError(err?.message || "Unable to save shop target.");
    } finally {
      setShopSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">{pageTitle}</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {isEmployeeMode ? (
              <button
                type="button"
                onClick={openAssignModal}
                className="h-11 rounded-2xl border border-[#c446ff] bg-white px-5 text-sm font-semibold text-[#c446ff] transition hover:bg-[#f6e8ff]"
              >
                + Assign Sales Target
              </button>
            ) : null}
            {isManageShopsMode ? null : (
              <input
                type="month"
                value={monthValue}
                onChange={(event) => handleMonthChange(event.target.value)}
                className="h-11 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-[#c446ff] focus:bg-white sm:w-48"
                aria-label="Select month"
              />
            )}
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={isEmployeeMode ? "Search employee" : "Search shop"}
              className="h-11 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c446ff] focus:bg-white sm:w-64"
            />
            {isEmployeeMode ? (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={!hasPendingChanges || saving}
                className="h-11 rounded-2xl bg-[#c446ff] px-5 text-sm font-semibold text-white transition hover:bg-[#ad32e3] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : `Save All Changes${hasPendingChanges ? ` (${pendingEntries.length})` : ""}`}
              </button>
            ) : null}
          </div>
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

      {isEmployeeMode ? (
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Avatar</th>
                <th className="px-5 py-4 font-semibold">Employee Name</th>
                <th className="px-5 py-4 font-semibold">Monthly Target</th>
                <th className="px-5 py-4 font-semibold">Current Sales</th>
                <th className="px-5 py-4 font-semibold">Achievement %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={5}>
                    Loading sales targets...
                  </td>
                </tr>
              ) : filteredTargets.length ? (
                filteredTargets.map((target) => {
                  const profile = target.profile || {};
                  const displayName = profile.full_name || profile.email || "Unnamed employee";
                  const draft = getDraft(target);
                  const achievement = calculateAchievement(draft.targetSales, draft.currentSales);
                  const rowErrors = formErrors[target.id] || {};

                  return (
                    <tr key={target.id} className="text-slate-700">
                      <td className="px-5 py-4">
                        <Link
                          to={getProfilePath(target.user_id, user?.id)}
                          aria-label={`Open ${displayName} profile`}
                          className="flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[#f6e8ff] text-sm font-bold text-[#c446ff]"
                        >
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(profile.full_name, profile.email)
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-950">
                        <Link to={getProfilePath(target.user_id, user?.id)} className="cursor-pointer transition hover:text-[#c446ff]">
                          {displayName}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={draft.targetSales}
                          onChange={(event) => updateTargetDraft(target, "targetSales", event.target.value)}
                          className="h-10 w-36 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                          aria-label={`${displayName} monthly target`}
                        />
                        {rowErrors.targetSales ? <p className="mt-1 text-xs text-rose-600">{rowErrors.targetSales}</p> : null}
                      </td>
                      <td className="px-5 py-4">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={draft.currentSales}
                          onChange={(event) => updateTargetDraft(target, "currentSales", event.target.value)}
                          className="h-10 w-36 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                          aria-label={`${displayName} current sales`}
                        />
                        {rowErrors.currentSales ? <p className="mt-1 text-xs text-rose-600">{rowErrors.currentSales}</p> : null}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#f6e8ff] px-3 py-1 text-xs font-semibold text-[#c446ff]">
                          {formatNumber(achievement)}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={5}>
                    No sales targets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : null}

      {isManageShopsMode ? (
        <>
          <form
            ref={shopManagementFormRef}
            onSubmit={handleSaveShopManagement}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Shop Management</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">
                  {isEditingShop ? "Edit shop and assigned employees" : "Create, edit, and assign employees"}
                </h3>
                {isEditingShop ? (
                  <p className="mt-2 text-sm font-semibold text-slate-600">Editing: {editingShopName}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handleSelectManagementShop("new")}
                className="h-10 rounded-2xl border border-[#c446ff] bg-white px-4 text-sm font-semibold text-[#c446ff] transition hover:bg-[#f6e8ff]"
              >
                + New Shop
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <label className="block text-sm font-medium text-slate-700">
                Existing Shop
                <select
                  value={shopManagementForm.shopId}
                  onChange={(event) => handleSelectManagementShop(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                >
                  <option value="new">Create new shop</option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name} {shop.is_active === false ? "(Inactive)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Code
                <input
                  value={shopManagementForm.code}
                  onChange={(event) => updateShopManagementForm("code", event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                  placeholder="Optional"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Shop Name
                <input
                  value={shopManagementForm.name}
                  onChange={(event) => updateShopManagementForm("name", event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                  placeholder="Shop name"
                />
                {shopErrors.name ? <p className="mt-1 text-xs text-rose-600">{shopErrors.name}</p> : null}
              </label>

            </div>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={shopManagementForm.is_active}
                  onChange={(event) => updateShopManagementForm("is_active", event.target.checked)}
                  className="h-4 w-4 accent-[#c446ff]"
                />
                Active shop
              </label>

              <div className="min-w-0 flex-1">
                <input
                  type="search"
                  value={shopEmployeeSearch}
                  onChange={(event) => setShopEmployeeSearch(event.target.value)}
                  placeholder="Search employees to assign"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#c446ff] focus:bg-white"
                />
              </div>
            </div>

            <div className="mt-4 max-h-56 overflow-auto rounded-2xl border border-slate-200">
              {filteredShopEmployees.length ? (
                filteredShopEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex cursor-pointer items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <Link
                        to={getProfilePath(employee.id, user?.id)}
                        className="block cursor-pointer truncate font-semibold text-slate-800 transition hover:text-[#c446ff]"
                      >
                        {employee.full_name || employee.email || "Unnamed employee"}
                      </Link>
                      <span className="block truncate text-xs text-slate-500">{employee.email}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {employee.current_shop?.name ? `Current shop: ${employee.current_shop.name}` : "Unassigned"}
                      </span>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center">
                      <span className="sr-only">
                        {selectedShopEmployeeIds.includes(employee.id) ? "Unassign" : "Assign"} {employee.full_name || employee.email}
                      </span>
                      <input
                        type="checkbox"
                        checked={selectedShopEmployeeIds.includes(employee.id)}
                        onChange={() => toggleShopEmployee(employee.id)}
                        className="h-4 w-4 accent-[#c446ff]"
                      />
                    </label>
                  </div>
                ))
              ) : (
                <p className="px-4 py-6 text-center text-sm text-slate-500">No employees found.</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {selectedShopEmployeeIds.length} employee{selectedShopEmployeeIds.length === 1 ? "" : "s"} selected
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                {isEditingShop ? (
                  <button
                    type="button"
                    onClick={handleCancelShopEdit}
                    disabled={shopManagementSaving}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={shopManagementSaving}
                  className="h-11 rounded-2xl bg-[#c446ff] px-5 text-sm font-semibold text-white transition hover:bg-[#ad32e3] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {shopManagementSaving ? "Saving..." : isEditingShop ? "Update Shop" : "Save Shop"}
                </button>
              </div>
            </div>
          </form>

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Shop List</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">Manage Shops</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Shop Name</th>
                    <th className="px-5 py-4 font-semibold">Code</th>
                    <th className="px-5 py-4 font-semibold">Employee Count</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shopsLoading ? (
                    <tr>
                      <td className="px-5 py-8 text-center text-slate-500" colSpan={5}>
                        Loading shops...
                      </td>
                    </tr>
                  ) : filteredShopManagementRows.length ? (
                    filteredShopManagementRows.map((shop) => (
                      <tr key={shop.id} className="text-slate-700">
                        <td className="px-5 py-4 font-semibold text-slate-950">{shop.name}</td>
                        <td className="px-5 py-4">{shop.code || "N/A"}</td>
                        <td className="px-5 py-4">{formatNumber(shop.employeeCount)}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              shop.is_active === false
                                ? "bg-slate-100 text-slate-600"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {shop.is_active === false ? "Inactive" : "Active"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditShop(shop.id)}
                              disabled={shopStatusSavingId === shop.id}
                              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteShopDialog(shop)}
                              disabled={shopStatusSavingId === shop.id}
                              className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {shopStatusSavingId === shop.id ? "Deleting..." : "🗑 Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-5 py-8 text-center text-slate-500" colSpan={5}>
                        No shops found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {isShopMode ? (
        <>
          <form
            onSubmit={handleSaveShopTarget}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
          >
            <div className="grid gap-4 lg:grid-cols-4">
              <label className="block text-sm font-medium text-slate-700">
                Shop
                <select
                  value={shopForm.shopId}
                  onChange={(event) => updateShopForm("shopId", event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                  disabled={shopsLoading}
                >
                  <option value="">{shopsLoading ? "Loading shops..." : "Select shop"}</option>
                  {shops.filter((shop) => shop.is_active !== false).map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}
                    </option>
                  ))}
                </select>
                {shopErrors.shopId ? <p className="mt-1 text-xs text-rose-600">{shopErrors.shopId}</p> : null}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Target Sales
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shopForm.targetSales}
                  onChange={(event) => updateShopForm("targetSales", event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                />
                {shopErrors.targetSales ? <p className="mt-1 text-xs text-rose-600">{shopErrors.targetSales}</p> : null}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Current Sales
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shopForm.currentSales}
                  onChange={(event) => updateShopForm("currentSales", event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                />
                {shopErrors.currentSales ? <p className="mt-1 text-xs text-rose-600">{shopErrors.currentSales}</p> : null}
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={shopSaving}
                  className="h-11 w-full rounded-2xl bg-[#c446ff] px-5 text-sm font-semibold text-white transition hover:bg-[#ad32e3] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {shopSaving ? "Saving..." : "Save Shop Target"}
                </button>
              </div>
            </div>
          </form>

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Rank</th>
                    <th className="px-5 py-4 font-semibold">Shop Name</th>
                    <th className="px-5 py-4 font-semibold">Achievement %</th>
                    <th className="px-5 py-4 font-semibold">Current Sales</th>
                    <th className="px-5 py-4 font-semibold">Target Sales</th>
                    <th className="px-5 py-4 font-semibold">Employee Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shopsLoading ? (
                    <tr>
                      <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                        Loading shop targets...
                      </td>
                    </tr>
                  ) : shopLeaderboardRows.length ? (
                    shopLeaderboardRows.map((target) => (
                      <tr key={target.id} className="text-slate-700">
                        <td className="px-5 py-4 font-semibold text-slate-950">#{target.rank}</td>
                        <td className="px-5 py-4 font-semibold text-slate-950">{target.shopName}</td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-[#f6e8ff] px-3 py-1 text-xs font-semibold text-[#c446ff]">
                            {formatNumber(target.achievement)}%
                          </span>
                        </td>
                        <td className="px-5 py-4">{formatNumber(target.current_sales)}</td>
                        <td className="px-5 py-4">{formatNumber(target.target_sales)}</td>
                        <td className="px-5 py-4">{formatNumber(target.employeeCount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                        No shop targets found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {shopDeleteDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">Delete Shop</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">Delete Shop</h3>
              <p className="mt-4 text-sm text-slate-600">This will permanently delete the shop.</p>
              <p className="mt-4 text-sm font-semibold text-slate-700">The following data will also be removed:</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>• Shop Sales Targets</li>
                <li>• Shop Champion History</li>
              </ul>
              <p className="mt-4 text-sm text-slate-600">Employees assigned to this shop will become Unassigned.</p>
              <p className="mt-2 text-sm font-semibold text-rose-600">This action cannot be undone.</p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteShopDialog}
                disabled={shopDeleting}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteShop}
                disabled={shopDeleting}
                className="h-11 rounded-2xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {shopDeleting ? "Deleting..." : "Delete Shop"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {assignModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Sales Target</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">Assign Sales Target</h3>
              </div>
              <button
                type="button"
                onClick={closeAssignModal}
                disabled={assigning}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleAssignTarget}>
              <label className="block text-sm font-medium text-slate-700">
                Employee
                <select
                  value={assignForm.userId}
                  onChange={(event) => updateAssignForm("userId", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                  disabled={employeesLoading}
                >
                  <option value="">{employeesLoading ? "Loading employees..." : "Select employee"}</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name || employee.email || "Unnamed employee"}
                    </option>
                  ))}
                </select>
                {assignErrors.userId ? <p className="mt-1 text-xs text-rose-600">{assignErrors.userId}</p> : null}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Month
                <input
                  type="month"
                  value={assignForm.monthValue}
                  onChange={(event) => updateAssignForm("monthValue", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                />
                {assignErrors.monthValue ? <p className="mt-1 text-xs text-rose-600">{assignErrors.monthValue}</p> : null}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Monthly Target
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={assignForm.targetSales}
                  onChange={(event) => updateAssignForm("targetSales", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#c446ff] focus:bg-white"
                />
                {assignErrors.targetSales ? (
                  <p className="mt-1 text-xs text-rose-600">{assignErrors.targetSales}</p>
                ) : null}
              </label>

              {assignError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {assignError}
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  disabled={assigning}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="h-11 rounded-2xl bg-[#c446ff] px-5 text-sm font-semibold text-white transition hover:bg-[#ad32e3] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assigning ? "Assigning..." : "Assign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default SalesTargetsPage;

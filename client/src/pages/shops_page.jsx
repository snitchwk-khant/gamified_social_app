import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/theme_context";
import { getShopAssignmentEmployees, getShops, subscribeToShopAssignments } from "../services/shop_service";
import { getShopPath } from "../utils/shop_path";

function getShopEmployeeCounts(employees = []) {
  return employees.reduce((counts, employee) => {
    const shopId = employee.current_shop_id || employee.shop_id;

    if (!shopId) {
      return counts;
    }

    counts[shopId] = (counts[shopId] || 0) + 1;
    return counts;
  }, {});
}

function ShopsPage() {
  const { isDark } = useTheme();
  const [shops, setShops] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadShops = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [shopRows, employeeRows] = await Promise.all([
        getShops(),
        getShopAssignmentEmployees(),
      ]);
      setShops(shopRows);
      setEmployees(employeeRows);
    } catch (err) {
      console.error("Shop list load error:", err);
      setError(err?.message || "Unable to load shops.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    return subscribeToShopAssignments(loadShops);
  }, [loadShops]);

  const employeeCounts = useMemo(() => getShopEmployeeCounts(employees), [employees]);
  const filteredShops = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return shops;
    }

    return shops.filter((shop) =>
      [shop.name, shop.code].some((value) => value?.toString().toLowerCase().includes(normalizedSearch))
    );
  }, [searchTerm, shops]);

  return (
    <section className="space-y-5">
      <div
        className={`rounded-2xl border p-5 shadow-sm ${
          isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Shops</h1>
            <p className={isDark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"}>
              Browse shops and open details
            </p>
          </div>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search shop"
            className={`h-11 min-w-0 rounded-2xl border px-4 text-sm outline-none transition placeholder:text-slate-400 sm:w-64 ${
              isDark
                ? "border-slate-800 bg-slate-900 text-slate-100 focus:border-sky-500"
                : "border-slate-200 bg-slate-50 text-slate-900 focus:border-[#c446ff] focus:bg-white"
            }`}
          />
        </div>

        {error ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              isDark ? "border-rose-900 bg-rose-950/40 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {error}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div
          className={`rounded-2xl border px-5 py-8 text-center text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          Loading shops...
        </div>
      ) : null}

      {!loading && filteredShops.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredShops.map((shop) => (
            <Link
              key={shop.id}
              to={getShopPath(shop.id)}
              className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#c446ff]/50 ${
                isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{shop.name}</h2>
                  {shop.code ? (
                    <p className={isDark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"}>{shop.code}</p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    shop.is_active
                      ? isDark
                        ? "bg-emerald-950 text-emerald-200"
                        : "bg-emerald-50 text-emerald-700"
                      : isDark
                        ? "bg-slate-800 text-slate-300"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {shop.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className={isDark ? "mt-4 text-sm text-slate-400" : "mt-4 text-sm text-slate-500"}>
                {employeeCounts[shop.id] || 0} employees
              </p>
            </Link>
          ))}
        </div>
      ) : null}

      {!loading && !filteredShops.length ? (
        <div
          className={`rounded-2xl border px-5 py-8 text-center text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-400" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          No shops found.
        </div>
      ) : null}
    </section>
  );
}

export default ShopsPage;

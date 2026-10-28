import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";
import { build } from "vite";

const projectRoot = path.resolve(import.meta.dirname, "..");
const leaderboardSourcePath = path.join(projectRoot, "src/services/leaderboard_service.js");
const salesTargetSourcePath = path.join(projectRoot, "src/services/sales_target_service.js");
const buildDirectory = await mkdtemp(path.join(tmpdir(), "gemify-p1-3-tests-"));

await build({
  configFile: false,
  logLevel: "silent",
  build: {
    emptyOutDir: true,
    outDir: buildDirectory,
    rollupOptions: {
      input: leaderboardSourcePath,
      output: {
        entryFileNames: "leaderboard_service.mjs",
        format: "es",
      },
    },
    ssr: leaderboardSourcePath,
  },
});

const leaderboard = await import(pathToFileURL(path.join(buildDirectory, "leaderboard_service.mjs")));
const leaderboardSource = await readFile(leaderboardSourcePath, "utf8");
const salesTargetSource = await readFile(salesTargetSourcePath, "utf8");

after(() => {
  // The operating system owns cleanup of this disposable temporary build directory.
});

function target({
  id,
  userId,
  name,
  email = `${String(name || "employee").toLowerCase()}@example.test`,
  role = "employee",
  targetSales = 100,
  currentSales = 0,
  updatedAt = "2026-10-01T00:00:00.000Z",
  month = 10,
  year = 2026,
} = {}) {
  return {
    id,
    user_id: userId,
    month,
    year,
    target_sales: targetSales,
    current_sales: currentSales,
    updated_at: updatedAt,
    profile: {
      id: userId,
      full_name: name,
      email,
      avatar_url: "",
      role,
    },
  };
}

test("retained export contract excludes removed legacy APIs", () => {
  assert.deepEqual(Object.keys(leaderboard).sort(), [
    "buildLeaderboard",
    "calculateAchievement",
    "getCurrentUserRank",
    "getTopThree",
  ]);

  assert.doesNotMatch(leaderboardSource, /getLeaderboardMembers/);
  assert.doesNotMatch(leaderboardSource, /subscribeToLeaderboardChanges/);
  assert.doesNotMatch(leaderboardSource, /leaderboard-realtime/);
  assert.doesNotMatch(leaderboardSource, /profiles\.is_active/);
  assert.doesNotMatch(leaderboardSource, /id,full_name,email,avatar_url,level,xp,is_active/);
});

test("employee ranking excludes admin and accountant targets", () => {
  const rows = leaderboard.buildLeaderboard([
    target({ id: "employee-1", userId: "employee-1", name: "Employee One", currentSales: 90 }),
    target({ id: "admin-1", userId: "admin-1", name: "Admin One", role: "admin", currentSales: 100 }),
    target({ id: "accountant-1", userId: "accountant-1", name: "Accountant One", role: "accountant", currentSales: 100 }),
  ]);

  assert.deepEqual(rows.map((row) => row.employeeId), ["employee-1"]);
  assert.equal(rows[0].rank, 1);
});

test("current-user rank returns the ranked employee and excludes non-employees", () => {
  const rows = [
    target({ id: "employee-1", userId: "employee-1", name: "Employee One", currentSales: 100 }),
    target({ id: "employee-2", userId: "employee-2", name: "Employee Two", currentSales: 80 }),
    target({ id: "admin-1", userId: "admin-1", name: "Admin One", role: "admin", currentSales: 200 }),
  ];

  const current = leaderboard.getCurrentUserRank(rows, "employee-2");
  assert.equal(current?.employeeId, "employee-2");
  assert.equal(current?.rank, 2);
  assert.equal(leaderboard.getCurrentUserRank(rows, "admin-1"), null);
});

test("top-three returns the first three ranked rows without recalculation", () => {
  const rows = leaderboard.buildLeaderboard([
    target({ id: "employee-1", userId: "employee-1", name: "Employee One", currentSales: 100 }),
    target({ id: "employee-2", userId: "employee-2", name: "Employee Two", currentSales: 90 }),
    target({ id: "employee-3", userId: "employee-3", name: "Employee Three", currentSales: 80 }),
    target({ id: "employee-4", userId: "employee-4", name: "Employee Four", currentSales: 70 }),
  ]);

  assert.deepEqual(leaderboard.getTopThree(rows).map((row) => row.rank), [1, 2, 3]);
});

test("search filtering matches employee display name or email", () => {
  const rows = [
    target({ id: "employee-1", userId: "employee-1", name: "Mya Thiri", currentSales: 90 }),
    target({
      id: "employee-2",
      userId: "employee-2",
      name: "Ko Aung",
      email: "koaung@example.test",
      currentSales: 80,
    }),
  ];

  assert.deepEqual(
    leaderboard.buildLeaderboard(rows, { searchTerm: "mya" }).map((row) => row.employeeId),
    ["employee-1"],
  );
  assert.deepEqual(
    leaderboard.buildLeaderboard(rows, { searchTerm: "koaung@example.test" }).map((row) => row.employeeId),
    ["employee-2"],
  );
});

test("month filtering remains in the active sales-target query contract", () => {
  assert.match(salesTargetSource, /if \(month\)[\s\S]*?query = query\.eq\("month", normalizeInteger\(month\)\)/);
  assert.match(salesTargetSource, /if \(year\)[\s\S]*?query = query\.eq\("year", normalizeInteger\(year\)\)/);
  assert.match(salesTargetSource, /profile:profiles!sales_targets_user_id_fkey\(id,full_name,email,avatar_url,role\)/);
});

test("empty input returns empty ranking and no current-user rank", () => {
  assert.deepEqual(leaderboard.buildLeaderboard(), []);
  assert.equal(leaderboard.getCurrentUserRank([], "employee-1"), null);
  assert.deepEqual(leaderboard.getTopThree([]), []);
});

test("invalid numeric values normalize to zero achievement", () => {
  const rows = leaderboard.buildLeaderboard([
    target({ id: "employee-1", userId: "employee-1", name: "Invalid One", targetSales: "invalid", currentSales: 50 }),
    target({ id: "employee-2", userId: "employee-2", name: "Invalid Two", targetSales: 100, currentSales: "invalid" }),
    target({ id: "employee-3", userId: "employee-3", name: "Negative", targetSales: -100, currentSales: -20 }),
  ]);

  assert.deepEqual(rows.map((row) => row.achievement), [0, 0, 0]);
});

test("tie ordering preserves achievement, current-sales, updated-at, and name rules", () => {
  const rows = leaderboard.buildLeaderboard([
    target({ id: "employee-z", userId: "employee-z", name: "Zulu", currentSales: 50, updatedAt: "2026-10-02T00:00:00.000Z" }),
    target({ id: "employee-a", userId: "employee-a", name: "Alpha", currentSales: 50, updatedAt: "2026-10-01T00:00:00.000Z" }),
    target({ id: "employee-b", userId: "employee-b", name: "Beta", currentSales: 50, updatedAt: "2026-10-01T00:00:00.000Z" }),
  ]);

  assert.deepEqual(rows.map((row) => row.employeeId), ["employee-a", "employee-b", "employee-z"]);
  assert.deepEqual(rows.map((row) => row.rank), [1, 2, 3]);
});

test("existing achievement calculations remain unchanged", () => {
  assert.equal(leaderboard.calculateAchievement(200, 150), 75);
  assert.equal(leaderboard.calculateAchievement(200, 250), 125);
  assert.equal(leaderboard.calculateAchievement(0, 250), 0);
  assert.equal(leaderboard.calculateAchievement(-200, 250), 0);
  assert.equal(leaderboard.calculateAchievement(3, 1), 33.33);
});

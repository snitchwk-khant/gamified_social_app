import cron from "node-cron";

function registerCleanupTask() {
  cron.schedule("0 3 * * *", () => {
    console.log("Running daily cleanup task");
  });
}

export default registerCleanupTask;

import cron from "node-cron";
import User from "../models/user_model.js";

function registerCleanupTask(timezone = "Asia/Yangon") {
  cron.schedule(
    "0 0 * * *",
    async () => {
      await User.updateMany({}, { $set: { dailySalesAmount: 0 } });
      console.log("Daily sales amounts reset.");
    },
    { timezone }
  );

  cron.schedule(
    "0 0 1 * *",
    async () => {
      await User.updateMany({}, { $set: { dailySalesAmount: 0, monthlySalesAccumulated: 0 } });
      console.log("Monthly sales accumulation reset.");
    },
    { timezone }
  );
}

export default registerCleanupTask;

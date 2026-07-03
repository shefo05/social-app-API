import mongoose from "mongoose";
import { DB_URL } from "../config";

const RETRY_DELAY_MS = 5000;
let retryTimer: NodeJS.Timeout | undefined;

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    connectDB();
  }, RETRY_DELAY_MS);
}

export function connectDB() {
  mongoose
    .connect(DB_URL, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => console.log("DB connected successfully"))
    .catch((err) => {
      console.log("fail to connect to DB:", err.message);
      scheduleRetry();
    });
}

mongoose.connection.on("disconnected", () => {
  console.log(`DB disconnected, retrying in ${RETRY_DELAY_MS / 1000}s`);
  scheduleRetry();
});

mongoose.connection.on("error", (err) => {
  console.log("DB connection error:", err.message);
});

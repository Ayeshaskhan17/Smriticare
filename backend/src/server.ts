import "dotenv/config";
import app from "./app";
import { startBackgroundScheduler } from "./services/notification.service";

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SmritiCare backend running on port ${PORT}`);
  
  // Start server-side background notification runner (runs every 60 seconds)
  startBackgroundScheduler(60000);
});

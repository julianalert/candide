// Load .env.local then .env for scripts run with tsx outside Next.
import { config } from "dotenv";
config({ path: ".env.local" });
config();

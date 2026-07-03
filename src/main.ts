import dns from "node:dns";
import { bootstrap } from "./app.controller";

// Render's free tier has unreliable outbound IPv6 (seen as ENETUNREACH
// connecting to Gmail SMTP); prefer IPv4 for all outbound connections.
dns.setDefaultResultOrder("ipv4first");

bootstrap();

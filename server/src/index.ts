import { serve } from "@hono/node-server";
import path from "node:path";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT || 4000);
const hostname = process.env.HOST || "127.0.0.1";
const app = createApp({ webDist: process.env.WEB_DIST ? path.resolve(process.env.WEB_DIST) : undefined });
serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`LingoLoop API listening on http://${info.address}:${info.port}`);
});

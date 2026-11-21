import { MongoClient } from "mongodb";
import { createClient as redisClient } from "redis";
import { createClient } from "@supabase/supabase-js";
import { criarApp } from "./app.js";
import { abrirCache } from "./cache.js";
for (const k of [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "MONGODB_URL",
  "MONGODB_DATABASE",
  "REDIS_URL",
])
  if (!process.env[k]) throw new Error(`Configure ${k} no .env.`);
export async function conectar() {
  const mongo = new MongoClient(process.env.MONGODB_URL, {
    serverSelectionTimeoutMS: 4000,
  });
  await mongo.connect();
  const redis = redisClient({
    url: process.env.REDIS_URL,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 1500,
      reconnectStrategy: (n) => Math.min(200 * (n + 1), 2000),
    },
  });
  redis.on("error", () => {});
  redis.connect().catch(() => {});
  const cache = await abrirCache({ prefixo: "catalogo:cache" });
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return {
    mongo,
    redis,
    cache,
    supabase,
    async close() {
      await cache.close();
      if (redis.isOpen) redis.destroy();
      await mongo.close();
    },
  };
}
const deps = await conectar();
const server = criarApp(deps).listen(
  Number(process.env.PORT || 3026),
  "127.0.0.1",
  () => console.log(`Catálogo: http://127.0.0.1:${process.env.PORT || 3026}`),
);
async function parar() {
  server.close(async () => {
    await deps.close();
    process.exit(0);
  });
}
process.on("SIGINT", parar);
process.on("SIGTERM", parar);

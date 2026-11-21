import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env existente preservado.");
  process.exit(0);
}
const s = JSON.parse(
  execFileSync(
    process.execPath,
    [resolve("node_modules/supabase/dist/supabase.js"), "status", "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
if (!s.SECRET_KEY || !s.PUBLISHABLE_KEY)
  throw new Error("Inicie o Supabase local primeiro.");
writeFileSync(
  ".env",
  `PORT=3026\nSUPABASE_URL=${s.API_URL}\nSUPABASE_DB_URL=${s.DB_URL}\nSUPABASE_SECRET_KEY=${s.SECRET_KEY}\nSUPABASE_PUBLISHABLE_KEY=${s.PUBLISHABLE_KEY}\nMONGODB_URL=mongodb://127.0.0.1:27026\nMONGODB_DATABASE=catalogo_poliglota\nREDIS_URL=redis://127.0.0.1:6396\nCACHE_TTL=30\nADMIN_EMAIL=admin@catalogo.local\nADMIN_PASSWORD=${randomBytes(18).toString("base64url")}\nWHATSAPP_NUMBER=5500000000000\n`,
);
console.log(
  "Configuração criada em .env. Senha administrativa gerada localmente, sem exibir segredos.",
);

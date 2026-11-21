import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { MongoClient } from "mongodb";
import { readFile } from "node:fs/promises";
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();
try {
  await db.query(
    await readFile(new URL("../banco/schema.sql", import.meta.url), "utf8"),
  );
  await db.query("NOTIFY pgrst, 'reload schema'");
} finally {
  await db.end();
}
const { data: usuarios, error: listError } = await sb.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) throw listError;
const existente = usuarios.users.find(
  (u) => u.email === process.env.ADMIN_EMAIL,
);
if (!existente) {
  const { error } = await sb.auth.admin.createUser({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: { catalogo_admin: true },
  });
  if (error) throw error;
} else if (!existente.app_metadata.catalogo_admin)
  throw new Error(
    "O e-mail já existe sem permissão administrativa; use um novo e-mail.",
  );
const mongo = new MongoClient(process.env.MONGODB_URL);
await mongo.connect();
try {
  const db = mongo.db(process.env.MONGODB_DATABASE);
  const c = db.collection("produtos");
  await db.command({ ping: 1 });
  await c.createIndex({ nome: 1 });
  await c.createIndex({ ativo: 1, categoria: 1 });
  const seeds = [
    [
      "Caderno Horizonte",
      "Papelaria",
      2490,
      "caderno",
      "Caderno de capa rígida para ideias, estudos e planos.",
      "Páginas",
      "160",
    ],
    [
      "Mochila Urbana",
      "Acessórios",
      12990,
      "mochila",
      "Mochila leve com espaço para notebook e rotina organizada.",
      "Capacidade",
      "20 litros",
    ],
    [
      "Garrafa Essencial",
      "Acessórios",
      5990,
      "garrafa",
      "Garrafa térmica para acompanhar o seu dia, em qualquer lugar.",
      "Volume",
      "500 ml",
    ],
    [
      "Caneta Traço",
      "Papelaria",
      890,
      "caneta",
      "Escrita macia e traço preciso para colocar ideias no papel.",
      "Ponta",
      "0,7 mm",
    ],
    [
      "Fone Studio",
      "Tecnologia",
      18990,
      "fone",
      "Conforto e som equilibrado para trabalho, música e estudos.",
      "Conexão",
      "Bluetooth",
    ],
    [
      "Luminária Foco",
      "Escritório",
      8990,
      "luminaria",
      "Luz ajustável e formato compacto para uma mesa mais acolhedora.",
      "Iluminação",
      "LED",
    ],
  ];
  for (const [nome, categoria, precoCentavos, img, descricao, k, v] of seeds)
    await c.updateOne(
      { seedKey: img },
      {
        $setOnInsert: {
          nome,
          categoria,
          precoCentavos,
          imagem: `/imagens/${img}.svg`,
          descricao,
          atributos: { [k]: v },
          ativo: true,
          versao: 1,
          criadoEm: new Date(),
        },
      },
      { upsert: true },
    );
  console.log(
    "Supabase preparado, administrador disponível e seis produtos instalados no MongoDB. Dados existentes preservados.",
  );
} finally {
  await mongo.close();
}

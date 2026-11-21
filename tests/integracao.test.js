import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { createClient as redisClient } from "redis";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { criarApp } from "../src/app.js";
import { abrirCache } from "../src/cache.js";
import { produto, itensPedido, montarPedido } from "../src/domain.js";
test("validações de preço, atributos, itens duplicados e mensagem decimal", () => {
  const base = {
    nome: "Produto válido",
    descricao: "Descrição de teste",
    categoria: "Teste",
    preco: 12.35,
    imagem: "/imagens/caderno.svg",
  };
  assert.equal(produto(base).precoCentavos, 1235);
  assert.throws(() => produto({ ...base, preco: 12.345 }));
  assert.throws(() => produto({ ...base, atributos: { $where: "x" } }));
  assert.throws(() => produto({ ...base, imagem: "javascript:alert(1)" }));
  const id = "123456789012345678901234";
  assert.throws(() =>
    itensPedido({
      itens: [
        { id, quantidade: 1 },
        { id, quantidade: 2 },
      ],
    }),
  );
  assert.throws(() => itensPedido({ itens: [{ id, quantidade: 1.5 }] }));
  const r = montarPedido(
    [{ _id: id, nome: "Caderno", precoCentavos: 1235 }],
    new Map([[id, 3]]),
  );
  assert.equal(r.total, 3705);
  assert.match(r.mensagem, /37,05/);
});
test("fluxo real: Supabase Auth + MongoDB + Redis + pedidos e WhatsApp", async (t) => {
  const mongo = new MongoClient(process.env.MONGODB_URL);
  await mongo.connect();
  const redis = redisClient({ url: process.env.REDIS_URL });
  redis.on("error", () => {});
  await redis.connect();
  const prefixo = "teste:" + randomUUID(),
    cache = await abrirCache({ ttl: 1, prefixo }),
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  const server = criarApp({ mongo, redis, cache, supabase }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  let cookie = "",
    pId,
    viewerId,
    pedidoId,
    vis;
  const col = mongo.db(process.env.MONGODB_DATABASE).collection("produtos");
  async function req(path, method = "GET", body, headers = {}) {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of r.headers.getSetCookie()) {
      const pair = c.split(";")[0];
      if (pair.startsWith("visitante=")) {
        vis = pair.split("=")[1];
      }
      const key = pair.split("=")[0];
      cookie = cookie
        .split("; ")
        .filter((p) => !p.startsWith(key + "=") && p)
        .concat(pair)
        .join("; ");
    }
    return {
      status: r.status,
      cache: r.headers.get("x-cache"),
      headers: r.headers,
      data: await r.json(),
    };
  }
  try {
    for (let i = 0; i < 20 && !(await cache.status()).conectado; i++)
      await new Promise((r) => setTimeout(r, 100));
    await t.test(
      "painel e escrita bloqueados sem sessão; origem externa rejeitada",
      async () => {
        assert.equal((await req("admin")).status, 401);
        assert.equal((await req("admin/produtos", "POST", {})).status, 401);
        assert.equal(
          (
            await req(
              "pedidos",
              "POST",
              {},
              { Origin: "https://outro.example" },
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "login Supabase real com senha incorreta e correta; cookie HttpOnly",
      async () => {
        assert.equal(
          (
            await req("login", "POST", {
              email: process.env.ADMIN_EMAIL,
              password: "senha-invalida",
            })
          ).status,
          401,
        );
        const r = await req("login", "POST", {
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        });
        assert.equal(r.status, 200);
        assert.match(r.headers.get("set-cookie"), /HttpOnly/);
        assert.equal((await req("admin")).status, 200);
      },
    );
    await t.test(
      "cadastro MongoDB com documento flexível e cache MISS/HIT",
      async () => {
        await cache.invalidar();
        assert.equal((await req("produtos")).cache, "MISS");
        assert.equal((await req("produtos")).cache, "HIT");
        const r = await req("admin/produtos", "POST", {
          nome: "Teste " + randomUUID(),
          descricao: "Produto exclusivo do teste automatizado",
          categoria: "Validação",
          preco: 10.1,
          imagem: "/imagens/caderno.svg",
          atributos: { Material: "Papel", Formato: "A5" },
        });
        assert.equal(r.status, 201);
        pId = r.data._id;
        assert.ok(await col.findOne({ nome: r.data.nome }));
        const ps = await req("produtos");
        assert.equal(ps.cache, "MISS");
        assert.ok(ps.data.find((p) => p._id === pId));
      },
    );
    await t.test("edição invalida cache e rejeita versão antiga", async () => {
      const p = (await req("produtos/" + pId)).data;
      const body = { ...p, preco: 12.35 };
      assert.equal(
        (await req("admin/produtos/" + pId, "PUT", body)).status,
        200,
      );
      assert.equal(
        (await req("admin/produtos/" + pId, "PUT", body)).status,
        409,
      );
      assert.equal((await req("produtos")).cache, "MISS");
      assert.equal((await req("produtos")).cache, "HIT");
      await new Promise((r) => setTimeout(r, 1100));
      assert.equal((await req("produtos")).cache, "MISS");
    });
    await t.test(
      "recentes por visitante no Redis real; visitante distinto isolado",
      async () => {
        assert.equal(
          (await req("recentes/" + pId, "POST", {})).data.salvo,
          true,
        );
        assert.equal((await req("recentes")).data.produtos[0]._id, pId);
        assert.equal(await redis.zCard("catalogo:recentes:" + vis), 1);
        assert.ok((await redis.ttl("catalogo:recentes:" + vis)) > 0);
        const r = await fetch(base + "recentes");
        assert.equal((await r.json()).produtos.length, 0);
      },
    );
    await t.test(
      "pedido usa preço MongoDB e persiste PostgreSQL; URL WhatsApp correta",
      async () => {
        const r = await req("pedidos", "POST", {
          itens: [{ id: pId, quantidade: 3 }],
          total: 0.01,
        });
        assert.equal(r.status, 201);
        pedidoId = r.data.codigo;
        assert.equal(r.data.total, 3705);
        const link = new URL(r.data.url);
        assert.equal(link.hostname, "wa.me");
        assert.equal(link.pathname, "/" + process.env.WHATSAPP_NUMBER);
        assert.match(link.searchParams.get("text"), /37,05/);
        const { data, error } = await supabase
          .from("catalogo_pedidos")
          .select("*")
          .eq("id", pedidoId)
          .single();
        assert.ifError(error);
        assert.equal(data.total_centavos, 3705);
        assert.ok(
          (await req("admin/pedidos")).data.find((p) => p.id === pedidoId),
        );
      },
    );
    await t.test(
      "conexões reais e proteção contra permissão em user_metadata",
      async () => {
        const r = (await req("admin/integracoes")).data;
        assert.ok(
          r.supabase.conectado && r.mongodb.conectado && r.redis.conectado,
        );
        const email = `viewer-${randomUUID()}@example.test`,
          password = randomUUID() + "Ab1!";
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { catalogo_admin: true },
        });
        assert.ifError(error);
        viewerId = data.user.id;
        assert.equal(
          (await req("login", "POST", { email, password })).status,
          401,
        );
      },
    );
    await t.test(
      "RLS bloqueia acesso público e logout encerra sessão",
      async () => {
        const anon = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_PUBLISHABLE_KEY,
          { auth: { persistSession: false } },
        );
        assert.ok((await anon.from("catalogo_pedidos").select("*")).error);
        assert.equal((await req("logout", "POST", {})).status, 200);
        assert.equal((await req("admin")).status, 401);
      },
    );
  } finally {
    await new Promise((r) => server.close(r));
    if (pId)
      await col.deleteOne({
        _id: (await import("mongodb")).ObjectId.createFromHexString(pId),
      });
    if (pedidoId) {
      const db = new pg.Client({
        connectionString: process.env.SUPABASE_DB_URL,
      });
      await db.connect();
      try {
        await db.query("DELETE FROM public.catalogo_pedidos WHERE id=$1", [
          pedidoId,
        ]);
      } finally {
        await db.end();
      }
    }
    if (viewerId) await supabase.auth.admin.deleteUser(viewerId);
    if (vis) await redis.del("catalogo:recentes:" + vis);
    await cache.invalidar();
    await redis.del(prefixo + ":geracao");
    await cache.close();
    await redis.quit();
    await mongo.close();
  }
});
test("falha Redis mantém catálogo sem simular cache", async () => {
  const c = await abrirCache({ url: "redis://127.0.0.1:1" });
  try {
    const r = await c.ler("produtos", async () => ["MongoDB"]);
    assert.deepEqual(r.dados, ["MongoDB"]);
    assert.match(r.origem, /BYPASS/);
    await c.invalidar();
  } finally {
    await c.close();
  }
});

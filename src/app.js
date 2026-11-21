import express from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { AppError, produto, itensPedido, montarPedido } from "./domain.js";

export function criarApp({ mongo, redis, cache, supabase, env = process.env }) {
  const app = express(),
    sessoes = new Map(),
    tentativas = new Map();
  const produtos = mongo.db(env.MONGODB_DATABASE).collection("produtos");
  const auth = () =>
    createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const cookie = {
    httpOnly: true,
    sameSite: "strict",
    secure: env.NODE_ENV === "production",
    path: "/",
  };
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    });
    next();
  });
  app.use(express.json({ limit: "24kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(req.method)) {
      if (!req.is("application/json")) throw new AppError("Envie JSON.", 415);
      if (
        req.headers.origin &&
        req.headers.origin !== `${req.protocol}://${req.get("host")}`
      )
        throw new AppError("Origem inválida.", 403);
    }
    next();
  });
  app.use("/api", (req, res, next) => {
    let v = req.cookies.visitante;
    if (!/^[a-f0-9-]{36}$/.test(v || "")) {
      v = randomUUID();
      res.cookie("visitante", v, { ...cookie, maxAge: 86400000 });
    }
    req.visitante = v;
    next();
  });
  const out = (p) => ({ ...p, _id: String(p._id) });
  const id = (v) => {
    if (!/^[a-f0-9]{24}$/.test(v)) throw new AppError("Produto inválido.");
    return new ObjectId(v);
  };
  async function admin(req, res, next) {
    const s = sessoes.get(req.cookies.sessao);
    if (!s) throw new AppError("Faça login para continuar.", 401);
    if (s.expira < Date.now()) {
      sessoes.delete(req.cookies.sessao);
      throw new AppError("Sessão expirada. Entre novamente.", 401);
    }
    const { data, error } = await supabase.auth.getUser(s.token);
    if (error || !data.user) throw new AppError("Sessão inválida.", 401);
    if (data.user.app_metadata.catalogo_admin !== true)
      throw new AppError("Acesso restrito ao administrador.", 403);
    req.usuario = data.user;
    next();
  }
  app.post("/api/login", async (req, res) => {
    const k = req.ip,
      now = Date.now();
    let t = tentativas.get(k);
    if (!t || now - t.inicio > 60000) {
      t = { inicio: now, n: 0 };
      tentativas.set(k, t);
    }
    if (++t.n > 10)
      throw new AppError("Muitas tentativas. Aguarde um minuto.", 429);
    const { email, password } = req.body;
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 200 ||
      password.length > 200
    )
      throw new AppError("Dados de login inválidos.");
    const client = auth(),
      { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
    if (error || data.user?.app_metadata.catalogo_admin !== true)
      throw new AppError("E-mail ou senha inválidos para o painel.", 401);
    for (const [sid, s] of sessoes) if (s.expira < now) sessoes.delete(sid);
    if (sessoes.size > 500)
      throw new AppError("Tente novamente mais tarde.", 503);
    if (req.cookies.sessao) sessoes.delete(req.cookies.sessao);
    const sid = randomUUID(),
      expira = Math.min(data.session.expires_at * 1000, now + 3600000);
    sessoes.set(sid, { token: data.session.access_token, expira });
    res.cookie("sessao", sid, { ...cookie, maxAge: expira - now });
    res.json({ email: data.user.email });
  });
  app.get("/api/admin", admin, (req, res) =>
    res.json({ email: req.usuario.email }),
  );
  app.post("/api/logout", async (req, res) => {
    const s = sessoes.get(req.cookies.sessao);
    sessoes.delete(req.cookies.sessao);
    res.clearCookie("sessao", cookie);
    if (s) await supabase.auth.admin.signOut(s.token, "local").catch(() => {});
    res.json({ ok: true });
  });
  app.get("/api/produtos", async (req, res) => {
    const r = await cache.ler("produtos", async () =>
      (await produtos.find({ ativo: true }).sort({ nome: 1 }).toArray()).map(
        out,
      ),
    );
    res.set("X-Cache", r.origem.split(" ")[0]);
    res.json(r.dados);
  });
  app.get("/api/produtos/:id", async (req, res) => {
    const p = await produtos.findOne({ _id: id(req.params.id), ativo: true });
    if (!p) throw new AppError("Produto não encontrado.", 404);
    res.json(out(p));
  });
  app.post("/api/recentes/:id", async (req, res) => {
    const p = await produtos.findOne({ _id: id(req.params.id), ativo: true });
    if (!p) throw new AppError("Produto não encontrado.", 404);
    let salvo = false;
    try {
      if (redis.isReady) {
        const key = `catalogo:recentes:${req.visitante}`;
        await redis
          .multi()
          .zAdd(key, { score: Date.now(), value: String(p._id) })
          .zRemRangeByRank(key, 0, -9)
          .expire(key, 86400)
          .exec();
        salvo = true;
      }
    } catch {}
    res.json({ salvo });
  });
  app.get("/api/recentes", async (req, res) => {
    let ids = [];
    try {
      if (!redis.isReady) throw new Error();
      ids = await redis.zRange(`catalogo:recentes:${req.visitante}`, 0, 7, {
        REV: true,
      });
    } catch {
      return res.json({ disponivel: false, produtos: [] });
    }
    const ps = await produtos
      .find({ _id: { $in: ids.map(id) }, ativo: true })
      .toArray();
    res.json({
      disponivel: true,
      produtos: ids
        .map((x) => ps.find((p) => String(p._id) === x))
        .filter(Boolean)
        .map(out),
    });
  });
  app.post("/api/admin/produtos", admin, async (req, res) => {
    const p = { ...produto(req.body), versao: 1, criadoEm: new Date() };
    const r = await produtos.insertOne(p);
    await cache.invalidar();
    res.status(201).json(out({ ...p, _id: r.insertedId }));
  });
  app.put("/api/admin/produtos/:id", admin, async (req, res) => {
    const p = produto(req.body);
    if (!Number.isInteger(req.body.versao))
      throw new AppError("Versão inválida.");
    const r = await produtos.findOneAndUpdate(
      { _id: id(req.params.id), versao: req.body.versao, ativo: true },
      { $set: { ...p, atualizadoEm: new Date() }, $inc: { versao: 1 } },
      { returnDocument: "after" },
    );
    if (!r)
      throw new AppError(
        "O produto foi alterado. Recarregue antes de editar.",
        409,
      );
    await cache.invalidar();
    res.json(out(r));
  });
  app.post("/api/pedidos", async (req, res) => {
    const qs = itensPedido(req.body),
      ps = await produtos
        .find({ _id: { $in: [...qs.keys()].map(id) }, ativo: true })
        .toArray();
    const pedido = montarPedido(ps, qs),
      codigo = randomUUID();
    const telefone = env.WHATSAPP_NUMBER || "";
    if (!/^55\d{10,11}$/.test(telefone) || /^550+$/.test(telefone))
      throw new AppError("O WhatsApp da loja ainda não foi configurado.", 503);
    const mensagem = `${pedido.mensagem}\nReferência: ${codigo.slice(0, 8)}`;
    const { error } = await supabase.from("catalogo_pedidos").insert({
      id: codigo,
      itens: pedido.itens,
      total_centavos: pedido.total,
    });
    if (error)
      throw new AppError(
        "Não foi possível registrar o pedido. Tente novamente.",
        503,
      );
    res.status(201).json({
      ...pedido,
      codigo,
      mensagem,
      url: `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`,
    });
  });
  app.get("/api/admin/pedidos", admin, async (req, res) => {
    const { data, error } = await supabase
      .from("catalogo_pedidos")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(20);
    if (error) throw new AppError("Pedidos indisponíveis.", 503);
    res.json(data);
  });
  app.get("/api/admin/integracoes", admin, async (req, res) => {
    const m = await mongo.db(env.MONGODB_DATABASE).command({ ping: 1 });
    const { count, error } = await supabase
      .from("catalogo_pedidos")
      .select("id", { count: "exact", head: true });
    res.json({
      supabase: { conectado: !error, pedidos: count },
      mongodb: {
        conectado: m.ok === 1,
        produtos: await produtos.countDocuments({ ativo: true }),
      },
      redis: await cache.status(),
    });
  });
  app.get("/admin", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.sendFile(
      fileURLToPath(new URL("../public/index.html", import.meta.url)),
    );
  });
  app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Serviço temporariamente indisponível.",
    });
  });
  return app;
}

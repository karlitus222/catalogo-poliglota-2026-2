const $ = (s) => document.querySelector(s),
  money = (n) =>
    (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  esc = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let produtos = [],
  carrinho = [],
  usuario = null,
  origem = "";
try {
  const saved = JSON.parse(localStorage.getItem("essencia-sacola") || "[]");
  if (Array.isArray(saved))
    carrinho = saved.filter(
      (i) =>
        /^[a-f0-9]{24}$/.test(i.id) &&
        Number.isInteger(i.quantidade) &&
        i.quantidade > 0 &&
        i.quantidade <= 99,
    );
} catch {}
async function api(path, method = "GET", body) {
  const r = await fetch("/api/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (r.headers.get("X-Cache")) origem = r.headers.get("X-Cache");
  if (!r.ok) throw new Error(d.error || "Não foi possível concluir.");
  return d;
}
function aviso(texto, erro = false) {
  $("#aviso").textContent = texto;
  $("#aviso").hidden = false;
  $("#aviso").className = erro ? "erro" : "";
}
function salvar() {
  localStorage.setItem("essencia-sacola", JSON.stringify(carrinho));
  $("#quantidade-sacola").textContent = carrinho.reduce(
    (n, i) => n + i.quantidade,
    0,
  );
  $("#pedido-pronto").hidden = true;
}
function adicionar(id) {
  const item = carrinho.find((i) => i.id === id);
  if (item) {
    if (item.quantidade >= 99)
      return aviso("Limite de 99 unidades por produto.", true);
    item.quantidade++;
  } else carrinho.push({ id, quantidade: 1 });
  salvar();
  const p = produtos.find((p) => p._id === id);
  aviso(`${p?.nome || "Produto"} adicionado à sacola.`);
}
function render() {
  const q = $("#busca").value.toLocaleLowerCase("pt-BR"),
    cat = $("#categoria").value;
  const ps = produtos.filter(
    (p) =>
      (!cat || p.categoria === cat) &&
      `${p.nome} ${p.descricao}`.toLocaleLowerCase("pt-BR").includes(q),
  );
  $("#contagem").textContent = `${ps.length} produtos selecionados para você`;
  $("#produtos").innerHTML =
    ps
      .map(
        (p) =>
          `<article class="product"><button class="product-image" data-ver="${p._id}" aria-label="Ver ${esc(p.nome)}"><img src="${esc(p.imagem)}" alt="${esc(p.nome)}"></button><div class="product-info"><div><h3>${esc(p.nome)}</h3><p>${esc(p.categoria)}</p></div><span class="product-price">${money(p.precoCentavos)}</span></div><div class="product-bottom"><button class="button outline" data-ver="${p._id}">Conhecer</button><button class="add" data-add="${p._id}" aria-label="Adicionar ${esc(p.nome)} à sacola">+</button></div></article>`,
      )
      .join("") || "<p>Nenhum produto encontrado. Experimente outra busca.</p>";
  $("#origem").textContent =
    `Consulta do catálogo: ${origem === "HIT" ? "cache Redis (HIT)" : origem === "BYPASS" ? "MongoDB direto (cache indisponível)" : "MongoDB (MISS)"}.`;
}
async function carregar() {
  produtos = await api("produtos");
  const categoria = $("#categoria").value;
  $("#categoria").innerHTML =
    '<option value="">Todas as categorias</option>' +
    [...new Set(produtos.map((p) => p.categoria))]
      .sort()
      .map((c) => `<option>${esc(c)}</option>`)
      .join("");
  $("#categoria").value = categoria;
  render();
  if (usuario) renderAdmin();
}
async function recentes() {
  const r = await api("recentes");
  $("#recentes").innerHTML = !r.disponivel
    ? '<p class="muted">Histórico temporariamente indisponível. Continue explorando a coleção.</p>'
    : r.produtos.length
      ? r.produtos
          .map(
            (p) =>
              `<button class="recent-item" data-ver="${p._id}"><img src="${esc(p.imagem)}" alt=""><span>${esc(p.nome)}<br><strong>${money(p.precoCentavos)}</strong></span></button>`,
          )
          .join("")
      : '<p class="muted">Os produtos que você conhecer aparecem aqui.</p>';
}
async function detalhe(id) {
  const p = await api("produtos/" + id);
  await api("recentes/" + id, "POST", {});
  $("#detalhe").innerHTML =
    `<img class="detail-image" src="${esc(p.imagem)}" alt="${esc(p.nome)}"><p class="eyebrow">${esc(p.categoria)}</p><h2>${esc(p.nome)}</h2><p>${esc(p.descricao)}</p><div class="attributes">${Object.entries(
      p.atributos || {},
    )
      .map(([k, v]) => `<span>${esc(k)}: ${esc(v)}</span>`)
      .join(
        "",
      )}</div><p class="detail-price">${money(p.precoCentavos)}</p><button class="button primary full" data-add="${p._id}">Adicionar à sacola</button>`;
  $("#produto-dialog").showModal();
  await recentes();
}
async function sacola() {
  await carregar();
  $("#itens-sacola").innerHTML = carrinho.length
    ? carrinho
        .map((i) => {
          const p = produtos.find((p) => p._id === i.id);
          return `<div class="cart-row"><img src="${esc(p?.imagem || "/imagens/caderno.svg")}" alt=""><div class="description"><strong>${esc(p?.nome || "Produto indisponível")}</strong><br><span>${p ? money(p.precoCentavos) : "Atualize sua sacola"}</span><br><button class="remove" data-remove="${i.id}">Remover</button></div><label>Quantidade<input type="number" min="1" max="99" step="1" value="${i.quantidade}" data-quantidade="${i.id}" aria-label="Quantidade de ${esc(p?.nome || "produto")}"></label></div>`;
        })
        .join("")
    : "<p>Sua sacola está esperando suas escolhas.</p>";
  $("#total").textContent = money(
    carrinho.reduce(
      (s, i) =>
        s +
        (produtos.find((p) => p._id === i.id)?.precoCentavos || 0) *
          i.quantidade,
      0,
    ),
  );
  $("#comprar").disabled = !carrinho.length;
  $("#comprar").hidden = false;
  $("#pedido-pronto").hidden = true;
  $("#erro-sacola")?.remove();
  if (!$("#sacola").open) $("#sacola").showModal();
}
function renderAdmin() {
  $("#lista-admin").innerHTML = produtos
    .map(
      (p) =>
        `<div class="admin-row"><img src="${esc(p.imagem)}" alt=""><div class="description"><strong>${esc(p.nome)}</strong><p class="muted">${esc(p.categoria)} · ${money(p.precoCentavos)} · versão ${p.versao}</p></div><button class="button outline" data-edit="${p._id}">Editar</button></div>`,
    )
    .join("");
}
function formProduto(id) {
  const p = produtos.find((p) => p._id === id),
    f = $("#form-produto");
  f.reset();
  f.elements.id.value = p?._id || "";
  f.elements.versao.value = p?.versao || "";
  for (const k of ["nome", "descricao", "categoria", "imagem"])
    if (p) f.elements[k].value = p[k];
  if (p) {
    f.elements.preco.value = p.precoCentavos / 100;
    const [key, value] = Object.entries(p.atributos || {})[0] || ["", ""];
    f.elements.atributo.value = key;
    f.elements.valor.value = value;
  }
  $("#form-titulo").textContent = p ? "Editar produto" : "Novo produto";
  $("#form-erro").textContent = "";
  $("#form-dialog").showModal();
}
async function pedidos() {
  const ps = await api("admin/pedidos");
  $("#lista-pedidos").innerHTML =
    ps
      .map(
        (p) =>
          `<article class="pedido-card"><strong>Pedido ${esc(p.id.slice(0, 8))}</strong> · ${new Date(p.criado_em).toLocaleString("pt-BR")}<p>${p.itens.map((i) => `${i.quantidade}× ${esc(i.nome)}`).join(" · ")}</p><strong>${money(p.total_centavos)}</strong></article>`,
      )
      .join("") || "<p>Nenhum pedido iniciado ainda.</p>";
}
async function integracoes() {
  const s = await api("admin/integracoes");
  $("#conexoes").innerHTML =
    `<article><p class="eyebrow">IDENTIDADE E PEDIDOS</p><h3>Supabase</h3><p>${s.supabase.conectado ? "● Conectado" : "Indisponível"}</p><p>Login validado pelo Supabase Auth. ${s.supabase.pedidos ?? "—"} pedidos no PostgreSQL.</p></article><article><p class="eyebrow">DOCUMENTOS FLEXÍVEIS</p><h3>MongoDB</h3><p>${s.mongodb.conectado ? "● Conectado" : "Indisponível"}</p><p>${s.mongodb.produtos} produtos. Nome, preço, imagem e atributos de cada item ficam em documentos.</p></article><article><p class="eyebrow">MEMÓRIA TEMPORÁRIA</p><h3>Redis</h3><p>${s.redis.conectado ? "● PONG recebido" : "Indisponível · catálogo usa MongoDB"}</p><p>Catálogo: TTL ${s.redis.ttlConfigurado}s. Itens recentes por visitante: 24h.</p><p>HIT ${s.redis.metricas.hits} · MISS ${s.redis.metricas.misses} · BYPASS ${s.redis.metricas.bypass}</p></article>`;
}
async function tab(nome) {
  for (const k of ["gestao", "pedidos", "integracoes"])
    $("#" + k).hidden = k !== nome;
  if (nome === "pedidos") await pedidos();
  if (nome === "integracoes") await integracoes();
}
async function navegar() {
  const admin = location.hash === "#admin";
  $("#catalogo").hidden = admin;
  $("#admin").hidden = !admin;
  $("#aviso").hidden = true;
  if (admin) {
    try {
      usuario = await api("admin");
    } catch {
      usuario = null;
    }
    $("#login").hidden = !!usuario;
    $("#painel").hidden = !usuario;
    if (usuario) {
      $("#usuario").textContent = "Conectado como " + usuario.email;
      await carregar();
    }
  } else {
    await carregar();
    await recentes();
  }
}
document.addEventListener("click", async (e) => {
  try {
    const close = e.target.closest("[data-close]");
    if (close) $("#" + close.dataset.close).close();
    const ver = e.target.closest("[data-ver]");
    if (ver) await detalhe(ver.dataset.ver);
    const add = e.target.closest("[data-add]");
    if (add) {
      adicionar(add.dataset.add);
      if ($("#produto-dialog").open) $("#produto-dialog").close();
    }
    const rem = e.target.closest("[data-remove]");
    if (rem) {
      carrinho = carrinho.filter((i) => i.id !== rem.dataset.remove);
      salvar();
      await sacola();
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) formProduto(edit.dataset.edit);
  } catch (err) {
    aviso(err.message, true);
  }
});
$("#itens-sacola").addEventListener("change", async (e) => {
  const id = e.target.dataset.quantidade;
  if (!id) return;
  const n = Number(e.target.value);
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    await sacola();
    return;
  }
  carrinho.find((i) => i.id === id).quantidade = n;
  salvar();
  await sacola();
});
$("#abrir-carrinho").onclick = () =>
  sacola().catch((e) => aviso(e.message, true));
$("#busca").oninput = render;
$("#categoria").onchange = render;
$("#comprar").onclick = async () => {
  const b = $("#comprar");
  b.disabled = true;
  try {
    const p = await api("pedidos", "POST", { itens: carrinho });
    $("#mensagem-pedido").textContent = p.mensagem;
    $("#link-whatsapp").href = p.url;
    $("#pedido-pronto").hidden = false;
    $("#total").textContent = money(p.total);
    b.hidden = true;
  } catch (e) {
    aviso(e.message, true);
    let err = $("#erro-sacola");
    if (!err) {
      err = document.createElement("p");
      err.id = "erro-sacola";
      err.setAttribute("role", "alert");
      b.before(err);
    }
    err.textContent = e.message;
  } finally {
    b.disabled = false;
  }
};
$("#login").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target,
    b = f.querySelector("button");
  b.disabled = true;
  $("#login-erro").textContent = "";
  try {
    await api("login", "POST", {
      email: f.elements.email.value,
      password: f.elements.password.value,
    });
    f.elements.password.value = "";
    await navegar();
  } catch (err) {
    $("#login-erro").textContent = err.message;
  } finally {
    b.disabled = false;
  }
};
$("#sair").onclick = async () => {
  await api("logout", "POST", {});
  usuario = null;
  await navegar();
};
$("#novo").onclick = () => formProduto();
$("#form-produto").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target,
    b = f.querySelector("button");
  b.disabled = true;
  try {
    const id = f.elements.id.value,
      p = {
        nome: f.elements.nome.value,
        descricao: f.elements.descricao.value,
        categoria: f.elements.categoria.value,
        preco: f.elements.preco.value,
        imagem: f.elements.imagem.value,
        versao: Number(f.elements.versao.value),
      };
    const antes = produtos.find((p) => p._id === id);
    p.atributos = { ...(antes?.atributos || {}) };
    if (f.elements.atributo.value.trim())
      p.atributos[f.elements.atributo.value.trim()] =
        f.elements.valor.value.trim();
    await api("admin/produtos" + (id ? "/" + id : ""), id ? "PUT" : "POST", p);
    $("#form-dialog").close();
    await carregar();
    aviso("Produto salvo e disponível no catálogo.");
  } catch (err) {
    $("#form-erro").textContent = err.message;
  } finally {
    b.disabled = false;
  }
};
for (const [id, name] of [
  ["tab-produtos", "gestao"],
  ["tab-pedidos", "pedidos"],
  ["tab-integracoes", "integracoes"],
])
  $("#" + id).onclick = () => tab(name).catch((e) => aviso(e.message, true));
$("#atualizar-integracoes").onclick = () =>
  integracoes().catch((e) => aviso(e.message, true));
window.addEventListener("hashchange", () =>
  navegar().catch((e) => aviso(e.message, true)),
);
salvar();
navegar().catch((e) => aviso(e.message, true));

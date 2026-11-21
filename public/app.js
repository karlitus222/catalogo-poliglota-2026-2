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
let toastTimer;
let toastOrigin;
const buttonTimers = new WeakMap();
let detalheRequest = 0;
let sacolaCarregando = false;
let filtroAnterior = "";
let ultimaRemocao;
let pedidoPendente = false;

function carregandoBotao(botao, texto) {
  const original = botao.innerHTML;
  const contador = botao.querySelector("#quantidade-sacola");
  botao.disabled = true;
  botao.setAttribute("aria-busy", "true");
  botao.classList.add("is-loading");
  if (contador) botao.replaceChildren(document.createTextNode(texto), contador);
  else botao.textContent = texto;
  return () => {
    botao.disabled = false;
    botao.removeAttribute("aria-busy");
    botao.classList.remove("is-loading");
    botao.innerHTML = original;
  };
}
function placeholder(texto, cards = false) {
  return `<div class="loading-state" role="status"><span class="spinner" aria-hidden="true"></span>${esc(texto)}</div>${cards ? '<div class="skeleton-grid" aria-hidden="true">' + '<div class="skeleton-card"><div></div><span></span><span></span></div>'.repeat(3) + "</div>" : ""}`;
}
function mostrarErro(campo, mensagem) {
  campo.textContent = mensagem;
  animar(campo, "error-enter");
}

function animar(elemento, classe) {
  elemento.classList.remove(classe);
  void elemento.offsetWidth;
  elemento.classList.add(classe);
}
function fecharToast() {
  clearTimeout(toastTimer);
  const toast = $("#cart-toast");
  const devolverFoco = toast.contains(document.activeElement);
  if (typeof toast.hidePopover === "function" && toast.matches(":popover-open"))
    toast.hidePopover();
  toast.hidden = true;
  if (devolverFoco)
    (toastOrigin?.isConnected ? toastOrigin : $("#abrir-carrinho")).focus();
}
function programarToast() {
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    // Não remover um botão enquanto o usuário está usando o teclado nele.
    if ($("#cart-toast").contains(document.activeElement)) return;
    fecharToast();
  }, 5500);
}
function confirmarSacola(titulo, descricao, imagem) {
  const toast = $("#cart-toast");
  if (!toast.contains(document.activeElement))
    toastOrigin = document.activeElement;
  $("#toast-title").textContent = titulo;
  $("#toast-description").textContent = descricao;
  $("#cart-live").textContent = `${titulo} ${descricao}`;
  $("#toast-image").hidden = !imagem;
  if (imagem) $("#toast-image").src = imagem;
  $("#toast-cart").hidden = $("#sacola").open;
  toast.hidden = false;
  if (
    typeof toast.showPopover === "function" &&
    !toast.matches(":popover-open")
  )
    toast.showPopover();
  animar(toast, "toast-enter");
  programarToast();
}
function atualizarCards() {
  document.querySelectorAll("[data-product-id]").forEach((card) => {
    const quantidade =
      carrinho.find((i) => i.id === card.dataset.productId)?.quantidade || 0;
    card.classList.toggle("in-cart", quantidade > 0);
    const badge = card.querySelector(".in-cart-badge");
    badge.hidden = !quantidade;
    badge.textContent = `✓ ${quantidade} na sacola`;
  });
  document.querySelectorAll("[data-add]").forEach((button) => {
    const quantidade =
      carrinho.find((i) => i.id === button.dataset.add)?.quantidade || 0;
    const p = produtos.find((p) => p._id === button.dataset.add);
    button.setAttribute(
      "aria-label",
      `Adicionar ${p?.nome || "produto"} à sacola${quantidade ? ` (${quantidade} na sacola)` : ""}`,
    );
  });
}
function confirmarBotao(id) {
  document.querySelectorAll(`[data-add="${id}"]`).forEach((button) => {
    clearTimeout(buttonTimers.get(button));
    button.classList.add("is-added");
    button.querySelector(".add-icon").textContent = "✓";
    button.querySelector(".add-label").textContent = "Adicionado";
    buttonTimers.set(
      button,
      setTimeout(() => {
        button.classList.remove("is-added");
        button.querySelector(".add-icon").textContent = "+";
        button.querySelector(".add-label").textContent = button.closest(
          "#detalhe",
        )
          ? "Adicionar à sacola"
          : "Adicionar";
      }, 1800),
    );
  });
}
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
  $("#aviso").className = erro ? "erro notice-enter" : "notice-enter";
}
function salvar() {
  localStorage.setItem("essencia-sacola", JSON.stringify(carrinho));
  $("#quantidade-sacola").textContent = carrinho.reduce(
    (n, i) => n + i.quantidade,
    0,
  );
  $("#pedido-pronto").hidden = true;
  atualizarCards();
}
function adicionar(id) {
  const item = carrinho.find((i) => i.id === id);
  if (item) {
    if (item.quantidade >= 99)
      return confirmarSacola(
        "Limite por produto atingido",
        "Você já tem 99 unidades deste item na sacola.",
      );
    item.quantidade++;
  } else carrinho.push({ id, quantidade: 1 });
  salvar();
  const p = produtos.find((p) => p._id === id);
  const quantidade = carrinho.find((i) => i.id === id).quantidade;
  confirmarBotao(id);
  animar($("#abrir-carrinho"), "cart-bump");
  confirmarSacola(
    "Boa escolha! Já está na sacola.",
    `${p?.nome || "Produto"} · ${quantidade} ${quantidade === 1 ? "unidade" : "unidades"}`,
    p?.imagem,
  );
}
function render() {
  const q = $("#busca").value.toLocaleLowerCase("pt-BR"),
    cat = $("#categoria").value;
  const ps = produtos.filter(
    (p) =>
      (!cat || p.categoria === cat) &&
      `${p.nome} ${p.descricao}`.toLocaleLowerCase("pt-BR").includes(q),
  );
  $("#contagem").textContent =
    `${ps.length} ${ps.length === 1 ? "produto encontrado" : "produtos encontrados"}`;
  const filtros = $("#filtros-ativos");
  filtros.hidden = !q && !cat;
  filtros.innerHTML = `${q ? `<button class="filter-chip" data-clear-filter="busca" aria-label="Limpar busca: ${esc(q)}">Busca: ${esc(q)} <span aria-hidden="true">×</span></button>` : ""}${cat ? `<button class="filter-chip" data-clear-filter="categoria" aria-label="Limpar categoria: ${esc(cat)}">${esc(cat)} <span aria-hidden="true">×</span></button>` : ""}<button class="clear-filters" data-clear-filter="todos">Limpar filtros</button>`;
  $("#produtos").innerHTML =
    ps
      .map(
        (p) =>
          `<article class="product" data-product-id="${p._id}"><button class="product-image" data-ver="${p._id}" aria-label="Ver ${esc(p.nome)}"><img src="${esc(p.imagem)}" alt="${esc(p.nome)}"></button><span class="in-cart-badge" hidden></span><div class="product-info"><div><h3>${esc(p.nome)}</h3><p>${esc(p.categoria)}</p></div><span class="product-price">${money(p.precoCentavos)}</span></div><div class="product-bottom"><button class="button outline" data-ver="${p._id}">Conhecer</button><button class="add" data-add="${p._id}" aria-label="Adicionar ${esc(p.nome)} à sacola"><span class="add-icon" aria-hidden="true">+</span><span class="add-label">Adicionar</span></button></div></article>`,
      )
      .join("") ||
    '<div class="empty-results"><span aria-hidden="true">⌕</span><h3>Nenhuma escolha por aqui ainda.</h3><p>Tente outro termo ou volte para a coleção completa.</p><button class="button outline" data-clear-filter="todos">Ver todos os produtos</button></div>';
  const filtro = JSON.stringify([q, cat]);
  if (filtro !== filtroAnterior) animar($("#produtos"), "grid-enter");
  filtroAnterior = filtro;
  atualizarCards();
  $("#origem").textContent =
    `Consulta do catálogo: ${origem === "HIT" ? "cache Redis (HIT)" : origem === "BYPASS" ? "MongoDB direto (cache indisponível)" : "MongoDB (MISS)"}.`;
}
async function carregar() {
  const grid = $("#produtos");
  grid.setAttribute("aria-busy", "true");
  if (!produtos.length && !grid.querySelector(".product"))
    grid.innerHTML = placeholder("Buscando suas próximas escolhas…", true);
  try {
    produtos = await api("produtos");
  } catch (e) {
    if (!produtos.length)
      grid.innerHTML =
        '<div class="empty-results"><h3>Não conseguimos carregar a coleção.</h3><p>Confira sua conexão e tente novamente.</p><button class="button primary" data-retry-catalog>Carregar coleção</button></div>';
    throw e;
  } finally {
    grid.setAttribute("aria-busy", "false");
  }
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
  const pedido = ++detalheRequest;
  fecharToast();
  $("#detalhe").innerHTML = placeholder("Conhecendo esse produto…", true);
  $("#detalhe").setAttribute("aria-busy", "true");
  if (!$("#produto-dialog").open) $("#produto-dialog").showModal();
  try {
    const p = await api("produtos/" + id);
    if (pedido !== detalheRequest || !$("#produto-dialog").open) return;
    $("#detalhe").innerHTML =
      `<img class="detail-image" src="${esc(p.imagem)}" alt="${esc(p.nome)}"><p class="eyebrow">${esc(p.categoria)}</p><h2>${esc(p.nome)}</h2><p>${esc(p.descricao)}</p><div class="attributes">${Object.entries(
        p.atributos || {},
      )
        .map(([k, v]) => `<span>${esc(k)}: ${esc(v)}</span>`)
        .join(
          "",
        )}</div><p class="detail-price">${money(p.precoCentavos)}</p><button class="button primary full" data-add="${p._id}"><span class="add-icon" aria-hidden="true">+</span><span class="add-label">Adicionar à sacola</span></button>`;
    atualizarCards();
    animar($("#detalhe"), "content-enter");
    try {
      await api("recentes/" + id, "POST", {});
      await recentes();
    } catch {
      /* Detalhes continuam disponíveis se o histórico falhar. */
    }
  } catch (e) {
    if (pedido === detalheRequest && $("#produto-dialog").open)
      $("#detalhe").innerHTML =
        `<div class="empty-results"><h3>Não foi possível abrir o produto.</h3><p>${esc(e.message)}</p><button class="button outline" data-ver="${id}">Tentar novamente</button></div>`;
  } finally {
    if (pedido === detalheRequest)
      $("#detalhe").setAttribute("aria-busy", "false");
  }
}
async function sacola() {
  if (sacolaCarregando || pedidoPendente) return;
  sacolaCarregando = true;
  fecharToast();
  const finalizar = carregandoBotao($("#abrir-carrinho"), "Abrindo sacola…");
  $("#sacola-status").textContent = "Conferindo os preços da coleção…";
  $("#itens-sacola").innerHTML = placeholder("Organizando suas escolhas…");
  $("#sacola .total").hidden = true;
  $("#comprar").hidden = true;
  $("#pedido-pronto").hidden = true;
  $("#desfazer-remocao").hidden = true;
  ultimaRemocao = null;
  if (!$("#sacola").open) $("#sacola").showModal();
  try {
    await carregar();
    if (!$("#sacola").open) return;
    renderSacola();
    $("#sacola-status").textContent = "";
    animar($("#itens-sacola"), "content-enter");
  } catch (e) {
    $("#sacola-status").textContent = "";
    $("#itens-sacola").innerHTML =
      `<div class="empty-results"><h3>Sua sacola está guardada.</h3><p>${esc(e.message)}</p><button class="button outline" data-retry-cart>Tentar novamente</button></div>`;
  } finally {
    finalizar();
    // Restaurar o contador atual: ele pode ter mudado durante a consulta.
    $("#quantidade-sacola").textContent = carrinho.reduce(
      (n, i) => n + i.quantidade,
      0,
    );
    sacolaCarregando = false;
  }
}
function atualizarTotal() {
  $("#sacola .total").hidden = false;
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
}
function renderSacola() {
  $("#itens-sacola").innerHTML = carrinho.length
    ? carrinho
        .map((i) => {
          const p = produtos.find((p) => p._id === i.id);
          return `<div class="cart-row"><img src="${esc(p?.imagem || "/imagens/caderno.svg")}" alt=""><div class="description"><strong>${esc(p?.nome || "Produto indisponível")}</strong><br><span>${p ? money(p.precoCentavos) : "Atualize sua sacola"}</span><br><button class="remove" data-remove="${i.id}">Remover</button></div><label>Quantidade<input type="number" min="1" max="99" step="1" value="${i.quantidade}" data-quantidade="${i.id}" aria-label="Quantidade de ${esc(p?.nome || "produto")}"></label></div>`;
        })
        .join("")
    : '<div class="empty-cart"><span aria-hidden="true">♡</span><h3>Ainda cabe uma boa escolha.</h3><p>Explore a coleção e encontre algo com a sua cara.</p><button class="button primary" data-close="sacola">Continuar explorando ↗</button></div>';
  atualizarTotal();
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
  $("#lista-pedidos").innerHTML = placeholder("Buscando os pedidos da loja…");
  $("#lista-pedidos").setAttribute("aria-busy", "true");
  try {
    const ps = await api("admin/pedidos");
    $("#lista-pedidos").innerHTML =
      ps
        .map(
          (p) =>
            `<article class="pedido-card"><strong>Pedido ${esc(p.id.slice(0, 8))}</strong> · ${new Date(p.criado_em).toLocaleString("pt-BR")}<p>${p.itens.map((i) => `${i.quantidade}× ${esc(i.nome)}`).join(" · ")}</p><strong>${money(p.total_centavos)}</strong></article>`,
        )
        .join("") ||
      '<div class="empty-results"><span aria-hidden="true">♡</span><h3>Os próximos pedidos começam aqui.</h3><p>Quando alguém preparar uma compra, o resumo aparece nesta lista.</p></div>';
  } catch (e) {
    $("#lista-pedidos").innerHTML =
      `<div class="inline-error" role="alert">${esc(e.message)} <button class="button outline" data-retry-orders>Tentar novamente</button></div>`;
  } finally {
    $("#lista-pedidos").setAttribute("aria-busy", "false");
  }
}
async function integracoes() {
  const botao = $("#atualizar-integracoes");
  if (botao.disabled) return;
  const finalizar = carregandoBotao(botao, "Verificando conexões…");
  $("#conexoes").setAttribute("aria-busy", "true");
  if (!$("#conexoes article"))
    $("#conexoes").innerHTML = placeholder("Conferindo os serviços…");
  try {
    const s = await api("admin/integracoes");
    $("#conexoes").innerHTML =
      `<article><p class="eyebrow">IDENTIDADE E PEDIDOS</p><h3>Supabase</h3><p>${s.supabase.conectado ? "● Conectado" : "Indisponível"}</p><p>Login validado pelo Supabase Auth. ${s.supabase.pedidos ?? "—"} pedidos no PostgreSQL.</p></article><article><p class="eyebrow">DOCUMENTOS FLEXÍVEIS</p><h3>MongoDB</h3><p>${s.mongodb.conectado ? "● Conectado" : "Indisponível"}</p><p>${s.mongodb.produtos} produtos. Nome, preço, imagem e atributos de cada item ficam em documentos.</p></article><article><p class="eyebrow">MEMÓRIA TEMPORÁRIA</p><h3>Redis</h3><p>${s.redis.conectado ? "● PONG recebido" : "Indisponível · catálogo usa MongoDB"}</p><p>Catálogo: TTL ${s.redis.ttlConfigurado}s. Itens recentes por visitante: 24h.</p><p>HIT ${s.redis.metricas.hits} · MISS ${s.redis.metricas.misses} · BYPASS ${s.redis.metricas.bypass}</p></article>`;
    [...$("#conexoes").querySelectorAll("article")].forEach((card, index) => {
      const online = [
        s.supabase.conectado,
        s.mongodb.conectado,
        s.redis.conectado,
      ][index];
      card.classList.add(online ? "service-online" : "service-offline");
    });
    animar($("#conexoes"), "content-enter");
  } catch (e) {
    $("#conexoes").innerHTML =
      `<p class="inline-error" role="alert">${esc(e.message)} Use “Atualizar conexões” para tentar novamente.</p>`;
  } finally {
    finalizar();
    $("#conexoes").setAttribute("aria-busy", "false");
  }
}
async function tab(nome) {
  for (const k of ["gestao", "pedidos", "integracoes"])
    $("#" + k).hidden = k !== nome;
  for (const [id, painel] of [
    ["tab-produtos", "gestao"],
    ["tab-pedidos", "pedidos"],
    ["tab-integracoes", "integracoes"],
  ])
    $("#" + id).setAttribute("aria-pressed", String(painel === nome));
  animar($("#" + nome), "content-enter");
  if (nome === "pedidos") await pedidos();
  if (nome === "integracoes") await integracoes();
}
async function navegar() {
  fecharToast();
  const admin = location.pathname.replace(/\/$/, "") === "/admin";
  document.querySelectorAll(".header nav a").forEach((link) => {
    const ativo =
      link.getAttribute("href") === (admin ? "/admin" : "/#catalogo");
    if (ativo) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
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
    const limpar = e.target.closest("[data-clear-filter]");
    if (limpar) {
      const tipo = limpar.dataset.clearFilter;
      if (tipo !== "categoria") $("#busca").value = "";
      if (tipo !== "busca") $("#categoria").value = "";
      render();
      $(tipo === "categoria" ? "#categoria" : "#busca").focus();
    }
    if (e.target.closest("[data-retry-catalog]")) await carregar();
    if (e.target.closest("[data-retry-cart]")) await sacola();
    if (e.target.closest("[data-retry-orders]")) await pedidos();
    const close = e.target.closest("[data-close]");
    if (close) $("#" + close.dataset.close).close();
    const ver = e.target.closest("[data-ver]");
    if (ver) await detalhe(ver.dataset.ver);
    const add = e.target.closest("[data-add]");
    if (add) {
      adicionar(add.dataset.add);
    }
    const rem = e.target.closest("[data-remove]");
    if (rem) {
      ultimaRemocao = { ...carrinho.find((i) => i.id === rem.dataset.remove) };
      const nome =
        produtos.find((p) => p._id === rem.dataset.remove)?.nome || "Produto";
      const linhas = [...$("#itens-sacola").querySelectorAll(".remove")];
      const posicao = linhas.indexOf(rem);
      carrinho = carrinho.filter((i) => i.id !== rem.dataset.remove);
      salvar();
      renderSacola();
      $("#sacola-status").textContent = `${nome} removido da sacola.`;
      $("#desfazer-remocao").hidden = false;
      const botoes = $("#itens-sacola").querySelectorAll(".remove");
      (
        botoes[Math.min(posicao, botoes.length - 1)] ||
        $("#itens-sacola button") ||
        $("#sacola .close")
      ).focus();
      animar($("#total"), "total-update");
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) formProduto(edit.dataset.edit);
  } catch (err) {
    aviso(err.message, true);
  }
});
$("#desfazer-remocao").onclick = () => {
  if (!ultimaRemocao) return;
  const atual = carrinho.find((i) => i.id === ultimaRemocao.id);
  if (atual)
    atual.quantidade = Math.min(
      99,
      atual.quantidade + ultimaRemocao.quantidade,
    );
  else carrinho.push(ultimaRemocao);
  ultimaRemocao = null;
  salvar();
  renderSacola();
  $("#sacola-status").textContent = "Pronto! O produto voltou para sua sacola.";
  $("#desfazer-remocao").hidden = true;
  $("#sacola .close").focus();
  animar($("#total"), "total-update");
};
$("#itens-sacola").addEventListener("change", async (e) => {
  const id = e.target.dataset.quantidade;
  if (!id) return;
  const n = Number(e.target.value);
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    e.target.value = carrinho.find((i) => i.id === id).quantidade;
    $("#sacola-status").textContent =
      "Escolha uma quantidade inteira entre 1 e 99.";
    return;
  }
  carrinho.find((i) => i.id === id).quantidade = n;
  salvar();
  atualizarTotal();
  const nome = produtos.find((p) => p._id === id)?.nome || "Produto";
  $("#sacola-status").textContent = `${nome}: quantidade atualizada para ${n}.`;
  animar($("#total"), "total-update");
});
$("#toast-close").onclick = fecharToast;
$("#toast-cart").onclick = async () => {
  fecharToast();
  if ($("#produto-dialog").open) $("#produto-dialog").close();
  try {
    await sacola();
  } catch (e) {
    aviso(e.message, true);
  }
};
$("#cart-toast").addEventListener("mouseenter", () => clearTimeout(toastTimer));
$("#cart-toast").addEventListener("mouseleave", programarToast);
$("#cart-toast").addEventListener("focusin", () => clearTimeout(toastTimer));
$("#cart-toast").addEventListener("focusout", programarToast);
$("#abrir-carrinho").onclick = () =>
  sacola().catch((e) => aviso(e.message, true));
$("#busca").oninput = render;
$("#categoria").onchange = render;
$("#comprar").onclick = async () => {
  const b = $("#comprar");
  if (b.disabled) return;
  pedidoPendente = true;
  const finalizar = carregandoBotao(b, "Preparando seu pedido…");
  const controles = [
    ...$("#sacola").querySelectorAll(
      "[data-remove], [data-quantidade], #desfazer-remocao",
    ),
  ];
  controles.forEach((c) => (c.disabled = true));
  $("#erro-sacola")?.remove();
  $("#pedido-status").hidden = false;
  $("#pedido-status").textContent =
    "Conferindo os preços e registrando suas escolhas…";
  $("#pedido-status").classList.add("pending-status");
  try {
    const p = await api("pedidos", "POST", { itens: carrinho });
    $("#mensagem-pedido").textContent = p.mensagem;
    $("#link-whatsapp").href = p.url;
    $("#pedido-pronto").hidden = false;
    animar($("#pedido-pronto"), "order-enter");
    if ($("#sacola").open)
      $("#pedido-pronto").scrollIntoView({
        block: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
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
    mostrarErro(err, e.message);
  } finally {
    finalizar();
    controles.forEach((c) => (c.disabled = false));
    $("#pedido-status").hidden = true;
    $("#pedido-status").classList.remove("pending-status");
    pedidoPendente = false;
  }
};
$("#login").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target,
    b = f.querySelector("button");
  if (b.disabled) return;
  const finalizar = carregandoBotao(b, "Entrando na sua loja…");
  f.setAttribute("aria-busy", "true");
  $("#login-erro").textContent = "";
  try {
    await api("login", "POST", {
      email: f.elements.email.value,
      password: f.elements.password.value,
    });
    f.elements.password.value = "";
    await navegar();
    aviso("Bem-vindo! Sua loja está pronta para cuidar da coleção.");
  } catch (err) {
    mostrarErro($("#login-erro"), err.message);
  } finally {
    finalizar();
    f.setAttribute("aria-busy", "false");
  }
};
$("#sair").onclick = async () => {
  const b = $("#sair");
  if (b.disabled) return;
  const finalizar = carregandoBotao(b, "Saindo…");
  try {
    await api("logout", "POST", {});
    usuario = null;
    await navegar();
    aviso("Você saiu da área da loja com segurança.");
  } catch (e) {
    aviso(e.message, true);
  } finally {
    finalizar();
  }
};
$("#novo").onclick = () => formProduto();
$("#form-produto").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target,
    b = f.querySelector("button");
  if (b.disabled) return;
  const finalizar = carregandoBotao(b, "Salvando produto…");
  f.setAttribute("aria-busy", "true");
  $("#form-erro").textContent = "";
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
    const salvo = await api(
      "admin/produtos" + (id ? "/" + id : ""),
      id ? "PUT" : "POST",
      p,
    );
    $("#form-dialog").close();
    try {
      await carregar();
      const linha = [...$("#lista-admin").querySelectorAll("[data-edit]")]
        .find((b) => b.dataset.edit === salvo._id)
        ?.closest(".admin-row");
      if (linha) animar(linha, "saved-highlight");
      aviso(`${salvo.nome} salvo e disponível no catálogo. ✓`);
    } catch {
      aviso("Produto salvo! Atualize a página para recarregar a lista.");
    }
  } catch (err) {
    mostrarErro($("#form-erro"), err.message);
  } finally {
    finalizar();
    f.setAttribute("aria-busy", "false");
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

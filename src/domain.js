export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function produto(body) {
  const nome = String(body.nome || "").trim(),
    descricao = String(body.descricao || "").trim(),
    categoria = String(body.categoria || "").trim();
  const preco = Number(body.preco),
    imagem = String(body.imagem || "").trim();
  if (
    nome.length < 3 ||
    nome.length > 100 ||
    descricao.length < 10 ||
    descricao.length > 1000 ||
    !categoria ||
    categoria.length > 40
  )
    throw new AppError("Confira nome, descrição e categoria.");
  if (
    !Number.isFinite(preco) ||
    preco < 0.01 ||
    preco > 99999 ||
    Math.abs(preco * 100 - Math.round(preco * 100)) > 0.00001
  )
    throw new AppError("Preço inválido. Use até duas casas decimais.");
  if (
    !/^\/imagens\/(caderno|mochila|garrafa|caneta|fone|luminaria)\.svg$/.test(
      imagem,
    )
  )
    throw new AppError("Escolha uma das imagens disponíveis.");
  const atributos = body.atributos ?? {};
  if (
    typeof atributos !== "object" ||
    Array.isArray(atributos) ||
    Object.keys(atributos).length > 8 ||
    Object.entries(atributos).some(
      ([k, v]) =>
        !/^[-\p{L} 0-9]{1,40}$/u.test(k) ||
        typeof v !== "string" ||
        v.length > 120,
    )
  )
    throw new AppError("Atributos inválidos.");
  return {
    nome,
    descricao,
    categoria,
    precoCentavos: Math.round(preco * 100),
    imagem,
    atributos,
    ativo: true,
  };
}
export function itensPedido(body) {
  if (
    !Array.isArray(body.itens) ||
    body.itens.length < 1 ||
    body.itens.length > 30
  )
    throw new AppError("Carrinho vazio ou muito grande.");
  const m = new Map();
  for (const i of body.itens) {
    if (
      !/^[a-f0-9]{24}$/.test(i.id) ||
      !Number.isInteger(i.quantidade) ||
      i.quantidade < 1 ||
      i.quantidade > 99 ||
      m.has(i.id)
    )
      throw new AppError("Itens do carrinho inválidos.");
    m.set(i.id, i.quantidade);
  }
  return m;
}
export function montarPedido(produtos, quantidades) {
  if (produtos.length !== quantidades.size)
    throw new AppError(
      "Um produto saiu do catálogo. Atualize o carrinho.",
      409,
    );
  const itens = produtos.map((p) => ({
    id: String(p._id),
    nome: p.nome,
    quantidade: quantidades.get(String(p._id)),
    precoCentavos: p.precoCentavos,
  }));
  const total = itens.reduce((s, p) => s + p.quantidade * p.precoCentavos, 0);
  const moeda = (n) =>
    (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return {
    itens,
    total,
    mensagem: `Olá! Gostaria de pedir:\n${itens.map((i) => `${i.quantidade}x ${i.nome} — ${moeda(i.quantidade * i.precoCentavos)}`).join("\n")}\nTotal: ${moeda(total)}\nAguardo confirmação da disponibilidade.`,
  };
}

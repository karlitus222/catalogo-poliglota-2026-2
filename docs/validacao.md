# Validação da interface e roteiro final

## Estado em 21/11/2026

- Implementação pronta para revisão.
- Onze testes automatizados aprovados com serviços reais.
- Supabase security advisors sem problemas; npm audit sem vulnerabilidades reportadas.
- A conferência no navegador foi interrompida pela ferramenta antes de inspecionar o aplicativo, pois não foi possível determinar a URL com segurança.
- Não há capturas de tela apresentadas como verificadas.
- Vídeo e submissão no Gennera ainda pendentes.

## Conferência visual antes do vídeo

1. Abra http://127.0.0.1:3026 e confira coleção, imagens, pesquisa e filtro de categoria.
2. Conheça dois produtos e volte ao primeiro: os recentes devem aparecer na ordem de acesso, sem repetição. Uma janela anônima deve ter histórico separado.
3. Adicione dois produtos à sacola, mude quantidades, remova um e confira o total. Recarregue a página e confirme que a sacola persiste.
4. Acesse Área da loja pelo menu (ou /admin diretamente), tente senha inválida e depois use a conta do .env. Sem sessão o painel deve mostrar o login.
5. Cadastre um novo produto com nome, descrição, categoria, preço, imagem e um atributo. Volte à coleção e confira sua presença. Edite o preço e confira o catálogo novamente.
6. Adicione o novo produto e prepare um pedido. Confira quantidades e total no texto. O link deve apontar ao destino configurado e abrir a conversa com texto pronto; não é necessário enviar a mensagem durante o ensaio.
7. No painel, confira o pedido salvo e o status dos três bancos. A primeira consulta de catálogo após gravação deve ser MISS e a seguinte HIT.
8. Pare apenas Redis: docker compose stop redis. O catálogo continua disponível e o histórico informa indisponibilidade. Reinicie com docker compose start redis e consulte novamente.
9. Saia da conta; confira que cadastrar ou editar exige novo login.
10. Confira também em uma janela estreita (celular): menu, filtros, cards, formulário e sacola sem elementos cortados.

## Roteiro do vídeo — 5 a 10 minutos

O vídeo fica para a última etapa, conforme combinado. Deve mostrar a aplicação executando, não apenas imagens estáticas.

- 0:00–0:45: proposta da loja e justificativa de cada banco.
- 0:45–1:45: catálogo, filtros, detalhes, itens recentes e sacola.
- 1:45–3:30: login real do administrador, cadastro de produto, atributos flexíveis e edição. Conferir atualização no catálogo público.
- 3:30–5:00: compra simulada, quantidades, total recalculado, texto formatado e abertura do WhatsApp.
- 5:00–6:00: painel de pedidos e integrações, mostrar MISS/HIT e propósito do Redis.
- 6:00–7:00: explicar configuração, testes e limitações. Se houver tempo, demonstrar BYPASS com Redis parado.

Não mostrar .env, senha, tokens ou chaves durante a gravação. O usuário ainda escolherá/grava a narração. Após conferir o vídeo, publicar o link e enviar o trabalho na Plataforma A.

## Feedback de interação ampliado

A interface inclui confirmação ao adicionar à sacola, quantidade marcada no card, contador animado, aviso flutuante, filtros ativos com limpeza, estados de carregamento, tentativa novamente em falhas, remoção com desfazer, preparação do pedido com bloqueio de cliques repetidos, confirmação de sucesso, abas administrativas ativas e indicadores das conexões. As animações respeitam prefers-reduced-motion.

Conferência funcional adicional em DOM isolado (21/11/2026): busca/limpeza, confirmação de adição, carregamento da sacola, remoção/desfazer, quantidade sem perda de foco e finalização com respostas de erro/sucesso. Dois cliques rápidos geraram uma solicitação. Essa conferência usa respostas controladas e não substitui a revisão visual no navegador; os testes dos bancos reais continuam descritos no README.

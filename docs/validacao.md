# Roteiro de apresentação

## Preparação

Inicie os serviços e a aplicação seguindo o README. A apresentação deve durar de 5 a 10 minutos e mostrar o sistema em execução. A revisão visual e a gravação foram concluídas em 25/11/2026.

## Fluxos a conferir

1. Abra http://127.0.0.1:3026. Confira os produtos, a busca, as categorias e os links das seções da página.
2. Abra dois produtos e depois volte ao primeiro. O histórico deve acompanhar a ordem de acesso, sem repetir itens. Uma janela anônima deve apresentar um histórico separado.
3. Adicione produtos à sacola. Confira a confirmação no botão, a quantidade no card e o aviso flutuante.
4. Altere quantidades, remova um item e desfaça a remoção. Confira o total e a persistência da sacola após recarregar a página.
5. Entre em Área da loja usando a conta configurada no .env. Confira também a mensagem para senha incorreta e a exigência de login para acesso ao painel.
6. Cadastre um produto com nome, descrição, preço, categoria, imagem e um atributo. Confira sua presença no catálogo. Edite o preço e consulte novamente.
7. Prepare um pedido. Confira os itens, as quantidades, o total e a mensagem. Abra o WhatsApp para mostrar o texto preparado; não é necessário enviar durante o ensaio.
8. No painel, consulte o registro do pedido e o estado das três conexões.
9. Confira a listagem após uma gravação: primeiro MISS, depois HIT. Pare apenas o Redis com `docker compose stop redis` e confira o BYPASS. Reinicie com `docker compose start redis`.
10. Saia do painel e confirme que cadastrar ou editar exige novo login.
11. Confira a página em uma janela estreita: navegação, cards, formulários, perguntas frequentes e sacola.

## Sequência sugerida para o vídeo

| Tempo     | Conteúdo                                                     |
| --------- | ------------------------------------------------------------ |
| 0:00–0:45 | Proposta da loja e função de cada banco                      |
| 0:45–1:45 | Catálogo, filtros, detalhes, recentes e sacola               |
| 1:45–3:30 | Login, cadastro, atributos e edição; atualização do catálogo |
| 3:30–5:00 | Pedido, total calculado no servidor e abertura do WhatsApp   |
| 5:00–6:00 | Pedidos salvos, conexões e cache MISS/HIT                    |
| 6:00–7:00 | Configuração, testes e limites; BYPASS, se houver tempo      |

Mantenha senhas, tokens, chaves e o arquivo .env fora da gravação.

## Validação realizada

Em 21/11/2026, os 11 testes de integração passaram com Supabase, MongoDB e Redis locais. O advisor de segurança do Supabase não reportou problemas e o npm audit não reportou vulnerabilidades.

A interface também foi conferida em DOM isolado, com respostas controladas, para busca, limpeza de filtros, confirmação de adição, carregamento da sacola, remoção e desfazer, atualização de quantidade e pedido com erro ou sucesso. Dois cliques rápidos geraram uma solicitação.

Em 25/11/2026, os fluxos foram conferidos e capturados no navegador com os serviços reais. Foi cadastrado o Caderno Aurora e seu preço foi editado de R$ 34,90 para R$ 39,90; a alteração apareceu no catálogo. A sacola com duas Garrafas Essenciais e uma Mochila Urbana totalizou R$ 249,70. O pedido foi persistido e consultado no painel. O link abriu a página do WhatsApp com os itens, as quantidades, o total e a referência preenchidos; nenhuma mensagem foi enviada. As conexões com os três bancos foram conferidas. Os 11 testes foram novamente aprovados.

O MP4 de entrega, com cerca de 6 minutos e 8 segundos, está incluído no ZIP preparado para envio pela Plataforma A, junto com o código-fonte. O vídeo combina a narração original com capturas da aplicação, aproximações, transições e diagramas explicativos.

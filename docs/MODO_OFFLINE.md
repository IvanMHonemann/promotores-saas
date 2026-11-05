# Modo offline do promotor

## O que funciona sem internet (depois do primeiro acesso online)
- Abrir o app (todas as telas do app ficam salvas pelo service worker, `client/public/sw.js` + plugin `pwa-precache` no `vite.config.ts`).
- Continuar logado (sessão salva no aparelho).
- Ver o roteiro do dia, lojas, clientes e últimas batidas (cache em IndexedDB, `client/src/lib/offlineCache.ts`).
- Bater ponto (entrada, intervalo, retorno, saída), fazer check-in/check-out e tirar fotos: tudo vai para a fila
  `client/src/lib/outbox.ts` (IndexedDB, fotos como Blob comprimido).

## Como a fila sincroniza
- Envia ao abrir o app, ao voltar a internet, ao voltar para o app e a cada 30 s (`client/src/hooks/useOutbox.ts`).
- Ordem preservada: batidas na ordem em que foram feitas; a foto do check-in só sobe depois do check-in.
- Tentativas com espera crescente (5 s até 5 min). Erro recusado pelo servidor fica marcado e aparece na lista
  "Itens aguardando envio" (toque no indicador no topo) com "Tentar agora" ou "Descartar".
- Cada item tem um UUID que é a chave de idempotência: reenviar nunca duplica.

## Servidor
- Batida offline: horário registrado = horário do aparelho; horário de gravação = recebimento no servidor
  (Portaria 671, Anexo IX itens 4 e 5). NSR e cadeia de hash são atribuídos no recebimento.
- Relógio do aparelho: o app guarda uma âncora a cada resposta do servidor (cabeçalho Date + `performance.now`).
  Se a hora da marcação não bate com o tempo decorrido, a marcação recebe `[ALERTA-RELOGIO]` (shared/offlineClock.ts).
- Batida offline fora da sequência é aceita (a Portaria proíbe restringir marcação) e recebe `[SEQUENCIA-OFFLINE]`.
- Visitas: `operations.visits.start/complete` aceitam `clientId`, `deviceTime`, `offline` e `clock`; a tabela
  `offline_submissions` (drizzle/0027, criada sozinha no primeiro uso) guarda a chave e a marca "registrado offline".

## Onde o gestor vê
- Espelho de ponto (PDF/planilha): símbolo `o` = registrada offline, com legenda e total do mês.
- Cartão ponto do administrador: etiquetas "Registrado offline", "Relógio suspeito", "Fora de sequência".
- Check-in / Check-out: "Registrado offline · recebido às ..." e "Conferir horário".

## Limites
- O primeiro login precisa de internet.
- O relógio monotônico zera quando o app é fechado; nesse caso só se detecta relógio que voltou no tempo ou que já
  estava errado na última conexão.
- Batida offline com mais de 7 dias ou no futuro usa o horário do servidor (regra já existente).
- Endereço por extenso só aparece com internet (o GPS é guardado offline; o endereço é buscado na hora de ver).
- Limpar os dados do navegador ou desinstalar o app apaga a fila que ainda não foi enviada.

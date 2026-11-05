# Módulo Check-in / Check-out de visitas (`visitCheckIn`)

Separado de **Lojas, roteiros e fotos** (`fieldOperations`) e do **Ponto eletrônico** (`timeTracking`).

## O que cobre
- Botões de check-in e check-out (foto da fachada + GPS)
- Status de execução da visita (pendente / em andamento / concluída) nas telas de acompanhamento
- Página admin **Check-in / Check-out** (`/check-in-out`)
- Procedures `operations.visits.start` e `operations.visits.complete`
- Passos de onboarding/guia que falam em check-in

## O que NÃO cobre (fica em `fieldOperations`)
- Cadastro de lojas e clientes da loja
- Planejamento de roteiros / agenda do dia (consulta)
- Fotos de loja (galeria), inclusive sem check-in
- Listagem `operations.visits.today` / `list` (só leitura do planejamento)

## Combinações
| Ponto (`timeTracking`) | Check-in (`visitCheckIn`) | Comportamento |
|---|---|---|
| off | on | Check-in livre, sem exigir jornada (PR #59) |
| on | on | Check-in só com jornada aberta |
| on | off | Ponto funciona; roteiro/fotos ok; sem botões nem página de check-in |
| off | off | Só planejamento/fotos (se `fieldOperations`) e demais módulos |

`visitCheckIn` sem `fieldOperations` não tem o que operar (não há lojas/roteiro); o painel da plataforma pode deixar os dois ligados juntos.

## Default
Planos Profissional/Empresarial e overrides que já tinham `fieldOperations` recebem `visitCheckIn` ligado (migração `0027_visit_checkin_module.sql` + `ensureVisitCheckInFeature` no boot).

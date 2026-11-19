# DOSSIÊ DE CONFORMIDADE REP-P — GONDAP

**Documento técnico de apoio. Não é certificado de conformidade, laudo oficial ou garantia de aprovação em fiscalização.**

**Data:** 18 de novembro de 2026  
**Versão analisada:** main @ 31ef998 + alterações locais de assinaturas e PAdES

## NSR por estabelecimento

Conforme FAQ do MTE (Portaria 671), cada estabelecimento (CNPJ de 14 posições) deve ter sua própria sequência de NSR.

No GondUp, o NSR é sequencial por `companyId`. O modelo operacional documentado em `server/ponto/ledger.ts` é que cada estabelecimento (CNPJ) utiliza uma conta própria. Com essa premissa, a sequência por companyId atende ao requisito normativo.

## Matriz resumida

| Requisito | Status |
|-----------|--------|
| Imutabilidade das marcações | CONFORME |
| NSR por estabelecimento (via conta por CNPJ) | CONFORME (com premissa operacional) |
| AFD 004 / AEJ 002 | CONFORME |
| CAdES AFD/AEJ | PARCIAL (código pronto; depende de certificado ICP-Brasil) |
| PAdES recibos | PARCIAL (integrado ao endpoint; depende de certificado) |
| INPI / ATRT | PENDÊNCIA DOCUMENTAL |

Este dossiê é material de trabalho. Não constitui certificado de conformidade.

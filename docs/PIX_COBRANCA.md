# Cobrança manual com Pix (sem gateway)

## Variáveis de ambiente (opcionais)

| Variável | Padrão | Uso |
|---|---|---|
| `PIX_KEY` | `ivanhonemann09@gmail.com` | Chave Pix |
| `PIX_MERCHANT_NAME` | `IVAN MATEUS HONEMANN` | Nome no BR Code (máx. 25, sem acento) |
| `PIX_MERCHANT_CITY` | `SAPIRANGA` | Cidade no BR Code (máx. 15) |
| `PIX_WHATSAPP` | `5551991667804` | Número do WhatsApp (só dígitos) |

## Fluxo

1. Administrador da plataforma define **valor mensal**, **vencimento** e **tolerância** (padrão 5 dias) em Empresas.
2. Em 5, 3 e 1 dia antes do vencimento, o admin da empresa vê um aviso (pode fechar no dia).
3. Após o vencimento, aviso vermelho permanente (não fecha) com QR Pix + copia e cola + WhatsApp, mostrando dias até o bloqueio.
4. Depois da tolerância, o acesso comercial é bloqueado e só aparece a tela de pagamento.
5. **Marcar como pago** (plataforma) registra o Pix, avança a validade em **1 mês a partir do vencimento original** (não da data do pagamento) e remove o aviso.
   - Ex.: venceu 10/11, pago 14/11 → próximo vencimento **10/12** (os dias em atraso contam no ciclo já pago).
   - Pagamento antecipado também parte do vencimento original.
   - Cada clique avança **um** mês (mesmo se estiver vários meses atrasado).
   - Dia 31: em fevereiro vira 28/29; o dia âncora 31 é preservado para os meses seguintes.

A confirmação é sempre manual — não há gateway nem webhook.

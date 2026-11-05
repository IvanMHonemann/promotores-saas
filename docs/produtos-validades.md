# Produtos e validades (módulo `products`)

- **Módulo por empresa**: `products` no catálogo de módulos (Empresas → módulos). Default ON: `ensureProductsFeature()` (e a migração `drizzle/0031_products_module_validades.sql`) inclui o módulo em todos os planos que ainda não têm a linha. Desligado: some do menu, a rota `/produtos` mostra "Módulo não liberado", todas as rotas `products.*` respondem 403 e os painéis não mostram alertas. Independe de ponto e check-in.
- **Permissões (servidor)**: admin e supervisor vêem e alteram tudo da empresa. Promotor vê o que cadastrou + produtos das lojas atribuídas a ele, e só edita/exclui o que ele cadastrou (`canManageProduct`).
- **Cadastro**: loja → indústria (cliente da loja, `store_clients`) → ler código → validade → salvar e próximo. Mesmo código + loja + indústria + lote + validade soma a quantidade. Cada envio leva um `clientRequestId` (tabela `inventory_product_requests`): reenvio não duplica nem soma duas vezes — pronto para a fila offline do PR #58.
- **Validade no passado**: o app pede confirmação. Datas impossíveis (30/02, ano < 2000) são recusadas no servidor.
- **Alerta**: janela por empresa (`system_settings.products_alert_days`, padrão 30, opções 7/15/30/45/60/90, só o administrador muda). "Alerta" = vencidos + a vencer na janela. Datas sempre como data de calendário no fuso de Brasília.
- **Foto da etiqueta**: comprimida no aparelho (`imageCompress`), gravada em `product-photos/{companyId}/…` (área aceita por `isTenantMediaKey`/`isDeletableMediaKey`). Apagada ao trocar/remover e quando o item sai da lixeira.
- **Relatórios**: lista paginada e filtrada no servidor; CSV (até 10 mil linhas, `;`, BOM, fórmulas neutralizadas); impressão agrupada por indústria.
- **Loja removida**: produtos continuam e aparecem como "loja removida"; ao remover a loja o app avisa quantos produtos ela tem.
- **Teste com MySQL real**: `LOCAL_MYSQL_URL=mysql://root@127.0.0.1:PORT/db npx vitest run server/productsModule.mysql.test.ts`.

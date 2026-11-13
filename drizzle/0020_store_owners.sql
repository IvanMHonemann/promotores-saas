-- Quem cadastrou cada loja. Define a visibilidade: usuário comum vê as lojas que cadastrou
-- (e as de roteiros atribuídos a ele); o administrador da empresa vê todas.
-- Lojas antigas ficam sem dono (só o administrador as vê). O servidor também cria esta tabela
-- sob demanda (ensureStoreOwnersTable), então o arquivo é idempotente.
CREATE TABLE IF NOT EXISTS `store_owners` (
  `storeId` int NOT NULL,
  `companyId` int NOT NULL,
  `memberAccountId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`storeId`),
  KEY `store_owners_company_member_idx` (`companyId`,`memberAccountId`)
);

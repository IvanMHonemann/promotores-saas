import { sql } from "drizzle-orm";

/**
 * Clientes cadastrados dentro de cada loja. As fotos passam a ser tiradas dentro de um cliente
 * (`store_photos.storeClientId`, opcional para preservar as fotos antigas).
 * Segue o padrão de DDL sob demanda do projeto (idempotente, sem apagar nada).
 */
let ensured: Promise<void> | null = null;

export function ensureStoreClientsSchema(db: any): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS store_clients (
        id int AUTO_INCREMENT NOT NULL,
        companyId int NOT NULL,
        storeId int NOT NULL,
        name varchar(255) NOT NULL,
        contactName varchar(255) NULL,
        phone varchar(50) NULL,
        notes text NULL,
        active boolean NOT NULL DEFAULT true,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY store_clients_company_store_idx (companyId, storeId)
      )`));
      // store_photos pode ainda não existir (criada sob demanda pelo módulo de fotos).
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS store_photos (
        id int AUTO_INCREMENT NOT NULL,
        companyId int NOT NULL,
        storeId int NOT NULL,
        promoterId int NOT NULL,
        visitId int,
        capturedAt timestamp NOT NULL,
        latitude double,
        longitude double,
        accuracy double,
        locationStatus enum('success','permission_denied','unavailable','timeout','error') DEFAULT 'unavailable',
        fileKey varchar(512) NOT NULL,
        thumbnailKey varchar(512),
        mimeType varchar(100),
        fileSize int,
        idempotencyKey varchar(64),
        uploadStatus enum('pending','uploaded','failed') NOT NULL DEFAULT 'pending',
        expiresAt timestamp NOT NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY store_photos_company_store_date_idx (companyId,storeId,capturedAt),
        KEY store_photos_company_promoter_idx (companyId,promoterId),
        KEY store_photos_expires_idx (expiresAt),
        UNIQUE KEY store_photos_company_idempotency_unique (companyId,idempotencyKey)
      )`));
      const res: any = await db.execute(sql`SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_photos' AND COLUMN_NAME = 'storeClientId'`);
      const first = Array.isArray(res?.[0]) ? res[0][0] : Array.isArray(res) ? res[0] : res?.rows?.[0];
      if (Number(first?.n ?? 0) === 0) {
        await db.execute(sql.raw(`ALTER TABLE store_photos ADD COLUMN storeClientId int NULL`));
        try { await db.execute(sql.raw(`CREATE INDEX store_photos_client_idx ON store_photos (companyId, storeClientId)`)); } catch { /* índice já existe */ }
      }
    })().catch((err) => { ensured = null; throw err; });
  }
  return ensured;
}

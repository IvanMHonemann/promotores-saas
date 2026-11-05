import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

let cachedS3: { signature: string; value: NonNullable<ReturnType<typeof buildS3Client>> } | null = null;

/** Reaproveita o S3Client entre chamadas (evita novo handshake TLS/credenciais a cada upload na mesma instância). */
function getS3Client() {
  const signature = [process.env.S3_BUCKET, process.env.S3_ACCESS_KEY_ID, process.env.S3_SECRET_ACCESS_KEY, process.env.S3_REGION, process.env.S3_ENDPOINT, process.env.S3_FORCE_PATH_STYLE, process.env.S3_PUBLIC_BASE_URL].join("|");
  if (cachedS3?.signature === signature) return cachedS3.value;
  const value = buildS3Client();
  cachedS3 = value ? { signature, value } : null;
  return value;
}

function buildS3Client() {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  const rawRegion = process.env.S3_REGION || "us-east-1";
  const region = rawRegion === "auto" ? "us-east-1" : rawRegion;
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || Boolean(endpoint && endpoint.includes("r2.cloudflarestorage.com")),
    credentials: { accessKeyId, secretAccessKey },
  });
  return { bucket, client, publicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "") };
}

/** True quando o bucket R2/S3 está configurado (backup e fotos usam isso). */
export function isStorageConfigured(): boolean {
  return Boolean(getS3Client());
}

function publicOrSignedUrl(s3: NonNullable<ReturnType<typeof getS3Client>>, key: string): Promise<string> {
  if (!s3) return Promise.reject(new Error("Storage is not configured."));
  if (s3.publicBaseUrl) {
    return Promise.resolve(`${s3.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`);
  }
  return getSignedUrl(s3.client, new GetObjectCommand({ Bucket: s3.bucket, Key: key }), { expiresIn: 3600 });
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const s3 = getS3Client();
  if (!s3) throw new Error("Storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: body, ContentType: contentType }));
  return { key, url: await publicOrSignedUrl(s3, key) };
}

/** Grava com a chave exata (sem sufixo aleatório). Usado pelo backup diário para chaves previsíveis. */
export async function storagePutExact(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();
  if (!s3) throw new Error("Storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: body, ContentType: contentType }));
  return { key, url: await publicOrSignedUrl(s3, key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: await storageGetSignedUrl(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();
  if (!s3) throw new Error("Storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  return publicOrSignedUrl(s3, key);
}

export async function storageRead(relKey: string): Promise<{ data: Buffer; contentType?: string }> {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();
  if (!s3) throw new Error("Storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  const result = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
  if (!result.Body) throw new Error("Storage returned an empty image.");
  const bytes = await result.Body.transformToByteArray();
  return { data: Buffer.from(bytes), contentType: result.ContentType };
}

export async function storageDelete(relKey: string): Promise<boolean> {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();
  if (!s3) return false;
  try {
    await s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Lista todas as chaves sob um prefixo (paginado). Retorna [] se o storage não estiver configurado. */
export async function storageListKeys(prefix: string): Promise<string[]> {
  const s3 = getS3Client();
  if (!s3) return [];
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const result = await s3.client.send(
      new ListObjectsV2Command({
        Bucket: s3.bucket,
        Prefix: normalizeKey(prefix),
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of result.Contents || []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

/** Apaga até 1000 chaves por chamada (limite do S3/R2). */
export async function storageDeleteMany(keys: string[]): Promise<number> {
  const s3 = getS3Client();
  if (!s3 || keys.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000).map((Key) => ({ Key: normalizeKey(Key) }));
    const result = await s3.client.send(
      new DeleteObjectsCommand({
        Bucket: s3.bucket,
        Delete: { Objects: chunk, Quiet: true },
      }),
    );
    deleted += result.Deleted?.length ?? chunk.length;
  }
  return deleted;
}

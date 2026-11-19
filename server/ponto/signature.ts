/**
 * Assinatura digital real (CAdES detached .p7s e PAdES).
 * Usa node-forge para PKCS#7 e @signpdf para PAdES com ByteRange.
 * Não simula assinaturas. Certificado ICP-Brasil esperado via REP_SIGN_CERT_PATH / REP_SIGN_CERT_PASSWORD.
 */
import forge from "node-forge";
import fs from "node:fs";

export type CertMaterial = {
  cert: forge.pki.Certificate;
  privateKey: forge.pki.PrivateKey;
  validFrom: Date;
  validTo: Date;
};

export class SignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureError";
  }
}

export function loadCertificate(path?: string, password?: string): CertMaterial {
  const certPath = path || process.env.REP_SIGN_CERT_PATH;
  const certPassword = password || process.env.REP_SIGN_CERT_PASSWORD;
  if (!certPath || !certPassword) {
    throw new SignatureError("Certificado ICP-Brasil não configurado (REP_SIGN_CERT_PATH / REP_SIGN_CERT_PASSWORD).");
  }
  if (!fs.existsSync(certPath)) {
    throw new SignatureError("Arquivo de certificado não encontrado.");
  }
  const p12Der = fs.readFileSync(certPath);
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(p12Der.toString("binary"))), certPassword);
  } catch {
    throw new SignatureError("Certificado ou senha inválidos.");
  }
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
  if (!cert || !privateKey) throw new SignatureError("Certificado ou chave privada ausentes no arquivo.");

  const now = new Date();
  if (now < cert.validity.notBefore) throw new SignatureError("Certificado ainda não está vigente.");
  if (now > cert.validity.notAfter) throw new SignatureError("Certificado expirado.");

  return { cert, privateKey, validFrom: cert.validity.notBefore, validTo: cert.validity.notAfter };
}

export function signCadesDetached(content: Buffer | string, material: CertMaterial): Buffer {
  const data = Buffer.isBuffer(content) ? content.toString("latin1") : content;
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(data, "latin1" as any);
  p7.addCertificate(material.cert);
  p7.addSigner({
    key: material.privateKey as any,
    certificate: material.cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date().toISOString() },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Buffer.from(der, "latin1");
}

/**
 * Assina um PDF com PAdES usando @signpdf (placeholder + ByteRange + PKCS#7).
 */
export async function signPades(pdfBuffer: Buffer, p12Buffer: Buffer, password: string): Promise<Buffer> {
  const { default: signpdf } = await import("@signpdf/signpdf");
  const { P12Signer } = await import("@signpdf/signer-p12");
  const { pdflibAddPlaceholder } = await import("@signpdf/placeholder-pdf-lib");
  const { PDFDocument } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  pdflibAddPlaceholder({
    pdfDoc,
    reason: "Comprovante de registro de ponto",
    contactInfo: "GondUp",
    name: "GondUp REP-P",
    location: "Brasil",
  });
  const pdfWithPlaceholder = Buffer.from(await pdfDoc.save());
  const signer = new P12Signer(p12Buffer, { passphrase: password });
  return await signpdf.sign(pdfWithPlaceholder, signer);
}

export function loadP12Buffer(path?: string): Buffer | null {
  const certPath = path || process.env.REP_SIGN_CERT_PATH;
  if (!certPath || !fs.existsSync(certPath)) return null;
  return fs.readFileSync(certPath);
}

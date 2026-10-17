/**
 * Gerador de ZIP mínimo (sem compressão / método "store").
 * Fotos JPEG/PNG já são comprimidas, então guardar sem compressão é o ideal e
 * evita depender de uma biblioteca externa.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = (Math.max(date.getFullYear(), 1980) - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, date: day & 0xffff };
}

/** Monta um arquivo .zip com os arquivos informados (nomes duplicados recebem sufixo). */
export async function buildZip(files: File[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: BlobPart[] = [];
  const usedNames = new Set<string>();
  let offset = 0;
  let centralSize = 0;
  const stamp = dosDateTime(new Date());

  for (const file of files) {
    let name = file.name || "arquivo";
    if (usedNames.has(name)) {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let n = 2;
      while (usedNames.has(`${base}-${n}${ext}`)) n++;
      name = `${base}-${n}${ext}`;
    }
    usedNames.add(name);

    const nameBytes = encoder.encode(name);
    const data = new Uint8Array(await file.arrayBuffer());
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // versão necessária
    local.setUint16(6, 0x0800, true); // flag: nome em UTF-8
    local.setUint16(8, 0, true); // método: store
    local.setUint16(10, stamp.time, true);
    local.setUint16(12, stamp.date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer as ArrayBuffer, nameBytes as BlobPart, data as BlobPart);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true); // versão que criou
    entry.setUint16(6, 20, true); // versão necessária
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, stamp.time, true);
    entry.setUint16(14, stamp.date, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint16(30, 0, true); // extra
    entry.setUint16(32, 0, true); // comentário
    entry.setUint16(34, 0, true); // disco
    entry.setUint16(36, 0, true); // atributos internos
    entry.setUint32(38, 0, true); // atributos externos
    entry.setUint32(42, offset, true);
    central.push(entry.buffer as ArrayBuffer, nameBytes as BlobPart);

    offset += 30 + nameBytes.length + data.length;
    centralSize += 46 + nameBytes.length;
  }

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true);

  return new Blob([...parts, ...central, end.buffer as ArrayBuffer], { type: "application/zip" });
}

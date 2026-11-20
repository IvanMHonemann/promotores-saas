#!/usr/bin/env python3
"""Reconstroi arquivos a partir de .sync-parts/*.manifest.json (base64 ou gzip+base64)."""
import base64
import gzip
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parts_dir = root / ".sync-parts"
if not parts_dir.exists():
    print("Nenhuma pasta .sync-parts")
    sys.exit(0)

for manifest in sorted(parts_dir.glob("*.manifest.json")):
    meta = json.loads(manifest.read_text())
    stem = meta.get("stem") or manifest.name.replace(".manifest.json", "")
    target_name = meta.get("target") or stem.replace("__", "/")
    target = root / target_name
    encoding = meta.get("encoding", "base64")
    n = int(meta["parts"])
    chunks = []
    for i in range(n):
        part = parts_dir / f"{stem}.{i:03d}.b64"
        if not part.exists():
            print("Faltando", part)
            sys.exit(1)
        chunks.append(part.read_text().strip())
    blob = base64.b64decode("".join(chunks))
    if encoding in ("gzip+base64", "gzip"):
        blob = gzip.decompress(blob)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(blob)
    print("OK", target_name, len(blob), "bytes")
print("Concluido.")

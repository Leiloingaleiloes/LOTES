"""Prepara as fotos e videos enviados nas pastas lote-XX para o site.

Para cada arquivo em lote-XX/ gera, em midia/lote-XX/:
  - fotos: <nome>.jpg (ate 1600 px) e <nome>-mini.jpg (400 px)
  - videos: <nome>.mp4 (H.264, ate 720p, toca em qualquer celular) e <nome>-capa.jpg
Depois escreve midia.json, que o site le para montar a galeria de cada lote.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageOps

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except Exception:  # sem suporte a HEIC: as fotos HEIC sao ignoradas
    pass

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "midia"
FOTO = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}
VIDEO = {".mov", ".mp4", ".m4v", ".3gp"}


def limpo(nome: str) -> str:
    s = re.sub(r"[^A-Za-z0-9_-]+", "-", nome).strip("-").lower()
    return s or "arquivo"


def assinatura(arq: Path) -> str:
    h = hashlib.sha1()
    with open(arq, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()[:8]


def foto(origem: Path, pasta: Path, base: str) -> dict:
    grande, mini = pasta / f"{base}.jpg", pasta / f"{base}-mini.jpg"
    if not (grande.exists() and mini.exists()):
        with Image.open(origem) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            g = im.copy()
            g.thumbnail((1600, 1600))
            g.save(grande, "JPEG", quality=82, optimize=True, progressive=True)
            m = im.copy()
            m.thumbnail((400, 400))
            m.save(mini, "JPEG", quality=78, optimize=True)
    return {"src": f"midia/{pasta.name}/{grande.name}", "mini": f"midia/{pasta.name}/{mini.name}"}


def video(origem: Path, pasta: Path, base: str) -> dict:
    mp4, capa = pasta / f"{base}.mp4", pasta / f"{base}-capa.jpg"
    if not mp4.exists():
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(origem),
            "-vf", "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(mp4),
        ], check=True)
    if not capa.exists():
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", str(mp4),
            "-frames:v", "1", "-vf", "scale='min(800,iw)':-2", "-q:v", "4", str(capa),
        ], check=False)
        if not capa.exists():
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4),
                            "-frames:v", "1", "-q:v", "4", str(capa)], check=False)
    return {"src": f"midia/{pasta.name}/{mp4.name}",
            "capa": f"midia/{pasta.name}/{capa.name}" if capa.exists() else ""}


def main() -> int:
    SAIDA.mkdir(exist_ok=True)
    resultado, gerados, erros = {}, set(), []
    for dir_lote in sorted(RAIZ.glob("lote-*")):
        m = re.fullmatch(r"lote-(\d+)", dir_lote.name)
        if not dir_lote.is_dir() or not m:
            continue
        num = str(int(m.group(1)))
        destino = SAIDA / f"lote-{int(num):02d}"
        destino.mkdir(exist_ok=True)
        fotos, videos, usados = [], [], set()
        for arq in sorted(dir_lote.iterdir(), key=lambda p: p.name.lower()):
            if arq.name.startswith(".") or not arq.is_file():
                continue
            ext = arq.suffix.lower()
            if ext not in FOTO | VIDEO:
                continue
            base = f"{limpo(arq.stem)}-{assinatura(arq)}"
            if base in usados:
                continue
            usados.add(base)
            try:
                if ext in FOTO:
                    item = foto(arq, destino, base)
                    fotos.append(item)
                    gerados.update({item["src"], item["mini"]})
                elif ext in VIDEO:
                    item = video(arq, destino, base)
                    videos.append(item)
                    gerados.update({item["src"], item["capa"]})
            except Exception as e:  # um arquivo ruim nao derruba os outros
                erros.append(f"{arq.relative_to(RAIZ)}: {e}")
        if fotos or videos:
            resultado[num] = {"fotos": fotos, "videos": videos}
    # apaga o que sobrou de arquivos removidos
    for f in SAIDA.rglob("*"):
        if f.is_file() and str(f.relative_to(RAIZ)) not in gerados:
            f.unlink()
    for d in sorted(SAIDA.glob("*"), reverse=True):
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()
    (RAIZ / "midia.json").write_text(
        json.dumps(resultado, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for e in erros:
        print("ERRO:", e, file=sys.stderr)
    print(f"{len(resultado)} lotes com midia; {len(erros)} erros")
    return 0


if __name__ == "__main__":
    sys.exit(main())

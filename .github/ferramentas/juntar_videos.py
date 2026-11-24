#!/usr/bin/env python3
"""Junta os vídeos dos lotes em dois vídeos: um dos MACHOS e um das FÊMEAS.

Pedido pelo botão "Juntar vídeos" do Lotes ADM (grava pedido-videos.json; a rotina do GitHub roda).
Cada trecho ganha uma faixa em cima com o lote, a quantidade, a raça e o peso. Ordem: número do lote.
Vídeos marcados como ocultos no Lotes ADM ficam de fora.
Saída: juntos/machos.mp4, juntos/femeas.mp4 e juntos/status.json.
Uso: python3 .github/ferramentas/juntar_videos.py   (na raiz do repositório, com ffmpeg instalado)
"""
import json, os, subprocess, tempfile, datetime, shutil

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SAIDA = os.path.join(RAIZ, "juntos")
FONTE = next((f for f in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"] if os.path.exists(f)), None)
W, H = 720, 1280  # celular em pé; vídeo deitado ganha faixas pretas

def ler_lotes():
    dados = {}
    try:
        linhas = open(os.path.join(RAIZ, "lotes.csv"), encoding="utf-8").read().splitlines()
    except FileNotFoundError:
        return dados
    for ln in linhas[1:]:
        c = [x.strip() for x in ln.split(";")]
        if not c or not c[0].isdigit():
            continue
        dados[int(c[0])] = {"raca": c[1] if len(c) > 1 else "", "sexo": (c[3] if len(c) > 3 else "")[:1].upper(),
                            "qtde": c[4] if len(c) > 4 else "", "peso": c[5] if len(c) > 5 else ""}
    return dados

def tem_audio(arq):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", arq], capture_output=True, text=True)
    return bool(r.stdout.strip())

def txt(s):
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%")

def trecho(src, rotulo, destino):
    l1, _, l2 = rotulo.partition(" · ")
    vf = (f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,"
          f"drawbox=x=0:y=0:w=iw:h=150:color=0x0E1410@0.85:t=fill,drawbox=x=0:y=146:w=iw:h=4:color=0x24B53B:t=fill")
    if FONTE:
        vf += f",drawtext=fontfile={FONTE}:text='{txt(l1)}':fontcolor=white:fontsize=56:x=(w-tw)/2:y=22"
        if l2:
            vf += f",drawtext=fontfile={FONTE}:text='{txt(l2)}':fontcolor=0xD6F1DD:fontsize=30:x=(w-tw)/2:y=96"
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", src]
    if not tem_audio(src):
        cmd += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-shortest"]
    cmd += ["-vf", vf, "-map", "0:v:0", "-map", "0:a:0" if tem_audio(src) else "1:a:0",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "2", destino]
    subprocess.run(cmd, check=True)

def main():
    midia = json.load(open(os.path.join(RAIZ, "midia.json"), encoding="utf-8")) if os.path.exists(os.path.join(RAIZ, "midia.json")) else {}
    lotes, leilao = ler_lotes(), {}
    try:
        leilao = json.load(open(os.path.join(RAIZ, "leilao.json"), encoding="utf-8"))
    except Exception:
        pass
    os.makedirs(SAIDA, exist_ok=True)
    status = {"leilao": leilao, "pronto_em": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")}
    try:
        status["pedido_em"] = json.load(open(os.path.join(RAIZ, "pedido-videos.json"), encoding="utf-8")).get("em")
    except Exception:
        pass
    for sx, nome in (("M", "machos"), ("F", "femeas")):
        itens = []
        for n in sorted(int(k) for k in midia if str(k).isdigit()):
            d = lotes.get(n, {})
            if d.get("sexo") != sx:
                continue
            for v in (midia[str(n)] or {}).get("videos", []):
                src = os.path.join(RAIZ, v.get("src", ""))
                if v.get("oculta") or not os.path.exists(src):
                    continue
                partes = [f"LOTE {n:02d}"]
                if d.get("qtde"): partes.append(f"{d['qtde']} cab.")
                if d.get("raca"): partes.append(d["raca"].title())
                if d.get("peso"): partes.append(f"{d['peso']} kg")
                itens.append((n, src, " · ".join(partes)))
        destino = os.path.join(SAIDA, nome + ".mp4")
        if not itens:
            if os.path.exists(destino):
                os.remove(destino)
            status[nome] = {"arquivo": None, "lotes": []}
            print(nome, ": nenhum vídeo")
            continue
        tmp = tempfile.mkdtemp()
        lista = os.path.join(tmp, "lista.txt")
        with open(lista, "w") as f:
            for i, (n, src, rot) in enumerate(itens):
                p = os.path.join(tmp, f"t{i:03d}.mp4")
                trecho(src, rot, p)
                f.write(f"file '{p}'\n")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", "-movflags", "+faststart", destino], check=True)
        shutil.rmtree(tmp, ignore_errors=True)
        status[nome] = {"arquivo": f"juntos/{nome}.mp4", "lotes": sorted({n for n, _, _ in itens}), "trechos": len(itens),
                        "mb": round(os.path.getsize(destino) / 1e6, 1)}
        print(nome, ":", len(itens), "trechos ->", destino)
    with open(os.path.join(SAIDA, "status.json"), "w", encoding="utf-8") as f:
        json.dump(status, f, ensure_ascii=False, indent=1)
        f.write("\n")

if __name__ == "__main__":
    main()

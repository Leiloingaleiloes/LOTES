"""Junta os vídeos dos lotes num vídeo só, com "LOTE 03" escrito em cada trecho.

Roda no GitHub Actions (tarefa juntar-videos.yml), chamada pelo botão
"Juntar vídeos" do Lotes ADM. A ordem vem pronta da página (machos e depois
fêmeas, cada grupo pelo número do lote); aqui só conferimos e juntamos.

Variáveis de ambiente:
  PASTA   ""  (site de verdade)  ou  "teste-v2/"  (versão de teste)
  LISTA   "03:midia/lote-03/video-ab12.mov;07:midia/lote-07/video-cd34.mp4"
  PEDIDO  código do pedido, só letras minúsculas e números
  SAIDA   pasta onde gravar juntos-<PEDIDO>.mp4 e juntos.json
"""
import json, os, re, subprocess, sys, tempfile, time

LIMITE = 92 * 1024 * 1024          # o GitHub não aceita arquivo acima de 100 MB
AUDIO_K = 96                       # kbit/s do som
FONTES = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
          "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]


def erro(msg):
    print("ERRO: " + msg, file=sys.stderr)
    sys.exit(1)


def ler_entrada():
    pasta = os.environ.get("PASTA", "")
    if pasta not in ("", "teste-v2/"):
        erro("pasta inválida")
    pedido = os.environ.get("PEDIDO", "")
    if not re.fullmatch(r"[a-z0-9]{6,24}", pedido):
        erro("código do pedido inválido")
    itens = []
    for parte in os.environ.get("LISTA", "").split(";"):
        parte = parte.strip()
        if not parte:
            continue
        m = re.fullmatch(r"(\d{1,3}):(midia/lote-\d{2,3}/video-[A-Za-z0-9]{4,40}\.(?:mov|mp4|m4v|webm|3gp))", parte)
        if not m:
            erro("item inválido na lista: " + parte[:80])
        caminho = pasta + m.group(2)
        if not os.path.isfile(caminho):
            erro("vídeo não encontrado: " + caminho)
        itens.append({"lote": int(m.group(1)), "arquivo": caminho})
    if not itens:
        erro("a lista de vídeos está vazia")
    if len(itens) > 300:
        erro("vídeos demais (máximo 300)")
    return pasta, pedido, itens


def sondar(arquivo):
    """Duração, se tem som e se o vídeo é em pé (já considerando a rotação do celular)."""
    r = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", arquivo],
                       capture_output=True, text=True)
    if r.returncode != 0:
        erro("não consegui abrir " + arquivo)
    d = json.loads(r.stdout)
    v = next((s for s in d.get("streams", []) if s.get("codec_type") == "video"), None)
    if not v:
        erro("sem imagem: " + arquivo)
    w, h = int(v.get("width") or 0), int(v.get("height") or 0)
    rot = 0
    try:
        rot = int(float((v.get("tags") or {}).get("rotate", 0)))
    except ValueError:
        pass
    for sd in v.get("side_data_list") or []:
        if "rotation" in sd:
            rot = int(float(sd["rotation"]))
    if abs(rot) % 180 == 90:
        w, h = h, w
    dur = float((d.get("format") or {}).get("duration") or v.get("duration") or 0)
    if dur <= 0:
        erro("duração desconhecida: " + arquivo)
    som = any(s.get("codec_type") == "audio" for s in d.get("streams", []))
    return {"dur": dur, "som": som, "empe": h > w}


def tamanho_saida(empe, vk):
    """Tamanho do vídeo final: menor quando a qualidade precisa cair para caber no limite."""
    if vk >= 1400:
        a, b = 1280, 720
    elif vk >= 800:
        a, b = 960, 540
    else:
        a, b = 848, 480
    return (b, a) if empe else (a, b)


def codificar(item, info, w, h, vk, fonte, destino):
    texto = "LOTE %02d" % item["lote"]
    tam = max(18, round(min(w, h) * 0.05))
    vf = ("scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2:color=black,"
          "setsar=1,fps=30,format=yuv420p,"
          "drawtext=fontfile=%s:text='%s':fontcolor=white:fontsize=%d:box=1:boxcolor=black@0.55:boxborderw=%d:x=%d:y=%d"
          % (w, h, w, h, fonte, texto, tam, round(tam * 0.4), round(tam * 0.9), round(tam * 0.9)))
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", item["arquivo"]]
    if info["som"]:
        mapa = ["-map", "0:v:0", "-map", "0:a:0"]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
        mapa = ["-map", "0:v:0", "-map", "1:a:0"]
    cmd += mapa + ["-t", "%.3f" % info["dur"], "-vf", vf,
                   "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high",
                   "-b:v", "%dk" % vk, "-maxrate", "%dk" % round(vk * 1.4), "-bufsize", "%dk" % (vk * 2),
                   "-g", "60", "-c:a", "aac", "-b:a", "%dk" % AUDIO_K, "-ar", "44100", "-ac", "2",
                   "-video_track_timescale", "30000", destino]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        erro("falhou ao preparar o lote %02d: %s" % (item["lote"], r.stderr[-400:]))


def juntar(itens, infos, fonte, pasta_tmp, fator):
    total = sum(i["dur"] for i in infos)
    vk = int((LIMITE * 8 / 1000) / total * fator) - AUDIO_K
    vk = max(250, min(2500, vk))
    empe = sum(1 for i in infos if i["empe"]) * 2 > len(infos)
    w, h = tamanho_saida(empe, vk)
    print("Total %.0f s · %dx%d · %d kbit/s" % (total, w, h, vk))
    partes = []
    for n, (item, info) in enumerate(zip(itens, infos)):
        p = os.path.join(pasta_tmp, "parte-%03d.mp4" % n)
        codificar(item, info, w, h, vk, fonte, p)
        partes.append(p)
        print("  lote %02d pronto (%d de %d)" % (item["lote"], n + 1, len(itens)), flush=True)
    lista = os.path.join(pasta_tmp, "lista.txt")
    with open(lista, "w") as f:
        for p in partes:
            f.write("file '%s'\n" % p)
    final = os.path.join(pasta_tmp, "final.mp4")
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lista,
                        "-c", "copy", "-movflags", "+faststart", final], capture_output=True, text=True)
    if r.returncode != 0:
        erro("falhou ao juntar: " + r.stderr[-400:])
    return final, total, w, h


def main():
    pasta, pedido, itens = ler_entrada()
    saida = os.environ.get("SAIDA") or "saida"
    os.makedirs(saida, exist_ok=True)
    fonte = next((f for f in FONTES if os.path.isfile(f)), None)
    if not fonte:
        erro("fonte não encontrada")
    infos = [sondar(i["arquivo"]) for i in itens]
    inicio = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        final, total, w, h = juntar(itens, infos, fonte, tmp, 1.0)
        if os.path.getsize(final) > LIMITE:
            print("Ficou grande, refazendo com qualidade menor…")
            final, total, w, h = juntar(itens, infos, fonte, tmp, 0.72)
        if os.path.getsize(final) > LIMITE:
            erro("o vídeo final passou de 92 MB mesmo com qualidade menor")
        nome = "juntos-%s.mp4" % pedido
        os.replace(final, os.path.join(saida, nome))
    tam = os.path.getsize(os.path.join(saida, nome))
    info = {"pedido": pedido, "arquivo": nome, "lotes": [i["lote"] for i in itens],
            "duracao": round(total), "largura": w, "altura": h, "mb": round(tam / 1048576, 1),
            "segundos_para_gerar": round(time.time() - inicio),
            "gerado_em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    with open(os.path.join(saida, "juntos.json"), "w") as f:
        json.dump(info, f, ensure_ascii=False)
    print(json.dumps(info, ensure_ascii=False))


if __name__ == "__main__":
    main()

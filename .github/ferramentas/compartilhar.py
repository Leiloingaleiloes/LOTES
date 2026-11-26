#!/usr/bin/env python3
"""Atualiza a prévia do link do catálogo (a imagem e o texto que aparecem no WhatsApp).

O WhatsApp não executa o site: ele lê só as etiquetas og:* do index.html. Por isso, com o
leilão encerrado (estado.json), este script pega o PRÓXIMO leilão da Leiloingá na agenda
(AGENDA/agenda.json), monta compartilhar-banner.jpg (1200x630) com o banner dele e troca
título/descrição no index.html. Se o leilão do site estiver aberto, não mexe em nada.
Uso: python3 .github/ferramentas/compartilhar.py   (na raiz do repositório)
"""
import datetime, io, json, os, re, sys, urllib.request
from PIL import Image, ImageFilter

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
AG = "https://raw.githubusercontent.com/Leiloingaleiloes/AGENDA/main/"
SITE = "https://leiloingaleiloes.github.io/LOTES/"
SEM = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
UA = {"User-Agent": "Mozilla/5.0 (Leiloinga catalogo)"}

def baixa(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return r.read()

def proximo(agenda):
    agora = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=3 + 6)  # horário de Brasília, com folga de 6 h
    achados = []
    for l in agenda.get("leiloes", []):
        if l.get("leiloeira") != "Leiloingá":
            continue
        try:
            quando = datetime.datetime.fromisoformat(f"{l['data']}T{l.get('hora') or '00:00'}")
        except Exception:
            continue
        if quando >= agora:
            achados.append((quando, l))
    return min(achados, key=lambda x: x[0]) if achados else (None, None)

def moldura(img):
    """1200x630: a arte inteira no centro, com ela mesma desfocada no fundo."""
    W, H = 1200, 630
    img = img.convert("RGB")
    fundo = img.resize((W, int(W * img.height / img.width)) if img.width / img.height < W / H else (int(H * img.width / img.height), H))
    fx, fy = (fundo.width - W) // 2, (fundo.height - H) // 2
    fundo = fundo.crop((fx, fy, fx + W, fy + H)).filter(ImageFilter.GaussianBlur(28))
    esc = Image.new("RGB", (W, H), (0, 0, 0))
    fundo = Image.blend(fundo, esc, 0.35)
    r = min(W / img.width, H / img.height)
    fg = img.resize((max(1, int(img.width * r)), max(1, int(img.height * r))), Image.LANCZOS)
    fundo.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2))
    return fundo

def main():
    try:
        estado = json.load(open(os.path.join(RAIZ, "estado.json"), encoding="utf-8"))
    except Exception:
        estado = {}
    if not estado.get("encerrado"):
        print("leilão aberto no site: nada a fazer"); return
    agenda = json.loads(baixa(AG + "agenda.json"))
    quando, l = proximo(agenda)
    if not l:
        print("nenhum próximo leilão na agenda"); return
    local = l.get("local") or ""
    dia = f"{SEM[quando.weekday()]}, {quando.day:02d}/{quando.month:02d}, {quando.strftime('%Hh%M').replace('h00', 'h')}"
    titulo = f"{l['nome']} · {l.get('cidade','')} · Leiloingá Leilões"
    desc = f"Veja os lotes com fotos e vídeos · {(local + ', ') if local else ''}{l.get('cidade','')} · {dia[0].upper() + dia[1:]}"
    if l.get("bannerLocal"):
        img = Image.open(io.BytesIO(baixa(AG + l["bannerLocal"])))
        moldura(img).save(os.path.join(RAIZ, "compartilhar-banner.jpg"), "JPEG", quality=88, optimize=True)
    caminho = os.path.join(RAIZ, "index.html")
    html = open(caminho, encoding="utf-8").read()
    v = l["data"]
    def troca(padrao, novo, h):
        return re.sub(padrao, lambda m: m.group(1) + novo + m.group(3), h, count=1)
    html = troca(r'(<meta name="description" content=")([^"]*)(">)', desc + ".", html)
    html = troca(r'(<meta property="og:title" content=")([^"]*)(">)', titulo, html)
    html = troca(r'(<meta property="og:description" content=")([^"]*)(">)', desc, html)
    html = troca(r'(<meta property="og:image" content=")([^"]*)(">)', f"{SITE}compartilhar-banner.jpg?v={v}", html)
    html = troca(r'(<title>)([^<]*)(</title>)', titulo, html)
    open(caminho, "w", encoding="utf-8").write(html)
    print("prévia atualizada para:", titulo)

if __name__ == "__main__":
    main()

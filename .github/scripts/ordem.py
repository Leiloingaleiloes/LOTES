"""Gera ordem-de-entrada.pdf a partir de lotes.csv e ordem.txt.

ordem.txt: números dos lotes na ordem em que entram na pista (um por linha,
ou separados por vírgula/espaço). Lotes do CSV que não estiverem na lista
entram no final, em ordem numérica. Sem ordem.txt, usa a ordem numérica.
"""
import os
import re

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EVENTO = "Feira Especial de Gado de Corte"
INFO = ["CTG Jacob Fritz", "Cantagalo - PR", "Domingo · 14h30"]

VERDE = HexColor("#0D5D23")
VERDE_ESC = HexColor("#083F18")
VERDE_VIVO = HexColor("#26E856")
VERMELHO = HexColor("#FC282F")
TEXTO = HexColor("#12261a")
CINZA = HexColor("#4a5f50")
LISTRA = HexColor("#eef3ec")
LINHA = HexColor("#d3ddcf")


def fontes():
    d = "/usr/share/fonts/truetype/"
    opcoes = {
        "Titulo": ["dejavu/DejaVuSansCondensed-Bold.ttf", "liberation/LiberationSans-Bold.ttf"],
        "Corpo": ["liberation/LiberationSans-Regular.ttf", "dejavu/DejaVuSans.ttf"],
        "Negrito": ["liberation/LiberationSans-Bold.ttf", "dejavu/DejaVuSans-Bold.ttf"],
    }
    for nome, arqs in opcoes.items():
        for a in arqs:
            if os.path.exists(d + a):
                pdfmetrics.registerFont(TTFont(nome, d + a))
                break


def ler_lotes():
    lotes = {}
    with open(os.path.join(RAIZ, "lotes.csv"), encoding="utf-8-sig") as f:
        for linha in f:
            if not linha.strip():
                continue
            sep = ";" if ";" in linha else "\t" if "\t" in linha else ","
            c = [x.strip() for x in linha.rstrip("\n").split(sep)]
            try:
                n = int(c[0])
            except ValueError:
                continue
            c += [""] * 8
            lotes[n] = dict(raca=c[1], idade=c[2], sexo=c[3], qtde=c[4], peso=c[5])
    return lotes


def ler_ordem(lotes):
    ordem = []
    p = os.path.join(RAIZ, "ordem.txt")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            for t in re.findall(r"\d+", f.read()):
                n = int(t)
                if n in lotes and n not in ordem:
                    ordem.append(n)
    ordem += [n for n in sorted(lotes) if n not in ordem]
    return ordem


def cabecalho(c, W, H, pagina, total_pag):
    alt = 150 if pagina == 1 else 70
    c.setFillColor(VERDE)
    c.rect(0, H - alt, W, alt, stroke=0, fill=1)
    c.setFillColor(VERDE_VIVO)
    c.rect(0, H - alt - 6, W, 6, stroke=0, fill=1)
    logo = ImageReader(os.path.join(RAIZ, "logo-leiloinga.png"))
    if pagina == 1:
        lw = 190
        c.drawImage(logo, 36, H - 30 - lw * 136 / 510, lw, lw * 136 / 510)
        c.setFillColor(white)
        c.setFont("Titulo", 23)
        c.drawRightString(W - 36, H - 62, "ORDEM DE ENTRADA")
        c.setFont("Titulo", 15)
        c.drawString(36, H - 106, EVENTO.upper())
        # etiquetas com local e horário
        x, y = 36, H - 136
        c.setFont("Corpo", 10.5)
        for i, t in enumerate(INFO):
            w = pdfmetrics.stringWidth(t, "Corpo", 10.5) + 20
            c.setFillColor(VERMELHO if i == len(INFO) - 1 else VERDE_ESC)
            c.roundRect(x, y, w, 19, 9.5, stroke=0, fill=1)
            c.setFillColor(white)
            if i == len(INFO) - 1:
                c.setFont("Negrito", 10.5)
            c.drawString(x + 10, y + 6, t)
            x += w + 8
    else:
        lw = 120
        c.drawImage(logo, 36, H - 18 - lw * 136 / 510, lw, lw * 136 / 510)
        c.setFillColor(white)
        c.setFont("Titulo", 16)
        c.drawRightString(W - 36, H - 42, "ORDEM DE ENTRADA")
    c.setFillColor(CINZA)
    c.setFont("Corpo", 9)
    c.drawCentredString(W / 2, 22, "Leiloingá Leilões  ·  página %d de %d" % (pagina, total_pag))
    return H - alt - 6


COLS = [("ORDEM", 52, "c"), ("LOTE", 52, "c"), ("RAÇA", 150, "l"), ("IDADE", 70, "c"),
        ("SEXO", 64, "c"), ("QTDE", 50, "c"), ("PESO MÉDIO", 85, "c")]


def gerar():
    fontes()
    lotes = ler_lotes()
    ordem = ler_ordem(lotes)
    W, H = A4
    lin_h, cab_h = 26, 26
    largura = sum(w for _, w, _ in COLS)
    x0 = (W - largura) / 2

    # quantas linhas cabem em cada página
    def cabe(pag):
        topo = H - (156 if pag == 1 else 76) - 22 - cab_h
        return int((topo - 70) // lin_h)

    paginas, resto, p = [], list(ordem), 1
    while resto or not paginas:
        k = cabe(p)
        paginas.append(resto[:k])
        resto = resto[k:]
        p += 1
    # rodapé com totais precisa de espaço na última página
    if len(paginas[-1]) > cabe(len(paginas)) - 3:
        paginas.append([])

    saida = os.path.join(RAIZ, "ordem-de-entrada.pdf")
    c = canvas.Canvas(saida, pagesize=A4)
    c.setTitle("Ordem de entrada · Leiloingá Leilões")
    c.setAuthor("Leiloingá Leilões")
    pos = 0
    for i, grupo in enumerate(paginas, 1):
        y = cabecalho(c, W, H, i, len(paginas)) - 22
        if grupo:
            c.setFillColor(VERDE)
            c.roundRect(x0, y - cab_h, largura, cab_h, 4, stroke=0, fill=1)
            c.setFillColor(white)
            c.setFont("Titulo", 10.5)
            x = x0
            for nome, w, al in COLS:
                if al == "c":
                    c.drawCentredString(x + w / 2, y - 17, nome)
                else:
                    c.drawString(x + 10, y - 17, nome)
                x += w
            y -= cab_h
            for n in grupo:
                pos += 1
                d = lotes[n]
                if pos % 2 == 0:
                    c.setFillColor(LISTRA)
                    c.rect(x0, y - lin_h, largura, lin_h, stroke=0, fill=1)
                c.setStrokeColor(LINHA)
                c.setLineWidth(0.6)
                c.line(x0, y - lin_h, x0 + largura, y - lin_h)
                qt = d["qtde"].zfill(2) if d["qtde"].isdigit() else d["qtde"]
                pe = d["peso"] + " kg" if re.fullmatch(r"\d+([.,]\d+)?", d["peso"]) else d["peso"]
                vals = [str(pos) + "º", "%02d" % n, d["raca"], d["idade"], d["sexo"], qt, pe]
                x = x0
                for j, ((_, w, al), v) in enumerate(zip(COLS, vals)):
                    if j == 1:
                        c.setFillColor(VERDE)
                        c.setFont("Titulo", 13)
                    elif j == 0:
                        c.setFillColor(CINZA)
                        c.setFont("Negrito", 10.5)
                    else:
                        c.setFillColor(TEXTO)
                        c.setFont("Corpo", 11)
                    if al == "c":
                        c.drawCentredString(x + w / 2, y - 17.5, v)
                    else:
                        c.drawString(x + 10, y - 17.5, v)
                    x += w
                y -= lin_h
        if i == len(paginas):
            def soma(f):
                return sum(int(lotes[n]["qtde"]) for n in ordem if lotes[n]["qtde"].isdigit() and f(lotes[n]))
            cab = soma(lambda d: True)
            mac = soma(lambda d: d["sexo"].lower().startswith("m"))
            fem = soma(lambda d: d["sexo"].lower().startswith("f"))
            c.setStrokeColor(VERDE)
            c.setLineWidth(1.2)
            c.line(x0, y - 8, x0 + largura, y - 8)
            c.setFillColor(VERDE)
            c.setFont("Titulo", 12)
            c.drawString(x0, y - 28, "TOTAL: %d LOTES  ·  %d CABEÇAS" % (len(ordem), cab))
            c.setFillColor(TEXTO)
            c.setFont("Titulo", 12)
            c.drawString(x0, y - 48, "MACHOS: %d" % mac)
            c.drawString(x0 + 150, y - 48, "FÊMEAS: %d" % fem)
        c.showPage()
    c.save()
    print("ok:", saida, "ordem:", ordem)


if __name__ == "__main__":
    gerar()

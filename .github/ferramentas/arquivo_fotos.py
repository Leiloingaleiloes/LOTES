#!/usr/bin/env python3
"""Guarda as fotos de cada leilão por 30 dias (para o relatório interno).

O site dos produtores só tem as fotos do leilão atual: quando o Lotes ADM começa um
leilão novo, as fotos antigas saem. Este script copia as FOTOS (não os vídeos, que
pesam demais) do leilão atual para arquivo/<AAAA-MM-DD>/ e mantém arquivo/index.json.
Pastas de leilões com mais de 30 dias são apagadas.
Uso: python3 .github/ferramentas/arquivo_fotos.py   (na raiz do repositório)
"""
import json, os, re, shutil, datetime

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ARQ = os.path.join(RAIZ, "arquivo")
DIAS = 30

def ler(p, padrao):
    try:
        with open(os.path.join(RAIZ, p), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return padrao

def grava(caminho, dados):
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=1)
        f.write("\n")

def main():
    os.makedirs(ARQ, exist_ok=True)
    idx = ler("arquivo/index.json", {"leiloes": []})
    leilao, midia = ler("leilao.json", {}), ler("midia.json", {})
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})$", str(leilao.get("data", "")).strip())
    if m:
        iso = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
        pasta = os.path.join(ARQ, iso)
        novo = {}
        for lote, it in midia.items():
            fotos = []
            for f in (it or {}).get("fotos", []):
                item = {}
                for chave in ("src", "mini"):
                    src = f.get(chave)
                    if not src or not os.path.exists(os.path.join(RAIZ, src)):
                        continue
                    destino = f"arquivo/{iso}/" + src.split("midia/", 1)[-1]
                    alvo = os.path.join(RAIZ, destino)
                    if not os.path.exists(alvo):
                        os.makedirs(os.path.dirname(alvo), exist_ok=True)
                        shutil.copy2(os.path.join(RAIZ, src), alvo)
                    item[chave] = destino
                if item.get("src"):
                    if f.get("oculta"):
                        item["oculta"] = True
                    fotos.append(item)
            if fotos:
                novo[str(lote)] = {"fotos": fotos}
        if novo:
            # junta com o que já estava guardado (uma foto apagada do site continua no arquivo)
            antigo = ler(f"arquivo/{iso}/midia.json", {})
            for lote, it in antigo.items():
                ja = {f["src"] for f in novo.get(lote, {}).get("fotos", [])}
                resto = [f for f in it.get("fotos", []) if f["src"] not in ja and os.path.exists(os.path.join(RAIZ, f["src"]))]
                if resto:
                    novo.setdefault(lote, {"fotos": []})["fotos"].extend(resto)
            os.makedirs(pasta, exist_ok=True)
            grava(os.path.join(pasta, "midia.json"), novo)
            idx["leiloes"] = [x for x in idx["leiloes"] if x.get("pasta") != iso]
            idx["leiloes"].append({"data": leilao["data"], "nome": leilao.get("nome", ""), "pasta": iso,
                                   "fotos": sum(len(v["fotos"]) for v in novo.values())})
    # apaga leilões com mais de 30 dias
    limite = (datetime.date.today() - datetime.timedelta(days=DIAS)).isoformat()
    for nome in os.listdir(ARQ):
        if re.match(r"\d{4}-\d{2}-\d{2}$", nome) and nome < limite:
            shutil.rmtree(os.path.join(ARQ, nome))
            print("apagado (mais de 30 dias):", nome)
    idx["leiloes"] = sorted([x for x in idx["leiloes"] if os.path.isdir(os.path.join(ARQ, x["pasta"]))], key=lambda x: x["pasta"], reverse=True)
    grava(os.path.join(ARQ, "index.json"), idx)
    print("arquivo:", [x["pasta"] for x in idx["leiloes"]])

if __name__ == "__main__":
    main()

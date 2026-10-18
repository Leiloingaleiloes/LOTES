/* Carrega os lotes (lotes.csv) e as fotos/vídeos (midia.json) e monta as páginas. */
(function () {
  var RAW = "https://raw.githubusercontent.com/Leiloingaleiloes/LOTES/main/";
  var ZAP = "5542998737705";

  function buscar(arquivo) {
    var t = "?t=" + Date.now();
    return fetch(RAW + arquivo + t, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw r; return r.text(); })
      .catch(function () {
        return fetch(arquivo + t, { cache: "no-store" }).then(function (r) {
          if (!r.ok) throw r; return r.text();
        });
      })
      .catch(function () { return ""; });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function lerCsv(txt) {
    var lotes = {};
    txt.split(/\r?\n/).forEach(function (linha) {
      if (!linha.trim()) return;
      var sep = linha.indexOf(";") >= 0 ? ";" : linha.indexOf("\t") >= 0 ? "\t" : ",";
      var c = linha.split(sep).map(function (x) { return x.trim(); });
      var n = parseInt(c[0], 10);
      if (!(n > 0)) return; // cabeçalho ou linha inválida
      lotes[n] = {
        raca: c[1] || "", idade: c[2] || "", sexo: c[3] || "",
        qtde: c[4] || "", peso: c[5] || "", mang: c[6] || "",
        obs: c.slice(7).join(sep === "," ? ", " : " ").trim()
      };
    });
    return lotes;
  }

  function peso(p) { return /^\d+([.,]\d+)?$/.test(p) ? p + " kg" : p; }
  function qtde(q) { return /^\d$/.test(q) ? "0" + q : q; }

  /* Arquivo do site; se ainda não chegou ao site, tenta direto do GitHub. */
  function url(caminho) { return caminho; }
  function reserva(caminho) { return RAW + caminho; }
  window.__trocaRaw = function (el) {
    var c = el.getAttribute("data-raw");
    if (c && el.src.indexOf(RAW) !== 0) el.src = reserva(c);
  };
  function img(caminho, alt, extra) {
    return '<img src="' + esc(url(caminho)) + '" data-raw="' + esc(caminho) +
      '" onerror="__trocaRaw(this)" alt="' + esc(alt) + '"' + (extra || "") + ">";
  }

  function carregar() {
    return Promise.all([buscar("lotes.csv"), buscar("midia.json")]).then(function (r) {
      var dados = lerCsv(r[0]);
      var midia = {};
      try { midia = JSON.parse(r[1] || "{}"); } catch (e) { midia = {}; }
      var nums = {};
      Object.keys(dados).forEach(function (n) { nums[n] = 1; });
      Object.keys(midia).forEach(function (n) { nums[n] = 1; });
      /* só aparecem no site os lotes que já têm vídeo ou foto */
      var lista = Object.keys(midia).filter(function (n) {
        var m = midia[n] || {};
        return (m.videos && m.videos.length) || (m.fotos && m.fotos.length);
      }).map(Number).sort(function (a, b) { return a - b; });
      return { lista: lista, dados: dados, midia: midia };
    });
  }

  function zap(n) {
    var t = "Olá, vim até aqui pelo catálogo do leilão de hoje" + (n ? " (lote " + n + ")" : "");
    return "https://wa.me/" + ZAP + "?text=" + encodeURIComponent(t);
  }

  window.montarIndice = function (alvo) {
    carregar().then(function (b) {
      if (!b.lista.length) {
        alvo.innerHTML = '<div class="vazio">Os lotes aparecem aqui em breve.</div>';
        return;
      }
      alvo.innerHTML = b.lista.map(function (n) {
        var d = b.dados[n] || {}, m = b.midia[n] || { fotos: [], videos: [] };
        var capa = m.fotos.length ? m.fotos[0].mini : (m.videos.length && m.videos[0].capa) || "";
        var l1 = [d.raca, d.idade].filter(Boolean).join(" · ");
        var l2 = [d.qtde && qtde(d.qtde) + " cab.", d.peso && peso(d.peso), d.sexo].filter(Boolean).join(" · ");
        return '<a class="card" href="lote.html?n=' + n + '">' +
          (capa ? img(capa, "Lote " + n, ' loading="lazy"') : '<div class="sem">fotos em breve</div>') +
          "<div><b>Lote " + n + "</b>" +
          (l1 ? "<span>" + esc(l1) + "</span>" : "") +
          (l2 ? "<span>" + esc(l2) + "</span>" : "") +
          (m.videos.length ? '<span class="tag">▶ vídeo</span>' : "") +
          "</div></a>";
      }).join("");
    });
  };

  window.montarLote = function (alvo, titulo) {
    var n = parseInt(new URLSearchParams(location.search).get("n"), 10);
    if (!(n > 0)) { location.replace("./"); return; }
    document.title = "Lote " + n;
    titulo.textContent = "Lote " + n;
    carregar().then(function (b) {
      var d = b.dados[n] || {}, m = b.midia[n] || { fotos: [], videos: [] };
      var h = '<a class="back" href="./">← Todos os lotes</a>';
      if (m.fotos.length) {
        h += '<div class="gal" id="gal">' + m.fotos.map(function (f, i) {
          return img(f.src, "Lote " + n + " foto " + (i + 1), i ? ' loading="lazy"' : "");
        }).join("") + "</div>";
        h += m.fotos.length > 1
          ? '<div class="dots" id="dots">foto 1 de ' + m.fotos.length + " · deslize para o lado</div>"
          : '<div style="height:4px"></div>';
      }
      m.videos.forEach(function (v) {
        h += '<video class="vid" controls playsinline preload="metadata"' +
          (v.capa ? ' poster="' + esc(v.capa) + '"' : "") + ">" +
          '<source src="' + esc(v.src) + '" type="video/mp4">' +
          '<source src="' + esc(RAW + v.src) + '" type="video/mp4">' +
          "Seu navegador não toca este vídeo.</video>";
      });
      if (!m.fotos.length && !m.videos.length) h += '<div class="vazio">Fotos em breve.</div>';
      var campos = [["Raça", d.raca], ["Idade", d.idade], ["Sexo", d.sexo],
        ["Quantidade", d.qtde && qtde(d.qtde)], ["Peso médio", d.peso && peso(d.peso)], ["Mangueira", d.mang]]
        .filter(function (c) { return c[1]; });
      if (campos.length) {
        h += '<dl style="margin-top:14px">' + campos.map(function (c) {
          return "<div><dt>" + c[0] + "</dt><dd>" + esc(c[1]) + "</dd></div>";
        }).join("") + "</dl>";
      }
      if (d.obs) h += '<div class="obs">' + esc(d.obs) + "</div>";
      var i = b.lista.indexOf(n), ant = b.lista[i - 1], prox = b.lista[i + 1];
      h += '<div class="nav"><a class="' + (ant ? "" : "off") + '" href="lote.html?n=' + ant + '">← Lote ' + ant + "</a>" +
        '<a class="' + (prox ? "" : "off") + '" href="lote.html?n=' + prox + '">Lote ' + prox + " →</a></div>";
      h += '<a class="zap" href="' + zap(n) + '" target="_blank" rel="noopener">' + ICONE + "Dúvidas? Fale conosco!</a>";
      alvo.innerHTML = h;
      var gal = document.getElementById("gal"), dots = document.getElementById("dots");
      if (gal && dots) gal.addEventListener("scroll", function () {
        var k = Math.round(gal.scrollLeft / gal.clientWidth) + 1;
        dots.textContent = "foto " + k + " de " + m.fotos.length + " · deslize para o lado";
      }, { passive: true });
    });
  };

  var ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/><path d="M9 9.2c.3 2.3 2.5 4.5 4.8 4.8l1.2-1.3-1.9-1-0.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-1.9z" fill="#fff" stroke="none"/></svg>';
})();

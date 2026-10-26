/* Catálogo de lotes – versão "app".
   Lê lotes.csv (dados) e midia.json (fotos/vídeos) e monta as telas. */
(function () {
  var RAW = "https://raw.githubusercontent.com/Leiloingaleiloes/LOTES/main/";
  var ZAP = "5542998737705";
  var SITE = "https://leiloingaleiloes.github.io/LOTES/";
  var EVENTO = "7º Leilão das Águas – Gado de Corte";
  var PG_LOTE = document.body.getAttribute("data-lote") || "lote.html";
  var PG_INICIO = document.body.getAttribute("data-inicio") || "./";

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
      if (!(n > 0)) return;
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
  function norm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function unicos(arr) { return arr.filter(function (v, i) { return v && arr.indexOf(v) === i; }); }
  function linkLote(n) { return PG_LOTE + "?n=" + n; }

  window.__trocaRaw = function (el) {
    var c = el.getAttribute("data-raw");
    if (c && el.src.indexOf(RAW) !== 0) el.src = RAW + c;
  };
  function img(caminho, alt, extra) {
    return '<img src="' + esc(caminho) + '" data-raw="' + esc(caminho) +
      '" onerror="__trocaRaw(this)" alt="' + esc(alt) + '"' + (extra || "") + ">";
  }

  function carregar() {
    return Promise.all([buscar("lotes.csv"), buscar("midia.json")]).then(function (r) {
      var dados = lerCsv(r[0]), midia = {};
      try { midia = JSON.parse(r[1] || "{}"); } catch (e) { midia = {}; }
      /* só aparecem os lotes que já têm vídeo ou foto */
      var lista = Object.keys(midia).filter(function (n) {
        var m = midia[n] || {};
        return (m.videos && m.videos.length) || (m.fotos && m.fotos.length);
      }).map(Number).sort(function (a, b) { return a - b; });
      lista.forEach(function (n) {
        var m = midia[n]; m.fotos = m.fotos || []; m.videos = m.videos || [];
      });
      return { lista: lista, dados: dados, midia: midia };
    });
  }

  function zapContato(n) {
    var t = "Olá, vim pelo catálogo do leilão" + (n ? " (lote " + n + ")" : "");
    return "https://wa.me/" + ZAP + "?text=" + encodeURIComponent(t);
  }
  function zapEnviar(texto) { return "https://wa.me/?text=" + encodeURIComponent(texto); }
  function resumo(d) {
    return [d.raca, d.idade, d.qtde && qtde(d.qtde) + " cab.", d.peso && peso(d.peso), d.sexo].filter(Boolean).join(" · ");
  }

  /* Baixar arquivo direto, sem abrir outra página. */
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("[data-dl]");
    if (!a) return;
    ev.preventDefault();
    var href = a.getAttribute("href");
    fetch(href).then(function (r) { if (!r.ok) throw r; return r.blob(); }).then(function (bl) {
      var u = URL.createObjectURL(bl), t = document.createElement("a");
      t.href = u; t.download = a.getAttribute("data-dl");
      document.body.appendChild(t); t.click(); t.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
    }).catch(function () { location.href = href; });
  });

  /* ---------- ícones ---------- */
  var I = {
    zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/><path d="M9 9.2c.3 2.3 2.5 4.5 4.8 4.8l1.2-1.3-1.9-1-0.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-1.9z" fill="currentColor" stroke="none"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    busca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>'
  };

  /* ---------- página inicial ---------- */
  window.montarInicio = function () {
    var pLotes = document.getElementById("p-lotes"), pOrdem = document.getElementById("p-ordem");
    ligarAbas();
    Promise.all([carregar(), buscar("ordem.txt")]).then(function (res) {
      var b = res[0];
      var cont = document.getElementById("n-lotes");
      if (cont) cont.textContent = b.lista.length ? b.lista.length : "";
      pOrdem.innerHTML = montarOrdem(b, res[1]);
      if (!b.lista.length) {
        pLotes.innerHTML = '<div class="vazio"><b>Os lotes aparecem aqui em breve.</b><span>As fotos e os vídeos são publicados nos dias antes do leilão.</span></div>';
        return;
      }
      var cards = b.lista.map(function (n) { return card(n, b.dados[n] || {}, b.midia[n]); }).join("");
      pLotes.innerHTML = filtros(b) + '<div class="grade" id="grade">' + cards + "</div>" +
        '<div class="vazio" id="vazio" hidden><b>Nenhum lote com esses filtros.</b></div>';
      ligarFiltros(pLotes);
    });
  };

  function card(n, d, m) {
    var capa = (m.videos[0] && m.videos[0].capa) || (m.fotos[0] && m.fotos[0].mini) || "";
    var l1 = [d.idade, d.sexo].filter(Boolean).join(" · ");
    var l2 = [d.qtde && qtde(d.qtde) + " cab.", d.peso && peso(d.peso)].filter(Boolean).join(" · ");
    var busca = ["lote " + n, n, d.raca, d.idade, d.sexo, d.qtde, d.peso, d.obs].join(" ");
    return '<a class="card" href="' + linkLote(n) + '" data-busca="' + esc(busca) + '" data-sexo="' + esc(d.sexo) +
      '" data-raca="' + esc(d.raca) + '" data-idade="' + esc(d.idade) + '" data-video="' + (m.videos.length ? 1 : 0) + '">' +
      '<div class="thumb">' + (capa ? img(capa, "Lote " + n, ' loading="lazy"') : '<i class="sem">sem foto</i>') +
      '<span class="num">Lote ' + n + "</span>" +
      (m.videos.length ? '<span class="play" title="Tem vídeo">' + I.play + "</span>" : "") + "</div>" +
      '<div class="info"><b>' + esc(d.raca || "Lote " + n) + "</b>" +
      (l1 ? "<span>" + esc(l1) + "</span>" : "") +
      (l2 ? '<span class="forte">' + esc(l2) + "</span>" : "") + "</div></a>";
  }

  function filtros(b) {
    var ds = b.lista.map(function (n) { return b.dados[n] || {}; });
    var sexos = unicos(ds.map(function (d) { return d.sexo; }));
    var racas = unicos(ds.map(function (d) { return d.raca; })).sort();
    var idades = unicos(ds.map(function (d) { return d.idade; })).sort();
    var temVideo = b.lista.some(function (n) { return b.midia[n].videos.length; });
    var semVideo = b.lista.some(function (n) { return !b.midia[n].videos.length; });
    function sel(id, arr, t) {
      if (arr.length < 2) return "";
      return '<label class="chip sel"><select id="' + id + '" aria-label="' + t + '"><option value="">' + t + "</option>" +
        arr.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("") + "</select></label>";
    }
    return '<div class="filtros">' +
      '<label class="busca">' + I.busca + '<input id="q" type="search" placeholder="Buscar lote, raça, peso…" aria-label="Buscar lotes"></label>' +
      '<div class="chips"><button class="chip" data-sexo="" aria-pressed="true">Todos</button>' +
      sexos.map(function (s) { return '<button class="chip" data-sexo="' + esc(s) + '" aria-pressed="false">' + esc(s) + "</button>"; }).join("") +
      (temVideo && semVideo ? '<button class="chip" id="f-video" aria-pressed="false">Com vídeo</button>' : "") +
      sel("f-raca", racas, "Raça") + sel("f-idade", idades, "Idade") + "</div>" +
      '<div class="contagem"><span id="cont"></span><button type="button" id="limpar" hidden>Limpar filtros</button></div></div>';
  }

  function ligarFiltros(raiz) {
    var cards = [].slice.call(raiz.querySelectorAll(".card"));
    var q = raiz.querySelector("#q"), fr = raiz.querySelector("#f-raca"), fi = raiz.querySelector("#f-idade");
    var fv = raiz.querySelector("#f-video"), limpar = raiz.querySelector("#limpar");
    var chipsSexo = [].slice.call(raiz.querySelectorAll(".chip[data-sexo]"));
    var sexo = "", vid = false;
    function val(s) { return s ? s.value : ""; }
    function aplicar() {
      var t = norm(q.value).trim(), n = 0;
      cards.forEach(function (c) {
        var hb = norm(c.dataset.busca);
        var ok = t.split(/\s+/).every(function (w) { return !w || hb.indexOf(w) > -1; }) &&
          (!sexo || c.dataset.sexo === sexo) && (!val(fr) || c.dataset.raca === val(fr)) &&
          (!val(fi) || c.dataset.idade === val(fi)) && (!vid || c.dataset.video === "1");
        c.hidden = !ok; if (ok) n++;
      });
      [fr, fi].forEach(function (s) { if (s) s.parentNode.classList.toggle("on", !!s.value); });
      raiz.querySelector("#cont").textContent = n === cards.length ? cards.length + " lotes" : n + " de " + cards.length + " lotes";
      raiz.querySelector("#vazio").hidden = n > 0;
      limpar.hidden = !(t || sexo || val(fr) || val(fi) || vid);
    }
    chipsSexo.forEach(function (bt) {
      bt.addEventListener("click", function () {
        sexo = bt.dataset.sexo;
        chipsSexo.forEach(function (x) { x.setAttribute("aria-pressed", x === bt ? "true" : "false"); });
        aplicar();
      });
    });
    if (fv) fv.addEventListener("click", function () { vid = !vid; fv.setAttribute("aria-pressed", vid ? "true" : "false"); aplicar(); });
    [q, fr, fi].forEach(function (x) { if (x) x.addEventListener("input", aplicar); });
    limpar.addEventListener("click", function () {
      q.value = ""; if (fr) fr.value = ""; if (fi) fi.value = ""; sexo = ""; vid = false;
      chipsSexo.forEach(function (x) { x.setAttribute("aria-pressed", x.dataset.sexo === "" ? "true" : "false"); });
      if (fv) fv.setAttribute("aria-pressed", "false");
      aplicar();
    });
    aplicar();
  }

  function montarOrdem(b, txt) {
    var ordem = (txt || "").split(/[\s,;]+/).map(function (x) { return parseInt(x, 10); }).filter(function (n) { return n > 0; });
    if (!ordem.length) {
      return '<div class="vazio"><b>A ordem de entrada sai perto do dia do leilão.</b><span>Volte aqui mais tarde.</span></div>';
    }
    var itens = ordem.map(function (n, k) {
      var d = b.dados[n] || {}, tem = b.lista.indexOf(n) > -1;
      var corpo = '<i>' + (k + 1) + "º</i><div><b>Lote " + n + "</b><span>" + esc(resumo(d)) + "</span></div>" +
        (tem ? '<em aria-hidden="true">›</em>' : "");
      return "<li>" + (tem ? '<a href="' + linkLote(n) + '">' + corpo + "</a>" : '<div class="sl">' + corpo + "</div>") + "</li>";
    }).join("");
    return '<div class="ordem-topo"><p>Ordem em que os lotes entram na pista. Toque para ver fotos e vídeo.</p>' +
      '<div class="acoes"><a class="bt" href="ordem-de-entrada.pdf" data-dl="ordem-de-entrada.pdf" download>' + I.pdf + "Baixar PDF</a>" +
      '<a class="bt sec" href="' + zapEnviar("Ordem de entrada na pista – " + EVENTO + "\n" + SITE + "ordem-de-entrada.pdf") +
      '" target="_blank" rel="noopener">' + I.zap + "Enviar</a></div></div>" +
      '<ol class="ordem">' + itens + "</ol>";
  }

  function ligarAbas() {
    var abas = [].slice.call(document.querySelectorAll("[data-aba]"));
    function mostrar(nome, rolar) {
      abas.forEach(function (a) { a.setAttribute("aria-current", a.dataset.aba === nome ? "page" : "false"); });
      ["lotes", "ordem"].forEach(function (p) { document.getElementById("p-" + p).hidden = p !== nome; });
      if (rolar) {
        var alvo = document.getElementById("conteudo");
        if (alvo.getBoundingClientRect().top < 0) alvo.scrollIntoView();
      }
    }
    abas.forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        history.replaceState(null, "", a.dataset.aba === "ordem" ? "#ordem" : location.pathname + location.search);
        mostrar(a.dataset.aba, true);
      });
    });
    mostrar(location.hash === "#ordem" ? "ordem" : "lotes", false);
  }

  /* ---------- página do lote ---------- */
  window.montarLote = function () {
    var alvo = document.getElementById("lote");
    var n = parseInt(new URLSearchParams(location.search).get("n"), 10);
    if (!(n > 0)) { location.replace(PG_INICIO); return; }
    document.title = "Lote " + n + " · Leiloingá Leilões";
    document.getElementById("tit").textContent = "Lote " + n;
    carregar().then(function (b) {
      var d = b.dados[n] || {}, m = b.midia[n] || { fotos: [], videos: [] };
      var sub = document.getElementById("sub");
      if (sub) sub.textContent = [d.raca, d.idade].filter(Boolean).join(" · ") || EVENTO;
      var itens = m.videos.map(function (v) {
        return '<div class="slide"><video controls playsinline preload="metadata"' + (v.capa ? ' poster="' + esc(v.capa) + '"' : "") + ">" +
          '<source src="' + esc(v.src) + '" type="video/mp4"><source src="' + esc(RAW + v.src) + '" type="video/mp4">' +
          "Seu navegador não toca este vídeo.</video></div>";
      }).concat(m.fotos.map(function (f, i) {
        return '<div class="slide">' + img(f.src, "Lote " + n + " foto " + (i + 1), ' class="foto"' + (i ? ' loading="lazy"' : "")) + "</div>";
      }));
      var h = "";
      if (itens.length) {
        h += '<div class="midia"><div class="trilho" id="trilho">' + itens.join("") + "</div>" +
          (itens.length > 1 ? '<span class="contador" id="contador">1 / ' + itens.length + "</span>" +
            '<div class="pontos" id="pontos">' + itens.map(function (_, k) { return "<i" + (k ? "" : ' class="on"') + "></i>"; }).join("") + "</div>" : "") +
          "</div>";
      } else {
        h += '<div class="vazio"><b>Fotos em breve.</b></div>';
      }
      var campos = [["Raça", d.raca], ["Idade", d.idade], ["Sexo", d.sexo],
        ["Cabeças", d.qtde && qtde(d.qtde)], ["Peso médio", d.peso && peso(d.peso)], ["Mangueira", d.mang]]
        .filter(function (c) { return c[1]; });
      if (campos.length) {
        h += '<dl class="ficha">' + campos.map(function (c) { return "<div><dt>" + c[0] + "</dt><dd>" + esc(c[1]) + "</dd></div>"; }).join("") + "</dl>";
      }
      if (d.obs) h += '<p class="obs">' + esc(d.obs) + "</p>";
      alvo.innerHTML = h;

      var i = b.lista.indexOf(n), ant = b.lista[i - 1], prox = b.lista[i + 1];
      var bAnt = document.getElementById("ant"), bProx = document.getElementById("prox");
      if (ant) { bAnt.href = linkLote(ant); bAnt.setAttribute("aria-label", "Lote " + ant); } else bAnt.classList.add("off");
      if (prox) { bProx.href = linkLote(prox); bProx.setAttribute("aria-label", "Lote " + prox); } else bProx.classList.add("off");
      document.getElementById("contato").href = zapContato(n);
      document.getElementById("enviar").href = zapEnviar("Lote " + n + (resumo(d) ? " – " + resumo(d) : "") + "\n" + EVENTO + "\n" + SITE + "lote.html?n=" + n);

      ligarTrilho(itens.length);
      ligarZoom();
    });
  };

  function ligarTrilho(total) {
    var tr = document.getElementById("trilho"), ct = document.getElementById("contador"), pt = document.getElementById("pontos");
    if (!tr || total < 2) return;
    var atual = 0;
    tr.addEventListener("scroll", function () {
      var k = Math.round(tr.scrollLeft / tr.clientWidth);
      if (k === atual) return;
      var v = tr.children[atual] && tr.children[atual].querySelector("video");
      if (v && !v.paused) v.pause();
      atual = k;
      ct.textContent = (k + 1) + " / " + total;
      [].forEach.call(pt.children, function (p, j) { p.className = j === k ? "on" : ""; });
    }, { passive: true });
  }

  function ligarZoom() {
    var imgs = [].slice.call(document.querySelectorAll("img.foto"));
    if (!imgs.length) return;
    var lb = document.createElement("div");
    lb.className = "lb";
    lb.innerHTML = '<img alt=""><button class="x" aria-label="Fechar">×</button><button class="pv" aria-label="Anterior">‹</button><button class="nx" aria-label="Próxima">›</button><div class="ct"></div>';
    document.body.appendChild(lb);
    var im = lb.querySelector("img"), ct = lb.querySelector(".ct"), i = 0;
    function show(k) {
      i = (k + imgs.length) % imgs.length;
      im.src = imgs[i].currentSrc || imgs[i].src;
      lb.classList.remove("z"); lb.scrollTo(0, 0);
      ct.textContent = (i + 1) + " / " + imgs.length;
      var v = imgs.length > 1 ? "" : "none";
      lb.querySelector(".pv").style.display = v; lb.querySelector(".nx").style.display = v; ct.style.display = v;
    }
    function abrir(k) { show(k); lb.classList.add("on"); document.body.style.overflow = "hidden"; }
    function fechar() { lb.classList.remove("on", "z"); document.body.style.overflow = ""; }
    imgs.forEach(function (x, k) { x.addEventListener("click", function () { abrir(k); }); });
    im.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (lb.classList.toggle("z")) { lb.scrollLeft = (im.offsetWidth - lb.clientWidth) / 2; lb.scrollTop = (im.offsetHeight - lb.clientHeight) / 2; }
    });
    lb.querySelector(".x").addEventListener("click", fechar);
    lb.querySelector(".pv").addEventListener("click", function (ev) { ev.stopPropagation(); show(i - 1); });
    lb.querySelector(".nx").addEventListener("click", function (ev) { ev.stopPropagation(); show(i + 1); });
    lb.addEventListener("click", function (ev) { if (ev.target === lb) fechar(); });
    document.addEventListener("keydown", function (ev) {
      if (!lb.classList.contains("on")) return;
      if (ev.key === "Escape") fechar();
      if (ev.key === "ArrowLeft") show(i - 1);
      if (ev.key === "ArrowRight") show(i + 1);
    });
  }
})();

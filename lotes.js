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

  var SITE = "https://leiloingaleiloes.github.io/LOTES/";
  var EVENTO = "Feira Especial de Gado de Corte";

  function compartilhar(texto, rotulo) {
    return '<a class="zapsec" href="https://wa.me/?text=' + encodeURIComponent(texto) +
      '" target="_blank" rel="noopener">' + ICONE_V + esc(rotulo) + "</a>";
  }
  function resumoLote(d) {
    return [d.raca, d.idade, d.qtde && qtde(d.qtde) + " cab.", d.peso && peso(d.peso), d.sexo].filter(Boolean).join(" · ");
  }
  function norm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function unicos(arr) { return arr.filter(function (v, i) { return v && arr.indexOf(v) === i; }); }

  /* Baixar arquivo direto, sem abrir outra página. */
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("[data-dl]");
    if (!a) return;
    ev.preventDefault();
    var href = a.getAttribute("href");
    fetch(href).then(function (r) { return r.blob(); }).then(function (bl) {
      var u = URL.createObjectURL(bl), t = document.createElement("a");
      t.href = u; t.download = a.getAttribute("data-dl");
      document.body.appendChild(t); t.click(); t.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
    }).catch(function () { location.href = href; });
  });

  function montarOrdem(b, txt) {
    var ordem = (txt || "").split(/[\s,;]+/).map(function (x) { return parseInt(x, 10); }).filter(function (n) { return n > 0; });
    if (!ordem.length) return "";
    var itens = ordem.map(function (n, k) {
      var d = b.dados[n] || {}, tem = b.lista.indexOf(n) > -1;
      var corpo = '<i>' + (k + 1) + '</i><b>Lote ' + n + '</b><span>' + esc(resumoLote(d)) + '</span>';
      return "<li>" + (tem ? '<a href="lote.html?n=' + n + '">' + corpo + "</a>" : '<div class="semlink">' + corpo + "</div>") + "</li>";
    }).join("");
    return '<section class="ordem" id="ordem"><h2>Ordem de entrada na pista</h2>' +
      '<p>Lotes com fotos ou vídeo podem ser tocados para abrir.</p><ol>' + itens + "</ol>" +
      '<div class="acoes"><a class="bt" href="ordem-de-entrada.pdf" data-dl="ordem-de-entrada.pdf" download>Baixar PDF</a>' +
      '<a class="bt sec" href="ordem-de-entrada.pdf" target="_blank" rel="noopener">Abrir PDF</a></div></section>' +
      compartilhar("Ordem de entrada na pista – " + EVENTO + "\n" + SITE + "ordem-de-entrada.pdf", "Enviar a ordem de entrada no WhatsApp");
  }

  window.montarIndice = function (alvo) {
    Promise.all([carregar(), buscar("ordem.txt").catch(function () { return ""; })]).then(function (res) {
      var b = res[0];
      if (!b.lista.length) {
        alvo.innerHTML = '<div class="vazio">Os lotes aparecem aqui em breve.</div>';
        return;
      }
      var cards = b.lista.map(function (n) {
        var d = b.dados[n] || {}, m = b.midia[n] || { fotos: [], videos: [] };
        var capa = m.fotos.length ? m.fotos[0].mini : (m.videos.length && m.videos[0].capa) || "";
        var l1 = [d.raca, d.idade].filter(Boolean).join(" · ");
        var l2 = [d.qtde && qtde(d.qtde) + " cab.", d.peso && peso(d.peso), d.sexo].filter(Boolean).join(" · ");
        var busca = ["lote " + n, d.raca, d.idade, d.sexo, d.qtde, d.peso, "mangueira " + d.mang, d.obs].join(" ");
        return '<a class="card" href="lote.html?n=' + n + '" data-busca="' + esc(busca) + '" data-sexo="' + esc(d.sexo || "") +
          '" data-raca="' + esc(d.raca || "") + '" data-cat="' + esc(d.idade || "") + '" data-video="' + (m.videos.length ? 1 : 0) + '">' +
          (capa ? img(capa, "Lote " + n, ' loading="lazy"') : '<div class="sem">fotos em breve</div>') +
          "<div><b>Lote " + n + "</b>" +
          (l1 ? "<span>" + esc(l1) + "</span>" : "") +
          (l2 ? "<span>" + esc(l2) + "</span>" : "") +
          (m.videos.length ? '<span class="tag">▶ vídeo</span>' : "") +
          "</div></a>";
      }).join("");

      var ds = b.lista.map(function (n) { return b.dados[n] || {}; });
      var sexos = unicos(ds.map(function (d) { return d.sexo; }));
      var racas = unicos(ds.map(function (d) { return d.raca; })).sort();
      var idades = unicos(ds.map(function (d) { return d.idade; })).sort();
      var temVideo = b.lista.some(function (n) { return (b.midia[n].videos || []).length; });
      var opt = function (arr, t) { return '<option value="">' + t + "</option>" + arr.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join(""); };
      var filtros = '<div class="filtros"><input id="q" type="search" placeholder="Buscar: nº do lote, raça, peso…" aria-label="Buscar lotes">' +
        '<div class="chips"><button class="chip" data-sexo="" aria-pressed="true">Todos</button>' +
        sexos.map(function (s) { return '<button class="chip" data-sexo="' + esc(s) + '" aria-pressed="false">' + esc(s) + "</button>"; }).join("") +
        (temVideo ? '<button class="chip" id="chip-video" aria-pressed="false">▶ Com vídeo</button>' : "") + "</div>" +
        '<div class="sel"><select id="f-raca" aria-label="Raça">' + opt(racas, "Raça: todas") + '</select><select id="f-cat" aria-label="Idade">' + opt(idades, "Idade: todas") + "</select></div>" +
        '<div class="fcont" id="fcont"><span></span><button type="button">Limpar filtros</button></div></div>';

      alvo.innerHTML = filtros + '<div id="lista-cards">' + cards + '</div><div class="vazio" id="vazio" style="display:none">Nenhum lote com esses filtros.</div>' + montarOrdem(b, res[1]);
      ligarFiltros(alvo);
      if (location.hash === "#ordem") { var o = document.getElementById("ordem"); if (o) o.scrollIntoView(); }
    });
  };

  function ligarFiltros(alvo) {
    var cards = [].slice.call(alvo.querySelectorAll(".card[data-busca]"));
    var q = alvo.querySelector("#q"), rs = alvo.querySelector("#f-raca"), cs = alvo.querySelector("#f-cat");
    var cont = alvo.querySelector("#fcont"), vazio = alvo.querySelector("#vazio"), cv = alvo.querySelector("#chip-video");
    var sexo = "", vid = false;
    function ap() {
      var t = norm(q.value).trim(), n = 0;
      cards.forEach(function (c) {
        var hb = norm(c.dataset.busca);
        var ok = t.split(/\s+/).every(function (w) { return !w || hb.indexOf(w) > -1; }) &&
          (!sexo || c.dataset.sexo === sexo) && (!rs.value || c.dataset.raca === rs.value) &&
          (!cs.value || c.dataset.cat === cs.value) && (!vid || c.dataset.video === "1");
        c.hidden = !ok; if (ok) n++;
      });
      cont.querySelector("span").textContent = n === cards.length ? cards.length + " lotes" : n + " de " + cards.length + " lotes";
      vazio.style.display = n ? "none" : "block";
      cont.querySelector("button").style.display = (t || sexo || rs.value || cs.value || vid) ? "" : "none";
    }
    [].forEach.call(alvo.querySelectorAll(".chip[data-sexo]"), function (bt) {
      bt.addEventListener("click", function () {
        sexo = bt.dataset.sexo;
        [].forEach.call(alvo.querySelectorAll(".chip[data-sexo]"), function (x) { x.setAttribute("aria-pressed", x === bt ? "true" : "false"); });
        ap();
      });
    });
    if (cv) cv.addEventListener("click", function () { vid = !vid; cv.setAttribute("aria-pressed", vid ? "true" : "false"); ap(); });
    [q, rs, cs].forEach(function (x) { x.addEventListener("input", ap); });
    cont.querySelector("button").addEventListener("click", function () {
      q.value = ""; rs.value = ""; cs.value = ""; sexo = ""; vid = false;
      [].forEach.call(alvo.querySelectorAll(".chip[data-sexo]"), function (x) { x.setAttribute("aria-pressed", x.dataset.sexo === "" ? "true" : "false"); });
      if (cv) cv.setAttribute("aria-pressed", "false");
      ap();
    });
    ap();
  }

  /* Foto em tela cheia, com zoom ao tocar. */
  function ligarZoom() {
    var imgs = [].slice.call(document.querySelectorAll("#gal img"));
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
      var m = imgs.length > 1;
      lb.querySelector(".pv").style.display = m ? "" : "none";
      lb.querySelector(".nx").style.display = m ? "" : "none";
      ct.style.display = m ? "" : "none";
    }
    function abrir(k) { show(k); lb.classList.add("on"); document.body.style.overflow = "hidden"; }
    function fechar() { lb.classList.remove("on", "z"); document.body.style.overflow = ""; }
    imgs.forEach(function (x, k) { x.addEventListener("click", function () { abrir(k); }); });
    im.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var z = lb.classList.toggle("z");
      if (z) { lb.scrollLeft = (im.offsetWidth - lb.clientWidth) / 2; lb.scrollTop = (im.offsetHeight - lb.clientHeight) / 2; }
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
      h += compartilhar("Lote " + n + (resumoLote(d) ? " – " + resumoLote(d) : "") + "\n" + EVENTO + "\n" + SITE + "lote.html?n=" + n, "Enviar este lote no WhatsApp");
      alvo.innerHTML = h;
      ligarZoom();
      var gal = document.getElementById("gal"), dots = document.getElementById("dots");
      if (gal && dots) gal.addEventListener("scroll", function () {
        var k = Math.round(gal.scrollLeft / gal.clientWidth) + 1;
        dots.textContent = "foto " + k + " de " + m.fotos.length + " · deslize para o lado";
      }, { passive: true });
    });
  };

  var ICONE_V = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/><path d="M9 9.2c.3 2.3 2.5 4.5 4.8 4.8l1.2-1.3-1.9-1-0.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-1.9z" fill="currentColor" stroke="none"/></svg>';
  var ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/><path d="M9 9.2c.3 2.3 2.5 4.5 4.8 4.8l1.2-1.3-1.9-1-0.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-1.9z" fill="#fff" stroke="none"/></svg>';
})();

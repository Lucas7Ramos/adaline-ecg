/* Tela 13: Experimento 3, "por que adaptativo?".
 *
 * Números grandes e gráfico SNR × desvio: window.RESULTADOS_COLAB.exp3
 * (data/resultados.js). Sem esse arquivo, usa o cálculo ao vivo com o mesmo modelo.
 * Faixas de erro ("sobra"): sempre ao vivo, com o Q do melhor notch do Colab.
 *
 * Passo 1: slider de desvio + placar.   Passo 2: gráfico SNR × desvio.
 * Passo 3: referência acompanha / fixa. Passo 4: resposta em uma frase.
 */
(function (g) {
  'use strict';

  var S = g.Sinais, E = g.Experimentos;
  var NS = 'http://www.w3.org/2000/svg';
  var FS = S.FS;

  var AZUL = '#2b59ff', LARANJA = '#ff6b3d', TINTA = '#111111';
  var DB_MAX = 35;

  // Geometria do gráfico (px do SVG de 722 × 196).
  var X0 = 52, X1 = 552, Y0 = 6, Y1 = 156;
  function X(d) { return X0 + (d / 0.5) * (X1 - X0); }
  function Y(db) { return Y1 - (Math.max(0, Math.min(DB_MAX, db)) / DB_MAX) * (Y1 - Y0); }

  // Janela das faixas de erro: perto do desvio máximo da rede (t = 22,5 s).
  var FAIXA_INI = Math.round(22.3 * FS), FAIXA_FIM = Math.round(22.7 * FS);

  var sec, num, est = { i: 0, modo: 'acompanha', passo: 1 };
  var el = {};

  function fmtDesvio(d) {
    return d === 0 ? '0 Hz' : '±' + String(d).replace('.', ',') + ' Hz';
  }

  function adalineArr() {
    return est.modo === 'fixa' ? num.fixa : num.acompanha;
  }

  /* ---------- Gráfico ---------- */

  function serie(arr) {
    return arr.map(function (v, k) {
      return (k ? 'L' : 'M') + X(num.desvios[k]).toFixed(1) + ' ' + Y(v).toFixed(1);
    }).join('');
  }

  function linha(d, cor, larg, tracejado) {
    var a = { d: d, fill: 'none', stroke: cor, 'stroke-width': larg,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    if (tracejado) a['stroke-dasharray'] = '9 8';
    return S.el('path', a, el.svg);
  }

  function texto(x, y, t, ancora) {
    var e = S.el('text', { x: x, y: y, 'text-anchor': ancora || 'start' }, el.svg);
    e.textContent = t;
    return e;
  }

  /* Rótulo na ponta direita de uma linha: traço de cor + nome em preto. */
  function rotuloLinha(nome, cor, tracejado) {
    var gr = S.el('g', { class: 'rotulo-linha' }, el.svg);
    var a = { x1: 568, x2: 590, y1: 0, y2: 0, stroke: cor, 'stroke-width': 5, 'stroke-linecap': 'round' };
    if (tracejado) { a['stroke-dasharray'] = '5 5'; a['stroke-linecap'] = 'butt'; }
    S.el('line', a, gr);
    var t = S.el('text', { x: 598, y: 7, style: "font-family:'DM Sans',sans-serif;font-weight:700;font-size:20px" }, gr);
    t.textContent = nome;
    return gr;
  }

  function montarGrafico() {
    var svg = el.svg = sec.querySelector('#exp3-grafico');
    var dv = num.desvios;

    // Faixa amarela da virada (posição definida em atualizar).
    el.faixaVirada = S.el('rect', { y: Y0, height: Y1 - Y0, fill: '#ffd23f', 'fill-opacity': 0.6, rx: 6 }, svg);

    // Eixos e rótulos.
    S.el('line', { class: 'eixo', x1: X0, x2: X1, y1: Y1, y2: Y1 }, svg);
    [0, 10, 20, 30].forEach(function (v) { texto(X0 - 12, Y(v) + 7, String(v), 'end'); });
    [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach(function (d) {
      texto(X(d), 186, d === 0.5 ? '0,5 Hz' : S.fmt(d, d === 0 ? 0 : 1), 'middle');
    });

    // Cursor no desvio atual.
    el.cursor = S.el('g', { class: 'movel' }, svg);
    S.el('line', { x1: 0, x2: 0, y1: Y0, y2: Y1, stroke: TINTA, 'stroke-width': 2, 'stroke-dasharray': '5 6' }, el.cursor);

    // Curvas.
    el.lQ30 = linha(serie(num.q30), LARANJA, 3.5);
    el.lMelhor = linha(serie(num.melhor), TINTA, 3.5);
    el.lFixa = linha(serie(num.fixa), AZUL, 4, true);
    el.lAcomp = linha(serie(num.acompanha), AZUL, 4.5);

    // Pontos no desvio atual.
    el.pontos = [AZUL, LARANJA, TINTA].map(function (c) {
      return S.el('circle', { class: 'movel', cx: 0, cy: 0, r: 8, fill: c, stroke: TINTA, 'stroke-width': 3 }, svg);
    });

    // Rótulos das linhas.
    var fim = dv.length - 1;
    el.rotulos = [
      { g: rotuloLinha('Adaline', AZUL), y: Y(num.acompanha[fim]), sempre: true },
      { g: rotuloLinha('melhor notch', TINTA), y: Y(num.melhor[fim]), sempre: true },
      { g: rotuloLinha('notch Q = 30', LARANJA), y: Y(num.q30[fim]), sempre: true },
      { g: rotuloLinha('Adaline fixa', AZUL, true), y: Y(num.fixa[fim]), sempre: false }
    ];
  }

  /* Coloca os rótulos visíveis na altura da ponta de cada linha, sem sobrepor. */
  function posicionarRotulos() {
    var vis = el.rotulos.filter(function (r) { return r.sempre || est.modo === 'fixa'; });
    vis.sort(function (a, b) { return a.y - b.y; });
    var MIN = 26, ys = [];
    vis.forEach(function (r, k) { ys[k] = k ? Math.max(r.y, ys[k - 1] + MIN) : r.y; });
    var excesso = ys.length ? ys[ys.length - 1] - (Y1 + 8) : 0;
    if (excesso > 0) {
      for (var k = ys.length - 1; k >= 0; k--) {
        ys[k] -= excesso;
        if (k && ys[k - 1] > ys[k] - MIN) excesso = ys[k - 1] - (ys[k] - MIN); else break;
      }
    }
    el.rotulos.forEach(function (r) {
      var k = vis.indexOf(r);
      r.g.style.opacity = k < 0 ? 0 : 1;
      if (k >= 0) r.g.style.transform = 'translateY(' + ys[k].toFixed(1) + 'px)';
    });
  }

  /* ---------- Atualização ---------- */

  function desenharFaixa(svg, i, metodo, Q, cor) {
    var r = E.exp3Residuo(i, metodo, Q, FAIXA_INI, FAIXA_FIM);
    var p = svg.querySelector('path') || S.el('path', {
      fill: 'none', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, svg);
    p.setAttribute('stroke', cor);
    p.setAttribute('d', S.caminho(r, { x: 2, y: 3, w: 266, h: 28 }, -0.3, 0.3));
  }

  function atualizar() {
    var i = est.i, fixa = est.modo === 'fixa', dv = num.desvios[i];
    var ad = adalineArr();

    // Controle.
    el.desvioTxt.textContent = fmtDesvio(dv);
    el.slider.value = i;
    el.slider.style.setProperty('--pct', (i / (num.desvios.length - 1)) * 100 + '%');
    el.bAcomp.setAttribute('aria-pressed', String(!fixa));
    el.bFixa.setAttribute('aria-pressed', String(fixa));

    // Placar.
    var vals = [ad[i], num.q30[i], num.melhor[i]];
    var venc = vals.indexOf(Math.max.apply(null, vals));
    var subs = [
      fixa ? 'referência fixa em 60 Hz' : 'referência acompanha a rede',
      'filtro fixo, Q = 30',
      'o melhor Q possível: ' + num.melhorQ[i]
    ];
    el.cartoes.forEach(function (c, k) {
      c.classList.toggle('vencedor', k === venc);
      c.querySelector('[data-snr]').textContent = S.fmt(vals[k], 1);
      c.querySelector('[data-sub]').textContent = subs[k];
      c.querySelector('.barra > div').style.width =
        (Math.max(0, Math.min(DB_MAX, vals[k])) / DB_MAX) * 100 + '%';
    });

    // Faixas de erro (ao vivo).
    desenharFaixa(el.faixas[0], i, est.modo, null, AZUL);
    desenharFaixa(el.faixas[1], i, 'notch', 30, LARANJA);
    desenharFaixa(el.faixas[2], i, 'notch', num.melhorQ[i], TINTA);

    // Gráfico: cursor e pontos.
    var x = X(dv);
    el.cursor.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
    vals.forEach(function (v, k) {
      el.pontos[k].style.transform = 'translate(' + x.toFixed(1) + 'px,' + Y(v).toFixed(1) + 'px)';
    });

    // Linhas do Adaline conforme a referência.
    el.lAcomp.setAttribute('stroke-width', fixa ? 2.5 : 4.5);
    el.lFixa.style.opacity = fixa ? 1 : 0;
    posicionarRotulos();

    // Virada: a partir de onde o Adaline (na referência atual) vence o melhor notch.
    var k0 = -1;
    for (var k = 0; k < ad.length; k++) if (ad[k] > num.melhor[k]) { k0 = k; break; }
    if (k0 > 0) {
      var xa = X(num.desvios[k0 - 1]), xb = X(num.desvios[k0]);
      el.faixaVirada.setAttribute('x', xa);
      el.faixaVirada.setAttribute('width', xb - xa);
      el.faixaVirada.style.opacity = 1;
      el.virada.style.left = (xb + 10) + 'px';
      el.virada.style.opacity = 1;
    } else {
      el.faixaVirada.style.opacity = 0;
      el.virada.style.opacity = 0;
    }
  }

  function escolherDesvio(i) {
    est.i = Math.max(0, Math.min(num.desvios.length - 1, i));
    atualizar();
  }

  function escolherModo(m) {
    est.modo = m;
    atualizar();
  }

  g.Telas = g.Telas || {};
  g.Telas.exp3 = {
    iniciar: function (s) {
      sec = s;
      num = E.exp3Numeros();
      if (num.fonte !== 'colab') console.warn('Exp. 3: data/resultados.js não carregou; números calculados ao vivo.');
      el.slider = sec.querySelector('#exp3-desvio');
      el.desvioTxt = sec.querySelector('#exp3-desvio-txt');
      el.bAcomp = sec.querySelector('#exp3-acompanha');
      el.bFixa = sec.querySelector('#exp3-fixa');
      el.virada = sec.querySelector('#exp3-virada');
      el.cartoes = [0, 1, 2].map(function (k) { return sec.querySelector('#exp3-c' + k); });
      el.faixas = el.cartoes.map(function (c) { return c.querySelector('.sobra svg'); });
      el.slider.max = num.desvios.length - 1;

      montarGrafico();

      el.slider.addEventListener('input', function () { escolherDesvio(+el.slider.value); });
      el.bAcomp.addEventListener('click', function () { escolherModo('acompanha'); });
      el.bFixa.addEventListener('click', function () { escolherModo('fixa'); });
      atualizar();
    },
    passo: function (s, p) {
      est.passo = p;
      // O controle da referência só existe a partir do passo 3.
      if (p < 3 && est.modo !== 'acompanha') est.modo = 'acompanha';
      atualizar();
    },
    reiniciar: function () {
      est.i = 0;
      est.modo = 'acompanha';
      atualizar();
    }
  };
})(window);

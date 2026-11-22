/* Tela 14: Análise dos resultados.
 *
 * Os três números grandes e as miniaturas vêm de window.RESULTADOS_COLAB
 * (data/resultados.js), via Experimentos.resumo(); nada escrito à mão.
 *   1. ganho de SNR do experimento 1 (depois − antes)
 *   2. o menor tempo de convergência do experimento 2
 *   3. o primeiro desvio em que o Adaline (referência acompanha) vence o melhor notch
 * A miniatura 1 é o registro 100 com o ruído fixo, antes e depois do Adaline
 * (calculada aqui com o mesmo filtro do experimento 1).
 *
 * Passos 1 a 3: uma coluna por seta.  Passo 4: a conclusão geral.
 */
(function (g) {
  'use strict';

  var S = g.Sinais, A = g.Adaline, E = g.Experimentos;
  var FS = S.FS;
  var AZUL = '#2b59ff', LARANJA = '#ff6b3d', TINTA = '#111111', AMARELO = '#ffd23f';
  var W = 324;

  function fmtN(v) { return String(v).replace('.', ','); }

  function texto(svg, x, y, t, classe, ancora) {
    var e = S.el('text', { x: x, y: y, 'class': classe, 'text-anchor': ancora || 'start' }, svg);
    e.textContent = t;
    return e;
  }

  /* Linha que se desenha da esquerda para a direita quando a coluna aparece. */
  function linha(svg, d, cor, larg) {
    return S.el('path', {
      d: d, 'class': 'desenha', pathLength: 1, fill: 'none', stroke: cor,
      'stroke-width': larg, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, svg);
  }

  function pontos(xs, ys) {
    return xs.map(function (x, k) {
      return (k ? 'L' : 'M') + x.toFixed(1) + ' ' + ys[k].toFixed(1);
    }).join('');
  }

  /* ---------- 1. Antes e depois ---------- */

  function mini1(svg, R) {
    var ecg = S.ecg();
    var mu = (R.exp1 && R.exp1.mu) || 0.01;
    // 4 s de sinal: o Adaline já aprendeu bem antes do trecho mostrado.
    var N = Math.min(ecg.length, 4 * FS), d = new Float64Array(N);
    for (var n = 0; n < N; n++) d[n] = ecg[n] + S.ruidoFixo(n);
    var e = A.filtrar(d, mu).e;

    // Um batimento depois de 2,5 s.
    var pk = S.picosR(ecg).filter(function (p) { return p > 2.5 * FS && p < N - 0.5 * FS; });
    var c = pk.length ? pk[0] : Math.round(3 * FS);
    var ini = c - Math.round(0.25 * FS), fim = c + Math.round(0.4 * FS);
    var lo = -1.0, hi = 1.9;

    texto(svg, 0, 22, 'antes', 't-nome');
    texto(svg, 0, 46, R.exp1 ? S.fmt(R.exp1.antes, 1) + ' dB' : '', 't-mono');
    texto(svg, 0, 82, 'depois', 't-nome');
    texto(svg, 0, 106, R.exp1 ? S.fmt(R.exp1.depois, 1) + ' dB' : '', 't-mono');
    linha(svg, S.caminho(d, { x: 112, y: 3, w: 208, h: 48 }, lo, hi, ini, fim), LARANJA, 3);
    linha(svg, S.caminho(e, { x: 112, y: 61, w: 208, h: 48 }, lo, hi, ini, fim), TINTA, 3.5);
  }

  /* ---------- 2. A tesoura ---------- */

  function mini2(svg, R) {
    var C = E.exp2Numeros();
    if (!C || !R.exp2) return;
    var X0 = 86, X1 = 316;
    var a = Math.log10(C.mus[0]), b = Math.log10(C.mus[C.mus.length - 1]);
    function x(mu) { return X0 + (Math.log10(mu) - a) / (b - a) * (X1 - X0); }
    var xs = C.mus.map(x);

    // Tempo em escala log (de 6 s a 0,05 s); SNR linear. Cada linha na sua faixa.
    var tl = C.tempo.map(Math.log10);
    var tMin = Math.min.apply(null, tl), tMax = Math.max.apply(null, tl);
    var yT = tl.map(function (v) { return 8 + (1 - (v - tMin) / (tMax - tMin)) * 30; });
    var sMin = Math.min.apply(null, C.snr), sMax = Math.max.apply(null, C.snr);
    var yS = C.snr.map(function (v) { return 52 + (1 - (v - sMin) / (sMax - sMin)) * 30; });

    texto(svg, 0, 30, 'tempo', 't-nome');
    texto(svg, 0, 74, 'SNR', 't-nome');

    // Marca no µ que aprende mais rápido.
    var xr = x(R.exp2.muRapido);
    S.el('line', { x1: xr, x2: xr, y1: 0, y2: 88, stroke: TINTA, 'stroke-width': 2, 'stroke-dasharray': '5 5' }, svg);

    linha(svg, pontos(xs, yT), AZUL, 3.5);
    linha(svg, pontos(xs, yS), LARANJA, 3.5);
    var k = C.mus.indexOf(R.exp2.muRapido);
    [yT[k], yS[k]].forEach(function (y) {
      S.el('circle', { cx: xr, cy: y, r: 8, fill: AMARELO, stroke: TINTA, 'stroke-width': 3 }, svg);
    });

    texto(svg, 0, 110, 'µ', 't-nome');
    texto(svg, X0 - 4, 110, fmtN(C.mus[0]), 't-mono');
    texto(svg, xr, 110, fmtN(R.exp2.muRapido), 't-mono', 'middle');
  }

  /* ---------- 3. A virada ---------- */

  function mini3(svg) {
    var C = E.exp3Numeros();
    var dv = C.desvios, dMax = dv[dv.length - 1];
    var X0 = 4, X1 = 316, Y0 = 4, Y1 = 62, LO = 14, HI = 28;
    function x(d) { return X0 + (d / dMax) * (X1 - X0); }
    function y(v) { return Y1 - (Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO) * (Y1 - Y0); }

    // Faixa amarela entre o último desvio em que o notch vence e o primeiro em que o Adaline vence.
    var k0 = -1;
    for (var k = 0; k < dv.length; k++) if (C.acompanha[k] > C.melhor[k]) { k0 = k; break; }
    if (k0 > 0) {
      S.el('rect', { x: x(dv[k0 - 1]), y: Y0 - 4, width: x(dv[k0]) - x(dv[k0 - 1]), height: Y1 - Y0 + 4,
        fill: AMARELO, stroke: TINTA, 'stroke-width': 2, rx: 3 }, svg);
    }
    S.el('line', { 'class': 'eixo', x1: X0, x2: X1, y1: Y1 + 4, y2: Y1 + 4 }, svg);

    var xs = dv.map(x);
    linha(svg, pontos(xs, C.melhor.map(y)), TINTA, 3.5);
    linha(svg, pontos(xs, C.acompanha.map(y)), AZUL, 4.5);

    texto(svg, X0, 88, '0', 't-mono');
    texto(svg, X1, 88, '±' + fmtN(dMax) + ' Hz', 't-mono', 'end');

    // Legenda (a cor nunca vai sozinha).
    S.el('line', { x1: 2, x2: 30, y1: 104, y2: 104, stroke: AZUL, 'stroke-width': 6, 'stroke-linecap': 'round' }, svg);
    texto(svg, 38, 111, 'Adaline', 't-nome');
    S.el('line', { x1: 136, x2: 164, y1: 104, y2: 104, stroke: TINTA, 'stroke-width': 6, 'stroke-linecap': 'round' }, svg);
    texto(svg, 172, 111, 'melhor notch', 't-nome');
  }

  g.Telas = g.Telas || {};
  g.Telas.analise = {
    iniciar: function (sec) {
      var R = E.resumo();
      if (R.exp1) sec.querySelector('#an-n1').textContent = '+' + S.fmt(R.exp1.ganho, 1);
      // O µ do aprendizado mais rápido aparece embaixo da marca, na miniatura.
      if (R.exp2) sec.querySelector('#an-n2').textContent = S.fmt(R.exp2.tempoRapido, 2);
      if (R.exp3 && R.exp3.virada != null) sec.querySelector('#an-n3').textContent = fmtN(R.exp3.virada);
      if (!g.RESULTADOS_COLAB) console.warn('Análise: data/resultados.js não carregou.');

      mini1(sec.querySelector('#an-mini1'), R);
      mini2(sec.querySelector('#an-mini2'), R);
      mini3(sec.querySelector('#an-mini3'));
    }
  };
})(window);

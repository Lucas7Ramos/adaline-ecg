/* Tela 12: Experimento 2, "qual o papel de µ?".
 *
 * Slider de µ: só os valores testados no Colab (RESULTADOS_COLAB.exp2.mus), que
 * já são espaçados em escala logarítmica (0,001 · 0,002 · 0,005 · 0,01 …).
 * Cada mudança de µ recomeça o filtro do zero (mesmo cenário do experimento 1:
 * registro 100 + ruído fixo de 60 Hz), em tempo real.
 *
 * Monitor de varredura (como num monitor cardíaco: o traço é escrito da esquerda
 * para a direita e recomeça do lado esquerdo), com o ECG original tracejado por
 * baixo. Laranja = ainda aprendendo; preto = depois de aprender. "Aprendeu" usa o
 * mesmo critério do Colab: erro dos pesos abaixo de 10% do valor certo (o tempo
 * medido aqui bate com o do Colab).
 *
 * Barras e tesoura: números do Colab (data/resultados.js). Sem esse arquivo,
 * calcula ao vivo com o mesmo modelo (30 s de sinal, SNR a partir de 5 s).
 *
 * Passo 1: slider + monitor.  Passo 2: barras.  Passo 3: tesoura.  Passo 4: resposta.
 */
(function (g) {
  'use strict';

  var S = g.Sinais, A = g.Adaline, E = g.Experimentos;
  var FS = S.FS;
  var AZUL = '#2b59ff', LARANJA = '#ff6b3d', TINTA = '#111111', AMARELO = '#ffd23f';

  var ALVO1 = S.A_RUIDO * Math.sin(S.FASE_RUIDO);
  var ALVO2 = S.A_RUIDO * Math.cos(S.FASE_RUIDO);
  var NORMA_ALVO = Math.hypot(ALVO1, ALVO2);

  // Monitor de varredura (658 × 166): 2 s de sinal, em tempo real.
  // Em cima o ECG (y 4 a 108); embaixo a faixa da sobra do ruído (saída − ECG),
  // ampliada: ±0,15 mV ocupam ±19 px (y 124 a 162).
  var JANELA = 2 * FS, VAZIO = Math.round(0.06 * FS);
  var CX = 4, CW = 650, CY = 4, CH = 104, LO = -0.6, HI = 1.5;
  var SOBRA_Y = 143, SOBRA_H = 19, SOBRA_MAX = 0.15;
  function mx(j) { return CX + (j / (JANELA - 1)) * CW; }
  function my(v) { return CY + CH - ((Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO)) * CH; }
  function sy(r) { return SOBRA_Y - Math.max(-1, Math.min(1, r / SOBRA_MAX)) * SOBRA_H; }

  // Tesoura (318 × 150 cada).
  var GX0 = 48, GX1 = 300, GY0 = 30, GY1 = 108;

  var sec, num, el = {};
  var ecg, volta, neuronio;
  var est = { i: 3 };
  var n = 0, nConv = -1, resto = 0, t0 = null, laco = null;
  var saida, orig, tipo;           // tipo: 0 vazio, 1 aprendendo, 2 aprendeu

  /* ---------- Números (Colab, ou ao vivo como reserva) ---------- */

  function numeros() {
    var c = E.exp2Numeros();
    if (c) return c;
    console.warn('Exp. 2: data/resultados.js não carregou; números calculados ao vivo.');
    var mus = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2];
    var L = S.repetir(ecg, 30 * FS), N = L.length, d = new Float64Array(N);
    for (var k = 0; k < N; k++) d[k] = L[k] + S.ruidoFixo(k);
    var tempo = [], snr = [];
    mus.forEach(function (mu) {
      var r = A.filtrar(d, mu), t = null;
      for (var k = 0; k < N && t == null; k++) {
        if (Math.hypot(r.w1[k] - ALVO1, r.w2[k] - ALVO2) < 0.1 * NORMA_ALVO) t = k / FS;
      }
      tempo.push(t);
      snr.push(S.snrDb(r.e, L, 5 * FS));
    });
    return { mus: mus, tempo: tempo, snr: snr };
  }

  function fmtMu(mu) { return String(mu).replace('.', ','); }

  /* ---------- Filtro e varredura ---------- */

  function amostra() {
    var c = ecg[n % volta];
    var f = A.faseFixa(n);
    var e = neuronio.passo(c + S.ruidoFixo(n), Math.cos(f), Math.sin(f));
    if (nConv < 0 && Math.hypot(neuronio.w1 - ALVO1, neuronio.w2 - ALVO2) < 0.1 * NORMA_ALVO) nConv = n;
    var j = n % JANELA;
    saida[j] = e;
    orig[j] = c;
    tipo[j] = nConv >= 0 && n >= nConv ? 2 : 1;
    n++;
  }

  /* Monta os caminhos: o ECG original (tracejado) e a saída, separada em
   * "aprendendo" (laranja) e "aprendeu" (preto). Logo à frente do ponto de
   * escrita fica um vão, como num monitor cardíaco. */
  function desenhar() {
    var cur = (n - 1 + JANELA) % JANELA;
    var sOrig = '', sSobra = '', partes = { 1: '', 2: '' };
    var abertoOrig = false, tipoAberto = 0;
    for (var j = 0; j < JANELA; j++) {
      var dist = (j - cur + JANELA) % JANELA;
      var visivel = tipo[j] !== 0 && !(dist > 0 && dist <= VAZIO);
      if (!visivel) { abertoOrig = false; tipoAberto = 0; continue; }
      var x = mx(j).toFixed(1);
      sOrig += (abertoOrig ? 'L' : 'M') + x + ' ' + my(orig[j]).toFixed(1);
      sSobra += (abertoOrig ? 'L' : 'M') + x + ' ' + sy(saida[j] - orig[j]).toFixed(1);
      abertoOrig = true;
      var y = my(saida[j]).toFixed(1), t = tipo[j];
      if (tipoAberto === t) {
        partes[t] += 'L' + x + ' ' + y;
      } else {
        // Na troca de cor, o trecho novo começa na amostra anterior para não deixar buraco.
        if (tipoAberto && j > 0) partes[t] += 'M' + mx(j - 1).toFixed(1) + ' ' + my(saida[j - 1]).toFixed(1) + 'L' + x + ' ' + y;
        else partes[t] += 'M' + x + ' ' + y;
        tipoAberto = t;
      }
    }
    el.orig.setAttribute('d', sOrig);
    el.sobra.setAttribute('d', sSobra);
    el.sujo.setAttribute('d', partes[1]);
    el.limpo.setAttribute('d', partes[2]);
    mostrarStatus();
  }

  function mostrarStatus() {
    var pronto = nConv >= 0;
    el.status.classList.toggle('pronto', pronto);
    el.status.textContent = pronto
      ? 'aprendeu em ' + S.fmt(nConv / FS, 2) + ' s'
      : 'aprendendo… ' + S.fmt(n / FS, 1) + ' s';
  }

  function quadro(t) {
    if (t0 != null) {
      resto += Math.min(0.1, (t - t0) / 1000) * FS;
      var k = Math.floor(resto);
      resto -= k;
      for (var i = 0; i < k; i++) amostra();
      if (k) desenhar();
    }
    t0 = t;
    laco = requestAnimationFrame(quadro);
  }

  function iniciarLaco() {
    if (laco || S.movimentoReduzido()) return;
    t0 = null;
    laco = requestAnimationFrame(quadro);
  }

  function pararLaco() {
    if (laco) cancelAnimationFrame(laco);
    laco = null;
  }

  /* Recomeça o filtro do zero com o µ atual. */
  function recomecarFiltro() {
    neuronio = new A.Neuronio(num.mus[est.i]);
    n = 0;
    nConv = -1;
    resto = 0;
    tipo.fill(0);
    if (S.movimentoReduzido()) {
      // Sem animação: mostra direto 2 s de sinal depois de aprender.
      var alvo = Math.round(Math.max(2, (num.tempo[est.i] || 0) + 2) * FS);
      while (n < alvo) amostra();
    }
    desenhar();
  }

  /* ---------- Barras, tesoura e controle ---------- */

  function segmentos(alvo, k) {
    var s = alvo.children;
    for (var i = 0; i < s.length; i++) s[i].classList.toggle('cheio', i < k);
  }

  function atualizarBarras() {
    var i = est.i, t = num.tempo, q = num.snr;
    var tMin = Math.min.apply(null, t), tMax = Math.max.apply(null, t);
    var qMin = Math.min.apply(null, q), qMax = Math.max.apply(null, q);
    // Velocidade: tempo em escala log (mais rápido = 10). Precisão: SNR final (maior = 10).
    var v = Math.round(1 + 9 * Math.log(tMax / t[i]) / Math.log(tMax / tMin));
    var p = Math.round(1 + 9 * (q[i] - qMin) / (qMax - qMin));
    segmentos(el.vel, v);
    segmentos(el.prec, p);
    el.velTxt.textContent = 'aprende em ' + S.fmt(t[i], 2) + ' s';
    el.precTxt.textContent = 'SNR final ' + S.fmt(q[i], 1) + ' dB';
    el.resultado.textContent =
      v >= 8 && p <= 6 ? 'rápido, mas tremido' :
      v <= 3 && p >= 8 ? 'preciso, mas lento' : 'equilíbrio';
  }

  function atualizarControle() {
    var i = est.i;
    el.muTxt.textContent = 'µ = ' + fmtMu(num.mus[i]);
    el.slider.value = i;
    el.slider.style.setProperty('--pct', (i / (num.mus.length - 1)) * 100 + '%');
    el.atalhos.forEach(function (a) { a.b.setAttribute('aria-pressed', String(a.i === i)); });
  }

  function atualizarTesoura() {
    var i = est.i, x = gxMu(num.mus[i]);
    el.graficos.forEach(function (gr) {
      gr.cursor.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
      gr.ponto.style.transform = 'translate(' + x.toFixed(1) + 'px,' + gr.y(gr.vals[i]).toFixed(1) + 'px)';
    });
  }

  function gxMu(mu) {
    var a = Math.log10(num.mus[0]), b = Math.log10(num.mus[num.mus.length - 1]);
    return GX0 + (Math.log10(mu) - a) / (b - a) * (GX1 - GX0);
  }

  function montarGrafico(svg, titulo, vals, vMax, ticks, cor) {
    function y(v) { return GY1 - (Math.max(0, Math.min(vMax, v)) / vMax) * (GY1 - GY0); }
    function texto(x, yy, t, anc, cls) {
      var e = S.el('text', { x: x, y: yy, 'text-anchor': anc || 'start' }, svg);
      if (cls) e.setAttribute('class', cls);
      e.textContent = t;
    }
    texto(0, 18, titulo, 'start', 'titulo-graf');
    S.el('line', { class: 'eixo', x1: GX0, x2: GX1 + 6, y1: GY1, y2: GY1 }, svg);
    ticks.forEach(function (v) { texto(GX0 - 10, y(v) + 7, S.fmt(v, 0), 'end'); });
    // Eixo de µ em escala log: 0,001 · 0,01 · 0,1.
    [0.001, 0.01, 0.1].forEach(function (mu) {
      if (mu < num.mus[0] || mu > num.mus[num.mus.length - 1]) return;
      texto(gxMu(mu), 136, fmtMu(mu), 'middle');
    });
    texto(GX1 + 14, 136, 'µ', 'start');

    var cursor = S.el('g', { class: 'movel' }, svg);
    S.el('line', { x1: 0, x2: 0, y1: GY0 - 4, y2: GY1, stroke: TINTA, 'stroke-width': 2, 'stroke-dasharray': '5 6' }, cursor);

    var d = vals.map(function (v, k) {
      return (k ? 'L' : 'M') + gxMu(num.mus[k]).toFixed(1) + ' ' + y(v).toFixed(1);
    }).join('');
    S.el('path', { d: d, fill: 'none', stroke: cor, 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    vals.forEach(function (v, k) {
      S.el('circle', { cx: gxMu(num.mus[k]), cy: y(v), r: 4.5, fill: cor, stroke: TINTA, 'stroke-width': 2 }, svg);
    });
    var ponto = S.el('circle', { class: 'movel', cx: 0, cy: 0, r: 10, fill: AMARELO, stroke: TINTA, 'stroke-width': 3 }, svg);
    return { cursor: cursor, ponto: ponto, y: y, vals: vals };
  }

  /* ---------- Ações ---------- */

  function escolher(i) {
    est.i = Math.max(0, Math.min(num.mus.length - 1, i));
    atualizarControle();
    atualizarBarras();
    atualizarTesoura();
    recomecarFiltro();
  }

  function indicePadrao() {
    var R = g.RESULTADOS_COLAB && g.RESULTADOS_COLAB.exp1;
    var k = R ? num.mus.indexOf(R.mu) : -1;
    return k >= 0 ? k : Math.floor((num.mus.length - 1) / 2);
  }

  g.Telas = g.Telas || {};
  g.Telas.exp2 = {
    iniciar: function (s) {
      sec = s;
      ecg = S.ecg();
      volta = S.pontoDeVolta(ecg);
      num = numeros();
      saida = new Float64Array(JANELA);
      orig = new Float64Array(JANELA);
      tipo = new Uint8Array(JANELA);

      el.slider = sec.querySelector('#exp2-mu');
      el.muTxt = sec.querySelector('#exp2-mu-txt');
      el.status = sec.querySelector('#exp2-status');
      el.vel = sec.querySelector('#exp2-vel');
      el.prec = sec.querySelector('#exp2-prec');
      el.velTxt = sec.querySelector('#exp2-vel-txt');
      el.precTxt = sec.querySelector('#exp2-prec-txt');
      el.resultado = sec.querySelector('#exp2-resultado');
      el.slider.max = num.mus.length - 1;
      sec.querySelector('#exp2-min').textContent = fmtMu(num.mus[0]);
      sec.querySelector('#exp2-max').textContent = fmtMu(num.mus[num.mus.length - 1]);
      [el.vel, el.prec].forEach(function (b) {
        for (var k = 0; k < 10; k++) b.appendChild(document.createElement('span'));
      });

      // Atalhos: o menor µ, o µ do experimento 1 e o µ que aprende mais rápido.
      var iRap = 0;
      num.tempo.forEach(function (t, k) { if (t < num.tempo[iRap]) iRap = k; });
      el.atalhos = [
        { b: sec.querySelector('#exp2-pequeno'), i: 0 },
        { b: sec.querySelector('#exp2-medio'), i: indicePadrao() },
        { b: sec.querySelector('#exp2-grande'), i: iRap }
      ];
      el.atalhos.forEach(function (a) {
        a.b.addEventListener('click', function () { escolher(a.i); });
      });
      el.slider.addEventListener('input', function () {
        if (+el.slider.value !== est.i) escolher(+el.slider.value);
      });

      // Monitor: ECG original tracejado por baixo, saída por cima.
      var svg = sec.querySelector('#exp2-monitor');
      el.orig = S.el('path', { fill: 'none', stroke: TINTA, 'stroke-width': 2.5, 'stroke-dasharray': '7 6', 'stroke-linejoin': 'round' }, svg);
      el.sujo = S.el('path', { fill: 'none', stroke: LARANJA, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      el.limpo = S.el('path', { fill: 'none', stroke: TINTA, 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      // Faixa da sobra: o ruído que o filtro ainda deixa passar.
      S.el('line', { x1: CX, x2: CX + CW, y1: SOBRA_Y, y2: SOBRA_Y, stroke: TINTA, 'stroke-width': 2 }, svg);
      var rot = S.el('text', { x: CX, y: 121, style: "font-family:'DM Sans',sans-serif;font-weight:700;font-size:20px" }, svg);
      rot.textContent = 'sobra do ruído (ampliada)';
      el.sobra = S.el('path', { fill: 'none', stroke: LARANJA, 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);

      // Tesoura.
      el.graficos = [
        montarGrafico(sec.querySelector('#exp2-tempo'), 'tempo para aprender (s)', num.tempo,
          Math.ceil(Math.max.apply(null, num.tempo)), [0, 3, 6], AZUL),
        montarGrafico(sec.querySelector('#exp2-snr'), 'SNR final (dB)', num.snr,
          Math.max(30, Math.ceil(Math.max.apply(null, num.snr))), [0, 15, 30], LARANJA)
      ];

      est.i = indicePadrao();
    },
    entrar: function () {
      escolher(est.i);
      iniciarLaco();
    },
    sair: function () {
      pararLaco();
    },
    reiniciar: function () {
      recomecarFiltro();
    }
  };
})(window);

/* Tela 2: O que é um ECG.
 * Passo 1: um batimento real (registro 100, R em 1,84 s) se desenha da
 *          esquerda para a direita; ao lado, o ritmo correndo e a frequência.
 * Passos 2 a 4: os rótulos onda P, QRS e onda T, cada um com a sua faixa.
 * Passo 5: a proporção entre a altura da onda P e a do QRS.
 * As alturas e a frequência são medidas no próprio data/ecg100.js.
 */
(function (g) {
  'use strict';

  var S = g.Sinais;
  var FS = S.FS;

  /* Batimento mostrado: o pico R mais perto de 1,84 s (o 3º do trecho). */
  var T_BATIMENTO = 1.84;
  /* Janela do desenho, em segundos em torno do pico R. */
  var ANTES = 0.36, DEPOIS = 0.56;
  /* Trechos de cada onda (s em torno do R), conferidos no registro 100. */
  var ONDAS = [
    { id: 'p', de: -0.22, ate: -0.08, passo: 2, perto: true },
    { id: 'qrs', de: -0.055, ate: 0.05, passo: 3, perto: false },
    { id: 't', de: 0.25, ate: 0.47, passo: 4, perto: true }
  ];

  /* Área do gráfico dentro do SVG de 672 × 392. */
  var X0 = 64, X1 = 656, Y0 = 56, Y1 = 350;
  var LO = -0.38, HI = 1.33;   // mV

  var caminho, faixas = {}, monitor, ecg, volta;

  function px(t) { return X0 + (t + ANTES) / (ANTES + DEPOIS) * (X1 - X0); }
  function py(v) { return Y1 - (v - LO) / (HI - LO) * (Y1 - Y0); }

  function mediana(a) {
    var b = Array.prototype.slice.call(a).sort(function (p, q) { return p - q; });
    return b[b.length >> 1];
  }

  /* Alturas médias da onda P e do QRS (acima da linha de base antes da P),
   * em todos os batimentos completos do trecho. */
  function medirAlturas(x, picos) {
    var s = function (t) { return Math.round(t * FS); };
    var ps = [], qs = [];
    picos.forEach(function (R) {
      if (R < s(0.35) || R + s(0.5) >= x.length) return;
      var base = mediana(x.subarray(R - s(0.34), R - s(0.24)));
      var p = -Infinity;
      for (var i = R - s(0.22); i < R - s(0.08); i++) p = Math.max(p, x[i]);
      ps.push(p - base);
      qs.push(x[R] - base);
    });
    return { p: mediana(ps), qrs: mediana(qs) };
  }

  function desenharBatimento(svg, x, R) {
    var ini = R - Math.round(ANTES * FS), fim = R + Math.round(DEPOIS * FS);

    // Faixas das ondas (atrás do sinal).
    ONDAS.forEach(function (o) {
      faixas[o.id] = S.el('rect', {
        class: 'faixa-onda',
        x: px(o.de).toFixed(1), y: Y0 - 8,
        width: (px(o.ate) - px(o.de)).toFixed(1), height: Y1 - Y0 + 16,
        rx: 6, fill: '#ffd23f', opacity: 0
      }, svg);
    });

    // Escala: 1 mV na vertical e 0,2 s na horizontal.
    var y0 = py(0), y1 = py(1);
    S.el('path', {
      d: 'M14 ' + y0 + ' L14 ' + y1 + ' M8 ' + y0 + ' L20 ' + y0 + ' M8 ' + y1 + ' L20 ' + y1,
      stroke: '#111111', 'stroke-width': 2.5, fill: 'none'
    }, svg);
    S.el('text', { x: 26, y: y1 + 20 }, svg).textContent = '1 mV';
    var xa = X0, xb = X0 + 0.2 / (ANTES + DEPOIS) * (X1 - X0), yb = 374;
    S.el('path', {
      d: 'M' + xa + ' ' + yb + ' L' + xb + ' ' + yb + ' M' + xa + ' ' + (yb - 6) + ' L' + xa + ' ' + (yb + 6) +
         ' M' + xb + ' ' + (yb - 6) + ' L' + xb + ' ' + (yb + 6),
      stroke: '#111111', 'stroke-width': 2.5, fill: 'none'
    }, svg);
    S.el('text', { x: xb + 10, y: yb + 7 }, svg).textContent = '0,2 s';

    // O batimento.
    var d = '';
    for (var i = ini; i <= fim; i++) {
      var t = (i - R) / FS;
      d += (i === ini ? 'M' : 'L') + px(t).toFixed(1) + ' ' + py(x[i]).toFixed(1);
    }
    caminho = S.el('path', {
      d: d, fill: 'none', stroke: '#111111', 'stroke-width': 4,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1
    }, svg);
  }

  /* Desenha o batimento da esquerda para a direita (ou mostra pronto). */
  function tracar(animar) {
    var c = caminho.style;
    c.transition = 'none';
    c.strokeDasharray = '1';
    c.strokeDashoffset = animar && !S.movimentoReduzido() ? '1' : '0';
    void caminho.getBoundingClientRect();
    c.transition = 'stroke-dashoffset 1400ms ease-out';
    c.strokeDashoffset = '0';
  }

  /* Faixa da onda do passo atual em amarelo; as anteriores ficam em papel. */
  function marcarFaixas(p) {
    ONDAS.forEach(function (o) {
      var f = faixas[o.id];
      if (p < o.passo) { f.setAttribute('opacity', 0); return; }
      var atual = p === o.passo;
      f.setAttribute('fill', atual ? '#ffd23f' : '#d9d4c8');
      f.setAttribute('opacity', atual ? 0.8 : 0.6);
    });
  }

  g.Telas = g.Telas || {};
  g.Telas.ecg = {
    iniciar: function (sec) {
      ecg = S.ecg();
      volta = S.pontoDeVolta(ecg);
      var picos = S.picosR(ecg);

      // Pico R mais perto de T_BATIMENTO.
      var R = picos[0];
      picos.forEach(function (k) {
        if (Math.abs(k / FS - T_BATIMENTO) < Math.abs(R / FS - T_BATIMENTO)) R = k;
      });
      desenharBatimento(sec.querySelector('#ecg-batimento'), ecg, R);

      // Rótulos centrados em cada faixa (a área HTML coincide com o SVG):
      // P e T logo acima da onda; o QRS no alto, acima do pico R.
      ONDAS.forEach(function (o) {
        var r = sec.querySelector('#ecg-rot-' + o.id);
        r.style.left = px((o.de + o.ate) / 2).toFixed(0) + 'px';
        if (o.perto) r.style.top = (py(0.45) - 44).toFixed(0) + 'px';
      });

      // Frequência cardíaca: média dos intervalos RR do trecho.
      var rr = (picos[picos.length - 1] - picos[0]) / (picos.length - 1) / FS;
      sec.querySelector('#ecg-bpm').textContent = Math.round(60 / rr);

      // Proporção P × QRS.
      var h = medirAlturas(ecg, picos);
      sec.querySelector('#ecg-fracao').textContent = '1/' + Math.round(h.qrs / h.p);
      sec.querySelector('#ecg-val-qrs').textContent = S.fmt(h.qrs, 1) + ' mV';
      sec.querySelector('#ecg-val-p').textContent = S.fmt(h.p, 1) + ' mV';
      sec.querySelector('#ecg-barra-qrs').style.width = '100%';
      sec.querySelector('#ecg-barra-p').style.width = (100 * h.p / h.qrs).toFixed(1) + '%';

      monitor = new S.Monitor({
        svg: sec.querySelector('#ecg-ritmo'),
        caixa: { x: 4, y: 6, w: 364, h: 88 },
        janela: 4,
        lo: LO,
        hi: HI,
        gerar: function (n) { return { v: ecg[n % volta], k: 'limpo' }; },
        tipos: { limpo: { cor: '#111111', largura: 3 } }
      });
    },
    entrar: function (sec, p) {
      tracar(p === 1);
      monitor.reiniciar();
      monitor.iniciar();
    },
    passo: function (sec, p) {
      marcarFaixas(p);
    },
    sair: function () {
      monitor.parar();
    },
    reiniciar: function (sec, p) {
      tracar(true);
      monitor.reiniciar();
    }
  };
})(window);

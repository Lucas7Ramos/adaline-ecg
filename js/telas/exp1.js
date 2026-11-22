/* Tela 11: Experimento 1, "o Adaline funciona?".
 *
 * O mesmo cenário do experimento 1 do Colab: registro 100 + ruído fixo de 60 Hz,
 * µ = RESULTADOS_COLAB.exp1.mu (0,01), pesos começando em zero.
 *
 * Passo 1: ECG ruidoso correndo; botão "ligar o Adaline".
 * Passo 2: o Adaline liga (se ainda não foi ligado pelo botão).
 * Passo 3: resposta em uma frase.
 *
 * Painéis ao lado, medidos ao vivo sobre o que está passando no monitor:
 *   pesos     w1 e w2 desde que o Adaline ligou, com o valor certo tracejado;
 *   espectro  amplitude de 0 a 90 Hz nos últimos 0,5 s (janela de Hann);
 *   SNR       10·log10(P_ecg / P_resto), com o resto medido nos últimos 0,5 s.
 * O SNR ao vivo oscila; o número dito em voz alta é o do Colab (escrito no painel).
 */
(function (g) {
  'use strict';

  var S = g.Sinais, A = g.Adaline;
  var FS = S.FS;
  var AZUL = '#2b59ff', LARANJA = '#ff6b3d', TINTA = '#111111';

  var VELOCIDADE = 0.4;            // câmera lenta: 40% do tempo real
  var JANELA_MEDIDA = FS / 2;      // 0,5 s para o espectro e o SNR
  var T_PESOS = 1.5;               // s de sinal no gráfico dos pesos
  var N_PESOS = Math.round(T_PESOS * FS);

  // Valor certo dos pesos: ruído = A·sen(ωn + φ) = A·sen φ·cos(ωn) + A·cos φ·sen(ωn).
  var ALVO1 = S.A_RUIDO * Math.sin(S.FASE_RUIDO);
  var ALVO2 = S.A_RUIDO * Math.cos(S.FASE_RUIDO);
  var NORMA_ALVO = Math.hypot(ALVO1, ALVO2);

  // Gráfico dos pesos (350 × 92).
  var PX0 = 4, PX1 = 346, PY0 = 4, PY1 = 62, WLO = -0.04, WHI = 0.56;
  function px(k) { return PX0 + (k / N_PESOS) * (PX1 - PX0); }
  function py(w) { return PY1 - (Math.max(WLO, Math.min(WHI, w)) - WLO) / (WHI - WLO) * (PY1 - PY0); }

  // Espectro (350 × 92): 0 a 90 Hz, 0 a 0,55 mV.
  var F_MAX = 90, AMP_MAX = 0.55;
  var EX0 = 4, EX1 = 346, EY0 = 4, EY1 = 62;
  function ex(f) { return EX0 + (f / F_MAX) * (EX1 - EX0); }
  function ey(a) { return EY1 - Math.min(1, a / AMP_MAX) * (EY1 - EY0); }

  // Barra do SNR: de −10 a 35 dB.
  var SNR_LO = -10, SNR_HI = 35;

  var MU = 0.01;
  var sec, el = {};
  var ecg, volta, pEcg, adaline, monitor;
  var ligado = false;
  var saida, limpo, pos = 0;       // anéis com as últimas amostras (saída e ECG limpo)
  var hist1 = [], hist2 = [], kConv = -1, nLigou = 0;
  var hann, cosT, senT;            // tabelas do espectro
  var snrMostrado = null, ultimoN = -1, laco = null;

  /* ---------- Sinal ---------- */

  function gerar(n) {
    var c = ecg[n % volta];
    var d = c + S.ruidoFixo(n);
    var v = d, k = 'sujo';
    if (ligado) {
      var f = A.faseFixa(n);
      v = adaline.passo(d, Math.cos(f), Math.sin(f));
      k = 'limpo';
      var j = n - nLigou;
      if (j < N_PESOS) {
        hist1.push(px(j + 1).toFixed(1) + ' ' + py(adaline.w1).toFixed(1));
        hist2.push(px(j + 1).toFixed(1) + ' ' + py(adaline.w2).toFixed(1));
        if (kConv < 0 && Math.hypot(adaline.w1 - ALVO1, adaline.w2 - ALVO2) < 0.1 * NORMA_ALVO) kConv = j + 1;
      }
    }
    saida[pos] = v;
    limpo[pos] = c;
    pos = (pos + 1) % JANELA_MEDIDA;
    return { v: v, k: k };
  }

  /* ---------- Painéis ---------- */

  function desenharPesos() {
    var ini = px(0) + ' ' + py(0);
    el.w1.setAttribute('d', hist1.length ? 'M' + ini + 'L' + hist1.join('L') : '');
    el.w2.setAttribute('d', hist2.length ? 'M' + ini + 'L' + hist2.join('L') : '');
    var mostrar = kConv > 0;
    el.conv.style.opacity = mostrar ? 1 : 0;
    if (mostrar) {
      el.convLinha.setAttribute('x1', px(kConv));
      el.convLinha.setAttribute('x2', px(kConv));
      el.convTxt.setAttribute('x', px(kConv) + 10);
    }
  }

  function desenharEspectro() {
    var L = JANELA_MEDIDA, soma = 0, pts = [], pico = [];
    for (var i = 0; i < L; i++) soma += hann[i];
    for (var f = 0; f <= F_MAX; f++) {
      var re = 0, im = 0, base = f * L;
      for (var m = 0; m < L; m++) {
        var v = saida[(pos + m) % L] * hann[m];
        re += v * cosT[base + m];
        im -= v * senT[base + m];
      }
      var a = (f ? 2 : 1) * Math.hypot(re, im) / soma;
      var p = ex(f).toFixed(1) + ' ' + ey(a).toFixed(1);
      pts.push(p);
      if (f >= 54 && f <= 66) pico.push(p);
    }
    el.espectro.setAttribute('d', 'M' + pts.join('L'));
    el.pico.setAttribute('d', 'M' + pico.join('L'));
  }

  function medirSnr() {
    var r = 0;
    for (var i = 0; i < JANELA_MEDIDA; i++) {
      var d = saida[i] - limpo[i];
      r += d * d;
    }
    return 10 * Math.log10(pEcg / Math.max(1e-12, r / JANELA_MEDIDA));
  }

  function mostrarSnr(imediato) {
    var v = medirSnr();
    snrMostrado = (imediato || snrMostrado == null) ? v : snrMostrado + 0.12 * (v - snrMostrado);
    el.snr.textContent = S.fmt(snrMostrado, 1);
    var u = (Math.max(SNR_LO, Math.min(SNR_HI, snrMostrado)) - SNR_LO) / (SNR_HI - SNR_LO);
    el.snrBarra.style.width = (u * 100).toFixed(1) + '%';
    el.snrBarra.style.backgroundColor = snrMostrado > 10 ? AZUL : LARANJA;
  }

  function atualizarPaineis(imediato) {
    desenharPesos();
    desenharEspectro();
    mostrarSnr(imediato);
  }

  function lacoPaineis() {
    if (monitor.n !== ultimoN) {
      ultimoN = monitor.n;
      atualizarPaineis(false);
    }
    laco = requestAnimationFrame(lacoPaineis);
  }

  function pararLaco() {
    if (laco) cancelAnimationFrame(laco);
    laco = null;
  }

  /* ---------- Estado ---------- */

  function mostrarEstado() {
    el.estado.className = 'faixa ' + (ligado ? 'azul' : 'laranja');
    el.estado.textContent = ligado
      ? 'Adaline ligado: o ruído some e fica o ECG'
      : 'Adaline desligado: ECG + ruído de 60 Hz';
    el.ligar.setAttribute('aria-pressed', String(ligado));
    el.ligar.classList.toggle('ativo', !ligado);
    el.ligarTxt.textContent = ligado ? 'desligar o Adaline' : 'ligar o Adaline';
  }

  function ligar(on) {
    if (on === ligado) return;
    ligado = on;
    adaline.reiniciar();
    hist1 = [];
    hist2 = [];
    kConv = -1;
    nLigou = monitor.n;
    mostrarEstado();
    if (S.movimentoReduzido()) monitor.avancar(on ? 2.5 : 1);
    atualizarPaineis(S.movimentoReduzido());
  }

  /* Volta ao começo: ECG ruidoso, Adaline desligado (ou ligado do zero, no passo ≥ 2). */
  function recomecar(p) {
    ligado = false;
    adaline.reiniciar();
    hist1 = [];
    hist2 = [];
    kConv = -1;
    monitor.reiniciar();
    snrMostrado = null;
    mostrarEstado();
    if (p >= 2) ligar(true);
    else atualizarPaineis(true);
  }

  /* ---------- Montagem ---------- */

  function montarPesos() {
    var svg = sec.querySelector('#exp1-pesos');
    S.el('line', { class: 'eixo', x1: PX0, x2: PX1, y1: PY1, y2: PY1 }, svg);
    S.el('line', { x1: PX0, x2: PX1, y1: py(ALVO1), y2: py(ALVO1), stroke: TINTA, 'stroke-width': 2.5, 'stroke-dasharray': '8 6' }, svg);
    var t = S.el('text', { x: PX1, y: py(ALVO1) - 8, 'text-anchor': 'end' }, svg);
    t.textContent = 'valor certo';
    [[0, '0', 'start'], [N_PESOS, S.fmt(T_PESOS, 1) + ' s', 'end']].forEach(function (r) {
      var e = S.el('text', { x: px(r[0]), y: 88, 'text-anchor': r[2] }, svg);
      e.textContent = r[1];
    });
    // Marca do momento em que aprendeu (erro dos pesos abaixo de 10%).
    el.conv = S.el('g', { style: 'opacity: 0; transition: opacity 250ms ease-out' }, svg);
    el.convLinha = S.el('line', { y1: PY0 + 10, y2: PY1, stroke: TINTA, 'stroke-width': 2, 'stroke-dasharray': '4 5' }, el.conv);
    el.convTxt = S.el('text', { y: 54, style: "font-family:'DM Sans',sans-serif;font-weight:700" }, el.conv);
    el.convTxt.textContent = 'aprendeu em ' + S.fmt(tempoColab(), 2) + ' s';
    el.w2 = S.el('path', { fill: 'none', stroke: TINTA, 'stroke-width': 7, 'stroke-linejoin': 'round' }, svg);
    el.w1 = S.el('path', { fill: 'none', stroke: AZUL, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, svg);
  }

  /* Tempo para aprender com o µ do experimento 1, do Colab (experimento 2). */
  function tempoColab() {
    var r = g.Experimentos.resumo();
    return r.exp1 && r.exp1.tempo != null ? r.exp1.tempo : 0.617;
  }

  function montarEspectro() {
    var svg = sec.querySelector('#exp1-espectro');
    S.el('line', { class: 'eixo', x1: EX0, x2: EX1, y1: EY1, y2: EY1 }, svg);
    [[0, '0', 'start'], [30, '30', 'middle'], [60, '60', 'middle'], [90, '90 Hz', 'end']].forEach(function (r) {
      var e = S.el('text', { x: ex(r[0]), y: 88, 'text-anchor': r[2] }, svg);
      e.textContent = r[1];
    });
    el.espectro = S.el('path', { fill: 'none', stroke: TINTA, 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
    el.pico = S.el('path', { fill: 'none', stroke: LARANJA, 'stroke-width': 4.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);

    var L = JANELA_MEDIDA;
    hann = new Float64Array(L);
    for (var m = 0; m < L; m++) hann[m] = 0.5 - 0.5 * Math.cos(2 * Math.PI * m / (L - 1));
    cosT = new Float64Array((F_MAX + 1) * L);
    senT = new Float64Array((F_MAX + 1) * L);
    for (var f = 0; f <= F_MAX; f++) {
      for (m = 0; m < L; m++) {
        cosT[f * L + m] = Math.cos(2 * Math.PI * f * m / FS);
        senT[f * L + m] = Math.sin(2 * Math.PI * f * m / FS);
      }
    }
  }

  g.Telas = g.Telas || {};
  g.Telas.exp1 = {
    iniciar: function (s) {
      sec = s;
      var R = g.RESULTADOS_COLAB && g.RESULTADOS_COLAB.exp1;
      if (R && R.mu) MU = R.mu;
      ecg = S.ecg();
      volta = S.pontoDeVolta(ecg);
      // Potência do ECG no trecho inteiro (o SNR "antes" fica perto do Colab).
      pEcg = 0;
      for (var i = 0; i < ecg.length; i++) pEcg += ecg[i] * ecg[i];
      pEcg /= ecg.length;
      adaline = new A.Neuronio(MU);
      saida = new Float64Array(JANELA_MEDIDA);
      limpo = new Float64Array(JANELA_MEDIDA);

      el.estado = sec.querySelector('#exp1-estado');
      el.ligar = sec.querySelector('#exp1-ligar');
      el.ligarTxt = sec.querySelector('#exp1-ligar-txt');
      el.snr = sec.querySelector('#exp1-snr');
      el.snrBarra = sec.querySelector('#exp1-snr-barra');
      if (R) {
        sec.querySelector('#exp1-colab').textContent =
          'no Colab: ' + S.fmt(R.snr_antes_db, 1) + ' → ' + S.fmt(R.snr_depois_db, 1) + ' dB';
      }

      montarPesos();
      montarEspectro();

      monitor = new S.Monitor({
        svg: sec.querySelector('#exp1-monitor'),
        caixa: { x: 16, y: 12, w: 706, h: 184 },
        janela: 1.6,
        velocidade: VELOCIDADE,
        lo: -0.85,
        hi: 1.85,
        gerar: gerar,
        tipos: {
          sujo: { cor: LARANJA, largura: 3 },
          limpo: { cor: TINTA, largura: 3.5 }
        }
      });

      el.ligar.addEventListener('click', function () { ligar(!ligado); });
      sec.querySelector('#exp1-recomecar').addEventListener('click', function () { recomecar(1); });
    },
    entrar: function (s, p) {
      recomecar(p);
      monitor.iniciar();
      ultimoN = -1;
      if (!laco) laco = requestAnimationFrame(lacoPaineis);
    },
    passo: function (s, p, anterior) {
      if (!anterior) return;                    // já tratado em entrar
      if (p >= 2 && anterior < 2) ligar(true);  // a seta também liga o Adaline
      else if (p < 2 && anterior >= 2) recomecar(1);
    },
    sair: function () {
      monitor.parar();
      pararLaco();
    },
    reiniciar: function (s, p) {
      recomecar(p);
    }
  };
})(window);

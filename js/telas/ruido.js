/* Tela 3: O problema, a interferência de 60 Hz.
 * Passo 1: o ECG limpo (registro 100) e o ruído da rede em faixas separadas.
 * Passo 2: as duas ondas descem/sobem e viram uma só (ECG + ruído);
 *          aparece o botão "com ruído / sem ruído".
 * Passo 3: lupa na onda P: com ruído ela some.
 * Passo 4: a pergunta que guia o resto.
 *
 * O ruído é o mesmo do Colab (0,5 mV, 60 Hz, fase 0,8 rad). Só para o desenho
 * ficar liso, o sinal é calculado em tempo contínuo: o ECG é interpolado entre
 * as amostras de 360 Hz e a senoide é calculada no instante exato.
 */
(function (g) {
  'use strict';

  var S = g.Sinais;
  var FS = S.FS;
  var TINTA = [17, 17, 17], LARANJA = [255, 107, 61];

  /* Gráfico principal: 1,8 s a partir de 1,39 s (dois batimentos inteiros). */
  var P_T0 = 1.39, P_DUR = 1.8, P_W = 900, P_K = 62;  // K: px por mV
  var Y_ECG = 88, Y_RUIDO = 148, Y_JUNTO = 118;        // linha do zero de cada faixa
  /* Posição do SVG principal na tela (cartão em 56,172 + borda + deslocamento). */
  var P_ESQ = 56 + 3 + 236, P_TOPO = 172 + 3 + 13;

  /* Lupa: a onda P do primeiro batimento. */
  var T_ONDA_P = 1.69;
  var Z_T0 = 1.50, Z_DUR = 0.285, Z_W = 578, Z_H = 170;
  var Z_LO = -0.6, Z_HI = 0.66;
  var Z_P_DE = 1.62, Z_P_ATE = 1.765;                  // trecho da onda P
  var ZOOM_TOPO = 412;                                 // topo do cartão da lupa

  var DUR_JUNTAR = 1400, DUR_ALTERNAR = 250;           // ms

  var ecg, el = {};
  var alfa = 0, beta = 1;        // alfa: 0 separadas → 1 juntas; beta: ganho do ruído
  var anim = null;

  /* ---------- Sinal em tempo contínuo ---------- */

  function ecgEm(t) {
    var u = t * FS, i = Math.floor(u), f = u - i;
    return ecg[i] * (1 - f) + ecg[i + 1] * f;
  }
  function ruidoEm(t) {
    return S.A_RUIDO * Math.sin(2 * Math.PI * 60 * t + S.FASE_RUIDO);
  }

  function lerp(a, b, u) { return a + (b - a) * u; }
  function cor(u) {
    return 'rgb(' + TINTA.map(function (c, i) { return Math.round(lerp(c, LARANJA[i], u)); }).join(',') + ')';
  }

  /* ---------- Desenho ---------- */

  function trilha(t0, dur, w, f) {
    var n = w * 2, s = '';
    for (var i = 0; i <= n; i++) {
      var t = t0 + dur * i / n;
      s += (i ? 'L' : 'M') + (w * i / n).toFixed(1) + ' ' + f(t).toFixed(1);
    }
    return s;
  }

  function desenhar() {
    var m = alfa * beta;
    var yE = lerp(Y_ECG, Y_JUNTO, alfa), yR = lerp(Y_RUIDO, Y_JUNTO, alfa);

    el.ecg.setAttribute('d', trilha(P_T0, P_DUR, P_W, function (t) {
      return yE - (ecgEm(t) + m * ruidoEm(t)) * P_K;
    }));
    el.ecg.setAttribute('stroke', cor(m));
    el.ruido.setAttribute('d', trilha(P_T0, P_DUR, P_W, function (t) {
      return yR - beta * ruidoEm(t) * P_K;
    }));
    el.ruido.setAttribute('opacity', (1 - alfa).toFixed(3));

    // Etiquetas: as duas de cima somem e a do sinal junto aparece.
    var sep = Math.max(0, 1 - 2 * alfa), jun = Math.max(0, 2 * alfa - 1);
    el.eEcg.style.opacity = el.eRuido.style.opacity = el.mais.style.opacity = sep;
    el.eJunto.style.opacity = jun;

    // Lupa: a mesma soma, ampliada.
    var kz = Z_H / (Z_HI - Z_LO);
    el.zoom.setAttribute('d', trilha(Z_T0, Z_DUR, Z_W, function (t) {
      return (Z_HI - (ecgEm(t) + beta * ruidoEm(t))) * kz;
    }));
    el.zoom.setAttribute('stroke', cor(beta));
  }

  /* Textos que dependem de "com ruído / sem ruído". */
  function rotular(com) {
    el.btnCom.setAttribute('aria-pressed', com ? 'true' : 'false');
    el.btnSem.setAttribute('aria-pressed', com ? 'false' : 'true');
    el.juntoTxt.textContent = com ? 'ECG + ruído' : 'ECG limpo';
    el.juntoBolinha.className = 'bolinha ' + (com ? 'laranja' : 'tinta');
    el.zoomCab.textContent = com ? 'Lupa na onda P: com ruído, ela some' : 'Lupa na onda P: sem ruído, ela aparece';
    el.zoomCab.className = 'faixa ' + (com ? 'laranja' : 'branca');
  }

  /* ---------- Animação (alfa e beta) ---------- */

  function suave(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }

  function animar(alvoAlfa, alvoBeta, dur) {
    if (anim) cancelAnimationFrame(anim.id);
    anim = null;
    if (S.movimentoReduzido() || !dur) {
      alfa = alvoAlfa; beta = alvoBeta; desenhar();
      return;
    }
    var a0 = alfa, b0 = beta, ini = null;
    function quadro(t) {
      if (ini == null) ini = t;
      var u = Math.min(1, (t - ini) / dur), e = suave(u);
      alfa = lerp(a0, alvoAlfa, e);
      beta = lerp(b0, alvoBeta, e);
      desenhar();
      anim = u < 1 ? { id: requestAnimationFrame(quadro) } : null;
    }
    anim = { id: requestAnimationFrame(quadro) };
  }

  function parar() {
    if (anim) cancelAnimationFrame(anim.id);
    anim = null;
  }

  /* Volta ao começo do passo p (separadas, com ruído) e anima até ele. */
  function recomecar(p, animarJuntar) {
    parar();
    alfa = 0; beta = 1;
    rotular(true);
    if (p >= 2) {
      if (animarJuntar) animar(1, 1, DUR_JUNTAR);
      else { alfa = 1; desenhar(); }
    } else {
      desenhar();
    }
  }

  /* ---------- Montagem ---------- */

  function montarLupa(sec) {
    // Faixa amarela sobre o trecho da onda P, atrás do sinal.
    var x0 = (Z_P_DE - Z_T0) / Z_DUR * Z_W, x1 = (Z_P_ATE - Z_T0) / Z_DUR * Z_W;
    S.el('rect', {
      x: x0.toFixed(1), y: 0, width: (x1 - x0).toFixed(1), height: Z_H,
      rx: 6, fill: '#ffd23f', opacity: 0.5
    }, el.zoomSvg);
    el.zoom = S.el('path', {
      fill: 'none', 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, el.zoomSvg);

    // Aro sobre a onda P do gráfico principal e cabo até o cartão da lupa.
    var cx = P_ESQ + (T_ONDA_P - P_T0) / P_DUR * P_W;
    var cy = P_TOPO + Y_JUNTO - 0.07 * P_K;
    var r = 36;
    var aro = sec.querySelector('#ruido-lupa-aro');
    aro.setAttribute('cx', cx.toFixed(1));
    aro.setAttribute('cy', cy.toFixed(1));
    aro.setAttribute('r', r);
    sec.querySelector('#ruido-lupa-cabo').setAttribute('d',
      'M' + cx.toFixed(1) + ' ' + (cy + r).toFixed(1) + ' L' + cx.toFixed(1) + ' ' + ZOOM_TOPO);
  }

  g.Telas = g.Telas || {};
  g.Telas.ruido = {
    iniciar: function (sec) {
      ecg = S.ecg();
      var svg = sec.querySelector('#ruido-principal');
      el.ruido = S.el('path', {
        fill: 'none', stroke: '#ff6b3d', 'stroke-width': 3, 'stroke-linejoin': 'round'
      }, svg);
      el.ecg = S.el('path', {
        fill: 'none', 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
      }, svg);
      el.eEcg = sec.querySelector('.e-ecg');
      el.eRuido = sec.querySelector('.e-ruido');
      el.mais = sec.querySelector('.mais');
      el.eJunto = sec.querySelector('.e-junto');
      el.juntoTxt = sec.querySelector('#ruido-junto-txt');
      el.juntoBolinha = sec.querySelector('#ruido-junto-bolinha');
      el.zoomSvg = sec.querySelector('#ruido-zoom');
      el.zoomCab = sec.querySelector('#ruido-zoom-cab');
      el.btnCom = sec.querySelector('#ruido-com');
      el.btnSem = sec.querySelector('#ruido-sem');
      montarLupa(sec);

      el.btnCom.addEventListener('click', function () {
        rotular(true);
        animar(alfa < 1 ? 1 : alfa, 1, DUR_ALTERNAR);
      });
      el.btnSem.addEventListener('click', function () {
        rotular(false);
        animar(alfa < 1 ? 1 : alfa, 0, DUR_ALTERNAR);
      });
    },
    entrar: function (sec, p) {
      recomecar(p, false);
    },
    passo: function (sec, p, anterior) {
      if (!anterior) return;                       // já tratado em entrar
      if (p >= 2 && anterior < 2) animar(1, beta, DUR_JUNTAR);
      else if (p < 2) recomecar(1, false);         // voltou ao passo 1: separa de novo
    },
    sair: function () {
      parar();
    },
    reiniciar: function (sec, p) {
      recomecar(p, true);
    }
  };
})(window);

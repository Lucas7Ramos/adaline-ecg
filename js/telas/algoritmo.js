/* Tela 9: O algoritmo passo a passo.
 *
 * O Adaline/LMS de verdade (Adaline.Neuronio, µ = 0,01 como no experimento 1)
 * sobre d = ECG do registro 100 + ruído fixo de 60 Hz. Os pesos começam em zero.
 *
 * "Próxima amostra": processa uma amostra e percorre as 4 linhas do loop,
 *                    acendendo cada linha e mostrando o valor que ela produz.
 * "Acelerar":        roda as amostras seguidas até 2 s de sinal; o gráfico
 *                    mostra os pesos subindo e se estabilizando no valor certo.
 * "Recomeçar" ou R:  pesos em zero, amostra 0.
 */
(function (g) {
  'use strict';

  var S = g.Sinais, A = g.Adaline;
  var FS = S.FS;

  var MU = 0.01;
  var JANELA = 2 * FS;          // amostras no gráfico (2 s)
  var MS_POR_LINHA = 420;       // ritmo do "próxima amostra"
  var AMOSTRAS_POR_S = 300;     // ritmo do "acelerar"

  var ALVO1 = S.A_RUIDO * Math.sin(S.FASE_RUIDO);
  var ALVO2 = S.A_RUIDO * Math.cos(S.FASE_RUIDO);

  // Gráfico dos pesos (906 × 100).
  var GX0 = 8, GX1 = 880, GY0 = 6, GY1 = 68, WLO = -0.05, WHI = 0.45;
  function gx(k) { return GX0 + (k / JANELA) * (GX1 - GX0); }
  function gy(w) { return GY1 - (Math.max(WLO, Math.min(WHI, w)) - WLO) / (WHI - WLO) * (GY1 - GY0); }

  var el = {};
  var ecg, volta, neuronio, n = 0;
  var hist1 = [], hist2 = [];
  var ultimo = null;            // valores da última amostra processada
  var timers = [], anim = null;

  function f3(v) { return S.fmt(v, 3); }

  /* ---------- Uma amostra ---------- */

  function processar() {
    var f = A.faseFixa(n);
    var x1 = Math.cos(f), x2 = Math.sin(f);
    var d = ecg[n % volta] + S.ruidoFixo(n);
    neuronio.passo(d, x1, x2);
    ultimo = { n: n, x1: x1, x2: x2, d: d, y: neuronio.y, e: neuronio.e, w1: neuronio.w1, w2: neuronio.w2 };
    n++;
    if (hist1.length <= JANELA) {
      hist1.push(gx(n).toFixed(1) + ' ' + gy(neuronio.w1).toFixed(1));
      hist2.push(gx(n).toFixed(1) + ' ' + gy(neuronio.w2).toFixed(1));
    }
  }

  /* ---------- Texto das linhas ---------- */

  function textoLinha(k, v) {
    if (!v) return k === 4 ? 'w<sub>1</sub> = 0<br>w<sub>2</sub> = 0' : '—';
    switch (k) {
      case 1: return 'x<sub>1</sub> = ' + f3(v.x1) + ' · x<sub>2</sub> = ' + f3(v.x2);
      case 2: return 'y = ' + f3(v.y);
      case 3: return 'd = ' + f3(v.d) + ' · e = ' + f3(v.e);
      case 4: return 'w<sub>1</sub> = ' + f3(v.w1) + '<br>w<sub>2</sub> = ' + f3(v.w2);
    }
  }

  function mostrarLinha(k, v, animar) {
    el.vals[k - 1].innerHTML = '<span' + (animar ? ' class="novo"' : '') + '>' + textoLinha(k, v) + '</span>';
  }

  function acender(k) {
    el.linhas.forEach(function (l) { l.classList.toggle('atual', +l.dataset.linha === k); });
  }

  function mostrarContador() {
    el.n.textContent = String(n);
    el.t.textContent = 't = ' + (n ? S.fmt(n / FS, 3) : '0') + ' s de sinal';
  }

  function desenharPesos() {
    el.l1.setAttribute('d', hist1.length ? 'M' + gx(0) + ' ' + gy(0) + 'L' + hist1.join('L') : '');
    el.l2.setAttribute('d', hist2.length ? 'M' + gx(0) + ' ' + gy(0) + 'L' + hist2.join('L') : '');
    el.estavel.classList.toggle('mostrar', n >= JANELA);
  }

  /* ---------- Animações ---------- */

  function limparTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function pararAcelerar() {
    if (anim) cancelAnimationFrame(anim);
    anim = null;
    el.acelerar.classList.remove('ativo');
    el.acelerar.setAttribute('aria-pressed', 'false');
  }

  /* Mostra tudo da última amostra de uma vez (fim de uma animação interrompida). */
  function completar() {
    limparTimers();
    for (var k = 1; k <= 4; k++) mostrarLinha(k, ultimo, false);
  }

  function proximaAmostra() {
    pararAcelerar();
    completar();
    var antes = { w1: neuronio.w1, w2: neuronio.w2 };
    processar();
    mostrarContador();
    desenharPesos();

    if (S.movimentoReduzido()) {
      for (var k = 1; k <= 4; k++) mostrarLinha(k, ultimo, false);
      acender(4);
      return;
    }
    // Apaga os valores da amostra anterior (a linha 4 mostra os pesos de antes
    // da correção) e revela uma linha por vez.
    for (var j = 1; j <= 3; j++) mostrarLinha(j, null, false);
    mostrarLinha(4, antes, false);
    [1, 2, 3, 4].forEach(function (k, i) {
      timers.push(setTimeout(function () {
        acender(k);
        mostrarLinha(k, ultimo, true);
      }, i * MS_POR_LINHA));
    });
  }

  function acelerar() {
    if (anim || n >= JANELA) return;
    completar();
    acender(0);
    el.acelerar.classList.add('ativo');
    el.acelerar.setAttribute('aria-pressed', 'true');

    if (S.movimentoReduzido()) {
      while (n < JANELA) processar();
      atualizarTudo();
      pararAcelerar();
      return;
    }
    var t0 = null, resto = 0;
    function quadro(t) {
      if (t0 != null) {
        resto += Math.min(0.1, (t - t0) / 1000) * AMOSTRAS_POR_S;
        var k = Math.floor(resto);
        resto -= k;
        while (k-- > 0 && n < JANELA) processar();
        atualizarTudo();
      }
      t0 = t;
      if (n < JANELA) anim = requestAnimationFrame(quadro);
      else pararAcelerar();
    }
    anim = requestAnimationFrame(quadro);
  }

  function atualizarTudo() {
    for (var k = 1; k <= 4; k++) mostrarLinha(k, ultimo, false);
    mostrarContador();
    desenharPesos();
  }

  function recomecar() {
    limparTimers();
    pararAcelerar();
    neuronio = new A.Neuronio(MU);
    n = 0;
    ultimo = null;
    hist1 = [];
    hist2 = [];
    acender(0);
    atualizarTudo();
  }

  /* ---------- Gráfico ---------- */

  function montarGrafico(svg) {
    S.el('line', { class: 'eixo', x1: GX0, x2: GX1, y1: gy(0), y2: gy(0) }, svg);
    [ALVO1, ALVO2].forEach(function (a) {
      S.el('line', {
        x1: GX0, x2: GX1, y1: gy(a), y2: gy(a),
        stroke: '#111111', 'stroke-width': 2, 'stroke-dasharray': '8 7'
      }, svg);
    });
    [0, 1, 2].forEach(function (s) {
      var t = S.el('text', { x: gx(s * FS), y: 94, 'text-anchor': s === 0 ? 'start' : s === 2 ? 'end' : 'middle' }, svg);
      t.textContent = s + ' s';
    });
    // w2 mais grossa, por baixo: onde as duas curvas coincidem, w1 fica com borda preta.
    var base = { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    el.l2 = S.el('path', Object.assign({ stroke: '#111111', 'stroke-width': 7 }, base), svg);
    el.l1 = S.el('path', Object.assign({ stroke: '#2b59ff', 'stroke-width': 3.5 }, base), svg);
  }

  g.Telas = g.Telas || {};
  g.Telas.algoritmo = {
    iniciar: function (sec) {
      ecg = S.ecg();
      volta = S.pontoDeVolta(ecg);
      el.linhas = [].slice.call(sec.querySelectorAll('.codigo .linha'));
      el.vals = [1, 2, 3, 4].map(function (k) { return sec.querySelector('#alg-v' + k); });
      el.n = sec.querySelector('#alg-n');
      el.t = sec.querySelector('#alg-t');
      el.estavel = sec.querySelector('#alg-estavel');
      el.acelerar = sec.querySelector('#alg-acelerar');
      montarGrafico(sec.querySelector('#alg-pesos'));

      sec.querySelector('#alg-proxima').addEventListener('click', proximaAmostra);
      el.acelerar.addEventListener('click', acelerar);
      sec.querySelector('#alg-recomecar').addEventListener('click', recomecar);
    },
    entrar: function () {
      recomecar();   // os pesos começam em zero, como no Colab
    },
    sair: function () {
      limparTimers();
      pararAcelerar();
    },
    reiniciar: function () {
      recomecar();
    }
  };
})(window);

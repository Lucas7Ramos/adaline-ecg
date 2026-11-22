/* Tela 4: A ideia de Widrow, d(n) − y(n) = e(n).
 * Os três sinais saem do Adaline rodando de verdade sobre o registro 100
 * com o ruído fixo de 60 Hz (µ = 0,01), num batimento já depois de aprender.
 */
(function (g) {
  'use strict';

  var S = g.Sinais, A = g.Adaline;
  var FS = S.FS;

  function desenhar(svg, x, ini, fim, lo, hi, cor, largura) {
    var w = +svg.getAttribute('width'), h = +svg.getAttribute('height');
    S.el('path', {
      d: S.caminho(x, { x: 12, y: 6, w: w - 24, h: h - 12 }, lo, hi, ini, fim),
      fill: 'none', stroke: cor, 'stroke-width': largura,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, svg);
  }

  g.Telas = g.Telas || {};
  g.Telas.widrow = {
    iniciar: function (sec) {
      var ecg = S.ecg();
      var N = ecg.length;
      var d = new Float64Array(N);
      for (var n = 0; n < N; n++) d[n] = ecg[n] + S.ruidoFixo(n);
      var r = A.filtrar(d, 0.01);

      // Um batimento depois de 4 s (o Adaline já aprendeu): do pico R − 0,25 s a R + 0,4 s.
      var pico = 4 * FS;
      for (var k = 4 * FS; k < 5.2 * FS; k++) if (ecg[k] > ecg[pico]) pico = k;
      var ini = pico - Math.round(0.25 * FS), fim = pico + Math.round(0.4 * FS);

      // A mesma escala nos três cartões, para a subtração ficar literal.
      var lo = Infinity, hi = -Infinity;
      for (var i = ini; i < fim; i++) { lo = Math.min(lo, d[i]); hi = Math.max(hi, d[i]); }
      lo -= 0.05; hi += 0.05;

      desenhar(sec.querySelector('#widrow-d'), d, ini, fim, lo, hi, '#ff6b3d', 3);
      desenhar(sec.querySelector('#widrow-y'), r.y, ini, fim, lo, hi, '#2b59ff', 3);
      desenhar(sec.querySelector('#widrow-e'), r.e, ini, fim, lo, hi, '#111111', 3.5);

      // Referência x(n): o cosseno de 60 Hz, 0,25 s.
      var ref = new Float64Array(Math.round(0.25 * FS));
      for (var j = 0; j < ref.length; j++) ref[j] = Math.cos(A.faseFixa(j));
      var sx = sec.querySelector('#widrow-x');
      S.el('path', {
        d: S.caminho(ref, { x: 2, y: 4, w: 296, h: 36 }, -1.05, 1.05),
        fill: 'none', stroke: '#2b59ff', 'stroke-width': 3, 'stroke-linejoin': 'round'
      }, sx);
    }
    // Sem estado para reiniciar: a tela é estática.
  };
})(window);

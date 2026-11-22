/* Tela 1: Capa.
 * Imagem estática, sem animação: o quadro do ECG dividido ao meio.
 *   Esquerda: o trecho do registro 100 + ruído fixo de 60 Hz (como no experimento 1), em laranja.
 *   Direita:  o mesmo trecho, só o ECG limpo (o sinal original), em preto.
 * As duas metades usam a mesma escala vertical, para a plateia ver que é o mesmo sinal.
 */
(function (g) {
  'use strict';

  var S = g.Sinais;

  // Trecho de dois batimentos inteiros (de 0,63 s a 2,34 s do registro 100).
  var INICIO = Math.round(0.63 * S.FS);
  var FIM = Math.round(2.34 * S.FS);
  var LO = -0.85, HI = 1.85;              // mV, a mesma faixa nas duas metades
  var CAIXA = { x: 14, y: 10, w: 550, h: 126 };

  function desenhar(svg, x, cor) {
    svg.innerHTML = '';
    S.el('path', {
      d: S.caminho(x, CAIXA, LO, HI, INICIO, FIM),
      fill: 'none', stroke: cor, 'stroke-width': 3.5,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, svg);
  }

  g.Telas = g.Telas || {};
  g.Telas.capa = {
    iniciar: function (sec) {
      if (g.CONFIG && g.CONFIG.disciplina) {
        sec.querySelector('#capa-disciplina').textContent = g.CONFIG.disciplina;
      }
      var ecg = S.ecg();
      var sujo = new Float64Array(ecg.length);
      for (var n = 0; n < ecg.length; n++) sujo[n] = ecg[n] + S.ruidoFixo(n);
      desenhar(sec.querySelector('#capa-antes'), sujo, '#ff6b3d');
      desenhar(sec.querySelector('#capa-depois'), ecg, '#111111');
    }
  };
})(window);

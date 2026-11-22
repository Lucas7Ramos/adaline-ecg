/* Tela 16: Perguntas.
 * O ECG limpo correndo, como na capa: é a saída e(n) do Adaline (registro 100 +
 * ruído fixo de 60 Hz, µ = 0,01), já depois de aprender. Antes de mostrar, o
 * filtro roda 3 s de sinal para começar sem ruído.
 */
(function (g) {
  'use strict';

  var S = g.Sinais, A = g.Adaline;
  var FS = S.FS;
  var MU = 0.01, AQUECER = 3 * FS;

  var monitor, adaline, ecg, volta;

  function passo(m) {
    var f = A.faseFixa(m);
    return adaline.passo(ecg[m % volta] + S.ruidoFixo(m), Math.cos(f), Math.sin(f));
  }

  function gerar(n) {
    return { v: passo(n + AQUECER), k: 'limpo' };
  }

  function recomecar() {
    adaline.reiniciar();
    for (var m = 0; m < AQUECER; m++) passo(m);
    monitor.reiniciar();
  }

  g.Telas = g.Telas || {};
  g.Telas.perguntas = {
    iniciar: function (sec) {
      ecg = S.ecg();
      volta = S.pontoDeVolta(ecg);
      adaline = new A.Neuronio(MU);
      if (g.CONFIG && g.CONFIG.disciplina) {
        sec.querySelector('#perguntas-disciplina').textContent = g.CONFIG.disciplina;
      }
      for (var m = 0; m < AQUECER; m++) passo(m);
      monitor = new S.Monitor({
        svg: sec.querySelector('#perguntas-monitor'),
        caixa: { x: 16, y: 14, w: 1130, h: 180 },
        janela: 3,
        // Câmera lenta, como na capa.
        velocidade: 0.5,
        lo: -0.6,
        hi: 1.6,
        gerar: gerar,
        tipos: { limpo: { cor: '#111111', largura: 3.5 } }
      });
    },
    entrar: function () {
      monitor.iniciar();
    },
    sair: function () {
      monitor.parar();
    },
    reiniciar: function () {
      recomecar();
    }
  };
})(window);

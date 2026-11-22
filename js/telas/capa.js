/* Tela 1: Capa.
 * Passo 1: ECG ruidoso correndo (registro 100 + 60 Hz fixo, como no experimento 1).
 * Passo 2: o Adaline liga (pesos em zero, µ = 0,01) e o ruído some ao vivo.
 */
(function (g) {
  'use strict';

  var S = g.Sinais, A = g.Adaline;
  var MU = 0.01;

  var monitor, adaline, ligado = false, ecg, volta, cabecalho;

  /* Ponto de volta do trecho de 10 s, escolhido para a emenda não dar salto. */
  function pontoDeVolta(x) {
    var melhor = x.length, custo = Infinity;
    for (var L = x.length - 360; L < x.length; L++) {
      var c = Math.abs(x[L] - x[0]) + 4 * Math.abs((x[L] - x[L - 1]) - (x[1] - x[0]));
      if (c < custo) { custo = c; melhor = L; }
    }
    return melhor;
  }

  function gerar(n) {
    var limpo = ecg[n % volta];
    var d = limpo + S.ruidoFixo(n);
    if (!ligado) return { v: d, k: 'sujo' };
    var f = A.faseFixa(n);
    return { v: adaline.passo(d, Math.cos(f), Math.sin(f)), k: 'limpo' };
  }

  function mostrarEstado() {
    cabecalho.className = 'faixa ' + (ligado ? 'azul' : 'laranja');
    cabecalho.textContent = ligado
      ? 'Adaline ligado: o ruído some e fica o ECG'
      : 'ECG + ruído de 60 Hz';
  }

  /* Recomeça: janela cheia de sinal ruidoso; no passo 2, liga o Adaline do zero. */
  function recomecar(p) {
    ligado = false;
    adaline.reiniciar();
    monitor.reiniciar();
    ligado = p >= 2;
    mostrarEstado();
    if (S.movimentoReduzido()) monitor.avancar(ligado ? 2.5 : 0);
  }

  g.Telas = g.Telas || {};
  g.Telas.capa = {
    iniciar: function (sec) {
      ecg = S.ecg();
      volta = pontoDeVolta(ecg);
      adaline = new A.Neuronio(MU);
      cabecalho = sec.querySelector('#capa-estado');
      if (g.CONFIG && g.CONFIG.disciplina) {
        sec.querySelector('#capa-disciplina').textContent = g.CONFIG.disciplina;
      }
      monitor = new S.Monitor({
        svg: sec.querySelector('#capa-monitor'),
        caixa: { x: 16, y: 10, w: 1130, h: 128 },
        janela: 2,
        // Câmera lenta: o sinal corre a 35% do tempo real para dar de ver o ruído.
        velocidade: 0.35,
        lo: -0.85,
        hi: 1.85,
        gerar: gerar,
        tipos: {
          sujo: { cor: '#ff6b3d', largura: 3 },
          limpo: { cor: '#111111', largura: 3.5 }
        }
      });
    },
    entrar: function (sec, p) {
      recomecar(p);
      monitor.iniciar();
    },
    passo: function (sec, p, anterior) {
      if (!anterior) return; // já tratado em entrar
      var on = p >= 2;
      if (on && !ligado) adaline.reiniciar();
      ligado = on;
      mostrarEstado();
      if (S.movimentoReduzido()) monitor.avancar(2.5);
    },
    sair: function () {
      monitor.parar();
    },
    reiniciar: function (sec, p) {
      recomecar(p);
    }
  };
})(window);

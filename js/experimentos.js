/* Experimentos: cálculo ao vivo (mesmo modelo do notebook) e números do Colab.
 *
 * Regra: os números grandes e os gráficos de resultado vêm de
 * window.RESULTADOS_COLAB (data/resultados.js). O cálculo ao vivo serve para
 * desenhar os sinais (faixas de erro) e como reserva se o arquivo faltar.
 */
(function (g) {
  'use strict';

  var S = g.Sinais, A = g.Adaline;
  var FS = S.FS;

  var DESVIOS = [0, 0.05, 0.1, 0.2, 0.3, 0.5];
  var QS = [2, 3, 5, 8, 12, 20, 30, 60, 120, 240];
  var MU_EXP3 = 0.02;
  var SEG_EXP3 = 30;           // s de sinal, como no notebook
  var INICIO_SNR = 5 * FS;     // SNR medido de 5 s até o fim

  /* ---------- Experimento 3, ao vivo ---------- */

  var _limpo = null, _modelos = {}, _saidas = {};

  function limpo30() {
    if (!_limpo) _limpo = S.repetir(S.ecg(), SEG_EXP3 * FS);
    return _limpo;
  }

  function modelo(i) {
    if (!_modelos[i]) _modelos[i] = S.modeloExp3(limpo30(), DESVIOS[i]);
    return _modelos[i];
  }

  /* Saída de um método no desvio de índice i.
   *   metodo: 'acompanha' | 'fixa' (Adaline) ou 'notch' (com o Q dado) */
  function exp3Saida(i, metodo, Q) {
    var chave = i + ':' + metodo + ':' + (Q || '');
    if (_saidas[chave]) return _saidas[chave];
    var m = modelo(i), s;
    if (metodo === 'acompanha') s = A.filtrar(m.d, MU_EXP3, m.fase).e;
    else if (metodo === 'fixa') s = A.filtrar(m.d, MU_EXP3).e;
    else s = S.lfilter(S.notchCoef(60, Q, FS), m.d);
    _saidas[chave] = s;
    return s;
  }

  /* Resíduo (saída − ECG) de um método, da amostra ini até fim. */
  function exp3Residuo(i, metodo, Q, ini, fim) {
    var s = exp3Saida(i, metodo, Q), L = limpo30();
    var r = new Float64Array(fim - ini);
    for (var n = ini; n < fim; n++) r[n - ini] = s[n] - L[n];
    return r;
  }

  var _exp3 = null;
  /* Para cada desvio, os SNRs de cada método e o melhor Q. */
  function exp3AoVivo() {
    if (_exp3) return _exp3;
    var L = limpo30();
    var res = DESVIOS.map(function (dv, i) {
      var melhorQ = null, melhorSnr = -Infinity;
      QS.forEach(function (q) {
        var v = S.snrDb(exp3Saida(i, 'notch', q), L, INICIO_SNR);
        if (v > melhorSnr) { melhorSnr = v; melhorQ = q; }
      });
      return {
        desvio: dv,
        snr: {
          acompanha: S.snrDb(exp3Saida(i, 'acompanha'), L, INICIO_SNR),
          fixa: S.snrDb(exp3Saida(i, 'fixa'), L, INICIO_SNR),
          q30: S.snrDb(exp3Saida(i, 'notch', 30), L, INICIO_SNR),
          melhor: melhorSnr
        },
        melhorQ: melhorQ
      };
    });
    _exp3 = { desvios: DESVIOS, porDesvio: res };
    return _exp3;
  }

  /* ---------- Números para a tela (Colab, ou ao vivo como reserva) ---------- */

  /* Experimento 3 no formato das telas:
   * { fonte, desvios, acompanha[], fixa[], q30[], melhor[], melhorQ[] } */
  function exp3Numeros() {
    var C = g.RESULTADOS_COLAB && g.RESULTADOS_COLAB.exp3;
    if (C) {
      return {
        fonte: 'colab',
        desvios: C.desvios_hz,
        acompanha: C.adaline_acompanha_db,
        fixa: C.adaline_fixa_db,
        q30: C.notch_q30_db,
        melhor: C.melhor_notch_db,
        melhorQ: C.melhor_notch_q
      };
    }
    var v = exp3AoVivo();
    function col(k) { return v.porDesvio.map(function (r) { return r.snr[k]; }); }
    return {
      fonte: 'ao vivo',
      desvios: v.desvios,
      acompanha: col('acompanha'),
      fixa: col('fixa'),
      q30: col('q30'),
      melhor: col('melhor'),
      melhorQ: v.porDesvio.map(function (r) { return r.melhorQ; })
    };
  }

  /* Experimento 2 do Colab: { mus[], tempo[], snr[] }, ou null se o arquivo faltar.
   * A faixa do slider da tela 12 é mus[0] … mus[último]. */
  function exp2Numeros() {
    var C = g.RESULTADOS_COLAB && g.RESULTADOS_COLAB.exp2;
    if (!C) return null;
    return { mus: C.mus, tempo: C.tempo_conv_s, snr: C.snr_final_db };
  }

  /* Números derivados que as telas e as notas citam (telas 11, 12, 13 e 14).
   * Tudo sai de RESULTADOS_COLAB; nada escrito à mão. */
  function resumo() {
    var R = g.RESULTADOS_COLAB || {};
    var out = {};

    if (R.exp1) {
      out.exp1 = {
        mu: R.exp1.mu,
        antes: R.exp1.snr_antes_db,
        depois: R.exp1.snr_depois_db,
        ganho: R.exp1.snr_depois_db - R.exp1.snr_antes_db
      };
    }

    var e2 = exp2Numeros();
    if (e2) {
      var n = e2.mus.length, iRap = 0;
      for (var i = 1; i < n; i++) if (e2.tempo[i] < e2.tempo[iRap]) iRap = i;
      out.exp2 = {
        muMin: e2.mus[0],
        muMax: e2.mus[n - 1],
        tempoMuMin: e2.tempo[0],
        snrMuMin: e2.snr[0],
        tempoMuMax: e2.tempo[n - 1],
        snrMuMax: e2.snr[n - 1],
        // O aprendizado mais rápido (nem sempre é o maior µ).
        muRapido: e2.mus[iRap],
        tempoRapido: e2.tempo[iRap],
        snrRapido: e2.snr[iRap],
        perdaRapido: e2.snr[0] - e2.snr[iRap]
      };
      if (out.exp1) {
        var k = e2.mus.indexOf(out.exp1.mu);
        if (k >= 0) out.exp1.tempo = e2.tempo[k];
      }
    }

    var e3 = exp3Numeros(), f = e3.desvios.length - 1;
    out.exp3 = {
      fonte: e3.fonte,
      // Primeiro desvio medido em que o Adaline (referência acompanha) supera o melhor notch.
      virada: primeiroQueVence(e3.desvios, e3.acompanha, e3.melhor),
      adalineEstavel: e3.acompanha[0],
      notchEstavel: e3.melhor[0],
      qEstavel: e3.melhorQ[0],
      qFim: e3.melhorQ[f],
      desvioMax: e3.desvios[f],
      adalineFim: e3.acompanha[f],
      melhorFim: e3.melhor[f],
      fixaFim: e3.fixa[f],
      q30Fim: e3.q30[f]
    };
    return out;
  }

  /* Primeiro desvio medido em que `a` > `b`; null se nunca. */
  function primeiroQueVence(desvios, a, b) {
    for (var i = 0; i < desvios.length; i++) if (a[i] > b[i]) return desvios[i];
    return null;
  }

  /* Desvio (Hz) a partir do qual a curva `a` passa a vencer a `b`,
   * por interpolação linear entre os pontos medidos. null se nunca vence. */
  function virada(desvios, a, b) {
    for (var i = 0; i < desvios.length; i++) {
      var d = a[i] - b[i];
      if (d > 0) {
        if (i === 0) return desvios[0];
        var d0 = a[i - 1] - b[i - 1];
        return desvios[i - 1] + (desvios[i] - desvios[i - 1]) * (-d0 / (d - d0));
      }
    }
    return null;
  }

  g.Experimentos = {
    DESVIOS: DESVIOS,
    QS: QS,
    MU_EXP3: MU_EXP3,
    exp3AoVivo: exp3AoVivo,
    exp3Saida: exp3Saida,
    exp3Residuo: exp3Residuo,
    exp3Numeros: exp3Numeros,
    exp2Numeros: exp2Numeros,
    resumo: resumo,
    virada: virada
  };
})(typeof window !== 'undefined' ? window : globalThis);

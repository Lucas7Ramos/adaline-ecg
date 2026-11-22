/* Adaline / LMS: o mesmo algoritmo do notebook adaline_ecg.ipynb.
 *
 *   x1 = cos(fase), x2 = sen(fase)      referência (fase = 2π·60·n/fs se fixa)
 *   y  = w1·x1 + w2·x2                  ruído estimado
 *   e  = d − y                          erro = ECG limpo (saída do filtro)
 *   w  ← w + 2·µ·e·x                    regra LMS
 *
 * Os pesos começam em zero. Script clássico (sem módulos) para funcionar via file://.
 * Também roda no node (para conferir os números com o Colab).
 */
(function (g) {
  'use strict';

  var FS = 360;      // Hz, registro 100 da MIT-BIH
  var F_REDE = 60;   // Hz

  /* Um neurônio Adaline com duas entradas. */
  function Neuronio(mu) {
    this.mu = mu;
    this.reiniciar();
  }
  Neuronio.prototype.reiniciar = function () {
    this.w1 = 0;
    this.w2 = 0;
    this.y = 0;
    this.e = 0;
  };
  /* Uma amostra: recebe d e a referência (x1, x2); devolve e. */
  Neuronio.prototype.passo = function (d, x1, x2) {
    var y = this.w1 * x1 + this.w2 * x2;
    var e = d - y;
    this.w1 += 2 * this.mu * e * x1;
    this.w2 += 2 * this.mu * e * x2;
    this.y = y;
    this.e = e;
    return e;
  };

  /* Fase da referência fixa em 60 Hz na amostra n. */
  function faseFixa(n) {
    return 2 * Math.PI * F_REDE * n / FS;
  }

  /* Filtra um sinal inteiro.
   *   d:    entrada primária (ECG + ruído)
   *   mu:   taxa de aprendizado
   *   fase: opcional, array com a fase da referência por amostra
   *         (sem ela, a referência é fixa em 60 Hz)
   * Devolve { e, y, w1, w2 } como Float64Array. */
  function filtrar(d, mu, fase) {
    var N = d.length;
    var ad = new Neuronio(mu);
    var e = new Float64Array(N), y = new Float64Array(N);
    var w1 = new Float64Array(N), w2 = new Float64Array(N);
    for (var n = 0; n < N; n++) {
      var f = fase ? fase[n] : faseFixa(n);
      e[n] = ad.passo(d[n], Math.cos(f), Math.sin(f));
      y[n] = ad.y;
      w1[n] = ad.w1;
      w2[n] = ad.w2;
    }
    return { e: e, y: y, w1: w1, w2: w2 };
  }

  g.Adaline = {
    FS: FS,
    F_REDE: F_REDE,
    Neuronio: Neuronio,
    faseFixa: faseFixa,
    filtrar: filtrar
  };
})(typeof window !== 'undefined' ? window : globalThis);

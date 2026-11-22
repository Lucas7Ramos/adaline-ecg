/* Sinais: ECG, ruído da rede, notch, SNR e desenho em SVG.
 *
 * O ECG é o trecho de 10 s do registro 100 exportado do Colab (data/ecg100.js,
 * window.ECG100). O modelo do ruído segue o notebook adaline_ecg.ipynb.
 * Script clássico (sem módulos) para funcionar via file://.
 */
(function (g) {
  'use strict';

  var FS = 360;
  var A_RUIDO = 0.5;      // mV
  var FASE_RUIDO = 0.8;   // rad
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- ECG ---------- */

  var _ecg = null;
  /* ECG limpo do registro 100 (mV, 360 Hz). */
  function ecg() {
    if (_ecg) return _ecg;
    if (!g.ECG100 || !g.ECG100.amostras) {
      throw new Error('data/ecg100.js não foi carregado (window.ECG100).');
    }
    _ecg = Float64Array.from(g.ECG100.amostras);
    return _ecg;
  }

  /* Repete o sinal até ter N amostras. O Colab usa 30 s do registro 100;
   * o site só tem 10 s exportados, então o trecho é repetido. */
  function repetir(x, N) {
    var out = new Float64Array(N);
    for (var n = 0; n < N; n++) out[n] = x[n % x.length];
    return out;
  }

  /* Ponto de volta para repetir o trecho em loop sem salto na emenda
   * (procura no último segundo a amostra que mais se parece com o início). */
  function pontoDeVolta(x) {
    var melhor = x.length, custo = Infinity;
    for (var L = x.length - FS; L < x.length; L++) {
      var c = Math.abs(x[L] - x[0]) + 4 * Math.abs((x[L] - x[L - 1]) - (x[1] - x[0]));
      if (c < custo) { custo = c; melhor = L; }
    }
    return melhor;
  }

  /* Picos R: máximos acima de `limiar` mV, separados por pelo menos 0,3 s. */
  function picosR(x, limiar) {
    var pk = [], lim = limiar == null ? 0.6 : limiar, dist = Math.round(0.3 * FS);
    for (var i = 1; i < x.length - 1; i++) {
      if (x[i] > lim && x[i] >= x[i - 1] && x[i] > x[i + 1] &&
          (!pk.length || i - pk[pk.length - 1] > dist)) pk.push(i);
    }
    return pk;
  }

  /* ---------- Ruído ---------- */

  /* Ruído fixo de 60 Hz na amostra n: A·sen(2π·60·n/fs + 0,8). */
  function ruidoFixo(n) {
    return A_RUIDO * Math.sin(2 * Math.PI * 60 * n / FS + FASE_RUIDO);
  }

  /* Modelo do experimento 3 (igual ao notebook):
   *   f(t)    = 60 + desvio·sen(2π·0,1·t)
   *   fase    = 2π·cumsum(f)/fs
   *   amp(t)  = A·(1 + 0,2·sen(2π·0,1·t))
   *   ruído   = amp(t)·sen(fase + 0,8)
   * Devolve { d, fase, ruido }. */
  function modeloExp3(limpo, desvio) {
    var N = limpo.length;
    var d = new Float64Array(N), fase = new Float64Array(N), ruido = new Float64Array(N);
    var acum = 0;
    for (var n = 0; n < N; n++) {
      var t = n / FS;
      var lento = Math.sin(2 * Math.PI * 0.1 * t);
      acum += 60 + desvio * lento;
      fase[n] = 2 * Math.PI * acum / FS;
      ruido[n] = A_RUIDO * (1 + 0.2 * lento) * Math.sin(fase[n] + FASE_RUIDO);
      d[n] = limpo[n] + ruido[n];
    }
    return { d: d, fase: fase, ruido: ruido };
  }

  /* ---------- Notch (scipy.signal.iirnotch + lfilter) ---------- */

  function notchCoef(f0, Q, fs) {
    var w0 = 2 * Math.PI * f0 / fs;
    var bw = w0 / Q;
    var beta = Math.tan(bw / 2);     // ganho de banda = 1/√2
    var ganho = 1 / (1 + beta);
    var c = Math.cos(w0);
    return {
      b: [ganho, -2 * ganho * c, ganho],
      a: [1, -2 * ganho * c, 2 * ganho - 1]
    };
  }

  /* Filtro IIR de 2ª ordem, causal (forma direta II transposta, como o lfilter). */
  function lfilter(coef, x) {
    var b = coef.b, a = coef.a;
    var N = x.length, y = new Float64Array(N);
    var z1 = 0, z2 = 0;
    for (var n = 0; n < N; n++) {
      var xn = x[n];
      var yn = b[0] * xn + z1;
      z1 = b[1] * xn - a[1] * yn + z2;
      z2 = b[2] * xn - a[2] * yn;
      y[n] = yn;
    }
    return y;
  }

  /* ---------- SNR ---------- */

  /* SNR = 10·log10(Σecg² / Σ(saída − ecg)²), da amostra `inicio` até o fim. */
  function snrDb(saida, limpo, inicio) {
    var ps = 0, pr = 0;
    for (var n = inicio || 0; n < limpo.length; n++) {
      ps += limpo[n] * limpo[n];
      var r = saida[n] - limpo[n];
      pr += r * r;
    }
    return 10 * Math.log10(ps / pr);
  }

  /* ---------- Texto ---------- */

  /* Número em pt-BR, com vírgula decimal e sinal de menos tipográfico. */
  function fmt(v, casas) {
    var s = Math.abs(v).toFixed(casas == null ? 1 : casas).replace('.', ',');
    return (v < 0 && Number(s.replace(',', '.')) !== 0 ? '−' : '') + s;
  }

  /* ---------- SVG ---------- */

  function el(nome, attrs, pai) {
    var e = document.createElementNS(NS, nome);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }

  /* Caminho SVG de x[ini..fim) ocupando a caixa (x0, y0, w, h), com a faixa
   * de valores [lo, hi] (valores fora são cortados). */
  function caminho(x, caixa, lo, hi, ini, fim) {
    ini = ini || 0;
    fim = fim == null ? x.length : fim;
    var n = fim - ini, s = '';
    if (n < 2) return '';
    for (var i = 0; i < n; i++) {
      var v = Math.max(lo, Math.min(hi, x[ini + i]));
      var px = caixa.x + (i / (n - 1)) * caixa.w;
      var py = caixa.y + caixa.h - ((v - lo) / (hi - lo)) * caixa.h;
      s += (i ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
    }
    return s;
  }

  function movimentoReduzido() {
    return g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- Monitor de ECG que rola para a esquerda ----------
   *
   * opcoes:
   *   svg       elemento <svg> onde desenhar
   *   caixa     { x, y, w, h } em px do SVG
   *   janela    segundos visíveis
   *   lo, hi    faixa vertical em mV
   *   gerar     function(n) -> { v: valor, k: tipo }  (tipo escolhe a cor)
   *   tipos     { tipo: { cor, largura } }
   * O monitor chama gerar() para cada nova amostra, a 360 amostras/s.
   */
  function Monitor(op) {
    this.op = op;
    this.N = Math.round(op.janela * FS);
    this.vals = new Float64Array(this.N);
    this.tipos = new Array(this.N);
    this.caminhos = {};
    var self = this;
    Object.keys(op.tipos).forEach(function (k) {
      var t = op.tipos[k];
      self.caminhos[k] = el('path', {
        fill: 'none', stroke: t.cor, 'stroke-width': t.largura,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round'
      }, op.svg);
    });
    this.rodando = false;
    this._quadro = this._quadro.bind(this);
    this.reiniciar();
  }

  Monitor.prototype.reiniciar = function () {
    this.n = 0;
    this.resto = 0;
    // Enche a janela antes de mostrar, para não começar vazio.
    for (var i = 0; i < this.N; i++) this._amostra();
    this.desenhar();
  };

  Monitor.prototype._amostra = function () {
    var r = this.op.gerar(this.n++);
    this.vals.copyWithin(0, 1);
    this.vals[this.N - 1] = r.v;
    this.tipos.shift();
    this.tipos.push(r.k);
  };

  /* Avança `seg` segundos de sinal de uma vez (sem animar). */
  Monitor.prototype.avancar = function (seg) {
    var k = Math.round(seg * FS);
    for (var i = 0; i < k; i++) this._amostra();
    this.desenhar();
  };

  Monitor.prototype.desenhar = function () {
    var op = this.op, N = this.N, c = op.caixa;
    var partes = {};
    var ini = 0;
    // Cada trecho contínuo de um mesmo tipo vira um subcaminho; os trechos
    // vizinhos se tocam (repetem a amostra da emenda) para não deixar buraco.
    for (var i = 1; i <= N; i++) {
      if (i === N || this.tipos[i] !== this.tipos[ini]) {
        var k = this.tipos[ini];
        var fim = Math.min(N, i + 1);
        var s = '';
        for (var j = ini; j < fim; j++) {
          var v = Math.max(op.lo, Math.min(op.hi, this.vals[j]));
          var px = c.x + (j / (N - 1)) * c.w;
          var py = c.y + c.h - ((v - op.lo) / (op.hi - op.lo)) * c.h;
          s += (j === ini ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1);
        }
        partes[k] = (partes[k] || '') + s;
        ini = i;
      }
    }
    for (var t in this.caminhos) this.caminhos[t].setAttribute('d', partes[t] || '');
  };

  Monitor.prototype.iniciar = function () {
    if (this.rodando || movimentoReduzido()) return;
    this.rodando = true;
    this.t0 = null;
    requestAnimationFrame(this._quadro);
  };

  Monitor.prototype.parar = function () {
    this.rodando = false;
  };

  Monitor.prototype._quadro = function (t) {
    if (!this.rodando) return;
    if (this.t0 != null) {
      var dt = Math.min(0.1, (t - this.t0) / 1000);
      this.resto += dt * FS * (this.op.velocidade || 1);
      var k = Math.floor(this.resto);
      this.resto -= k;
      for (var i = 0; i < k; i++) this._amostra();
      if (k) this.desenhar();
    }
    this.t0 = t;
    requestAnimationFrame(this._quadro);
  };

  g.Sinais = {
    FS: FS,
    A_RUIDO: A_RUIDO,
    FASE_RUIDO: FASE_RUIDO,
    ecg: ecg,
    repetir: repetir,
    pontoDeVolta: pontoDeVolta,
    picosR: picosR,
    ruidoFixo: ruidoFixo,
    modeloExp3: modeloExp3,
    notchCoef: notchCoef,
    lfilter: lfilter,
    snrDb: snrDb,
    fmt: fmt,
    el: el,
    caminho: caminho,
    movimentoReduzido: movimentoReduzido,
    Monitor: Monitor
  };
})(typeof window !== 'undefined' ? window : globalThis);

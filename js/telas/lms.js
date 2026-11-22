/* Tela 8: A regra LMS, a "tigela" do erro vista de cima.
 *
 * Curvas de nível: o erro médio J(w) = E[(d − w·x)²] é uma tigela (quadrática)
 * no plano (w1, w2). Calculamos R = E[x·xᵀ] e p = E[d·x] sobre os 10 s do
 * registro 100 + ruído fixo de 60 Hz; o fundo é w* = R⁻¹·p ("pesos corretos").
 *
 * A bolinha é o Adaline/LMS de verdade (Adaline.Neuronio), partindo de (0, 0),
 * em câmera lenta. O Adaline roda em todas as amostras, mas o caminho só ganha
 * um ponto a cada 6 amostras (um ciclo de 60 Hz a 360 Hz): amostra por amostra
 * cada passo gira 60° e o desenho vira hexágonos. A bolinha anda interpolando
 * entre esses pontos. Só o último 1,5 s de caminho fica visível, apagando aos
 * poucos. A descida para sozinha em 6 s de sinal.
 *
 * µ fica fixo em 0,01 (o efeito de µ é mostrado só no experimento 2).
 *
 * Passo 1: tigela + fórmula.  Passo 2: µ = 0,01 e o botão "soltar de novo".  Passo 3: frase final.
 */
(function (g) {
  'use strict';

  var S = g.Sinais, A = g.Adaline;
  var FS = S.FS;

  var VELOCIDADE = 1 / 3;     // fração do tempo real
  var DECIMA = 6;             // amostras por ponto do caminho (um ciclo de 60 Hz)
  var CICLOS_S = FS / DECIMA; // pontos do caminho por segundo de sinal (60)
  var DURACAO = 6;            // s de sinal até a descida parar
  var RASTRO = 1.5;           // s de caminho que ficam visíveis
  var PEDACOS = 10;           // o rastro é desenhado em pedaços, do mais apagado ao mais forte

  var MU = 0.01;

  var RAIOS = [0.1, 0.2, 0.3, 0.4, 0.5];   // curvas de nível (distância equivalente)

  // Geometria do SVG (444 × 368): o quadro do gráfico é quadrado (escala igual
  // nos dois eixos) e os rótulos w1 e w2 ficam fora dele.
  var LADO = 338, X0 = 35, Y0 = 26;
  var WMIN1, WMIN2, K;        // definidos em enquadrar()
  function px(w1) { return X0 + (w1 - WMIN1) * K; }
  function py(w2) { return Y0 + LADO - (w2 - WMIN2) * K; }

  var el = {};
  var ecg, volta, wEst, R;
  var neuronio, n = 0;
  var pontos = [];            // [w1, w2] a cada ciclo; pontos[0] = (0, 0)
  var progresso = 0;          // posição da bolinha, em ciclos (fracionário)
  var anim = null;

  /* ---------- A tigela ---------- */

  function calcularTigela() {
    var N = ecg.length, r11 = 0, r12 = 0, r22 = 0, p1 = 0, p2 = 0;
    for (var k = 0; k < N; k++) {
      var f = A.faseFixa(k), x1 = Math.cos(f), x2 = Math.sin(f);
      var dk = ecg[k] + S.ruidoFixo(k);
      r11 += x1 * x1; r12 += x1 * x2; r22 += x2 * x2;
      p1 += dk * x1; p2 += dk * x2;
    }
    r11 /= N; r12 /= N; r22 /= N; p1 /= N; p2 /= N;
    var det = r11 * r22 - r12 * r12;
    R = [r11, r12, r22];
    wEst = [(r22 * p1 - r12 * p2) / det, (r11 * p2 - r12 * p1) / det];
  }

  /* Pontos (no plano w) da curva de nível J − Jmin = r²/2 (com R = I/2 é um círculo de raio r). */
  function curvaW(r) {
    var L = r * r / 2, out = [];
    for (var i = 0; i <= 96; i++) {
      var a = 2 * Math.PI * i / 96, u1 = Math.cos(a), u2 = Math.sin(a);
      var q = R[0] * u1 * u1 + 2 * R[1] * u1 * u2 + R[2] * u2 * u2;
      var t = Math.sqrt(L / q);
      out.push([wEst[0] + t * u1, wEst[1] + t * u2]);
    }
    return out;
  }

  /* Vista quadrada que cabe a curva de fora inteira e o início (0, 0), com folga. */
  function enquadrar() {
    var c = curvaW(RAIOS[RAIOS.length - 1]).concat([[0, 0]]);
    var a1 = Infinity, b1 = -Infinity, a2 = Infinity, b2 = -Infinity;
    c.forEach(function (p) {
      a1 = Math.min(a1, p[0]); b1 = Math.max(b1, p[0]);
      a2 = Math.min(a2, p[1]); b2 = Math.max(b2, p[1]);
    });
    var folga = 0.035;
    var lado = Math.max(b1 - a1, b2 - a2) + 2 * folga;
    K = LADO / lado;
    WMIN1 = (a1 + b1) / 2 - lado / 2;
    WMIN2 = (a2 + b2) / 2 - lado / 2;
  }

  function caminhoSvg(lista, fechar) {
    return lista.map(function (p, i) {
      return (i ? 'L' : 'M') + px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1);
    }).join('') + (fechar ? 'Z' : '');
  }

  function montar() {
    var svg = el.svg;
    var defs = S.el('defs', {}, svg);
    var clip = S.el('clipPath', { id: 'lms-recorte' }, defs);
    S.el('rect', { x: X0, y: Y0, width: LADO, height: LADO }, clip);

    // Fundo da tigela.
    S.el('circle', {
      cx: px(wEst[0]), cy: py(wEst[1]), r: 0.05 * K,
      fill: '#ffd23f', stroke: '#111111', 'stroke-width': 2.5
    }, svg);
    RAIOS.forEach(function (r) {
      S.el('path', { d: caminhoSvg(curvaW(r), true), fill: 'none', stroke: '#111111', 'stroke-width': 2 }, svg);
    });

    // Eixos w1 = 0 e w2 = 0; os rótulos ficam fora do quadro, na ponta de cada eixo.
    S.el('line', { class: 'eixo', x1: X0, x2: X0 + LADO, y1: py(0), y2: py(0) }, svg);
    S.el('line', { class: 'eixo', x1: px(0), x2: px(0), y1: Y0, y2: Y0 + LADO }, svg);
    rotuloW(X0 + LADO + 8, py(0) + 8, 'start', '1');
    rotuloW(px(0), Y0 - 7, 'middle', '2');

    // Rastro (pedaços com opacidade crescente), início e bolinha.
    var gr = S.el('g', { 'clip-path': 'url(#lms-recorte)' }, svg);
    el.pedacos = [];
    for (var j = 0; j < PEDACOS; j++) {
      el.pedacos.push(S.el('path', {
        fill: 'none', stroke: '#2b59ff', 'stroke-width': 4,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        opacity: ((j + 1) / PEDACOS).toFixed(2)
      }, gr));
    }
    S.el('circle', { cx: px(0), cy: py(0), r: 7, fill: '#ffffff', stroke: '#111111', 'stroke-width': 3 }, svg);
    el.bola = S.el('circle', { r: 11, fill: '#2b59ff', stroke: '#111111', 'stroke-width': 3 }, gr);
  }

  /* "w" com índice. */
  function rotuloW(x, y, ancora, k) {
    var t = S.el('text', { x: x, y: y, 'text-anchor': ancora, style: 'font-size:24px' }, el.svg);
    t.textContent = 'w';
    S.el('tspan', { dy: 6, style: 'font-size:17px' }, t).textContent = k;
  }

  /* ---------- Descida (LMS de verdade) ---------- */

  /* Roda o Adaline até ter o ponto do ciclo c. */
  function garantir(c) {
    while (pontos.length <= c) {
      for (var k = 0; k < DECIMA; k++) {
        var f = A.faseFixa(n);
        neuronio.passo(ecg[n % volta] + S.ruidoFixo(n), Math.cos(f), Math.sin(f));
        n++;
      }
      pontos.push([neuronio.w1, neuronio.w2]);
    }
  }

  /* Posição (no plano w) no ciclo fracionário q. */
  function ponto(q) {
    var i = Math.floor(q), f = q - i;
    garantir(i + 1);
    var a = pontos[i], b = pontos[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  /* Pedaço do caminho entre os ciclos q0 e q1 (fracionários). */
  function trecho(q0, q1) {
    if (q1 <= q0) return '';
    var fimTrecho = ponto(q1);   // garante os pontos até q1
    var lista = [ponto(q0)];
    for (var i = Math.floor(q0) + 1; i < q1; i++) lista.push(pontos[i]);
    lista.push(fimTrecho);
    return caminhoSvg(lista, false);
  }

  function desenhar() {
    var q = progresso, tam = RASTRO * CICLOS_S / PEDACOS;
    for (var j = 0; j < PEDACOS; j++) {
      var q0 = Math.max(0, q - (PEDACOS - j) * tam);
      var q1 = Math.max(0, q - (PEDACOS - j - 1) * tam);
      el.pedacos[j].setAttribute('d', trecho(q0, q1));
    }
    var w = ponto(q);
    el.bola.setAttribute('cx', px(w[0]).toFixed(1));
    el.bola.setAttribute('cy', py(w[1]).toFixed(1));
    el.estado.innerHTML = 't = ' + S.fmt(q / CICLOS_S, 2) + ' s · w<sub>1</sub> = ' + S.fmt(w[0], 2) +
      ' · w<sub>2</sub> = ' + S.fmt(w[1], 2);
  }

  function parar() {
    if (anim) cancelAnimationFrame(anim);
    anim = null;
  }

  function soltar() {
    parar();
    neuronio = new A.Neuronio(MU);
    n = 0;
    pontos = [[0, 0]];
    var fim = DURACAO * CICLOS_S;

    if (S.movimentoReduzido()) {
      progresso = fim;      // só o estado final
      desenhar();
      return;
    }
    progresso = 0;
    desenhar();
    var t0 = null;
    function quadro(t) {
      if (t0 != null) {
        progresso = Math.min(fim, progresso + Math.min(0.1, (t - t0) / 1000) * VELOCIDADE * CICLOS_S);
        desenhar();
      }
      t0 = t;
      anim = progresso < fim ? requestAnimationFrame(quadro) : null;
    }
    anim = requestAnimationFrame(quadro);
  }

  g.Telas = g.Telas || {};
  g.Telas.lms = {
    iniciar: function (sec) {
      ecg = S.ecg();
      volta = S.pontoDeVolta(ecg);

      el.svg = sec.querySelector('#lms-tigela');
      el.estado = sec.querySelector('#lms-estado');

      calcularTigela();
      enquadrar();
      montar();

      sec.querySelector('#lms-soltar').addEventListener('click', soltar);
    },
    entrar: function () {
      soltar();
    },
    sair: function () {
      parar();
    },
    reiniciar: function () {
      soltar();
    }
  };
})(window);

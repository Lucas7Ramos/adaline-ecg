/* Tela 6: Por que seno e cosseno?
 *
 * O ruído da rede é A·sen(ωn + φ) (Sinais.ruidoFixo). Como
 *   A·sen(ωn + φ) = A·sen φ · cos(ωn) + A·cos φ · sen(ωn),
 * a cópia w1·cos + w2·sen encaixa no ruído com w1 = A·sen φ e w2 = A·cos φ.
 * Os dois pesos são os dois "botões": juntos dão qualquer amplitude e fase.
 *
 * Sliders: o apresentador gira w1 e w2 na mão.
 * "Deixar o Adaline fazer": roda o Adaline/LMS de verdade (µ = 0,01, como no
 * experimento 1) sobre d = ECG do registro 100 + ruído, a partir dos pesos
 * atuais, em câmera lenta. Os sliders seguem os pesos amostra a amostra.
 * Medidor: e² médio que sobra (ruído − cópia), em % da potência do ruído.
 */
(function (g) {
  'use strict';

  var S = g.Sinais, A = g.Adaline;
  var FS = S.FS;
  var OMEGA = 2 * Math.PI * A.F_REDE;     // rad/s

  var MU = 0.01;
  var VELOCIDADE = 0.4;    // fração do tempo real na animação do botão
  var DURACAO = 1.0;       // s de sinal que o botão processa (aprende em ~0,6 s)
  var W_MIN = -0.5, W_MAX = 0.5;
  var LIMIAR_ENCAIXE = 1;  // % abaixo do qual aparece "encaixou"

  var ALVO1 = S.A_RUIDO * Math.sin(S.FASE_RUIDO);
  var ALVO2 = S.A_RUIDO * Math.cos(S.FASE_RUIDO);

  // Gráfico principal: 4 ciclos de 60 Hz.
  var P_W = 1124, P_H = 160, P_K = 100, CICLOS = 4;
  // Miniaturas dos componentes: 2 ciclos.
  var M_W = 294, M_H = 64, M_K = 52, M_CICLOS = 2;

  var el = {};
  var w1 = 0, w2 = 0;
  var ecg, volta, neuronio, n = 0;
  var anim = null;

  /* ---------- Desenho ---------- */

  /* Caminho de f(t) para t em [0, ciclos/60), centrado na altura h/2. */
  function onda(f, w, h, k, ciclos) {
    var pontos = Math.round(w / 2), s = '';
    for (var i = 0; i <= pontos; i++) {
      var t = (ciclos / A.F_REDE) * i / pontos;
      var y = h / 2 - f(t) * k;
      s += (i ? 'L' : 'M') + (w * i / pontos).toFixed(1) + ' ' + y.toFixed(1);
    }
    return s;
  }

  function ruidoEm(t) { return S.A_RUIDO * Math.sin(OMEGA * t + S.FASE_RUIDO); }

  function linha(svg, attrs) {
    var a = { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    for (var k in attrs) a[k] = attrs[k];
    return S.el('path', a, svg);
  }

  function zero(svg, w, h) {
    S.el('line', {
      x1: 0, x2: w, y1: h / 2, y2: h / 2,
      stroke: '#111111', 'stroke-width': 2, 'stroke-dasharray': '6 8'
    }, svg);
  }

  function montar(sec) {
    var svg = sec.querySelector('#seno-ondas');
    zero(svg, P_W, P_H);
    linha(svg, { d: onda(ruidoEm, P_W, P_H, P_K, CICLOS), stroke: '#ff6b3d', 'stroke-width': 11 });
    el.copia = linha(svg, { stroke: '#2b59ff', 'stroke-width': 4 });

    el.minis = [1, 2].map(function (k) {
      var m = sec.querySelector('#seno-c' + k + ' svg');
      zero(m, M_W, M_H);
      return linha(m, { stroke: '#2b59ff', 'stroke-width': 3.5 });
    });
  }

  /* e² médio que sobra, em % da potência do ruído (média sobre um período). */
  function erroPct() {
    var a = ALVO1 - w1, b = ALVO2 - w2;
    return 100 * (a * a + b * b) / (S.A_RUIDO * S.A_RUIDO);
  }

  function mostrarSlider(input, txt, w) {
    input.value = w.toFixed(2);
    var pct = (Math.max(W_MIN, Math.min(W_MAX, w)) - W_MIN) / (W_MAX - W_MIN) * 100;
    input.style.setProperty('--a', Math.min(50, pct) + '%');
    input.style.setProperty('--b', Math.max(50, pct) + '%');
    txt.textContent = (w > 0.004 ? '+' : '') + S.fmt(w, 2);
  }

  function atualizar() {
    mostrarSlider(el.s1, el.t1, w1);
    mostrarSlider(el.s2, el.t2, w2);

    el.copia.setAttribute('d', onda(function (t) {
      return w1 * Math.cos(OMEGA * t) + w2 * Math.sin(OMEGA * t);
    }, P_W, P_H, P_K, CICLOS));
    el.minis[0].setAttribute('d', onda(function (t) { return w1 * Math.cos(OMEGA * t); }, M_W, M_H, M_K, M_CICLOS));
    el.minis[1].setAttribute('d', onda(function (t) { return w2 * Math.sin(OMEGA * t); }, M_W, M_H, M_K, M_CICLOS));

    var e = erroPct();
    el.erro.textContent = S.fmt(e, e < 9.95 ? 1 : 0);
    el.barra.style.width = Math.min(100, e) + '%';
    el.encaixou.classList.toggle('mostrar', e < LIMIAR_ENCAIXE);
  }

  /* ---------- "Deixar o Adaline fazer": o LMS de verdade ---------- */

  function amostra() {
    var f = A.faseFixa(n);
    var d = ecg[n % volta] + S.ruidoFixo(n);
    neuronio.passo(d, Math.cos(f), Math.sin(f));
    n++;
  }

  function parar() {
    if (anim) cancelAnimationFrame(anim.id);
    anim = null;
  }

  function deixarOAdalineFazer() {
    parar();
    neuronio.reiniciar();
    neuronio.w1 = w1;           // continua de onde o apresentador deixou os sliders
    neuronio.w2 = w2;
    var restam = Math.round(DURACAO * FS);

    if (S.movimentoReduzido()) {
      while (restam-- > 0) amostra();
      w1 = neuronio.w1; w2 = neuronio.w2;
      atualizar();
      return;
    }

    var t0 = null, resto = 0;
    function quadro(t) {
      if (t0 != null) {
        resto += Math.min(0.1, (t - t0) / 1000) * FS * VELOCIDADE;
        var k = Math.min(restam, Math.floor(resto));
        resto -= k;
        restam -= k;
        while (k-- > 0) amostra();
        w1 = neuronio.w1; w2 = neuronio.w2;
        atualizar();
      }
      t0 = t;
      if (restam > 0) anim = { id: requestAnimationFrame(quadro) };
      else parar();
    }
    anim = { id: requestAnimationFrame(quadro) };
  }

  function zerar() {
    parar();
    w1 = 0; w2 = 0; n = 0;
    atualizar();
  }

  g.Telas = g.Telas || {};
  g.Telas['seno-cosseno'] = {
    iniciar: function (sec) {
      ecg = S.ecg();
      volta = S.pontoDeVolta(ecg);
      neuronio = new A.Neuronio(MU);
      el.s1 = sec.querySelector('#seno-w1');
      el.s2 = sec.querySelector('#seno-w2');
      el.t1 = sec.querySelector('#seno-w1-txt');
      el.t2 = sec.querySelector('#seno-w2-txt');
      el.erro = sec.querySelector('#seno-erro');
      el.barra = sec.querySelector('#seno-barra');
      el.encaixou = sec.querySelector('#seno-encaixou');
      el.auto = sec.querySelector('#seno-auto');
      montar(sec);

      // Mexer num slider tira o controle do Adaline.
      el.s1.addEventListener('input', function () { parar(); w1 = +el.s1.value; atualizar(); });
      el.s2.addEventListener('input', function () { parar(); w2 = +el.s2.value; atualizar(); });
      el.auto.addEventListener('click', deixarOAdalineFazer);
      sec.querySelector('#seno-zerar').addEventListener('click', zerar);
    },
    entrar: function () {
      zerar();   // os pesos começam em zero, como no Colab
    },
    sair: function () {
      parar();
    },
    reiniciar: function () {
      zerar();
    }
  };
})(window);

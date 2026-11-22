/* Navegação: escala 16:9, telas, passos da seta, teclas, índice e endereço.
 *
 * Teclas:  → espaço PageDown  avança (primeiro os passos, depois a tela)
 *          ← PageUp           volta
 *          Home / End         primeira / última tela da sequência principal
 *          M                  índice          F  tela cheia
 *          R                  reinicia a demo
 *          Esc                fecha o índice
 * Clique nas bordas laterais: volta (esquerda) ou avança (direita).
 * Endereço: #widrow abre a tela; #exp3/2 abre no passo 2.
 *
 * Cada tela com demo registra um módulo em window.Telas[id] com, opcionalmente:
 *   iniciar(sec)            uma vez, na primeira visita
 *   entrar(sec, passo)      ao chegar na tela
 *   passo(sec, p, anterior) a cada mudança de passo (também logo após entrar)
 *   sair(sec)               ao sair (pare animações aqui)
 *   reiniciar(sec, passo)   tecla R
 */
(function () {
  'use strict';

  var W = 1280, H = 720;
  var BLOCOS = ['Motivação', 'Formulação em IA', 'Algoritmo', 'Experimentos', 'Análise dos resultados'];
  var GRUPOS = [
    { id: 'abertura', nome: 'Abertura' },
    { id: 'b1', nome: '1 · Motivação' },
    { id: 'b2', nome: '2 · Formulação em IA' },
    { id: 'b3', nome: '3 · Algoritmo' },
    { id: 'b4', nome: '4 · Experimentos' },
    { id: 'b5', nome: '5 · Análise' },
    { id: 'fim', nome: 'Fim' }
  ];
  // Colunas do índice (grupos em cada coluna).
  var COLUNAS = [['abertura', 'b1', 'b2'], ['b3', 'b4'], ['b5', 'fim']];

  var palco = document.getElementById('palco');
  var telas = Array.prototype.slice.call(document.querySelectorAll('.tela'));
  var indicador = document.getElementById('indicador');
  var indicadorRotulo = document.getElementById('indicador-rotulo');
  var indicadorPontos = document.getElementById('indicador-pontos');
  var numeroTela = document.getElementById('numero-tela');
  var indice = document.getElementById('indice');

  // Sequência principal: todas as telas (a última é a de perguntas).
  var ultimaPrincipal = telas.length - 1;
  var totalPrincipal = telas.filter(function (t) { return /^\d+$/.test(t.dataset.num || ''); }).length + 2;

  var atual = -1, passoAtual = 1, escala = 1;
  var iniciadas = {};

  function modulo(sec) {
    return (window.Telas && window.Telas[sec.dataset.id]) || null;
  }
  function chamar(sec, nome) {
    var m = modulo(sec);
    if (!m || typeof m[nome] !== 'function') return;
    try {
      return m[nome].apply(m, [sec].concat([].slice.call(arguments, 2)));
    } catch (err) {
      console.error('Tela ' + sec.dataset.id + ', ' + nome + ':', err);
    }
  }
  function totalPassos(sec) {
    return Math.max(1, parseInt(sec.dataset.passos, 10) || 1);
  }

  /* ---------- Escala ---------- */

  function escalar() {
    escala = Math.min(window.innerWidth / W, window.innerHeight / H);
    palco.style.transform = 'translate(-50%, -50%) scale(' + escala + ')';
  }

  /* ---------- Telas e passos ---------- */

  function aplicarPasso(sec, p) {
    var els = sec.querySelectorAll('[data-passo]');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.toggle('visivel', parseInt(els[i].dataset.passo, 10) <= p);
    }
  }

  function ir(i, p) {
    i = Math.max(0, Math.min(telas.length - 1, i));
    var sec = telas[i];
    p = Math.max(1, Math.min(totalPassos(sec), p || 1));

    if (i !== atual) {
      if (atual >= 0) {
        telas[atual].classList.remove('atual');
        chamar(telas[atual], 'sair');
      }
      if (!iniciadas[sec.dataset.id]) {
        iniciadas[sec.dataset.id] = true;
        chamar(sec, 'iniciar');
      }
      // Ao chegar, mostra os passos já revelados sem animação.
      sec.classList.add('sem-transicao');
      aplicarPasso(sec, p);
      sec.classList.add('atual');
      void sec.offsetWidth;
      sec.classList.remove('sem-transicao');
      atual = i;
      passoAtual = p;
      chamar(sec, 'entrar', p);
      chamar(sec, 'passo', p, 0);
      atualizarFixos(sec);
    } else if (p !== passoAtual) {
      var anterior = passoAtual;
      aplicarPasso(sec, p);
      passoAtual = p;
      chamar(sec, 'passo', p, anterior);
    }
    atualizarEndereco();
  }

  function avancar() {
    var sec = telas[atual];
    if (passoAtual < totalPassos(sec)) ir(atual, passoAtual + 1);
    else if (atual < telas.length - 1) ir(atual + 1, 1);
  }

  function voltar() {
    if (passoAtual > 1) ir(atual, passoAtual - 1);
    else if (atual > 0) ir(atual - 1, totalPassos(telas[atual - 1])); // volta com a tela completa
  }

  function reiniciar() {
    chamar(telas[atual], 'reiniciar', passoAtual);
  }

  /* ---------- Indicador de bloco e número ---------- */

  function atualizarFixos(sec) {
    var b = parseInt(sec.dataset.bloco, 10);
    if (b >= 1 && b <= 5) {
      indicador.hidden = false;
      indicadorRotulo.textContent = sec.dataset.etiqueta || BLOCOS[b - 1];
      indicadorPontos.innerHTML = '';
      for (var j = 1; j <= 5; j++) {
        var s = document.createElement('span');
        s.className = 'ponto' + (j < b ? ' passado' : j === b ? ' atual' : '');
        indicadorPontos.appendChild(s);
      }
      indicador.setAttribute('aria-label', 'Bloco ' + b + ' de 5: ' + BLOCOS[b - 1]);
    } else {
      indicador.hidden = true;
    }
    var n = sec.dataset.num || '';
    numeroTela.hidden = !n;
    numeroTela.textContent = /^\d+$/.test(n) ? n + ' / ' + totalPrincipal : n;
  }

  /* ---------- Endereço (#id ou #id/passo) ---------- */

  function atualizarEndereco() {
    var h = '#' + telas[atual].dataset.id + (passoAtual > 1 ? '/' + passoAtual : '');
    if (location.hash === h) return;
    try { history.replaceState(null, '', h); } catch (e) { location.hash = h; }
  }

  function lerEndereco() {
    var m = (location.hash || '').replace(/^#/, '').split('/');
    var id = decodeURIComponent(m[0] || '');
    for (var i = 0; i < telas.length; i++) {
      if (telas[i].dataset.id === id) return { i: i, p: parseInt(m[1], 10) || 1 };
    }
    return { i: 0, p: 1 };
  }

  /* ---------- Índice (M) ---------- */

  function montarIndice() {
    var html = '<h2>Índice</h2><div class="dica">clique numa tela · M ou Esc fecha</div><div class="colunas">';
    COLUNAS.forEach(function (col) {
      html += '<div>';
      col.forEach(function (gid) {
        var g = GRUPOS.filter(function (x) { return x.id === gid; })[0];
        html += '<div class="grupo"><h3>' + g.nome + '</h3>';
        telas.forEach(function (t, i) {
          if (t.dataset.grupo !== gid) return;
          var n = t.dataset.num || (gid === 'abertura' ? '1' : gid === 'fim' ? '16' : '');
          html += '<button type="button" class="item" data-ir="' + i + '"><span class="n">' + n +
            '</span><span>' + t.dataset.titulo + '</span></button>';
        });
        html += '</div>';
      });
      html += '</div>';
    });
    indice.innerHTML = html + '</div>';
  }

  function abrirIndice() {
    var itens = indice.querySelectorAll('.item');
    for (var i = 0; i < itens.length; i++) {
      itens[i].classList.toggle('atual', parseInt(itens[i].dataset.ir, 10) === atual);
    }
    indice.hidden = false;
  }

  function fecharIndice() { indice.hidden = true; }

  indice.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ir]');
    if (!b) return;
    fecharIndice();
    ir(parseInt(b.dataset.ir, 10), 1);
  });

  /* ---------- Tela cheia (F) ---------- */

  function alternarTelaCheia() {
    var d = document;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      var el = d.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    }
  }

  /* ---------- Teclado ---------- */

  function campoComSetas(el) {
    return el && el.tagName === 'INPUT' && el.type === 'range';
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var foco = document.activeElement;
    var k = ev.key;

    if (k === 'Escape') {
      if (!indice.hidden) { fecharIndice(); ev.preventDefault(); }
      return;
    }
    if (k === 'm' || k === 'M') {
      if (indice.hidden) abrirIndice(); else fecharIndice();
      ev.preventDefault();
      return;
    }
    if (!indice.hidden) return;

    // Slider com foco (pelo Tab): as setas mexem no slider, não na tela.
    if (campoComSetas(foco) && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown')) return;
    // Botão com foco (pelo Tab): espaço e Enter acionam o botão.
    if (foco && foco.tagName === 'BUTTON' && (k === ' ' || k === 'Enter')) return;

    switch (k) {
      case 'ArrowRight': case 'PageDown': case ' ':
        avancar(); break;
      case 'ArrowLeft': case 'PageUp':
        voltar(); break;
      case 'Home':
        ir(0, 1); break;
      case 'End':
        ir(ultimaPrincipal, 1); break;
      case 'f': case 'F':
        alternarTelaCheia(); break;
      case 'r': case 'R':
        reiniciar(); break;
      default:
        return;
    }
    ev.preventDefault();
  });

  /* Depois de usar um controle com o mouse, tira o foco dele,
   * para as setas e o espaço voltarem a navegar. */
  document.addEventListener('pointerup', function (ev) {
    var c = ev.target.closest && ev.target.closest('button, input');
    if (c) setTimeout(function () { c.blur(); }, 0);
  });
  document.addEventListener('change', function (ev) {
    if (ev.target.type === 'range') ev.target.blur();
  });

  /* ---------- Clique nas bordas ---------- */

  var BORDA = 48; // px na base 1280 (fica dentro da margem livre de 56 px)
  document.addEventListener('click', function (ev) {
    if (!indice.hidden) return;
    if (ev.target.closest('button, input, a, label, select, .indice')) return;
    var r = palco.getBoundingClientRect();
    var x = (ev.clientX - r.left) / escala;
    if (x < BORDA) voltar();
    else if (x > W - BORDA) avancar();
  });

  /* ---------- Início ---------- */

  window.addEventListener('resize', escalar);
  window.addEventListener('hashchange', function () {
    var e = lerEndereco();
    if (e.i !== atual || e.p !== passoAtual) ir(e.i, e.p);
  });

  escalar();
  montarIndice();
  var e0 = lerEndereco();
  ir(e0.i, e0.p);

  // Para testes no console.
  window.Navegacao = { ir: ir, avancar: avancar, voltar: voltar, reiniciar: reiniciar };
})();

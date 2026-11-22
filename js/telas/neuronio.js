/* Tela 5: O Adaline como neurônio.
 * Passos 1 a 7: acende uma linha da tabela de tradução por passo, e a parte
 *               correspondente do desenho do neurônio ganha um halo amarelo.
 * Passo 8:      a frase final; a linha do "Erro" volta a acender.
 * A tela não tem demo: o desenho e a tabela estão no index.html.
 */
(function (g) {
  'use strict';

  var LINHA_DO_FIM = 5;   // no passo 8, acende de novo o "Erro" (o erro é o resultado)

  var linhas = [], partes = [];

  function acender(p) {
    var k = p <= linhas.length ? p : LINHA_DO_FIM;
    var nome = '';
    linhas.forEach(function (l) {
      var acesa = +l.dataset.linha === k;
      l.classList.toggle('aceso', acesa);
      if (acesa) nome = l.dataset.parte;
    });
    partes.forEach(function (pt) {
      pt.classList.toggle('aceso', pt.dataset.parte === nome);
    });
  }

  g.Telas = g.Telas || {};
  g.Telas.neuronio = {
    iniciar: function (sec) {
      linhas = [].slice.call(sec.querySelectorAll('.traducao .linha[data-linha]'));
      partes = [].slice.call(sec.querySelectorAll('#neuronio-svg .parte'));
    },
    passo: function (sec, p) {
      acender(p);
    }
    // Sem estado para reiniciar: a tela é estática.
  };
})(window);

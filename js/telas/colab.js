/* Tela 10: Agora no Colab.
 * O botão "Ver no Colab" usa CONFIG.linkColab (js/config.js). Enquanto o link
 * não for passado, o botão não abre nada e o aviso diz onde configurar.
 */
(function (g) {
  'use strict';

  function atualizar(sec) {
    var a = sec.querySelector('#colab-link');
    var obs = sec.querySelector('#colab-obs');
    var link = g.CONFIG && g.CONFIG.linkColab;
    if (link) {
      a.href = link;
      a.classList.remove('sem-link');
      a.removeAttribute('aria-disabled');
      obs.textContent = navigator.onLine === false
        ? 'Sem internet: os números do Colab estão nas telas 11 a 14.'
        : 'Abre numa nova aba.';
    } else {
      a.removeAttribute('href');
      a.classList.add('sem-link');
      a.setAttribute('aria-disabled', 'true');
      obs.textContent = 'Link ainda não configurado (js/config.js): abrir o notebook na mão.';
    }
  }

  g.Telas = g.Telas || {};
  g.Telas.colab = {
    entrar: function (sec) { atualizar(sec); }
  };
})(window);

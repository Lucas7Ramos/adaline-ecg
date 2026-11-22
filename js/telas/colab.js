/* Tela 10: Agora no Colab.
 * O botão "Ver no Colab" usa CONFIG.linkColab (js/config.js) e abre numa nova aba.
 * Embaixo do botão fica o endereço sem "https://", sem "?usp=..." e sem "#...",
 * para digitar à mão se o clique falhar. Sem link configurado, o botão não abre nada.
 */
(function (g) {
  'use strict';

  // "https://colab.research.google.com/drive/ID?usp=sharing#..." →
  // ["colab.research.google.com/drive/", "ID"] (duas linhas na tela).
  function enderecoCurto(link) {
    var s = link.replace(/^https?:\/\//, '').replace(/[?#].*$/, '');
    var i = s.lastIndexOf('/');
    return i > 0 ? [s.slice(0, i + 1), s.slice(i + 1)] : [s];
  }

  function atualizar(sec) {
    var a = sec.querySelector('#colab-link');
    var obs = sec.querySelector('#colab-obs');
    var end = sec.querySelector('#colab-endereco');
    var link = g.CONFIG && g.CONFIG.linkColab;
    if (link) {
      a.href = link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.classList.remove('sem-link');
      a.removeAttribute('aria-disabled');
      obs.textContent = navigator.onLine === false
        ? 'Sem internet: os números do Colab estão nas telas 11 a 14.'
        : 'Abre numa nova aba. Se o clique falhar, digite:';
      end.innerHTML = '';
      enderecoCurto(link).forEach(function (parte) {
        var linha = document.createElement('span');
        linha.textContent = parte;
        end.appendChild(linha);
      });
      end.hidden = false;
    } else {
      a.removeAttribute('href');
      a.classList.add('sem-link');
      a.setAttribute('aria-disabled', 'true');
      obs.textContent = 'Link ainda não configurado (js/config.js): abrir o notebook na mão.';
      end.hidden = true;
    }
  }

  g.Telas = g.Telas || {};
  g.Telas.colab = {
    iniciar: function (sec) {
      // Sem link, o clique não faz nada (e não navega para "#").
      sec.querySelector('#colab-link').addEventListener('click', function (ev) {
        if (!this.getAttribute('href')) ev.preventDefault();
      });
    },
    entrar: function (sec) { atualizar(sec); }
  };
})(window);

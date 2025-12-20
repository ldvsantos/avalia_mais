(function () {
  'use strict';

  function onSubmit(ev) {
    try {
      var form = ev.target;
      if (!form || !form.getAttribute) return;
      if (form.getAttribute('data-confirm') !== 'delete-event') return;

      var msg =
        'ATENÇÃO: Tem certeza que deseja excluir este evento?\n\n' +
        'Esta ação apagará permanentemente o evento e todas as inscrições associadas.\n\n' +
        'Clique em OK para confirmar a exclusão.';

      if (!window.confirm(msg)) {
        ev.preventDefault();
      }
    } catch (e) {
      ev.preventDefault();
      window.alert('Não foi possível confirmar a exclusão. Atualize a página e tente novamente.');
    }
  }

  document.addEventListener('submit', onSubmit, true);
})();

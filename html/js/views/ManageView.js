/* Repeater management — placeholder until the remote-admin API lands. */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  MW.views.ManageView = {
    name: "MwManageView",
    props: { contact: { type: Object, required: true } },
    template:
      '<div class="page">' +
      '  <div class="auth-card">' +
      '    <div class="auth-card__icon"><mw-icon name="construction" :size="30" /></div>' +
      '    <div>' +
      '      <h2>Manage {{ contact.adv_name }}</h2>' +
      '      <p style="color:var(--text-1);margin-top:4px">' +
      '        Remote repeater administration is under construction — adverts, ACLs, and radio settings will live here.' +
      '      </p>' +
      '    </div>' +
      '    <button class="btn btn--ghost btn--block" @click="$router.push(\'/contacts/\' + contact.public_key + \'/info\')">' +
      '      <mw-icon name="arrow-left" :size="18" /> Back to details' +
      '    </button>' +
      '  </div>' +
      "</div>",
  };
})();

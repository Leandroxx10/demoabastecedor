/* WMoldes - Botão Tela Cheia V14 */
(function () {
  'use strict';

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  }

  async function enterFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.msRequestFullscreen) return el.msRequestFullscreen();
  }

  async function exitFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
  }

  async function toggle() {
    try {
      if (fullscreenElement()) {
        await exitFullscreen();
      } else {
        await enterFullscreen();
      }
      updateButton();
    } catch (err) {
      console.warn('Não foi possível alternar tela cheia:', err);
      if (window.showNotification) {
        window.showNotification('Tela cheia não permitida pelo navegador neste contexto.', 'warning');
      } else {
        alert('Tela cheia não permitida pelo navegador neste contexto.');
      }
    }
  }

  function updateButton() {
    const btn = document.getElementById('btnTelaCheia');
    if (!btn) return;
    const active = !!fullscreenElement();
    btn.classList.toggle('is-fullscreen', active);
    btn.innerHTML = active
      ? '<i class="fas fa-compress"></i> Sair tela cheia'
      : '<i class="fas fa-expand"></i> Tela cheia';
  }

  document.addEventListener('fullscreenchange', updateButton);
  document.addEventListener('webkitfullscreenchange', updateButton);
  document.addEventListener('msfullscreenchange', updateButton);
  document.addEventListener('DOMContentLoaded', updateButton);

  window.WMFullscreen = { toggle, updateButton };
})();

/* WMoldes - Atalhos rápidos V13
   Salva em Firebase em /atalhosAbastecedor e usa localStorage como fallback. */
(function(){
  'use strict';

  const ROOT = 'atalhosAbastecedor';
  const LS_KEY = 'wmoldes_atalhos_abastecedor_v1';
  const state = { items: [], editing: false, loaded: false };

  function getFirebaseRef(){
    try {
      if (window.firebase && firebase.database) return firebase.database().ref(ROOT);
    } catch (_) {}
    return null;
  }

  function uid(){
    return 'atalho_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }

  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function normalizeUrl(raw){
    let url = String(raw || '').trim();
    if (!url) return '';
    // Permite site, caminho de rede/local, file:// e caminhos internos do projeto.
    if (/^(https?:\/\/|file:\/\/|\\\\|\/)/i.test(url)) return url;
    if (/^[a-zA-Z]:[\\/]/.test(url)) return 'file:///' + url.replace(/\\/g, '/');
    if (url.includes('.') && !url.includes(' ')) return 'https://' + url;
    return url;
  }

  function createModal(){
    if (document.getElementById('wmShortcutBackdrop')) return;
    const wrap = document.createElement('div');
    wrap.id = 'wmShortcutBackdrop';
    wrap.className = 'wm-shortcut-backdrop';
    wrap.innerHTML = `
      <div class="wm-shortcut-modal" role="dialog" aria-modal="true" aria-labelledby="wmShortcutTitle">
        <div class="wm-shortcut-header">
          <div class="wm-shortcut-title">
            <h3 id="wmShortcutTitle"><i class="fas fa-bolt"></i> Atalhos</h3>
            <p>Cadastre botões para abrir sites, páginas internas ou caminhos de arquivos.</p>
          </div>
          <div class="wm-shortcut-actions">
            <button type="button" class="wm-shortcut-add" id="wmShortcutAdd"><i class="fas fa-plus"></i> Novo atalho</button>
            <button type="button" class="wm-shortcut-close" id="wmShortcutClose" title="Fechar"><i class="fas fa-times"></i></button>
          </div>
        </div>
        <div class="wm-shortcut-body">
          <form class="wm-shortcut-form" id="wmShortcutForm">
            <div class="wm-shortcut-field">
              <label for="wmShortcutName">Nome do botão</label>
              <input id="wmShortcutName" type="text" maxlength="50" placeholder="Ex: Manual da máquina" required>
            </div>
            <div class="wm-shortcut-field">
              <label for="wmShortcutUrl">URL de localização / site / arquivo</label>
              <input id="wmShortcutUrl" type="text" placeholder="https://site.com ou C:\\pasta\\arquivo.pdf" required>
            </div>
            <div class="wm-shortcut-field full">
              <label for="wmShortcutComment">Comentário / explicação ao passar o mouse</label>
              <textarea id="wmShortcutComment" maxlength="240" placeholder="Explique para que serve esse atalho"></textarea>
            </div>
            <div class="wm-shortcut-form-actions">
              <button type="button" class="wm-shortcut-cancel" id="wmShortcutCancel"><i class="fas fa-times"></i> Cancelar</button>
              <button type="submit" class="wm-shortcut-save"><i class="fas fa-save"></i> Salvar atalho</button>
            </div>
          </form>
          <div class="wm-shortcut-list" id="wmShortcutList"></div>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) fecharModal(); });
    document.getElementById('wmShortcutClose').addEventListener('click', fecharModal);
    document.getElementById('wmShortcutAdd').addEventListener('click', toggleForm);
    document.getElementById('wmShortcutCancel').addEventListener('click', hideForm);
    document.getElementById('wmShortcutForm').addEventListener('submit', salvarAtalho);
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fecharModal(); });
  }

  function abrirModal(){
    createModal();
    document.getElementById('wmShortcutBackdrop').classList.add('open');
    loadOnce();
    render();
  }

  function fecharModal(){
    const el = document.getElementById('wmShortcutBackdrop');
    if (el) el.classList.remove('open');
    hideForm();
  }

  function toggleForm(){
    const form = document.getElementById('wmShortcutForm');
    if (!form) return;
    form.classList.toggle('open');
    if (form.classList.contains('open')) setTimeout(()=>document.getElementById('wmShortcutName')?.focus(), 50);
  }

  function hideForm(){
    const form = document.getElementById('wmShortcutForm');
    if (!form) return;
    form.classList.remove('open');
    form.reset();
  }

  function readLocal(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') || []; } catch (_) { return []; }
  }
  function writeLocal(items){
    try { localStorage.setItem(LS_KEY, JSON.stringify(items || [])); } catch (_) {}
  }

  function loadOnce(){
    if (state.loaded) return;
    state.loaded = true;
    const ref = getFirebaseRef();
    if (ref) {
      ref.on('value', snap => {
        const val = snap.val() || {};
        state.items = Object.keys(val).map(id => ({ id, ...(val[id] || {}) }))
          .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
        render();
      }, () => {
        state.items = readLocal();
        render();
      });
    } else {
      state.items = readLocal();
    }
  }

  async function salvarAtalho(ev){
    ev.preventDefault();
    const nome = document.getElementById('wmShortcutName').value.trim();
    const url = normalizeUrl(document.getElementById('wmShortcutUrl').value);
    const comentario = document.getElementById('wmShortcutComment').value.trim();
    if (!nome || !url) return;

    const payload = {
      nome,
      url,
      comentario,
      createdAt: Date.now(),
      createdAtText: new Date().toLocaleString('pt-BR')
    };
    const ref = getFirebaseRef();
    if (ref) {
      try {
        await ref.push({ ...payload, serverCreatedAt: firebase.database.ServerValue.TIMESTAMP });
      } catch (err) {
        console.error('Erro ao salvar atalho no Firebase:', err);
        const local = readLocal(); local.unshift({ id: uid(), ...payload }); writeLocal(local); state.items = local;
      }
    } else {
      const local = readLocal(); local.unshift({ id: uid(), ...payload }); writeLocal(local); state.items = local;
    }
    hideForm();
    render();
  }

  async function excluirAtalho(id){
    if (!id) return;
    if (!confirm('Excluir este atalho?')) return;
    const ref = getFirebaseRef();
    if (ref && !String(id).startsWith('atalho_')) {
      try { await ref.child(id).remove(); }
      catch (err) { console.error('Erro ao excluir atalho:', err); }
    }
    const local = readLocal().filter(x => x.id !== id);
    writeLocal(local);
    state.items = state.items.filter(x => x.id !== id);
    render();
  }

  function abrirAtalho(url){
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    window.open(normalized, '_blank', 'noopener,noreferrer');
  }

  function render(){
    const list = document.getElementById('wmShortcutList');
    if (!list) return;
    const items = state.items || [];
    if (!items.length) {
      list.innerHTML = `<div class="wm-shortcut-empty"><i class="fas fa-bolt"></i><br>Nenhum atalho cadastrado. Clique em <strong>+ Novo atalho</strong>.</div>`;
      return;
    }
    list.innerHTML = items.map(item => {
      const title = item.comentario || item.url || item.nome;
      return `
        <div class="wm-shortcut-card" title="${escapeHtml(title)}" data-url="${escapeHtml(item.url)}" data-id="${escapeHtml(item.id)}">
          <button type="button" class="wm-shortcut-delete" title="Excluir atalho" data-delete="${escapeHtml(item.id)}"><i class="fas fa-times"></i></button>
          <span class="wm-shortcut-open-icon"><i class="fas fa-external-link-alt"></i></span>
          <strong>${escapeHtml(item.nome)}</strong>
          <small>${escapeHtml(item.comentario || item.url)}</small>
        </div>`;
    }).join('');
    list.querySelectorAll('[data-url]').forEach(card => {
      card.addEventListener('click', ev => {
        if (ev.target.closest('[data-delete]')) return;
        abrirAtalho(card.getAttribute('data-url'));
      });
    });
    list.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        excluirAtalho(btn.getAttribute('data-delete'));
      });
    });
  }

  window.WMAtalhos = { abrirModal, fecharModal, render };

  document.addEventListener('DOMContentLoaded', () => {
    createModal();
    loadOnce();
  });
})();

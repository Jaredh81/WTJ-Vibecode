// Admin UI — v5.B3
// Clean baseline with:
// - Reliable toggle (change event)
// - Edit modal with sections & per-section “Add Block”
// - Block types: heading, text, image (URL or upload), list, accordion, html, richtext
// - Preview grid + page detail; Back to grid keeps tiles clickable
// - No Reset button (per request)

'use strict';

/* ---------------------------------
   0) Tiny utilities
----------------------------------*/
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const uid = () => Math.random().toString(36).slice(2,9);
const esc = (s="") => String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#039;");

/* ---------------------------------
   1) Storage + Prefill
----------------------------------*/
const STORAGE_KEY = 'guide_draft';

const PREFILL = {
  pages: [
    { id:"welcome",   title:"Welcome To Jozi", emoji:"🌴", enabled:true,  sections:[] },
    { id:"hosts",     title:"Meet Hosts",      emoji:"👋", enabled:true,  sections:[] },
    { id:"checkin",   title:"Check-in/Out",    emoji:"🔑", enabled:true,  sections:[] },
    { id:"amenities", title:"Amenities",       emoji:"⭐", enabled:true,  sections:[] },
    { id:"wifi",      title:"WiFi",            emoji:"📶", enabled:true,  sections:[] },
    { id:"rules",     title:"House Rules",     emoji:"🛡️", enabled:true,  sections:[] },
    { id:"emergency", title:"Emergency",       emoji:"⚠️", enabled:true,  sections:[] },
  ]
};

let app = null;

function loadDraft(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.pages)) return null;
    return data;
  }catch{ return null; }
}

function saveDraft(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
  const slot = document.querySelector('[data-autosave]');
  if (slot) slot.textContent = 'just now';
}

/* ---------------------------------
   2) Boot
----------------------------------*/
function boot(){
  app = loadDraft() || JSON.parse(JSON.stringify(PREFILL));
  render();
  window.addEventListener('beforeunload', saveDraft);
}
document.addEventListener('DOMContentLoaded', boot);

/* ---------------------------------
   3) Rendering
----------------------------------*/
function render(){
  renderSidebar();
  renderPreview();
}

/* Sidebar (left) */
function renderSidebar(){
  const left = document.querySelector('[data-panel="left"]');
  if (!left) return;

left.innerHTML = `
  <div class="panel">
    <div class="dot"></div>
    <h3>Guidebook Pages</h3>
    <div id="pages-list">
      ${app.pages.map(p => pageRowHTML(p)).join('')}
    </div>

    <div class="mt-12"></div>
    <button class="btn primary" data-action="save">💾 Save Progress</button>
    <div class="mt-12"></div>
    <button class="btn" data-action="load">📂 Load Progress</button>
    <!-- Reset removed on purpose -->
    <div class="mt-12"></div>
    <button class="btn" data-action="download">⬇️ Download JSON</button>
    <div class="mt-12 muted" style="font-size:12px">Autosaved: <span data-autosave>—</span></div>
  </div>
`;


  // One-time wiring that persists across re-renders
  if (!left._wired){
    // a) Toggling uses 'change' so it always fires
    left.addEventListener('change', (e)=>{
      if (!e.target.matches('input[data-action="toggle"]')) return;
      const id = e.target.getAttribute('data-id');
      const page = app.pages.find(p=>p.id===id);
      if (!page) return;
      page.enabled = e.target.checked;
      saveDraft();
      render();
    });

    // b) Other sidebar clicks
    left.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      if (action==='toggle') return; // handled above

      if (action==='edit'){
        const id = btn.getAttribute('data-id');
        const page = app.pages.find(p=>p.id===id);
        if (page) openEditModal(page);
        return;
      }
      if (action==='save'){ saveDraft(); flash(btn); return; }
      if (action==='load'){
        const d = loadDraft();
        if (d){ app = d; render(); }
        return;
      }
      if (action==='download'){ downloadJSON(); return; }
    });

    left._wired = true;
  }
}

function pageRowHTML(p){
  return `
    <div class="page-row">
      <span class="badge">${esc(p.emoji||"")}</span>
      <div class="slug">${esc(p.title||"Untitled")}</div>
      <button class="btn xs" data-action="edit" data-id="${p.id}">Edit</button>
      <label class="switch" title="Enable/Disable">
        <input type="checkbox" ${p.enabled?'checked':''} data-action="toggle" data-id="${p.id}">
        <span></span>
      </label>
    </div>
  `;
}

/* Preview (right) */
function renderPreview(){
  const right = document.querySelector('[data-panel="right"]');
  if (!right) return;

  const enabled = app.pages.filter(p=>p.enabled);
  right.innerHTML = `
    <div class="panel">
      <h3>Live Preview</h3>
      <div class="tile-grid">
        ${enabled.map(p => `
          <button class="tile" data-open="${p.id}">
            <div class="tile-emoji">${esc(p.emoji||"")}</div>
            <div class="tile-title">${esc(p.title||"Untitled")}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  right.querySelectorAll('[data-open]').forEach(tile=>{
    tile.addEventListener('click', ()=>{
      const id = tile.getAttribute('data-open');
      const page = app.pages.find(p=>p.id===id);
      if (page) openPageView(page);
    });
  });
}

/* ---------------------------------
   4) Edit Modal (settings + content)
----------------------------------*/
let modalRoot = null;

function ensureModalRoot(){
  if (!modalRoot){
    modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    modalRoot.style.display = 'none';
    document.body.appendChild(modalRoot);
  }
}

function closeModal(){
  if (!modalRoot) return;
  modalRoot.style.display = 'none';
  modalRoot.innerHTML = '';
  document.body.classList.remove('modal-open');
}

function openEditModal(page){
  ensureModalRoot();
  document.body.classList.add('modal-open');
  modalRoot.style.display = 'flex';

  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal">
      <div class="modal-head">
        <div>Edit Page</div>
        <button class="icon" data-close aria-label="Close">✕</button>
      </div>

      <div class="tabs">
        <button class="tab active" data-tab="settings">Page Settings</button>
        <button class="tab" data-tab="content">Content</button>
      </div>

      <div class="tab-panels">
        <div class="tab-panel" data-panel="settings">
          <label class="label">Title</label>
          <input class="input" data-field="title" value="${esc(page.title||'')}">

          <div class="row mt-12">
            <div style="flex:1">
              <label class="label">Icon (emoji)</label>
              <input class="input" data-field="emoji" placeholder="e.g. 🌴" value="${esc(page.emoji||'')}">
              <div class="muted" style="font-size:12px">We’ll add a picker later — for now, paste an emoji.</div>
            </div>
            <div style="flex:1">
              <label class="label">Cover Image URL</label>
              <input class="input" data-field="cover" placeholder="https://…" value="${esc(page.cover||'')}">
              <div class="muted" style="font-size:12px">Optional. Used by the guest view and preview.</div>
            </div>
          </div>

          <div class="row mt-12" style="align-items:center">
            <input id="enb" type="checkbox" ${page.enabled?'checked':''}>
            <label for="enb" class="label" style="margin:0 0 0 8px">Enabled</label>
          </div>
        </div>

        <div class="tab-panel hidden" data-panel="content">
          ${renderSectionsEditor(page)}
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn" data-close>Cancel</button>
        <button class="btn primary" data-save>Save changes</button>
      </div>
    </div>
  `;

  // Tabs
  modalRoot.querySelector('.tabs').addEventListener('click', (e)=>{
    const t = e.target.closest('.tab'); if (!t) return;
    const name = t.getAttribute('data-tab');
    $$('.tab', modalRoot).forEach(b=>b.classList.toggle('active', b===t));
    $$('.tab-panel', modalRoot).forEach(p=>p.classList.toggle('hidden', p.getAttribute('data-panel')!==name));
  });

  // Close
  modalRoot.addEventListener('click', (e)=>{
    if (e.target.matches('[data-close], .modal-backdrop')) closeModal();
  }, { once:true });

  // Save
  modalRoot.querySelector('[data-save]').addEventListener('click', ()=>{
    page.title   = $('[data-field="title"]', modalRoot).value.trim() || page.title;
    page.emoji   = $('[data-field="emoji"]', modalRoot).value.trim();
    page.cover   = $('[data-field="cover"]', modalRoot).value.trim();
    page.enabled = $('#enb', modalRoot).checked;

    page.sections = readSectionsFromEditor();

    saveDraft();
    closeModal();
    render();
  });

  // Content editor event delegation
  const panels = $('.tab-panels', modalRoot);

  // Per-section “Add Block”, Move Section, Delete Section, Add Section
  panels.addEventListener('click', (e)=>{
    // Add Section
    if (e.target.matches('[data-add-section]')){
      const ed = $('#sections-ed', modalRoot);
      const sec = { id: uid(), title:'New Section', blocks: [] };
      ed.insertAdjacentHTML('beforeend', sectionHTML(sec));
      return;
    }

    // Inside a specific section
    const secEl = e.target.closest('.section-ed');
    if (secEl){
      if (e.target.matches('[data-sec-add-block]')){
        const blk = { id: uid(), type:'heading', value:'' };
        $('.section-blocks', secEl).insertAdjacentHTML('beforeend', blockHTML(blk));
        return;
      }
      if (e.target.matches('[data-sec-up]')){
        const prev = secEl.previousElementSibling;
        if (prev) secEl.parentElement.insertBefore(secEl, prev);
        return;
      }
      if (e.target.matches('[data-sec-down]')){
        const next = secEl.nextElementSibling;
        if (next) secEl.parentElement.insertBefore(next, secEl);
        return;
      }
      if (e.target.matches('[data-sec-del]')){
        secEl.remove();
        return;
      }
    }

    // Block controls (move/delete)
    const blkEl = e.target.closest('.block-ed');
    if (blkEl){
      if (e.target.matches('[data-up]')){
        const prev = blkEl.previousElementSibling;
        if (prev) blkEl.parentElement.insertBefore(blkEl, prev);
        return;
      }
      if (e.target.matches('[data-down]')){
        const next = blkEl.nextElementSibling;
        if (next) blkEl.parentElement.insertBefore(next, blkEl);
        return;
      }
      if (e.target.matches('[data-del]')){
        blkEl.remove();
        return;
      }
    }
  });

  // Change block type -> swap input control
  panels.addEventListener('change', (e)=>{
    // block type select
    if (e.target.matches('select[data-block-type]')){
      const blk = e.target.closest('.block-ed'); if (!blk) return;
      const valBox = blk.querySelector('[data-block-value]');
      const current = (valBox.querySelector('textarea,input,[contenteditable]')?.value) ?? '';
      valBox.innerHTML = controlForType(e.target.value, current);
    }
    // Image file upload
    if (e.target.matches('input[data-img-file]')){
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const tgt = e.target.closest('[data-block-value]')?.querySelector('input[data-img-url]');
        if (tgt){ tgt.value = reader.result; }
      };
      reader.readAsDataURL(file);
    }
  });
}

/* Sections/Blocks editor HTML */
function renderSectionsEditor(page){
  return `
    <div id="sections-ed">
      ${(page.sections||[]).map(sec => sectionHTML(sec)).join('')}
    </div>

    <div class="mt-12">
      <button class="btn" data-add-section>+ Add Section</button>
    </div>
  `;
}

function sectionHTML(sec){
  return `
    <div class="section-ed" data-sec="${esc(sec.id)}">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="badge" style="font-weight:700">SECTION</span>
        <div class="row">
          <button class="btn xs" data-sec-up title="Move up">↑</button>
          <button class="btn xs" data-sec-down title="Move down">↓</button>
          <button class="btn xs danger" data-sec-del title="Delete section">Delete</button>
        </div>
      </div>
      <input class="input" placeholder="Section title" value="${esc(sec.title||'New Section')}">

      <div class="section-blocks">
        ${(sec.blocks||[]).map(b=>blockHTML(b)).join('')}
      </div>

      <div class="mt-12">
        <button class="btn" data-sec-add-block>+ Add Block here</button>
      </div>
      <hr class="sep">
    </div>
  `;
}

function blockHTML(b){
  return `
    <div class="block-ed" data-blk="${esc(b.id)}">
      <div class="row" style="gap:10px">
        <select class="select" data-block-type>
          ${['heading','text','image','list','accordion','html','richtext'].map(t=>`
            <option value="${t}" ${b.type===t?'selected':''}>${t.toUpperCase()}</option>
          `).join('')}
        </select>

        <div data-block-value style="flex:1">
          ${controlForType(b.type, b.value || '')}
        </div>

        <div class="row">
          <button class="btn xs" data-up title="Move up">↑</button>
          <button class="btn xs" data-down title="Move down">↓</button>
          <button class="btn xs danger" data-del title="Delete">Delete</button>
        </div>
      </div>
    </div>
  `;
}

function controlForType(type, value){
  if (type==='text'){
    return `<textarea class="input" rows="2" placeholder="Write text">${esc(value)}</textarea>`;
  }
  if (type==='image'){
    return `
      <div class="row" style="gap:8px;align-items:center">
        <input class="input" data-img-url placeholder="Image URL or pasted data URL" value="${esc(value)}" style="flex:1">
        <input type="file" accept="image/*" data-img-file class="input" style="width:180px">
      </div>
      <div class="muted" style="font-size:12px">Choose a file to embed as data URL, or paste an image URL.</div>
    `;
  }
  if (type==='list'){
    return `<textarea class="input" rows="3" placeholder="One item per line">${esc(value)}</textarea>`;
  }
  if (type==='accordion'){
    // store items as "Title::Content" per line
    return `<textarea class="input" rows="4" placeholder="Each line: Title::Content">${esc(value)}</textarea>`;
  }
  if (type==='html'){
    return `<textarea class="input" rows="4" placeholder="HTML (rendered in page view)">${esc(value)}</textarea>`;
  }
  if (type==='richtext'){
    // simple contenteditable that stores HTML
    return `
      <div class="muted" style="font-size:12px;margin-bottom:6px">Rich text — basic formatting allowed.</div>
      <div class="input" contenteditable="true" style="min-height:90px;white-space:pre-wrap">${value||''}</div>
    `;
  }
  // heading
  return `<input class="input" placeholder="Heading text" value="${esc(value)}">`;
}

function readSectionsFromEditor(){
  const out = [];
  $$('#sections-ed .section-ed', modalRoot).forEach(secEl=>{
    const sec = {
      id: secEl.getAttribute('data-sec') || uid(),
      title: $('input.input', secEl).value.trim(),
      blocks: []
    };
    $$('.block-ed', secEl).forEach(bEl=>{
      const type = $('select[data-block-type]', bEl).value;
      let val = '';
      if (type==='richtext'){
        val = $('[contenteditable]', bEl)?.innerHTML || '';
      }else{
        const vEl = $('textarea.input, input.input, input[data-img-url]', bEl);
        val = vEl ? vEl.value : '';
      }
      sec.blocks.push({ id: bEl.getAttribute('data-blk') || uid(), type, value: val });
    });
    out.push(sec);
  });
  return out;
}

/* ---------------------------------
   5) Page detail (Preview right)
----------------------------------*/
function openPageView(page){
  const right = document.querySelector('[data-panel="right"]');
  if (!right) return;

  right.innerHTML = `
    <div class="page-detail">
      <div class="page-detail-head">
        <button class="btn xs" data-back>← Back to Guide</button>
        <div class="page-detail-title">${esc(page.emoji||"")} ${esc(page.title||"")}</div>
      </div>

      ${(page.sections||[]).map(sec => `
        <div class="section">
          ${sec.title ? `<div class="section-title">${esc(sec.title)}</div>` : ''}
          ${(sec.blocks||[]).map(b => renderBlock(b)).join('')}
        </div>
      `).join('') || `<div class="empty">No content yet</div>`}
    </div>
  `;

  const back = right.querySelector('[data-back]');
  if (back) back.addEventListener('click', renderPreview);
}

function renderBlock(b){
  const type = (b.type || 'text').toLowerCase();
  const v = (b.value || '').trim();

  if (!v && type !== 'image' && type !== 'divider') return '';

  // helpers
  const toList = (s) => s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);

  switch (type) {
    case 'heading':
      return `<h3 class="blk-h3">${esc(v)}</h3>`;

    case 'text': {
      // simple rich-ish: paragraphs by blank line, line breaks inside paragraphs
      return richTextHTML(v);
    }

    case 'list': {
      const items = toList(v);
      if (!items.length) return '';
      return `<ul class="blk-list">${items.map(li=>`<li>${esc(li)}</li>`).join('')}</ul>`;
    }

    case 'image': {
      if (!v) return '';
      return `
        <figure class="blk-figure">
          <img class="blk-img" src="${esc(v)}" alt="">
        </figure>
      `;
    }

    case 'accordion': {
      // First line = title; the rest = body (rendered like text)
      const lines = toList(v);
      if (!lines.length) return '';
      const title = lines.shift();
      const body  = lines.join('\n');
      return `
        <details class="blk-accordion">
          <summary>${esc(title)}</summary>
          <div class="blk-accordion-body">
            ${richTextHTML(body)}
          </div>
        </details>
      `;
    }

    case 'divider':
      return `<hr class="blk-sep">`;

    default:
      // fallback to text
      return richTextHTML(v);
  }
}

function richTextHTML(s){
  if (!s) return '';
  // paragraph split on blank lines
  const paras = s.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
  const html = paras.map(p=>{
    // turn single newlines into <br>, linkify http(s)://
    let h = esc(p).replace(/\n/g,'<br>');
    h = h.replace(/\bhttps?:\/\/[^\s<]+/g, m => `<a href="${esc(m)}" target="_blank" rel="noopener">${esc(m)}</a>`);
    return `<p class="blk-p">${h}</p>`;
  }).join('');
  return html || '';
}


/* ---------------------------------
   6) Misc
----------------------------------*/
function downloadJSON(){
  const blob = new Blob([JSON.stringify(app,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'guide.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function flash(el){
  el.classList.add('flash');
  setTimeout(()=>el.classList.remove('flash'), 300);
}

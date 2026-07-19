// Nếu dùng jsDelivr CDN để phục vụ ảnh, điền vào đây, ví dụ:
// "https://cdn.jsdelivr.net/gh/USER/REPO@main/"
const CDN_BASE = "";

const ACCENTS = ['#FF6B6B', '#A78BFA', '#22D3EE', '#FBBF24', '#34D399', '#F472B6'];
function accentFor(slug){
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

let library = [];

async function boot(){
  const res = await fetch('library.json');
  library = await res.json();
  window.addEventListener('hashchange', route);
  route();
}

function src(path){ return CDN_BASE + path; }

function route(){
  const raw = location.hash.slice(1);
  const [path, queryStr] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const query = new URLSearchParams(queryStr || '');

  if (parts[0] === 'series' && parts[1]) {
    renderSeries(parts[1]);
  } else if (parts[0] === 'read' && parts[1] && parts[2] !== undefined) {
    renderReader(parts[1], parseInt(parts[2], 10), parts[3] ? parseInt(parts[3], 10) : 0);
  } else {
    renderLibrary(query.get('tag'));
  }
  window.scrollTo(0, 0);
}

// ---------- Thư viện: tìm kiếm + lọc tag ----------
function renderLibrary(presetTag){
  const app = document.getElementById('app');
  if (!library.length) {
    app.innerHTML = `
      <div class="library-header"><h1>Thư viện</h1></div>
      <div class="empty">Chưa có truyện nào.<br>Thêm ảnh vào thư mục manga/&lt;tên-truyện&gt;/&lt;chương&gt;/ trên GitHub.</div>`;
    return;
  }

  const allTags = Array.from(new Set(library.flatMap(s => s.tags || []))).sort((a, b) => a.localeCompare(b, 'vi'));
  const selected = new Set(presetTag ? [presetTag] : []);

  app.innerHTML = `
    <div class="library-header">
      <h1>Thư viện</h1>
      <p>${library.length} bộ truyện</p>
    </div>
    <div class="search-panel">
      <input type="text" id="search-input" placeholder="Tìm theo tên truyện, tác giả...">
      ${allTags.length ? `<div class="tag-chips" id="tag-chips">
        ${allTags.map(t => `<button class="chip${selected.has(t) ? ' active' : ''}" data-tag="${t}">${t}</button>`).join('')}
      </div>` : ''}
    </div>
    <div id="grid-container"></div>`;

  function apply(){
    const q = document.getElementById('search-input').value.trim().toLowerCase();
    const filtered = library.filter(s => {
      const matchesQ = !q || s.title.toLowerCase().includes(q) || s.author.toLowerCase().includes(q);
      const matchesTags = selected.size === 0 || (s.tags || []).some(t => selected.has(t));
      return matchesQ && matchesTags;
    });
    renderGrid(filtered);
  }

  document.getElementById('search-input').addEventListener('input', apply);
  document.querySelectorAll('#tag-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const t = chip.dataset.tag;
      if (selected.has(t)) selected.delete(t); else selected.add(t);
      chip.classList.toggle('active');
      apply();
    });
  });

  apply();
}

function renderGrid(list){
  const container = document.getElementById('grid-container');
  if (!list.length) {
    container.innerHTML = `<div class="empty">Không tìm thấy truyện phù hợp.</div>`;
    return;
  }
  container.innerHTML = `<div class="grid">
    ${list.map(s => `
      <a class="card" href="#/series/${s.slug}" style="--accent:${accentFor(s.slug)}">
        <div class="cover-wrap"><img class="cover" src="${src(s.cover)}" loading="lazy" alt="${s.title}"></div>
        <div class="title">${s.title}</div>
        <div class="author">${s.author}</div>
      </a>`).join('')}
  </div>`;
}

// ---------- Trang bộ truyện ----------
function renderSeries(slug){
  const s = library.find(x => x.slug === slug);
  const app = document.getElementById('app');
  if (!s) { app.innerHTML = `<div class="empty">Không tìm thấy truyện.</div>`; return; }
  const accent = accentFor(s.slug);
  const tags = s.tags || [];

  app.innerHTML = `
    <div class="topbar"><a class="back" href="#/">←</a><h1>${s.title}</h1></div>
    <div class="series-hero" style="--accent:${accent}">
      <div class="cover-wrap"><img class="cover" src="${src(s.cover)}" alt="${s.title}"></div>
      <div class="meta">
        <h1>${s.title}</h1>
        <div class="author">${s.author}</div>
        ${tags.length ? `<div class="tags-row">${tags.map(t => `<a class="tag-pill" href="#/?tag=${encodeURIComponent(t)}">${t}</a>`).join('')}</div>` : ''}
        <div class="hero-actions">
          <span class="count">${s.chapters.length} chương</span>
          <button class="btn primary small" id="dl-all-btn">⬇ Tải toàn bộ</button>
        </div>
      </div>
    </div>
    <div class="chapter-list">
      ${s.chapters.map((c, i) => `
        <div class="chapter-row">
          <a class="chapter-link" href="#/read/${s.slug}/${i}/0">
            <span class="chap-badge">${i + 1}</span>
            <span class="name">${c.name}</span>
            <span class="pages">${c.pages.length} trang</span>
          </a>
          <button class="dl-btn" data-chapter="${i}" title="Tải chương này">⬇</button>
        </div>`).join('')}
    </div>`;

  document.getElementById('dl-all-btn').addEventListener('click', e => downloadSeries(s, e.currentTarget));
  document.querySelectorAll('.dl-btn').forEach(btn => {
    btn.addEventListener('click', () => downloadChapter(s, parseInt(btn.dataset.chapter, 10), btn));
  });
}

// ---------- Tải truyện (zip, xử lý ngay trên trình duyệt) ----------
function triggerDownload(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function downloadChapter(s, chapterIdx, btn){
  const chapter = s.chapters[chapterIdx];
  const original = btn.textContent;
  btn.disabled = true;
  try {
    const zip = new JSZip();
    for (let i = 0; i < chapter.pages.length; i++) {
      const res = await fetch(src(chapter.pages[i]));
      const blob = await res.blob();
      zip.file(String(i + 1).padStart(3, '0') + '.webp', blob);
      btn.textContent = `${i + 1}/${chapter.pages.length}`;
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(blob, `${s.title} - ${chapter.name}.zip`);
  } catch (err) {
    alert('Tải chương thất bại, kiểm tra mạng rồi thử lại.');
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}

async function downloadSeries(s, btn){
  const original = btn.textContent;
  btn.disabled = true;
  const total = s.chapters.reduce((sum, c) => sum + c.pages.length, 0);
  let done = 0;
  try {
    const zip = new JSZip();
    for (const chapter of s.chapters) {
      const folder = zip.folder(chapter.slug);
      for (let i = 0; i < chapter.pages.length; i++) {
        const res = await fetch(src(chapter.pages[i]));
        const blob = await res.blob();
        folder.file(String(i + 1).padStart(3, '0') + '.webp', blob);
        done++;
        btn.textContent = `${done}/${total}`;
      }
    }
    btn.textContent = 'Đang nén...';
    const blob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(blob, `${s.title}.zip`);
  } catch (err) {
    alert('Tải truyện thất bại, kiểm tra mạng rồi thử lại.');
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}

// ---------- Trình đọc ----------
function renderReader(slug, chapterIdx, pageIdx){
  const s = library.find(x => x.slug === slug);
  if (!s || !s.chapters[chapterIdx]) { location.hash = '#/'; return; }
  const chapter = s.chapters[chapterIdx];
  pageIdx = Math.max(0, Math.min(pageIdx, chapter.pages.length - 1));
  const accent = accentFor(s.slug);

  document.getElementById('app').innerHTML = `
    <div class="reader" id="reader" style="--accent:${accent}">
      <div class="progress">${chapter.pages.map((_, i) => `<span class="${i <= pageIdx ? 'done' : ''}"></span>`).join('')}</div>
      <div class="page-wrap"><img id="page-img" src="${src(chapter.pages[pageIdx])}" alt=""></div>
      <div class="tap-zone tap-prev" id="tap-prev"></div>
      <div class="tap-zone tap-next" id="tap-next"></div>
      <div class="bottom-bar">
        <a class="close" href="#/series/${s.slug}">✕</a>
        <span>${chapter.name} · ${pageIdx + 1}/${chapter.pages.length}</span>
        <span></span>
      </div>
    </div>`;

  preload(s, chapterIdx, pageIdx + 1);

  document.getElementById('tap-prev').onclick = () => goPage(s, chapterIdx, pageIdx - 1);
  document.getElementById('tap-next').onclick = () => goPage(s, chapterIdx, pageIdx + 1);

  let startX = null;
  const readerEl = document.getElementById('reader');
  readerEl.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  readerEl.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goPage(s, chapterIdx, pageIdx + 1);
      else goPage(s, chapterIdx, pageIdx - 1);
    }
    startX = null;
  }, { passive: true });
}

function preload(s, chapterIdx, pageIdx){
  const chapter = s.chapters[chapterIdx];
  if (!chapter || pageIdx >= chapter.pages.length) return;
  new Image().src = src(chapter.pages[pageIdx]);
}

function goPage(s, chapterIdx, pageIdx){
  const chapter = s.chapters[chapterIdx];
  if (pageIdx < 0) {
    if (chapterIdx > 0) {
      const prevCh = s.chapters[chapterIdx - 1];
      location.hash = `#/read/${s.slug}/${chapterIdx - 1}/${prevCh.pages.length - 1}`;
    } else {
      location.hash = `#/series/${s.slug}`;
    }
    return;
  }
  if (pageIdx >= chapter.pages.length) {
    if (chapterIdx < s.chapters.length - 1) {
      location.hash = `#/read/${s.slug}/${chapterIdx + 1}/0`;
    } else {
      showEnd(s);
    }
    return;
  }
  location.hash = `#/read/${s.slug}/${chapterIdx}/${pageIdx}`;
}

function showEnd(s){
  document.getElementById('app').innerHTML = `
    <div class="reader" style="--accent:${accentFor(s.slug)}">
      <div class="end-panel">
        <h2>Hết chương</h2>
        <p>Bạn đã đọc hết các chương hiện có của "${s.title}"</p>
        <div class="actions">
          <a class="btn" href="#/series/${s.slug}">Danh sách chương</a>
          <a class="btn primary" href="#/">Về thư viện</a>
        </div>
      </div>
    </div>`;
}

document.addEventListener('keydown', e => {
  const parts = location.hash.slice(1).split('?')[0].split('/').filter(Boolean);
  if (parts[0] !== 'read') return;
  const s = library.find(x => x.slug === parts[1]);
  if (!s) return;
  const chapterIdx = parseInt(parts[2], 10);
  const pageIdx = parseInt(parts[3], 10);
  if (e.key === 'ArrowRight') goPage(s, chapterIdx, pageIdx + 1);
  if (e.key === 'ArrowLeft') goPage(s, chapterIdx, pageIdx - 1);
  if (e.key === 'Escape') location.hash = `#/series/${s.slug}`;
});

boot();

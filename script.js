// Nếu dùng jsDelivr CDN để phục vụ ảnh, điền vào đây, ví dụ:
// "https://cdn.jsdelivr.net/gh/USER/REPO@main/"
const CDN_BASE = "";

let library = [];

async function boot(){
  const res = await fetch('library.json');
  library = await res.json();
  window.addEventListener('hashchange', route);
  route();
}

function src(path){ return CDN_BASE + path; }

function route(){
  const parts = location.hash.slice(1).split('/').filter(Boolean);
  if (parts[0] === 'series' && parts[1]) {
    renderSeries(parts[1]);
  } else if (parts[0] === 'read' && parts[1] && parts[2] !== undefined) {
    renderReader(parts[1], parseInt(parts[2], 10), parts[3] ? parseInt(parts[3], 10) : 0);
  } else {
    renderLibrary();
  }
  window.scrollTo(0, 0);
}

// ---------- Thư viện ----------
function renderLibrary(){
  const app = document.getElementById('app');
  if (!library.length) {
    app.innerHTML = `
      <div class="library-header"><h1>Thư viện</h1></div>
      <div class="empty">Chưa có truyện nào.<br>Thêm ảnh vào thư mục manga/&lt;tên-truyện&gt;/&lt;chương&gt;/ trên GitHub.</div>`;
    return;
  }
  app.innerHTML = `
    <div class="library-header">
      <h1>Thư viện</h1>
      <p>${library.length} bộ truyện</p>
    </div>
    <div class="grid">
      ${library.map(s => `
        <a class="card" href="#/series/${s.slug}">
          <img class="cover" src="${src(s.cover)}" loading="lazy" alt="${s.title}">
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
  app.innerHTML = `
    <div class="topbar"><a class="back" href="#/">←</a><h1>${s.title}</h1></div>
    <div class="series-hero">
      <img class="cover" src="${src(s.cover)}" alt="${s.title}">
      <div class="meta">
        <h1>${s.title}</h1>
        <div class="author">${s.author}</div>
        <div class="count">${s.chapters.length} chương</div>
      </div>
    </div>
    <div class="chapter-list">
      ${s.chapters.map((c, i) => `
        <a class="chapter-row" href="#/read/${s.slug}/${i}/0">
          <span class="name">${c.name}</span>
          <span class="pages">${c.pages.length} trang</span>
        </a>`).join('')}
    </div>`;
}

// ---------- Trình đọc ----------
function renderReader(slug, chapterIdx, pageIdx){
  const s = library.find(x => x.slug === slug);
  if (!s || !s.chapters[chapterIdx]) { location.hash = '#/'; return; }
  const chapter = s.chapters[chapterIdx];
  pageIdx = Math.max(0, Math.min(pageIdx, chapter.pages.length - 1));

  document.getElementById('app').innerHTML = `
    <div class="reader" id="reader">
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
      // Đọc trái sang phải: vuốt trái = trang tiếp, vuốt phải = trang trước
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
    <div class="reader">
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
  const parts = location.hash.slice(1).split('/').filter(Boolean);
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

// Nếu bạn dùng jsDelivr CDN để phục vụ ảnh (khuyến nghị khi có nhiều ảnh),
// điền vào CDN_BASE, ví dụ: "https://cdn.jsdelivr.net/gh/USER/REPO@main/"
// Để trống nếu muốn load ảnh trực tiếp từ GitHub Pages.
const CDN_BASE = "";

let manifest = [];
let currentIndex = 0;

async function init(){
  const res = await fetch('images.json');
  manifest = await res.json();
  document.getElementById('photo-count').textContent = manifest.length + ' ảnh';
  render();
}

function render(){
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  manifest.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.tabIndex = 0;
    div.innerHTML = `<span class="idx">${String(i + 1).padStart(3, '0')}</span><img data-src="${CDN_BASE}${item.src}" alt="${item.caption || ''}" loading="lazy">`;
    div.addEventListener('click', () => openLightbox(i));
    div.addEventListener('keypress', e => { if (e.key === 'Enter') openLightbox(i); });
    grid.appendChild(div);
  });
  document.querySelectorAll('.item img').forEach(img => {
    img.src = img.dataset.src;
    img.onload = () => img.classList.add('loaded');
  });
}

function openLightbox(i){
  currentIndex = i;
  document.getElementById('lightbox').hidden = false;
  updateLightbox();
}
function updateLightbox(){
  const item = manifest[currentIndex];
  document.getElementById('lb-img').src = CDN_BASE + item.src;
  document.getElementById('lb-index').textContent = `${currentIndex + 1} / ${manifest.length}`;
}
function closeLightbox(){ document.getElementById('lightbox').hidden = true; }
function next(){ currentIndex = (currentIndex + 1) % manifest.length; updateLightbox(); }
function prev(){ currentIndex = (currentIndex - 1 + manifest.length) % manifest.length; updateLightbox(); }

document.getElementById('lb-close').addEventListener('click', closeLightbox);
document.getElementById('lb-next').addEventListener('click', next);
document.getElementById('lb-prev').addEventListener('click', prev);
document.getElementById('lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });
document.addEventListener('keydown', e => {
  if (document.getElementById('lightbox').hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft') prev();
});

init();

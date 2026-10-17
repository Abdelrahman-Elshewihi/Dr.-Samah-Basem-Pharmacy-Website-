/* ====================================================================
   script.js — الدخول للصيدلية، العربية، الطلب عبر واتساب
   (كتالوج الأصناف في catalog.js)
   ==================================================================== */
const WA_NUMBER = '201284085786';
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 });

/* ---------- تنبيه صغير ---------- */
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
window.toast = toast;

/* ---------- 1) الباب: اضغط وادخل ---------- */
const entrance = $('entrance');
let entered = false;
function enterStore() {
  if (entered) { $('store').scrollIntoView({ behavior: 'smooth' }); return; }
  entered = true;
  entrance.classList.add('open');
  setTimeout(() => $('store').scrollIntoView({ behavior: 'smooth' }), 950);
}
['doorR', 'doorL', 'enterBtn'].forEach((id) => $(id).addEventListener('click', enterStore));
// لو الزائر نزل بنفسه (اسكرول)، الباب يتفتح لوحده
window.addEventListener('scroll', () => { if (scrollY > 260) entrance.classList.add('open'); }, { passive: true });

/* ---------- 2) العربية ---------- */
const STORE_KEY = 'sb-pharmacy-cart-v1';
const Cart = {
  items: new Map(),     // name -> {name, price, max, qty}
  listeners: [],
  load() {
    try {
      JSON.parse(localStorage.getItem(STORE_KEY) || '[]').forEach((i) => {
        if (i && i.name && i.qty > 0) this.items.set(i.name, i);
      });
    } catch (e) { /* التخزين غير متاح: تمام، العربية بتشتغل عادي */ }
  },
  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify([...this.items.values()])); } catch (e) {}
  },
  emit() { this.save(); this.listeners.forEach((f) => f()); },
  qty(name) { const i = this.items.get(name); return i ? i.qty : 0; },
  count() { let c = 0; this.items.forEach((i) => (c += i.qty)); return c; },
  total() { let t = 0; this.items.forEach((i) => (t += i.qty * i.price)); return t; },
  set(p, qty) {
    if (qty <= 0) this.items.delete(p.name);
    else {
      if (qty > p.max) { qty = p.max; toast(`المتاح من الصنف ده ${fmt(p.max)} بس`); }
      this.items.set(p.name, { name: p.name, label: p.label || p.name, price: p.price, max: p.max, qty });
    }
    this.emit();
  },
  add(p) { this.set(p, this.qty(p.name) + 1); },
  // تحديث الأسعار/الحد الأقصى من آخر ملف أصناف، وحذف اللي اختفى
  sync(map) {
    this.items.forEach((i, name) => {
      const p = map.get(name);
      if (!p) this.items.delete(name);
      else { i.price = p.price; i.max = p.max; i.qty = Math.min(i.qty, p.max); }
    });
    this.emit();
  },
  onChange(f) { this.listeners.push(f); }
};
window.Cart = Cart;
Cart.load();

/* حركة: الصنف بيطير للعربية */
window.flyToCart = function (fromEl) {
  const btn = $('cartBtn');
  btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
  if (!fromEl || !fromEl.getBoundingClientRect || !Element.prototype.animate) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = fromEl.getBoundingClientRect(), b = btn.getBoundingClientRect();
  const dot = document.createElement('div');
  dot.className = 'fly';
  dot.style.left = a.left + a.width / 2 - 13 + 'px';
  dot.style.top = a.top + a.height / 2 - 13 + 'px';
  document.body.appendChild(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  dot.animate(
    [{ transform: 'translate(0,0) scale(1)', opacity: 1 },
     { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 70}px) scale(1.2)`, opacity: 1, offset: 0.5 },
     { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0.3 }],
    { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)' }
  ).onfinish = () => dot.remove();
};

/* ---------- 3) رسم العربية ---------- */
const drawer = $('drawer'), scrim = $('scrim');
function openCart() {
  scrim.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => drawer.classList.add('open'));
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  scrim.hidden = true;
  document.body.style.overflow = '';
}
$('cartBtn').addEventListener('click', openCart);
$('closeCart').addEventListener('click', closeCart);
scrim.addEventListener('click', closeCart);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });

function renderCart() {
  $('cartCount').textContent = fmt(Cart.count());
  $('cartCount').hidden = Cart.count() === 0;
  const list = $('cartList');
  list.innerHTML = '';
  Cart.items.forEach((i) => {
    const li = document.createElement('li');
    li.className = 'cart-row';
    li.dataset.name = i.name;
    const h = document.createElement('h4'); h.textContent = i.label || i.name;
    const ctl = document.createElement('div'); ctl.className = 'row-ctl';
    ctl.innerHTML = '<div class="stepper"><button type="button" data-a="plus" aria-label="زيادة">+</button><span></span><button type="button" data-a="minus" aria-label="نقص">−</button></div><button type="button" class="rm" data-a="rm" aria-label="حذف">×</button>';
    ctl.querySelector('span').textContent = fmt(i.qty);
    const s = document.createElement('small'); s.textContent = `${fmt(i.price)} جنيه × ${fmt(i.qty)} = ${fmt(i.price * i.qty)}`;
    li.append(h, ctl, s);
    list.appendChild(li);
  });
  const has = Cart.items.size > 0;
  $('cartEmpty').hidden = has;
  $('checkout').hidden = !has;
  $('cartTotal').textContent = fmt(Cart.total()) + ' جنيه';
  updateOrder();
}
$('cartList').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-a]');
  if (!b) return;
  const name = b.closest('.cart-row').dataset.name;
  const i = Cart.items.get(name);
  if (!i) return;
  const a = b.dataset.a;
  if (a === 'plus') Cart.set(i, i.qty + 1);
  else if (a === 'minus') Cart.set(i, i.qty - 1);
  else Cart.set(i, 0);
});
Cart.onChange(renderCart);

/* ---------- 4) المنطقة + زر الطلب ---------- */
let area = '';
const nearby = $('nearby'), details = $('details'), orderBtn = $('orderBtn'), hint = $('orderHint');

$('areas').addEventListener('click', (e) => {
  const b = e.target.closest('.area');
  if (!b) return;
  area = b.dataset.area;
  document.querySelectorAll('.area').forEach((x) => {
    const on = x === b;
    x.classList.toggle('is-active', on);
    x.setAttribute('aria-checked', String(on));
  });
  nearby.hidden = area !== 'منطقة مجاورة';
  if (!nearby.hidden) nearby.focus();
  updateOrder();
});
[nearby, details].forEach((f) => f.addEventListener('input', updateOrder));

function buildMessage() {
  const lines = ['السلام عليكم، حابب أطلب من الصيدلية الأصناف دي:', ''];
  let n = 1;
  Cart.items.forEach((i) => lines.push(`${n++}) ${i.label || i.name} × ${i.qty}  —  ${fmt(i.price * i.qty)} جنيه`));
  lines.push('', `الإجمالي التقريبي: ${fmt(Cart.total())} جنيه`);
  const place = area === 'منطقة مجاورة' ? `منطقة مجاورة${nearby.value.trim() ? ' — ' + nearby.value.trim() : ''}` : area;
  lines.push(`📍 المنطقة: ${place}`);
  if (details.value.trim()) lines.push(`🏠 التفاصيل: ${details.value.trim()}`);
  lines.push('', 'ياريت تأكيد التوافر والسعر. شكرًا 🌿');
  return lines.join('\n');
}
function updateOrder() {
  const ready = Cart.items.size > 0 && area !== '';
  orderBtn.classList.toggle('is-disabled', !ready);
  orderBtn.setAttribute('aria-disabled', String(!ready));
  if (ready) {
    orderBtn.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(buildMessage())}`;
    hint.textContent = 'تمام ✓ جاهز تبعت الطلب';
    hint.classList.add('ok');
  } else {
    orderBtn.removeAttribute('href');
    hint.textContent = 'اختار منطقتك الأول عشان زر الطلب يفتح.';
    hint.classList.remove('ok');
  }
}
orderBtn.addEventListener('click', (e) => {
  if (orderBtn.classList.contains('is-disabled')) { e.preventDefault(); toast('اختار منطقة التوصيل الأول'); }
});

renderCart();

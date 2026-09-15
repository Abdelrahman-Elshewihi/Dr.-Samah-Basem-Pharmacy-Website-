/* ====================================================================
   1) قائمة الموبايل (فتح/غلق)
   ==================================================================== */
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // قفل القائمة تلقائيًا بعد الضغط على أي رابط داخلها
  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ====================================================================
   2) تغيير شكل الـ Navbar عند التمرير
   ==================================================================== */
const navbar = document.getElementById('navbar');

function updateNavbarState() {
  if (!navbar) return;
  if (window.scrollY > 20) {
    navbar.classList.add('is-scrolled');
  } else {
    navbar.classList.remove('is-scrolled');
  }
}

window.addEventListener('scroll', updateNavbarState, { passive: true });
updateNavbarState();

/* ====================================================================
   3) ظهور العناصر تدريجيًا عند النزول في الصفحة
   العناصر ظاهرة بشكل طبيعي دائمًا (من CSS). هنا فقط نضيف حركة اختيارية:
   نخفي مؤقتًا العناصر اللي لسه تحت الشاشة، ونظهرها بحركة ناعمة لما
   المستخدم يوصلها بالتمرير. لو حصل أي خطأ في الخطوة دي، العناصر
   تفضل ظاهرة زي ما هي (مفيش أي حالة ممكن تسبب اختفاء دائم للمحتوى).
   ==================================================================== */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion && 'IntersectionObserver' in window) {
  const revealElements = document.querySelectorAll('.reveal');
  const viewportH = window.innerHeight;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-hidden');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  revealElements.forEach((el) => {
    const isAlreadyInView = el.getBoundingClientRect().top < viewportH * 0.9;
    // العناصر الظاهرة أصلاً عند تحميل الصفحة تفضل ظاهرة زي ما هي،
    // فقط العناصر تحت الشاشة بتتخفى مؤقتًا لحد ما توصلها بالتمرير
    if (!isAlreadyInView) {
      el.classList.add('reveal-hidden');
      observer.observe(el);
    }
  });

  // شبكة أمان: لو لأي سبب الحركة متكملتش، رجّع كل حاجة ظاهرة بعد وقت قصير
  window.setTimeout(() => {
    revealElements.forEach((el) => el.classList.remove('reveal-hidden'));
  }, 2500);
}

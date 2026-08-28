# iOS-style Motion & Gestures (HTML/CSS/JS)

Patterns for making web interactions feel like native iOS gestures and transitions. Pair with the tokens in `SKILL.md` (`--ease-ios`, `--duration-normal`, etc.).

## Respect Reduced Motion

Always guard custom transitions/animations behind a media query so users who disabled motion don't get it:

```css
@media (prefers-reduced-motion: no-preference) {
  .page-transition { transition: transform var(--duration-normal) var(--ease-ios); }
}
@media (prefers-reduced-motion: reduce) {
  .page-transition { transition: none; }
}
```

## Push / Pop Page Transition (NavigationStack-style)

```css
.page {
  position: absolute;
  inset: 0;
  transition: transform var(--duration-normal) var(--ease-ios);
}
.page--entering { transform: translateX(100%); }
.page--active { transform: translateX(0); }
.page--exiting { transform: translateX(-30%); }
```

```js
function pushPage(container, newPageEl) {
  const current = container.querySelector('.page--active');
  container.appendChild(newPageEl);
  newPageEl.classList.add('page--entering');
  requestAnimationFrame(() => {
    newPageEl.classList.remove('page--entering');
    newPageEl.classList.add('page--active');
    current?.classList.add('page--exiting');
  });
}
```

## Swipe-to-Go-Back (Edge Swipe)

Minimal edge-swipe-to-dismiss using Pointer Events. Only triggers when the gesture starts near the left edge, matching iOS's interactive pop gesture.

```js
function enableSwipeBack(pageEl, onDismiss) {
  const EDGE_PX = 24;
  let startX = null;

  pageEl.addEventListener('pointerdown', (e) => {
    if (e.clientX <= EDGE_PX) startX = e.clientX;
  });

  pageEl.addEventListener('pointermove', (e) => {
    if (startX === null) return;
    const dx = Math.max(0, e.clientX - startX);
    pageEl.style.transform = `translateX(${dx}px)`;
  });

  pageEl.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    pageEl.style.transition = 'transform var(--duration-fast) var(--ease-ios)';
    if (dx > pageEl.offsetWidth * 0.35) {
      pageEl.style.transform = `translateX(100%)`;
      pageEl.addEventListener('transitionend', () => onDismiss(), { once: true });
    } else {
      pageEl.style.transform = 'translateX(0)';
    }
    startX = null;
  });
}
```

## Pull-to-Refresh

```html
<div class="refresh-container">
  <div class="refresh-spinner" hidden></div>
  <div class="scroll-content"><!-- content --></div>
</div>
```

```js
function enablePullToRefresh(container, onRefresh) {
  const spinner = container.querySelector('.refresh-spinner');
  const scrollEl = container.querySelector('.scroll-content');
  const THRESHOLD = 70;
  let startY = null;

  scrollEl.addEventListener('touchstart', (e) => {
    if (scrollEl.scrollTop === 0) startY = e.touches[0].clientY;
  }, { passive: true });

  scrollEl.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) {
      spinner.hidden = false;
      spinner.style.opacity = Math.min(dy / THRESHOLD, 1);
    }
  }, { passive: true });

  scrollEl.addEventListener('touchend', (e) => {
    if (startY === null) return;
    const dy = (e.changedTouches[0]?.clientY ?? startY) - startY;
    if (dy > THRESHOLD) onRefresh();
    else spinner.hidden = true;
    startY = null;
  });
}
```

## Tap Feedback (Since `:hover` Isn't Primary on Touch)

```css
.tappable {
  transition: opacity var(--duration-fast) var(--ease-ios),
              transform var(--duration-fast) var(--ease-ios);
}
.tappable:active {
  opacity: 0.6;
  transform: scale(0.97);
}
```

For instant feedback (avoiding the ~300ms tap delay in older WebViews), also set:

```css
html { touch-action: manipulation; }
```

## Momentum Scrolling & Overscroll Containment

```css
.scroll-content {
  -webkit-overflow-scrolling: touch; /* momentum scroll on older iOS WebKit */
  overscroll-behavior: contain;      /* stop scroll chaining to the page/body */
}
```

## Long-Press (Context Menu style)

```js
function onLongPress(el, callback, delay = 500) {
  let timer;
  const start = () => { timer = setTimeout(callback, delay); };
  const cancel = () => clearTimeout(timer);
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
}
```

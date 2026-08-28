# Additional iOS-style Components (HTML/CSS)

Extra components for `ios-web-style`. Each block is a self-contained HTML + CSS snippet using the design tokens defined in `SKILL.md` (`--ios-blue`, `--bg-primary`, `--separator`, etc.).

## Toggle / Switch

```html
<label class="ios-switch">
  <input type="checkbox" checked>
  <span class="ios-switch__track"><span class="ios-switch__thumb"></span></span>
</label>
```

```css
.ios-switch { display: inline-flex; align-items: center; cursor: pointer; }
.ios-switch input { display: none; }
.ios-switch__track {
  width: 51px;
  height: 31px;
  border-radius: var(--radius-pill);
  background: var(--ios-gray5);
  position: relative;
  transition: background var(--duration-fast) var(--ease-ios);
}
.ios-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 3px 8px rgba(0,0,0,0.15);
  transition: transform var(--duration-fast) var(--ease-ios);
}
.ios-switch input:checked + .ios-switch__track { background: var(--ios-green); }
.ios-switch input:checked + .ios-switch__track .ios-switch__thumb {
  transform: translateX(20px);
}
```

## Segmented Control

```html
<div class="segmented" role="tablist">
  <button class="segmented__item segmented__item--active" role="tab" aria-selected="true">Day</button>
  <button class="segmented__item" role="tab" aria-selected="false">Week</button>
  <button class="segmented__item" role="tab" aria-selected="false">Month</button>
</div>
```

```css
.segmented {
  display: flex;
  background: var(--ios-gray5);
  border-radius: var(--radius-sm);
  padding: 2px;
  gap: 2px;
}
.segmented__item {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--label-primary);
  border-radius: 7px;
  transition: background var(--duration-fast) var(--ease-ios);
}
.segmented__item--active {
  background: var(--bg-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
```

## Alert Dialog

```html
<div class="alert-scrim">
  <div class="alert">
    <div class="alert__body">
      <h3 class="alert__title">Delete Item?</h3>
      <p class="alert__message">This action cannot be undone.</p>
    </div>
    <div class="alert__actions">
      <button class="alert__action">Cancel</button>
      <button class="alert__action alert__action--destructive">Delete</button>
    </div>
  </div>
</div>
```

```css
.alert-scrim {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.alert {
  width: 270px;
  background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 14px;
  overflow: hidden;
  text-align: center;
}
.alert__body { padding: 20px 16px; }
.alert__title { font-size: 17px; font-weight: 600; margin: 0 0 4px; }
.alert__message { font-size: 13px; color: var(--label-secondary); margin: 0; }
.alert__actions {
  display: flex;
  border-top: 0.5px solid var(--separator);
}
.alert__action {
  flex: 1;
  padding: 11px 0;
  border: none;
  background: none;
  font-size: 17px;
  color: var(--ios-blue);
  border-left: 0.5px solid var(--separator);
}
.alert__action:first-child { border-left: none; }
.alert__action--destructive { color: var(--ios-red); font-weight: 600; }
```

## Badge

```html
<span class="badge">3</span>
```

```css
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--ios-red);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
```

## Search Bar

```html
<div class="search-bar">
  <svg class="search-bar__icon" width="16" height="16"><!-- magnifier --></svg>
  <input class="search-bar__input" type="search" placeholder="Search">
</div>
```

```css
.search-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 8px;
  background: var(--ios-gray5);
  border-radius: 10px;
  margin: 8px 16px;
}
.search-bar__input {
  flex: 1;
  border: none;
  background: none;
  font-size: 17px;
  outline: none;
  color: var(--label-primary);
}
.search-bar__icon { color: var(--ios-gray); flex-shrink: 0; }
```

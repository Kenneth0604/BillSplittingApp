---
name: ios-web-style
description: Make HTML/CSS web apps and PWAs look and feel like native iOS apps using Apple Human Interface Guidelines translated into pure CSS/HTML. Use when building a mobile web app, PWA, WebView-wrapped app (Capacitor/Cordova), or any HTML-based iOS interface that should mimic iOS visual style, navigation bars, tab bars, lists, cards, dark mode, and safe-area handling — without using SwiftUI or native Swift code.
---

# iOS Web Style (HTML/CSS)

Recreate the visual language of iOS (colors, typography, spacing, components, motion) using standard HTML/CSS/JS so a web app or hybrid app (Capacitor/Cordova/WebView) feels native on iPhone/iPad, in Safari or inside a WebView.

This skill is the HTML/CSS counterpart to native SwiftUI development. It does **not** use Swift/SwiftUI — everything here is CSS custom properties, HTML markup, and small vanilla JS snippets.

## When to Use This Skill

- Building a mobile-first web app, PWA, or hybrid app that should look like an iOS app
- Wrapping HTML in Capacitor/Cordova/Tauri/WebView and want native-feeling chrome
- Implementing iOS-style navigation bars, tab bars, sheets/modals, lists, and cards in HTML
- Handling iPhone notch/Dynamic Island/home indicator via safe-area CSS
- Supporting iOS light/dark mode and Dynamic Type in a web page
- Adding iOS-like touch feedback, transitions, and momentum scrolling
- Wanting an "Apple-like" aesthetic (SF-style fonts, translucency, rounded corners) without a native SDK

**Not for**: Actual SwiftUI/UIKit code — use a native iOS skill for that. This skill only covers the web/CSS side.

## Core Concepts

### 1. Design Tokens (CSS Custom Properties)

Define tokens once in `:root`, mirroring iOS system colors and metrics so every component stays consistent and themeable for dark mode.

```css
:root {
  /* System colors (light) */
  --ios-blue: #007AFF;
  --ios-green: #34C759;
  --ios-red: #FF3B30;
  --ios-orange: #FF9500;
  --ios-yellow: #FFCC00;
  --ios-gray: #8E8E93;
  --ios-gray2: #AEAEB2;
  --ios-gray5: #E5E5EA;
  --ios-gray6: #F2F2F7;

  /* Semantic (light) */
  --label-primary: #000000;
  --label-secondary: rgba(60, 60, 67, 0.6);
  --label-tertiary: rgba(60, 60, 67, 0.3);
  --bg-primary: #FFFFFF;
  --bg-secondary: #F2F2F7;
  --bg-grouped: #F2F2F7;
  --separator: rgba(60, 60, 67, 0.29);

  /* Metrics */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 999px;
  --nav-bar-height: 44px;
  --tab-bar-height: 49px;
  --spacing-unit: 8px;

  /* Motion */
  --ease-ios: cubic-bezier(0.25, 0.1, 0.25, 1);
  --duration-fast: 0.2s;
  --duration-normal: 0.35s;
}

@media (prefers-color-scheme: dark) {
  :root {
    --label-primary: #FFFFFF;
    --label-secondary: rgba(235, 235, 245, 0.6);
    --label-tertiary: rgba(235, 235, 245, 0.3);
    --bg-primary: #000000;
    --bg-secondary: #1C1C1E;
    --bg-grouped: #000000;
    --separator: rgba(84, 84, 88, 0.65);
  }
}
```

### 2. System Font Stack

iOS uses San Francisco. Web apps can't load SF directly (licensed to Apple), so use `-apple-system` which resolves to SF on Apple devices, with sane fallbacks:

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
}

/* Semantic type scale approximating iOS Dynamic Type */
.text-large-title { font-size: 34px; font-weight: 700; line-height: 41px; }
.text-title1      { font-size: 28px; font-weight: 700; line-height: 34px; }
.text-title2      { font-size: 22px; font-weight: 700; line-height: 28px; }
.text-headline    { font-size: 17px; font-weight: 600; line-height: 22px; }
.text-body        { font-size: 17px; font-weight: 400; line-height: 22px; }
.text-subheadline { font-size: 15px; font-weight: 400; line-height: 20px; }
.text-footnote    { font-size: 13px; font-weight: 400; line-height: 18px; }
.text-caption1    { font-size: 12px; font-weight: 400; line-height: 16px; }
```

### 3. Safe Area (Notch / Dynamic Island / Home Indicator)

Always declare the viewport and use `env(safe-area-inset-*)` so content doesn't collide with the notch or home indicator.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
.nav-bar {
  padding-top: calc(env(safe-area-inset-top, 0px) + 8px);
}

.tab-bar {
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
}

body {
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}
```

### 4. Navigation Bar (iOS-style)

```html
<header class="nav-bar">
  <button class="nav-bar__back">
    <svg width="12" height="20"><!-- chevron --></svg>
    <span>Back</span>
  </button>
  <h1 class="nav-bar__title">Title</h1>
  <button class="nav-bar__action">Edit</button>
</header>
```

```css
.nav-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--nav-bar-height);
  padding-inline: 16px;
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 0.5px solid var(--separator);
}
.nav-bar__title { font-size: 17px; font-weight: 600; }
.nav-bar__back, .nav-bar__action {
  color: var(--ios-blue);
  background: none;
  border: none;
  font-size: 17px;
}
```

### 5. Tab Bar (Bottom Navigation)

```html
<nav class="tab-bar">
  <a class="tab-bar__item tab-bar__item--active" href="#home">
    <svg><!-- filled icon --></svg>
    <span>Home</span>
  </a>
  <a class="tab-bar__item" href="#search">
    <svg><!-- outline icon --></svg>
    <span>Search</span>
  </a>
</nav>
```

```css
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  height: var(--tab-bar-height);
  background: color-mix(in srgb, var(--bg-primary) 85%, transparent);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-top: 0.5px solid var(--separator);
}
.tab-bar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: var(--ios-gray);
  text-decoration: none;
}
.tab-bar__item--active { color: var(--ios-blue); }
```

### 6. Grouped List / Table View

```html
<section class="list-group">
  <h2 class="list-group__header">Section Title</h2>
  <div class="list">
    <div class="list-row">
      <span>Notifications</span>
      <span class="list-row__chevron">›</span>
    </div>
    <div class="list-row">
      <span>Privacy</span>
      <span class="list-row__chevron">›</span>
    </div>
  </div>
</section>
```

```css
.list-group__header {
  font-size: 13px;
  color: var(--label-secondary);
  text-transform: uppercase;
  padding: 8px 16px 4px;
}
.list {
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-inline: 16px;
}
.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 0 16px;
  border-bottom: 0.5px solid var(--separator);
}
.list-row:last-child { border-bottom: none; }
.list-row:active { background: var(--bg-secondary); }
.list-row__chevron { color: var(--ios-gray2); }
```

### 7. Card / Sheet (Modal)

```css
.card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

/* iOS-style bottom sheet */
.sheet {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  background: var(--bg-primary);
  border-radius: 16px 16px 0 0;
  padding: 8px 16px calc(env(safe-area-inset-bottom, 0px) + 16px);
  transform: translateY(100%);
  transition: transform var(--duration-normal) var(--ease-ios);
}
.sheet.is-open { transform: translateY(0); }
.sheet__grabber {
  width: 36px;
  height: 5px;
  border-radius: var(--radius-pill);
  background: var(--ios-gray5);
  margin: 6px auto 12px;
}
```

### 8. Buttons

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px; /* Apple's 44pt tap target */
  padding: 0 20px;
  border-radius: var(--radius-md);
  font-size: 17px;
  font-weight: 600;
  border: none;
  transition: opacity var(--duration-fast) var(--ease-ios);
}
.btn:active { opacity: 0.6; }

.btn--filled { background: var(--ios-blue); color: #fff; }
.btn--tinted { background: color-mix(in srgb, var(--ios-blue) 15%, transparent); color: var(--ios-blue); }
.btn--plain  { background: none; color: var(--ios-blue); }
.btn--destructive { color: var(--ios-red); }
```

## Best Practices

1. **44×44pt minimum tap targets** for every interactive element (Apple HIG requirement)
2. **Use `env(safe-area-inset-*)`** for any fixed header/footer so content clears the notch and home indicator
3. **`prefers-color-scheme: dark`** — define tokens in `:root` and override in a dark media query; never hardcode colors in components
4. **Translucency via `backdrop-filter: blur()`** for nav bars/tab bars/sheets to mimic iOS materials
5. **`-webkit-overflow-scrolling: touch`** and `overscroll-behavior` for native-feeling momentum scroll
6. **Respect `prefers-reduced-motion`** — disable/soften transitions when set
7. **System font stack** (`-apple-system`) instead of shipping a custom "SF-like" font (avoids licensing issues and gets real SF on Apple devices)
8. **Avoid `:hover` as the primary state** — iOS is touch-first; use `:active` for tap feedback instead
9. **100vh pitfalls**: use `100dvh` (dynamic viewport height) instead of `100vh` to avoid Safari toolbar jump issues
10. **Disable double-tap zoom / bounce** where appropriate with `touch-action` and `overscroll-behavior: contain`, but keep pinch-zoom for accessibility unless it truly breaks the UI

## Common Issues

- **Fixed header covered by notch**: missing `viewport-fit=cover` in the viewport meta tag
- **Bottom sheet hidden behind home indicator**: missing safe-area bottom padding
- **Blurry translucency not showing**: `backdrop-filter` needs a semi-transparent (not fully opaque) background color, and Safari may need the `-webkit-` prefix
- **Buttons feel "webby"**: missing `:active` opacity/scale feedback, or tap target smaller than 44pt
- **Dark mode colors look native-app-inconsistent**: colors hardcoded instead of driven by CSS custom properties + `prefers-color-scheme`
- **Scrolling feels sluggish**: missing `-webkit-overflow-scrolling: touch`, or heavy repaints during scroll (avoid expensive `box-shadow`/`filter` on scrolling containers)
- **100vh cuts off content on iOS Safari**: replace with `100dvh` or `-webkit-fill-available`

## References

- `references/components.md` — more complete HTML/CSS for iOS-style switches, segmented controls, alerts, badges, and search bars
- `references/motion-and-gestures.md` — iOS-style transitions, swipe-to-go-back, pull-to-refresh, and haptics-adjacent feedback patterns in the browser

# Minimal, modern visual and motion pass

September 4, 2026. Direction: a polished public-service site with restrained depth, not a sparse directory. Existing light navy/teal identity, real YouTube imagery, official portraits, navigation, source links and civic records are preserved. No new marketing paragraphs or generated photography.

## Design decisions

- Public-facing design dials: variance 4, motion 5, density 4. Civic readers retain their functional split-pane layouts rather than adopting a landing-page layout.
- Restore white service tiles on a cool light canvas, compact monochrome service icons, quiet borders and modest elevation. Content remains behind native disclosures.
- Restore a navy featured-video caption panel; the full original thumbnail remains unobstructed. Give news, videos, meetings and City Hall destinations distinct visual hierarchy.
- Shared shape scale: 12–16px panels, 8px controls, 10px icon wells. No framework migration or added animation library.

## Motion and loading

- A single shared controller enhances all 12 routes, including dynamically rendered modules. Entrances use opacity and 10px movement over 420ms, with stagger capped at 160ms. Hover feedback is 180–220ms; no scroll-event animation loop.
- Native disclosures retain keyboard semantics. Reduced-motion preference prevents entrances, stops active animations, removes skeleton shimmer and switches programmatic scrolling to immediate movement.
- Build-time, layout-specific skeletons cover services, rows, meetings, portraits, videos, selected-video copy, reader details and maps. Loading is tied to actual initialization; there is no forced minimum delay.
- Static service content remains readable without JavaScript. Data views offer no-JavaScript source links. Loading regions use busy state and accessible status text; decorative shapes are hidden from assistive technology.
- Fetches have a 20-second timeout. Successful renders remove their own skeletons; completion clears remaining placeholders into source-linked fallbacks on failure. Failed media sections link to David’s channel.

## Verification

- All 12 routes: desktop 1440px and mobile 433px checks passed without horizontal page overflow or remaining busy states. Homepage and service interactions also checked at 390px.
- Computed foreground/background contrast check for visible primary buttons and reader controls passed across all routes (minimum 4.5:1). Fixed the meetings panel’s light primary button during review.
- Local QA server with an 8-second JSON delay: inspected agenda and video loading states, then verified 208 agenda items and 21 videos replaced their skeletons with no busy regions remaining.
- Simulated HTTP 503 responses on every JSON source across all 11 data-backed pages: all settled with zero skeletons or busy regions remaining. These failure responses exist only in the local QA server, not production data.
- Service search, native disclosure keyboard activation, nested mobile-menu Escape behavior and agenda list PageDown checked in the browser.
- Unit tests cover bounded motion, reduced-motion startup, cancellation on preference change, loading-shell assembly and repeat-build idempotency. CSS reduced-motion rules are present; system accessibility settings were not changed for testing.
- Existing parser/data regressions and 307 local link/asset checks pass. The civic datasets and official source content were not changed.

## Releases

1. `fc0a224`: visual depth and shared motion. Pushed to working branch and main; GitHub Pages deployment succeeded.
2. Loading skeletons, reduced-motion refinements, failure handling and regression tests: second major iteration, committed and pushed separately.

QA helper: `node scripts/preview-loading.mjs 4174 8000` for delayed JSON; add `fail-json` to simulate unavailable sources. It binds only to loopback and is not a production service.

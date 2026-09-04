# Coastal iteration — September 4, 2026

Approved scope: full Google Doc edit list, including its 12 screenshot references.

## Direction

Keep the real, multi-source homepage film. Extend its coastal navy and sea-glass palette throughout the site, with an intentional light alternative. Editorial pages use larger imagery and fewer competing modules; civic readers remain usable document tools.

Design dials (design / motion / density): home 7/6/4, media 7/5/4, civic readers 4/3/5. Existing Inter and Anton identity retained. No AI-generated imagery, new framework or paid provider added.

## Delivered

- Removed floating hero pause button; retained pause/play in Display for accessibility. Removed homepage search/quick-link strip and global search navigation/function. Old search URLs now open a static section directory.
- Shared pre-paint dark/light/automatic appearance, remembered locally and synchronized between tabs. Dark is the default. More solid header backing for legibility over footage.
- City GIS neighborhoods and sub-neighborhoods: 49 source polygons, 35 sub-neighborhood choices. Point-in-polygon filters, selected boundaries, phase legend, scrollable results, map expansion, approximate-location disclosures, original project sources. Boundary refresh added to the existing six-hour workflow.
- Homepage news desk; full news page with editorial hierarchy and real illustrative coastal imagery. Cleaner City-provided subhead excerpts refreshed automatically.
- Series shelves, horizontal navigation, original thumbnails, explicit-click YouTube player and retained episode URLs.
- David-only About page with a genuine frame from his Jeffrey Soffer conversation, source-backed biography, and verified office email. Separate Mayor & Commission page with seven official portraits.
- Updated resident services and distinct City Hall reading layouts. Shared bounded motion extended to new editorial modules. Native loading shells retained for asynchronous regions; static pages render immediately.

## Verification

- Full data validation and parser regressions; 374 local links/assets across 13 routes.
- Homepage film binary hashes unchanged; playback, mobile source, pause, offscreen, reduced-motion and data-saving regression tests pass.
- Theme tests: dark default, light persistence, automatic OS changes, cross-tab changes, invalid storage and denied storage.
- Geometry tests cover holes, multi-polygons, invalid coordinates and source-layer phase priority.
- Browser layout checks at 390px and 1440px; no horizontal overflow or stuck loading sections. Light mode checked on every mobile route; both themes visually inspected on civic readers and maps.
- Actual mobile agenda scrolling moved the list independently (591px, page scroll unchanged).
- West Ave filter returned six current mapped features; South of Fifth returned one. Reset, source switching and expanded/compact map controls verified. Future needs remain explicitly not confirmed funding.
- Video shelf navigation, series filter, no-results state, selected episode and explicit-click iframe creation verified. Third-party YouTube delivery remains provider-dependent.
- Offline-feed preview: homepage, media, projects, agenda, decisions and news expose fallbacks with zero remaining skeletons. Temporary test server stopped afterward.

## Source notes

Boundaries: City gc_Cadastral MapServer layers 11/12. A project point inside a boundary does not establish the project's complete service area; larger work can cross boundaries. Public Works is scheduled-refresh GIS data, not a real-time construction tracker. The neighborhood editorial catalog and future-needs presentation are separate, labeled sources.

About frame: official YouTube episode BBupCl9Bc2w at 02:57, reframed to 4:5. Biography/contact checked against the City's Commissioner David Suarez profile. Commission portraits are unchanged official City assets. News image is explicitly labeled illustrative city footage, not an image of the reported event.

The unrelated user file `design-qa 2.md` was not edited or staged.

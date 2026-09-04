# Resident hub simplification — September 4, 2026

## Brief

Make the existing 12-page website calmer, more approachable and less overwhelming, with Apple-like restraint. Preserve David’s navy/teal identity, the Suarez wordmark, real thumbnails, official portraits, source links and all civic records.

## Reviewed journeys and changes

1. **Home → find information: improved.** Reduced two navigation rows to one; grouped commission resources under City Hall. Added a useful homepage search and three common service shortcuts. Removed the dense recent-action list from the homepage; decisions remain one click away. Replaced all-caps display typography outside the wordmark with readable sentence-case headings, light backgrounds and quieter separators.
2. **Search → resident service: improved.** Service names are scannable disclosure rows. Instructions and official links appear on demand; one service opens at a time. Search and direct hash links open the correct service automatically. All 12 service entries remain available.
3. **Agenda → item → source: improved.** Advanced filters are closed by default with an active-filter count. All 11 agenda sections are accessible in a labeled selector instead of an overflowing tab strip. The selected item is visibly marked, official titles are expandable, and source caveats remain available. Mobile readers have a Back to items button. Agenda items remain explicitly distinct from decisions.
4. **Decisions → vote: improved.** Outcome remains immediately visible, with meeting and vote-path filters available on demand. Official action, consent, votes, amendments and source evidence are retained unchanged.
5. **Meetings, videos and supporting pages: improved.** Meetings show five upcoming events initially with all remaining events available by button; participation guidance, glossary and past meetings are expandable. Videos use a consistent light reading surface and complete thumbnails; redundant social buttons no longer compete with playback. Search and legislation show 12 results at a time. Projects, news, sources and the commissioner directory share the quieter visual system.

## Verification

- Captured current before/after homepage, agenda and service screens at 1280×900 and reviewed the matched pairs together.
- Reviewed desktop screenshots of meetings, decisions, videos, projects, legislation, sources, directory and news.
- Checked all 12 routes at 390×844: one main heading, no document-level horizontal overflow; mobile menu opened and closed on every route.
- Found and fixed duplicate shared-module loading that caused the mobile menu to toggle twice. Added a regression assertion and versioned transitive module imports to avoid stale browser caches.
- Tested nested City Hall menu with Escape: closes the submenu first, then the mobile menu, restoring focus appropriately.
- Homepage parking search returned 106 results; selecting the parking service opened the correct disclosure. Opening another service closed the first.
- Agenda section selection returned 44 ordinances. Combining North Beach yielded two; resetting restored 208 items and cleared the active-filter count.
- Mobile agenda list scrolled from 0 to 344px using PageDown; turtle-item selection and Back to items restored keyboard focus to the selected item.
- Decisions switched from Passed to all 1,188 actions; July 22 meeting filtering returned 194 records and a visible active-filter count.
- Existing parser, public-data integrity and local-link tests pass. No source data or update schedules changed in this release.

Screenshots are saved locally under `work/qa/calm/`. These are functional and visual checks, not a claim of complete WCAG compliance or a new independent verification of every civic record. The source limitations from SITE-REVIEW.md remain applicable.

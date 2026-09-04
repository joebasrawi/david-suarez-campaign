# Civic Network design QA

## Compared artifacts

- Selected agenda direction: `/Users/joe/.codex/generated_images/01a06d30-4655-7692-aa71-f2fe4a29a919/exec-2061be98-f076-426a-a18f-75ad9c7e27a2.png`
- Implementation: `http://127.0.0.1:4173/commission-agenda/?item=R5P`
- Combined comparison: `http://127.0.0.1:4173/work/qa/agenda-comparison.html`
- Reference and implementation were reviewed together in one comparison input using the same 1440 × 1024 target state.

## Findings and fixes

1. **P1 · Agenda hierarchy:** The first implementation used an oversized navy meeting banner that displaced the core reader. It was replaced with the selected direction’s compact cream meeting header, official-source panel, filter row, section tabs, and split list/detail workspace.
2. **P1 · Sponsor integrity:** Concept imagery could not be treated as sponsor identity. Production sponsor cards now resolve only against the official City of Miami Beach elected-official roster and use City-hosted portraits plus official profile links. Unresolved names never receive a portrait.
3. **P1 · Data completeness:** The prior homepage snapshot exposed only David-sponsored items. The reader imports the complete current agenda snapshot, including every City-provided section, while preserving a David-only filter.
4. **P2 · Hero composition:** The featured story’s left-side text field obscured the official YouTube thumbnail and cropped the right-hand subject. Text was moved into a compact lower field and the image now uses the complete 16:9 thumbnail without a cover crop.
5. **P2 · Naming:** The visible video series label and supporting library copy now use “Accountability” instead of “Investigations.”

## Final verification

- The latest source sync reports 208 parsed items across 10 City-provided sections.
- Section totals currently resolve to 6 competitive bid reports, 6 committee assignments, 2 committee reports, 60 consent resolutions, 44 ordinances, 48 regular resolutions, 32 discussables, 1 City Attorney report, 2 informational items, and 7 notices.
- Search, department, neighborhood, hearing-time, status, section, and David-only controls are wired to the same filtered item collection.
- Direct item URLs preserve selection through `?item=` and update as residents move between items.
- Item R5P correctly resolves the official David Suarez and Alex J. Fernandez portraits, City profiles, City Attorney department, Citywide neighborhood, and 9:55 a.m. hearing time.
- The PrimeGov meeting stays labeled as the legal source; Miami Beach Agenda stays labeled as the navigation layer.
- Static data validation, JavaScript syntax checks, and whitespace checks pass.

## September 4 homepage and decisions pass

- User reference: `/var/folders/vg/zy36khk5319fpzq07mv4fjtm0000gn/T/TemporaryItems/NSIRD_screencaptureui_aa1qvD/Screenshot 2026-09-04 at 1.45.38 PM.png`
- Implementation: `http://127.0.0.1:4173/`
- Combined comparison: `/Users/joe/Documents/DAVID MB/work/qa/homepage-comparison.jpg`
- Reference and implementation were reviewed together at the same 1280 × 720 viewport and top-of-page state.
- The updated hero preserves the entire official YouTube thumbnail at 16:9, moves all site copy into a compact field below it, and removes the former dead navy area.
- Homepage content was reduced to the featured story, official City snapshot, series entry points, four resident tools, alerts, and contact information. Full video and legislation collections now live on dedicated routes.
- The 2026 decisions reader was checked in the in-app browser with passed, consent/separate, amendment, meeting, and search controls. A David Suarez-sponsored record resolved his official City portrait, motion, roll call, vote result, amendment text, and approved-minutes link.
- The dedicated Watch and Legislation pages were checked visually; video-series filtering and real official YouTube thumbnails were verified.
- The scheduled public-data workflow refreshes every six hours, so newly published monthly meeting minutes are picked up automatically.

## September 4 agenda scrolling fix

- Source visual truth: `/var/folders/vg/zy36khk5319fpzq07mv4fjtm0000gn/T/TemporaryItems/NSIRD_screencaptureui_k7TOul/Screenshot 2026-09-04 at 2.20.15 PM.png`
- Browser-rendered implementation: `/Users/joe/Documents/DAVID MB/work/qa/agenda-scroll-fixed.jpg`
- Combined comparison: `/Users/joe/Documents/DAVID MB/work/qa/agenda-scroll-comparison.jpg`
- Source image: 1088 × 1182 pixels. The detached macOS screenshot does not expose its CSS viewport or density; it was normalized to 739 pixels wide for the combined comparison while preserving its aspect ratio.
- Implementation capture: 739 × 940 pixels at the in-app browser's responsive single-column state.
- State: the source shows the agenda list stuck at C2A; the implementation shows the same 208-item list after a direct scroll gesture, advanced to C7AG with the internal scrollbar thumb visibly moved.
- Full-view evidence: the responsive agenda reader, filters, section tabs, and list hierarchy remain visually consistent after the fix.
- Focused interaction evidence: the agenda list accepted a browser scroll targeted at the list container and moved through multiple item groups without moving or locking the surrounding page.
- Earlier P0 finding: the flex child retained its automatic minimum height, so the 208-item list expanded beyond its fixed reader track and was clipped instead of becoming a usable scroll area.
- Fix: the browser and list tracks now allow flex/grid shrinking with `min-height: 0`; both list and detail panes receive explicit touch momentum, stable scroll gutters, and contained overscroll.
- Post-fix result: mouse/trackpad-style scrolling works in the in-app browser at the responsive breakpoint represented by the report. Typography, spacing, color tokens, imagery, and copy were unchanged.

final result: passed

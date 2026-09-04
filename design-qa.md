# Design and functional QA — resident hub release
Date: September 4, 2026

final result: passed

## Scope
Twelve resident-facing routes: home, resident guide, search, meetings, city news, sources, commission roster/contact, legislation, commission agenda, decisions/votes, project explorer and media.

This was an improvement of the existing site, not a pixel-identical clone. The approved navy/teal/cream identity, Anton/Inter typography, authentic YouTube thumbnails and official City portraits were retained.

## Visual evidence
Before screenshots were captured from the existing homepage, media library, project explorer, legislation tracker and decisions reader; the existing agenda was inspected directly. Evidence is saved under the ignored local directory `work/qa/audit/`.

The original and final live homepage screenshots were reviewed together at matching 1280 × 720 viewport dimensions. A transient malformed capture immediately after a browser viewport change was discarded and recaptured. The final image preserves both people and the complete thumbnail, moves supporting copy below it, and uses a wider readable news column. The larger resident dashboard and contact sections have been replaced by compact links to dedicated pages.

Phone-size captures at 390 × 844 were reviewed for the guide, legislation, contact, media and agenda. The contact button's low contrast was found during visual inspection and corrected. Mobile selects remain native controls; horizontal secondary navigation can be scrolled independently.

## Functional checks
- No document-level horizontal overflow on all twelve routes at 390 px. Home and decisions were also checked at 768 px; key desktop layouts were checked at 1280 px.
- Mobile menu opens; Escape closes it and returns focus.
- Agenda list has a constrained scroll area. A keyboard PageDown changed its scrollTop from 0 to 407 at phone size; the detail pane remains separately usable.
- Existing item-number agenda URLs still resolve, and section-specific IDs eliminate the known informational-item collision.
- A direct link to a Referred action selects the correct item and switches the default Passed filter appropriately.
- Meeting-specific decision links retain the selected meeting.
- Service search filters to bulk-waste help.
- Global search supports category filters; the live Pages deployment links correctly within its repository subpath.
- Legislation switches between upcoming items and 2026 actions and displays a useful empty state.
- Video series filters show five Sound Off episodes and the previously missing ride-along. The inline YouTube player was observed playing the selected real video.
- Project phase filtering works; the replacement map displays real OpenStreetMap tiles.
- An address lookup for the public City Hall address returned a selectable result. Selecting it narrowed the future-needs dataset from 42 to eight projects within one mile; clearing restored all 42.
- Seven official commissioner portraits are rendered on the directory.
- All twelve deployed routes returned HTTP 200 with the new shared navigation.
- `npm test` passes public-data validation, unique-ID checks, conservative vote-parser regressions, script-module declarations and 294 local links/assets.
- The real GitHub Pages deployment succeeded. A manual run of the six-hour public-data workflow also completed successfully and published refresh-health metadata.

## Limits
This is not a full assistive-technology certification, a manual legal audit of 1,188 actions, or a claim that every external document is available indefinitely. Complex multi-motion items intentionally withhold a single vote score. Source coverage, the September 10 meeting-time discrepancy, manual project catalogs and editorial guide review dates are disclosed on the website.

The unrelated user-owned `design-qa 2.md` was not changed.

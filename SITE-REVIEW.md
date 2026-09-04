# Resident hub release — September 4, 2026

## Audit and outcome

The review covered all six original routes and their core tasks. The original brand, real YouTube thumbnails and official City portraits were retained. Changes followed the design audit: consistent navigation, clearer source distinctions, visible mobile controls, no text over faces, and fewer duplicated homepage sections.

Key issues addressed:

- The old global search only searched 23 historical legislation records. Search now spans the current agenda, 2026 actions, projects, services, news and videos.
- The project map used a tile source displaying an API-key warning. The new explorer uses OpenStreetMap and keeps an accessible list. Public Works GIS, the editorial neighborhood catalog and future needs are separate datasets.
- The video RSS feed replaced history with 15 uploads. Sync now preserves previous uploads and discovers additional full-length videos on the official channel; all five Sound Off episodes and all three civics episodes are indexed.
- The old legislation page was stale. The replacement shows upcoming legislation and 2026 recorded actions, with direct official registry links and first-reading cautions.
- The City calendar feed exposed only five upcoming government events. The replacement uses the official categorized events API with pagination and a 60-day window. The upstream pagination link drops its category parameter; the sync preserves it explicitly.
- Agenda IDs could collide across informational sections. IDs now include the section, while existing item-number links remain supported.
- Re-rendering an agenda selection removed focus and scrolled positions. Selection now updates the existing buttons and resets only the detail pane.
- Consent votes were inferred too broadly. The parser now excludes separated/addendum references, avoids inheriting votes for deferred/withdrawn items, discloses inherited votes, and withholds a single score when multiple roll calls occur.
- PDF page anchors and extracted action text let residents verify a result more quickly.
- A failed public feed previously blocked all later refreshes. Feeds now fail independently; validated snapshots can still publish and the workflow reports a failure.

## Coverage and honest limits

- 208 items in the September 10 agenda snapshot.
- 1,188 extracted actions across nine published 2026 meeting records through July 22. The May 5 budget retreat has published minutes but no item-shaped actions identified by this parser; its original minutes remain linked.
- The official 2026 annual schedule begins in February and lists an August recess. This does not imply unpublished records or special meetings never existed.
- 21 indexed YouTube videos. The archive is not claimed to be a complete export of the channel.
- 116 Public Works GIS features. Multiple features can represent one project. The separate neighborhood catalog and future-needs presentation are not automatically refreshed.
- 12 editorial resident-service guides reviewed against their official links.
- The City’s September 10 calendar event says 9:00 a.m.; its annual schedule says 8:30 a.m. The meeting page discloses the discrepancy and directs residents to confirm the meeting notice.
- Vote labels and amendments are automated extractions, not legal findings or manually certified minutes. A missing extracted amendment is not proof of no amendment.

## Maintenance

`npm run build` assembles the shared navigation and seven generated information pages, then versions local CSS and script URLs by content hash. Edit their templates in `scripts/build-site.mjs`. The homepage, agenda reader, decisions reader, video library and project explorer retain their own implementation files.

`npm run sync:data` refreshes seven source groups, validates snapshots, builds the small homepage summary and records refresh health. The existing GitHub workflow runs every six hours, including across month changes. `npm test` verifies source/data constraints, parser regressions, unique IDs, module loading declarations and local links/assets.

Original project scripts and the earlier 23-record data remain in Git history/source files; they are no longer the primary resident experience. The unrelated user file `design-qa 2.md` was left untouched.

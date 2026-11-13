# Events preview

Local-only implementation, not published.

- `/events/`: 41 official City calendar entries retrieved November 13, 2026, plus one user-approved community cleanup.
- `/events/<id>/`: accessible detail page with one Add to Calendar ICS action, per Joe’s review. iPhone/desktop import depends on browser/app association; Android may download rather than open Google Calendar. Universal native-calendar routing is not guaranteed.
- `/julia-tuttle-cleanup/`: alternate cleanup URL.
- Active source snapshot: existing `data/city-calendar.json`; `data/events-city-source.json` retains the original retrieval for reference.
- User-managed events: `data/custom-events.json`.
- Derived normalized manifest: `data/community-events.json`.
- Generate: `python3 scripts/build-events-preview.py`. This does not fetch new events.

The draft extends the existing six-hour public-data workflow to generate Events from its validated City snapshot, run offline failure tests, commit generated pages, and explicitly request a GitHub Pages build (bot pushes do not trigger one automatically). This is configured but not active until approved publication. The City fetcher retains prior data on network errors/empty results; the Events generator rejects malformed/empty/duplicate data before writing pages. Manual cleanup data is separate and preserved. Removed City events leave the upcoming list; old detail URLs remain available for existing links. UI displays source snapshot timestamp.

Validation: `python3 scripts/test-events.py` plus `npm test`. No live scheduled run or Pages rebuild has been triggered while approval is pending.

Calendar end times for City events are copied from the official feed, not guaranteed adjournment times. No individual event attendance has been booked. Calendar imports are one-time copies.

Prepared in an isolated clone based on current remote main (244d8a2), local branch codex/events-calendar-preview. Only Events files and navigation additions are changed. Nothing pushed. Joe must review and approve publication.

The cleanup includes the unmodified original 1080×1350 flyer, responsive and with descriptive alt text.

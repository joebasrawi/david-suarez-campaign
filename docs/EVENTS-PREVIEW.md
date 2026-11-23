# Events preview

Local-only implementation, not published.

- `/events/`: 41 official City calendar entries retrieved November 13, 2026, plus one user-approved community cleanup.
- `/events/<id>/`: accessible detail page with Google Calendar, Outlook and ICS export.
- `/julia-tuttle-cleanup/`: alternate cleanup URL.
- Source snapshot: `data/events-city-source.json`.
- User-managed events: `data/custom-events.json`.
- Derived normalized manifest: `data/community-events.json`.
- Generate: `python3 scripts/build-events-preview.py`. This does not fetch new events.

The existing six-hour public-data workflow commits only data, not newly generated Events pages. It must be deliberately extended and validated before claiming automatic Events refresh. Current UI explicitly describes snapshot coverage.

Calendar end times for City events are copied from the official feed, not guaranteed adjournment times. No individual event attendance has been booked. Calendar imports are one-time copies.

Before publication, apply only these new files to the current remote publishing branch; the local base is older than recent live-site work. Joe must review and approve publication.

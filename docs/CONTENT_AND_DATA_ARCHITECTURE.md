# Resident hub content and data architecture

The site should help a resident answer three questions quickly:

1. What is happening in Miami Beach right now?
2. What decisions are coming up, and how can I participate?
3. What has Commissioner Suarez said or produced about the issue?

## Information hierarchy

- **Miami Beach right now:** time-sensitive city meetings, notices, projects and alerts.
- **Decisions and records:** searchable agendas, ordinances, resolutions and meeting video.
- **By neighborhood:** projects and meetings organized around where a resident lives.
- **Watch and listen:** Suarez Sound Off, Miami Beach Civics, ride-alongs and issue explainers.
- **About and contact:** biography, office/contact details, constituent help and channel links.

## Source labels

Every record rendered on the site should carry one of these labels:

- **Official city record** — copied from or linked to a City of Miami Beach source.
- **Commissioner update** — an update or explanation published by David Suarez.
- **Original program** — podcast, civics, ride-along or other produced media.

Official records and commissioner commentary must not be visually merged into a single unlabeled feed. When an explanation discusses an ordinance or meeting item, the official record remains the primary source link.

## Update model

The automated sync writes versioned JSON into `data/` and never fetches third-party feeds directly in a resident's browser. This keeps the public pages fast and provides a reviewable history in Git.

- YouTube: official channel Atom feed, classified into site series by title.
- Meetings: official City of Miami Beach calendar export, limited to upcoming City Government entries.
- Commission agendas: all current meeting items, agenda sections, departments, hearing times, neighborhoods, and sponsor/co-sponsor metadata are discovered through Miami Beach Agenda. The on-site agenda reader presents this as a searchable split list/detail view while linking directly to the official PrimeGov legal source.
- Elected sponsors: the current Mayor and six Commissioners are matched against the official City directory. Sponsor cards use only City-hosted portraits and official profile links recorded in `data/commissioners.json`.
- City news: official City of Miami Beach press releases from the city's WordPress API.
- Projects: official Public Works ArcGIS layers for construction, design and planning.
- Ordinances and resolutions: discover changes automatically, but publish resident-facing summaries only after a human verifies the official document, number, adoption date and source link.

Each generated file includes `generatedAt` and a source URL. A failed validation stops the update instead of replacing good data with an empty or malformed feed.

## Publishing guardrails

- Preserve exact official titles and identifiers.
- Put plain-language summaries in separate fields; never overwrite the official title.
- Show “last checked” timestamps on time-sensitive sections.
- Link directly to the official document or meeting page whenever possible.
- Treat social posts as commentary, not as the legal record.
- Treat Miami Beach Agenda as a navigation layer, not the legal record; preserve the official PrimeGov link for every synced meeting.
- Use the item count on the meeting page rather than the Miami Beach Agenda home-page summary, and stop the sync if the parsed item total does not match it.
- Render a sponsor portrait only after the sponsor name resolves to the verified official commissioner roster. Unknown names remain department or agency labels, never portrait placeholders.
- Keep English and Spanish content as paired fields in the future content model.

# David Suarez Miami Beach Resident Hub

A resident-first website for Miami Beach information and Commissioner David Suarez's original media.

The project is a static GitHub Pages site. Its source snapshots are refreshed from official City of Miami Beach feeds and the commissioner's official YouTube channel, then validated before publication.

## Public data

Run all feed synchronizations with Node.js 20 or newer:

```sh
npm run sync:data
```

The scheduled GitHub Action refreshes:

- upcoming City Government calendar entries;
- Public Works construction, design and planning projects;
- the latest videos from Commissioner Suarez's YouTube channel; and
- City Clerk ordinance and resolution registry status.

The homepage's “Watch David” section uses the newest upload across the channel,
plus the newest thumbnail for each of its four series. The existing six-hour sync
rebuilds `data/home-summary.json`; the next page load picks up those changes.
YouTube outages retain the last good catalog, and a failed browser request leaves
the built homepage fallback visible. No API key is required.

Run `npm test` for offline regression checks and `npm run build` to regenerate the
static pages (including the homepage's no-JavaScript video fallback).

See [the content and data architecture](docs/CONTENT_AND_DATA_ARCHITECTURE.md) for source-labeling and review rules.

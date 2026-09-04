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

See [the content and data architecture](docs/CONTENT_AND_DATA_ARCHITECTURE.md) for source-labeling and review rules.

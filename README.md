# David Suarez · Miami Beach Resident Hub

A website for Miami Beach residents to find City services, meetings, commission agendas and decisions, neighborhood projects, and Commissioner David Suarez’s videos and updates.

This is an independent resident hub, not the official City website. Official City records remain authoritative.

## Site at a glance

- **Repository:** [joebasrawi/david-suarez-campaign](https://github.com/joebasrawi/david-suarez-campaign)
- **Intended domain:** `davidsuarezmb.com`
- **Frontend:** static HTML, CSS, and JavaScript; no application server or database required.
- **Hosting:** designed for GitHub Pages; compatible with static hosting that serves directory `index.html` files.
- **Content:** checked-in JSON snapshots in `data/`, refreshed by scripts and a scheduled GitHub Action.

The published files live at the repository root. There is no `dist/` directory. Node.js is used for maintenance and validation, not to serve the production site.

## Local setup

Use Node.js 20 or newer. The automated workflow uses Node.js 22.

```sh
git clone https://github.com/joebasrawi/david-suarez-campaign.git
cd david-suarez-campaign
npm install --ignore-scripts --no-audit --no-fund
npm test
```

To preview the checked-in site, serve the repository root over HTTP. For example, if Python 3 is installed:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000`. Use an HTTP server rather than opening HTML files directly, because the pages load JavaScript modules and JSON snapshots.

## Build and validate

```sh
npm run build
npm test
```

The build updates page HTML and asset versions **in place**. Review and commit those changes along with the source edits before publishing. Some layouts are generated from `scripts/`; editing only their generated HTML can be overwritten by the next build.

`npm test` checks data snapshots, site structure and asset references, motion behavior, homepage film logic, and the coastal theme. It does not replace a browser review of the site.

## Deployment handoff

### GitHub Pages

1. Confirm the release branch contains the intended site changes and passes `npm test`.
2. In the repository’s Pages settings, configure branch publishing from that branch’s root directory.
3. Confirm the site works at its Pages address before switching the domain.
4. Coordinate `davidsuarezmb.com` with the domain administrator: configure the custom domain in Pages, apply the DNS records required by the host, and verify HTTPS once available.

The repository’s data-sync workflow refreshes content; it is not a deployment workflow. Pages publishing and custom-domain settings must be configured separately. No `CNAME` file is currently checked in.

### Another static host or a ZIP handoff

Publish the root HTML, CSS, and JavaScript files, plus `assets/`, `data/`, and all public page directories listed below. Preserve their relative paths and configure directory URLs such as `/about/` to serve their `index.html` files.

Keep development material such as `.git/`, `.github/`, `node_modules/`, `scripts/`, `docs/`, `sources/`, `tmp/`, `work/`, and review notes out of the public upload. Retain the complete source repository separately for maintenance.

A ZIP contains a snapshot of the site. For ongoing data updates on another host, configure deployment when the sync workflow commits changes to the publishing branch.

## Public data updates

Refresh all supported sources manually with:

```sh
npm run sync:data
npm test
```

The [Sync public data workflow](.github/workflows/sync-public-data.yml) is scheduled every six hours, at minute 17, and can also be started manually in GitHub Actions. It requires permission to write repository contents so it can commit updated `data/` files.

Sources include the commissioner’s YouTube feed, City meetings and news, commission agendas and recorded actions, Public Works projects, neighborhood data, and City Clerk registry status. The browser reads saved snapshots rather than running these sync scripts.

If a source refresh fails, the sync retains its previous snapshot and records the failure in `data/sync-status.json`. The workflow can commit other validated updates, then reports the failed refresh. If validation fails, the commit step does not run.

Review failures in GitHub Actions and check snapshot timestamps before treating information as current. Resident-facing legal summaries require human verification against the official record; see the [content and data architecture](docs/CONTENT_AND_DATA_ARCHITECTURE.md).

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, root `*.css` and `*.js` | Homepage, shared styles, navigation, and browser behavior |
| `about/`, `commission/`, `resident-guide/`, `search/` | Profile, elected officials, resident services, and section directory |
| `meetings/`, `commission-agenda/`, `commission-actions/`, `legislation/`, `news/` | City meetings, records, and announcements |
| `active-projects/`, `media/` | Project explorer and video library |
| `assets/` | Images, video, and other public assets |
| `data/` | Public JSON snapshots and sync status |
| `scripts/` | Page generation, source refreshes, and validation |
| `.github/workflows/` | Scheduled data maintenance |
| `docs/` | Content architecture and source-review guidance |

import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fetchJson, isoNow, writeSnapshot } from './lib.mjs';

const PRIMEGOV = 'https://miamibeachfl.primegov.com';
const ARCHIVE_URL = `${PRIMEGOV}/api/v2/PublicPortal/ListArchivedMeetings?year=2026`;
const START_DATE = '2026-01-01';
const commissioners = JSON.parse(await readFile(new URL('../data/commissioners.json', import.meta.url), 'utf8'));
const commissionerNames = commissioners.items.flatMap(person =>
  [person.name, ...person.aliases].map(alias => [alias.toLowerCase(), person.slug])
);

function isoDate(value) {
  const date = new Date(`${value} 12:00:00`);
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString().slice(0, 10);
}

function cleanLine(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function isPageFurniture(line) {
  return /^Page \d+ of \d+$/i.test(line)
    || /^City of Miami Beach .*Commission Meeting/i.test(line)
    || /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 2026$/i.test(line);
}

async function extractPdfLines(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'DavidSuarezResidentHub/1.0 (+https://github.com/joebasrawi/david-suarez-campaign)' },
    signal: AbortSignal.timeout(90_000)
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const data = new Uint8Array(await response.arrayBuffer());
  const pdf = await getDocument({ data, disableWorker: true }).promise;
  const lines = [];
  lines.pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = [];
    for (const item of content.items.filter(item => cleanLine(item.str))) {
      const y = item.transform?.[5] ?? 0;
      let row = rows.find(candidate => Math.abs(candidate.y - y) < 1.5);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ x: item.transform?.[4] ?? 0, width: item.width ?? 0, text: item.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const line = cleanLine(row.items.reduce((value, item, index) => {
        if (!index) return item.text;
        const previous = row.items[index - 1];
        const gap = item.x - (previous.x + previous.width);
        const separator = /\s$/.test(value) || /^\s/.test(item.text) || gap < 0.7 ? '' : ' ';
        return `${value}${separator}${item.text}`;
      }, ''));
      if (line && !isPageFurniture(line)) { lines.pages.push(pageNumber); lines.push(line); }
    }
  }
  return lines;
}

function uppercaseRatio(value) {
  const letters = value.match(/[A-Za-z]/g) || [];
  return letters.length ? letters.filter(letter => letter === letter.toUpperCase()).length / letters.length : 0;
}

function itemStart(line) {
  const match = line.match(/^((?:C|R)\d+|RDA)\s+([A-Z]{1,3}|\d+)\*?\s+(.+)$/);
  if (!match || match[3].length < 18 || uppercaseRatio(match[3]) < 0.62) return null;
  return { itemNumber: `${match[1]} ${match[2]}`, titleStart: match[3] };
}

function extractRollCall(lines) {
  const start = lines.findIndex(line => /^VOTES:$/i.test(line));
  if (start < 0) return [];
  const votes = [];
  for (const line of lines.slice(start + 1, start + 12)) {
    const match = line.match(/^(Mayor|Commissioner|Vice-Mayor)\s+(.+?):\s+(Yes|No|Absent|Abstain|Abstained|Recused|No Vote)$/i);
    if (!match) {
      if (votes.length) break;
      continue;
    }
    votes.push({ member: `${match[1]} ${match[2]}`, vote: match[3] });
  }
  return votes;
}

function extractVoteSummary(lines, fallback = '') {
  const actionIndex = lines.findIndex(line => /^ACTION:/i.test(line));
  const relevant = lines.slice(Math.max(0, actionIndex)).join(' ');
  const match = relevant.match(/(?:Vote|Roll Call(?: taken)?):\s*(\d+\s*-\s*\d+(?:\s*-\s*\d+)?)/i);
  return match ? match[1].replace(/\s+/g, '') : fallback;
}

function extractAction(lines) {
  const start = lines.findIndex(line => /^ACTION:/i.test(line));
  if (start < 0) return '';
  const result = [lines[start].replace(/^ACTION:\s*/i, '')];
  for (const line of lines.slice(start + 1)) {
    if (/^(VOTES:|AMENDMENTS:|Handouts?\b|Reference Materials?:|Commissioner\s|Mayor\s|Vice-Mayor\s|The Public Hearing\b)/i.test(line)) break;
    result.push(line);
    if (result.join(' ').length > 1100) break;
  }
  return cleanLine(result.join(' '));
}

function extractMotion(lines) {
  const text = lines.join(' ');
  const matches = text.match(/(?:A motion was made by|[A-Z][a-z-]+ made a motion|motion to)[^.]{0,520}(?:\.|;)/gi) || [];
  return cleanLine(matches.find(value => /adopt|approve|accept|refer|defer|continue|withdraw/i.test(value)) || matches[0] || '');
}

function extractAmendments(lines, action) {
  const start = lines.findIndex(line => /^AMENDMENTS:$/i.test(line));
  if (start >= 0) {
    const amendmentLines = [];
    for (const line of lines.slice(start + 1, start + 22)) {
      if (/^(VOTES:|Handouts?\b|Reference Materials?:|Commissioner\s|Mayor\s|Vice-Mayor\s)/i.test(line)) break;
      amendmentLines.push(line);
    }
    const text = cleanLine(amendmentLines.join(' '));
    if (text) return [text];
  }
  if (!/\bas amended\b|\bwith changes\b/i.test(action)) return [];
  const text = lines.join(' ');
  const match = text.match(/(?:as amended to|with changes(?: to)?|with the following amendments?)[^.]{0,700}\./i);
  return match ? [cleanLine(match[0])] : ['The official action was adopted as amended; see the approved minutes for the complete amendment language.'];
}

function outcomeFor(action) {
  // Classify the recorded disposition, not a failed motion discussed later.
  const lead = action.split(/\.\s+(?=[A-Z])/)[0];
  if (/\b(adopted|approved|accepted|authorized|passed|carried|awarded|confirmed|granted)\b/i.test(lead)
      && !/\b(not|failed|denied)\b/i.test(lead)) return 'Passed';
  if (/\b(no separate action|no action was taken|not reached|discussion held|informational only)\b/i.test(action)) return 'Other action';
  if (/\b(failed|did not pass|motion failed|denied)\b/i.test(action)) return 'Failed';
  if (/\b(withdrawn|withdrew)\b/i.test(action)) return 'Withdrawn';
  if (/\b(deferred|continued|tabled)\b/i.test(action)) return 'Deferred';
  if (/\b(referred|dual-referred|dually referred)\b/i.test(action)) return 'Referred';
  if (/\b(adopted|approved|accepted|authorized|passed|carried|awarded|confirmed|granted)\b/i.test(action)) return 'Passed';
  return 'Other action';
}

function sponsorSlugs(lines) {
  const actionIndex = lines.findIndex(line => /^ACTION:/i.test(line));
  const preAction = lines.slice(0, actionIndex < 0 ? lines.length : actionIndex)
    .filter(line => /^(?:Sponsor(?:s)?:\s*)?(?:Commissioner|Mayor|Vice-Mayor)\s/i.test(line)).join(' ').toLowerCase();
  return [...new Set(commissionerNames.filter(([name]) => preAction.includes(name)).map(([, slug]) => slug))];
}

function extractConsentContext(lines) {
  const text = lines.join(' ');
  const start = lines.findIndex(line => /motion.*adopt the Consent Agenda/i.test(line));
  const vote = start < 0 ? '' : extractVoteSummary(lines.slice(start));
  const excluded = new Set([...text.matchAll(/\b(C\d+)\s+([A-Z]{1,3})\*?\b/g)].map(m=>`${m[1]} ${m[2]}`));
  return { vote, rollCall: start < 0 ? [] : extractRollCall(lines.slice(start)), excluded, recorded: start >= 0 };
}

function parseMeeting(lines, meeting, minutesDocument) {
  const starts = [];
  lines.forEach((line, index) => {
    const parsed = itemStart(line);
    if (parsed) starts.push({ ...parsed, index });
  });
  const consent = extractConsentContext(lines.slice(0, starts[0]?.index || lines.length));
  const items = [];

  starts.forEach((start, index) => {
    const end = starts[index + 1]?.index || lines.length;
    const block = [start.titleStart, ...lines.slice(start.index + 1, end)];
    const titleLines = [start.titleStart];
    for (const line of block.slice(1)) {
      if (/^(?:\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.)|(?:First|Second) Reading|Applicable Area:|ACTION:)/i.test(line)) break;
      titleLines.push(line);
      if (titleLines.join(' ').length > 1800) break;
    }
    const action = extractAction(block);
    if (!action) return;
    const outcome = outcomeFor(action);
    const rollCall = extractRollCall(block);
    const explicitVote = extractVoteSummary(block);
    const voteBlockCount = block.filter(line => /^VOTES:$/i.test(line)).length;
    const consentItem = /^C\d+/.test(start.itemNumber) && consent.recorded
      && !consent.excluded.has(start.itemNumber)
      && !/separated from (?:the )?Consent Agenda|Addendum|Item moved from|individual vote/i.test(block.join(' '))
      && ['Passed','Referred'].includes(outcome) && !rollCall.length && !explicitVote;
    const voteSummary = voteBlockCount > 1 ? '' : explicitVote || (consentItem ? consent.vote : '');
    const amendments = extractAmendments(block, action);
    const page = lines.pages?.[start.index];
    const sourceUrl = `${PRIMEGOV}/Public/CompiledDocument?meetingTemplateId=${minutesDocument.templateId}&compileOutputType=${minutesDocument.compileOutputType}${page ? `#page=${page}` : ''}`;

    items.push({
      id: `${isoDate(meeting.date)}-${start.itemNumber.toLowerCase().replace(/\s+/g, '-')}`,
      meetingId: meeting.id,
      meetingDate: isoDate(meeting.date),
      itemNumber: start.itemNumber,
      title: cleanLine(titleLines.join(' ')),
      outcome,
      action,
      voteSummary,
      voteType: consentItem ? 'Consent agenda' : voteSummary || rollCall.length ? 'Separate vote' : 'Not recorded',
      consentPlacement: /^C\d+/.test(start.itemNumber) ? 'Listed on consent agenda' : 'Regular agenda',
      voteBasis: voteBlockCount > 1 ? 'Multiple roll calls appear in this item. Open the minutes to match each vote to its motion; no single vote is inferred here.' : consentItem ? 'Inherited from the recorded consent-agenda motion; no separate item vote identified.' : explicitVote || rollCall.length ? 'Item-specific vote extracted from the minutes.' : 'No separate vote identified. A vote has not been inferred.',
      rollCall: voteBlockCount > 1 ? [] : rollCall.length ? rollCall : consentItem ? consent.rollCall : [],
      voteBlockCount,
      sourcePage: page || null,
      recordExcerpt: block.slice(Math.max(0,block.findIndex(line=>/^ACTION:/i.test(line)))).join('\n').slice(0,18000),
      motion: extractMotion(block),
      amendments,
      sponsors: sponsorSlugs(block),
      sourceUrl
    });
  });
  return items;
}

const archive = await fetchJson(ARCHIVE_URL);
const meetings = archive
  .filter(meeting => meeting.committeeId === 2 && /Commission/i.test(meeting.title || ''))
  .map(meeting => ({ ...meeting, isoDate: isoDate(meeting.date) }))
  .filter(meeting => meeting.isoDate >= START_DATE && meeting.isoDate <= new Date().toISOString().slice(0, 10))
  .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

const meetingResults = [];
for (const meeting of meetings) {
  const minutesDocument = meeting.documentList.find(document => /^Minutes$/i.test(document.templateName || ''));
  const officialMeetingUrl = `${PRIMEGOV}/public/portal?fromiframe=true`;
  if (!minutesDocument) {
    meetingResults.push({
      id: meeting.id,
      date: meeting.isoDate,
      title: meeting.title,
      minutesStatus: 'Pending publication',
      officialMeetingUrl,
      videoUrl: meeting.videoUrl || '',
      itemCount: 0,
      items: []
    });
    continue;
  }
  const minutesUrl = `${PRIMEGOV}/Public/CompiledDocument?meetingTemplateId=${minutesDocument.templateId}&compileOutputType=${minutesDocument.compileOutputType}`;
  const lines = await extractPdfLines(minutesUrl);
  const items = parseMeeting(lines, meeting, minutesDocument);
  meetingResults.push({
    id: meeting.id,
    date: meeting.isoDate,
    title: meeting.title,
    minutesStatus: 'Approved minutes published',
    minutesPublishedAt: minutesDocument.publishDate,
    minutesUrl,
    officialMeetingUrl,
    videoUrl: meeting.videoUrl || '',
    itemCount: items.length,
    items
  });
  console.log(`Parsed ${meeting.isoDate}: ${items.length} recorded actions.`);
}

const items = meetingResults.flatMap(meeting => meeting.items);
await writeSnapshot('data/commission-actions.json', {
  generatedAt: isoNow(),
  timezone: 'America/New_York',
  coverage: {
    startDate: START_DATE,
    throughDate: meetingResults.filter(meeting => meeting.minutesStatus === 'Approved minutes published').at(-1)?.date || '',
    meetingCount: meetingResults.length,
    publishedMinutesCount: meetingResults.filter(meeting => meeting.minutesStatus === 'Approved minutes published').length,
    pendingMinutesCount: meetingResults.filter(meeting => meeting.minutesStatus !== 'Approved minutes published').length
  },
  source: {
    label: 'City of Miami Beach PrimeGov approved minutes',
    url: ARCHIVE_URL,
    note: 'Meeting outcomes, motions, roll-call votes, consent status, and amendments are extracted from official approved minutes. Pending meetings remain clearly labeled until minutes are published.'
  },
  meetings: meetingResults.map(({ items: meetingItems, ...meeting }) => ({ ...meeting, itemCount: meetingItems.length })),
  items
});

console.log(`Synced ${items.length} commission actions across ${meetingResults.length} meetings since ${START_DATE}.`);

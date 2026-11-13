// Validate source completeness, not an assumed minimum meeting size.
export function validateAgenda({items, sections, itemCount, meetingDate, officialAgendaUrl}) {
  if (!Number.isInteger(itemCount) || itemCount < 1 || !Array.isArray(items) || items.length !== itemCount)
    throw Error(`Agenda parsing mismatch: source reports ${itemCount} items and ${items?.length ?? 0} were parsed.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate || '') || !/^https:\/\/miamibeachfl\.primegov\.com\/Portal\/Meeting\?/.test(officialAgendaUrl || ''))
    throw Error('Agenda is missing its meeting date or official source.');
  if (!Array.isArray(sections) || !sections.length || sections.some(s => !s.id || !s.label || !Number.isInteger(s.count) || s.count < 0) || sections.reduce((n,s)=>n+s.count,0)!==itemCount)
    throw Error('Agenda section counts are incomplete.');
  if (new Set(items.map(i=>i.id)).size!==itemCount || new Set(sections.map(s=>s.id)).size!==sections.length)
    throw Error('Agenda contains duplicate IDs.');
  for (const item of items) {
    if (!item.id || !item.itemNumber || !item.title || !item.officialTitle || !item.section || item.meetingDate!==meetingDate || !Array.isArray(item.officialSponsors))
      throw Error('Agenda contains an incomplete item.');
    if (!sections.some(s=>s.label===item.section)) throw Error('Agenda item has an unknown section.');
  }
  for (const section of sections) if (items.filter(i=>i.section===section.label).length!==section.count)
    throw Error('Agenda per-section count mismatch.');
}

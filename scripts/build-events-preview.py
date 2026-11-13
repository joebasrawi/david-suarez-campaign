from pathlib import Path
from urllib.parse import urlencode
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
import json,re,html
root=Path(__file__).resolve().parents[1]; out=root/'events'
feed=json.loads((root/'data/city-calendar.json').read_text())
zone=ZoneInfo('America/New_York')
now=datetime.fromisoformat(feed['generatedAt'].replace('Z','+00:00'))
source='https://events.miamibeachfl.gov/City%20Meetings/'
def plain(s):
 return html.unescape(re.sub('<[^>]+>','',s or '')).strip()
def dt(s):return datetime.fromisoformat(s).replace(tzinfo=zone)
# Validate every input before writing any output. Bad/empty source retains all prior pages.
assert isinstance(feed.get('items'),list) and feed['items'], 'Empty or malformed City snapshot'
items=[]; seen=set()
for e in feed['items']:
 assert e.get('id') and e.get('title') and e.get('startLocal') and e.get('endLocal'), 'Incomplete City event'
 assert e.get('url','').startswith('https://events.miamibeachfl.gov/'), 'Untrusted event source'
 start,end=dt(e['startLocal']),dt(e['endLocal']);assert end>=start, 'Invalid time range'
 eid='city-'+str(e['id']);assert eid not in seen, 'Duplicate City event';seen.add(eid)
 items.append(dict(id=eid,title=plain(e['title']).rstrip('*').strip(),start=start.isoformat(),end=end.isoformat(),location=plain(e.get('location')) or 'See the official event notice for location and participation details.',description=plain(e.get('description'))+('\n'+e['note'] if e.get('note') else ''),source=e['url'],category='City calendar',allDay=len(e['startLocal'])==10))
custom=json.loads((root/'data/custom-events.json').read_text());assert isinstance(custom,list)
for e in custom:
 assert re.fullmatch(r'[a-z0-9-]+',e['id']) and e['id'] not in seen, 'Invalid or duplicate custom ID'
 assert e['title'] and datetime.fromisoformat(e['end'])>datetime.fromisoformat(e['start'])
 assert e['source'].startswith('https://')
 if e.get('flyer'): assert (root/e['flyer']).is_file(), 'Missing flyer'
 seen.add(e['id'])
items.extend(custom);items.sort(key=lambda e:e['start'])
manifest=dict(updatedAt=feed['generatedAt'],timezone='America/New_York',source=source,coverage='Official City calendar snapshot plus manually managed community events. Not an exhaustive list.',items=items)
out.mkdir(exist_ok=True)
(root/'data/community-events.json').write_text(json.dumps(manifest,indent=2))
base=(root/'about/index.html').read_text(); head=base.split('<body')[0];header=re.search(r'<header.*?</header>',base,re.S).group().replace(' aria-current="page"',''); footer=re.search(r'<footer.*?</footer>',base,re.S).group()
css='<style>.events-list{display:grid;gap:0}.event-row{display:grid;grid-template-columns:170px 1fr 24px;gap:24px;text-decoration:none;padding:24px 0;border-top:1px solid #537277}.event-row h2{font-size:1.35rem;margin:5px 0}.event-row p{margin:0;line-height:1.6}.event-row:hover h2{text-decoration:underline}.event-meta{opacity:.75;font-size:.88rem}.event-feature{padding:24px;border:1px solid #7aa99c;margin:28px 0 36px}.event-detail-text{white-space:pre-line;line-height:1.8}.event-filters{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}.event-filters button{padding:10px 16px;color:inherit;background:transparent;border:1px solid currentColor;border-radius:4px}.event-filters button[aria-pressed="true"]{background:#b3ddcc;color:#071b24}.event-row[hidden]{display:none}@media(max-width:600px){.event-row{grid-template-columns:1fr 18px;gap:8px}.event-date{grid-column:1/-1}.event-row h2{font-size:1.15rem}}</style>'
def shell(title,main,depth=1):
 h=re.sub(r'<title>.*?</title>',f'<title>{html.escape(title)} | David Suarez</title>',head)
 h=re.sub(r'<meta (?:name="description"|property="og:description").*?>','',h)
 h=re.sub(r'<meta property="og:title".*?>',f'<meta property="og:title" content="{html.escape(title,quote=True)}">',h)
 h=re.sub(r'<link rel="canonical".*?>','',h).replace('</head>','<link rel="stylesheet" href="../events.css"></head>')
 page=h+'<body data-page="events"><a class="skip-link" href="#main">Skip to main content</a>'+header+main+footer+'<script type="module" src="../pages.js"></script></body></html>'
 if depth==2:page=page.replace('="../','="../../')
 return page
def stamp(s):return datetime.fromisoformat(s).astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
def escape_ics(s):return s.replace('\\','\\\\').replace(';','\\;').replace(',','\\,').replace('\n','\\n')
def fold(lines):
 result=[]
 for line in lines:
  while len(line.encode())>73:
   i=73
   while len(line[:i].encode())>73:i-=1
   result.append(line[:i]);line=' '+line[i:]
  result.append(line)
 return ('\r\n'.join(result)+'\r\n').encode()
for e in items:
 d=out/e['id'];d.mkdir(exist_ok=True); start=datetime.fromisoformat(e['start']); end=datetime.fromisoformat(e['end'])
 url='https://davidsuarezmb.com/events/'+e['id']+'/'
 desc=e['description']+'\nSource and updates: '+e['source']+'\nSaved calendar entries are one-time copies. Check the source before attending.'
 if e['allDay']:
  from datetime import timedelta
  dates=start.strftime('%Y%m%d')+'/'+(end+timedelta(days=1)).strftime('%Y%m%d'); dtlines=['DTSTART;VALUE=DATE:'+start.strftime('%Y%m%d'),'DTEND;VALUE=DATE:'+(end+timedelta(days=1)).strftime('%Y%m%d')]
 else: dates=stamp(e['start'])+'/'+stamp(e['end']);dtlines=['DTSTART:'+stamp(e['start']),'DTEND:'+stamp(e['end'])]
 g='https://calendar.google.com/calendar/render?'+urlencode(dict(action='TEMPLATE',text=e['title'],dates=dates,ctz='America/New_York',details=desc,location=e['location']))
 o='https://outlook.live.com/calendar/0/deeplink/compose?'+urlencode(dict(path='/calendar/action/compose',rru='addevent',subject=e['title'],startdt=start.isoformat(),enddt=end.isoformat(),body=desc,location=e['location'],allday=str(e['allDay']).lower()))
 lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//David Suarez Resident Hub//Events//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+e['id']+'@davidsuarezmb.com','DTSTAMP:'+now.strftime('%Y%m%dT%H%M%SZ')]+dtlines+['SUMMARY:'+escape_ics(e['title']),'LOCATION:'+escape_ics(e['location']),'DESCRIPTION:'+escape_ics(desc),'URL:'+url,'END:VEVENT','END:VCALENDAR']
 (d/'event.ics').write_bytes(fold(lines))
 time='All day' if e['allDay'] else start.strftime('%-I:%M %p')+'–'+end.strftime('%-I:%M %p')+' Eastern'
 flyer=(f'<figure class="event-flyer"><a href="../{html.escape(e["flyer"],quote=True)}" target="_blank" rel="noopener noreferrer"><img src="../{html.escape(e["flyer"],quote=True)}" alt="{html.escape(e.get("flyerAlt",e["title"]),quote=True)}" width="1080" height="1350"></a><figcaption>Official cleanup flyer · <a href="../{html.escape(e["flyer"],quote=True)}" target="_blank" rel="noopener noreferrer">Open full size ↗</a></figcaption></figure>' if e.get('flyer') else '')
 main=f'''<main id="main" class="container cleanup-wrap"><p class="cleanup-kicker"><a href="../">Events</a> / {html.escape(e['category'])}</p><h1 style="font-size:clamp(2.5rem,5vw,4.6rem);max-width:20ch">{html.escape(e['title'])}</h1><div class="cleanup-grid{' has-flyer' if flyer else ''}">{flyer}<div class="event-information"><section><p class="cleanup-lede"><strong>{start.strftime('%A, %B %-d, %Y')}</strong><br>{time}</p><p>{html.escape(e['location'])}</p><p class="event-detail-text">{html.escape(e['description'])}</p><p><a class="hub-button" href="{html.escape(e['source'],quote=True)}" target="_blank" rel="noopener noreferrer">{'RSVP with Clean Miami Beach' if e['id']=='julia-tuttle-cleanup' else 'Official event details'} ↗</a></p></section><aside class="cleanup-cal" style="margin-top:0"><h2>Save the date</h2><div class="cleanup-links"><a href="event.ics">Add to Calendar</a></div><p class="cleanup-note">{'RSVP is required to join the cleanup.' if e['id']=='julia-tuttle-cleanup' else 'Check the official event notice before attending.'}</p></aside></div></div></main>'''
 # shell's global depth rewrite also changes the back link; correct it explicitly afterwards.
 page=shell(e['title'],main,2).replace('<a href="../../">Events</a>','<a href="../">Events</a>')
 (d/'index.html').write_text(page)
rows=[]
for e in items:
 s=datetime.fromisoformat(e['start']); rows.append(f'''<a class="event-row" data-category="{'cleanup' if e['id']=='julia-tuttle-cleanup' else 'city'}" href="{e['id']}/"><div class="event-date"><strong>{s.strftime('%b %-d, %Y')}</strong><p>{'All day' if e['allDay'] else s.strftime('%-I:%M %p')+' ET'}</p></div><div><p class="event-meta">{html.escape(e['category'])}</p><h2>{html.escape(e['title'])}</h2><p>{html.escape(e['location'])}</p></div><span aria-hidden="true">↗</span></a>''')
main='''<main id="main" class="container cleanup-wrap"><p class="cleanup-kicker">David Suarez · Miami Beach</p><h1>Events &amp; meetings</h1><p class="cleanup-lede">Get involved in your community. Find upcoming events, commission meetings, boards and committees, and save the details to your calendar.</p><section class="event-feature"><p class="cleanup-kicker">Community cleanup · December 19</p><h2>Let’s clean up the Tuttle.</h2><p>8–10 a.m. Eastern · Julia Tuttle Causeway, westbound</p><a class="hub-button" href="julia-tuttle-cleanup/">Details &amp; add to calendar ↗</a></section><p class="cleanup-note">City listings come from the official City calendar and are not necessarily hosted by David. Listings refresh periodically and may not include every meeting. If a refresh fails, the last validated listings remain available. Check each event’s source for changes.</p><div class="event-filters" aria-label="Filter events"><button type="button" aria-pressed="true" data-filter="all">All events</button><button type="button" aria-pressed="false" data-filter="city">City calendar</button><button type="button" aria-pressed="false" data-filter="cleanup">Community cleanup</button></div><div class="events-list">'''+''.join(rows)+'''</div><p class="cleanup-note">Times shown in Eastern Time. Last checked November 13, 2026. <a href="https://events.miamibeachfl.gov/City%20Meetings/">See the full official City calendar ↗</a></p></main><script>document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('[data-category]').forEach(row=>{row.hidden=button.dataset.filter!=='all'&&row.dataset.category!==button.dataset.filter;});}));</script>'''
main=main.replace('Last checked November 13, 2026.', 'City snapshot updated '+now.astimezone(zone).strftime('%B %-d, %Y at %-I:%M %p')+' Eastern.')
(out/'index.html').write_text(shell('Events & meetings',main))
# Keep the already-shared cleanup path pointing to the same calendar-ready detail.
alias=(out/'julia-tuttle-cleanup/index.html').read_text().replace('="../../','="../').replace('<a href="../">Events</a>','<a href="../events/">Events</a>').replace('href="event.ics"','href="cleanup.ics"')
(root/'julia-tuttle-cleanup/index.html').write_text(alias);(root/'julia-tuttle-cleanup/cleanup.ics').write_bytes((out/'julia-tuttle-cleanup/event.ics').read_bytes())
print('Built',len(items),'event detail pages and ICS files plus index.')

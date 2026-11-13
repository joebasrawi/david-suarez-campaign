"""Offline regression tests for Events generation and failure preservation."""
from pathlib import Path
import tempfile,shutil,json,subprocess,sys,hashlib
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 r=Path(tmp)
 for name in ['scripts','data','about','assets/events','julia-tuttle-cleanup']:
  shutil.copytree(root/name,r/name,dirs_exist_ok=True)
 def build(ok=True):
  p=subprocess.run([sys.executable,str(r/'scripts/build-events-preview.py')],capture_output=True)
  assert (p.returncode==0)==ok,p.stderr.decode()
 def digest():
  return {str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['events','julia-tuttle-cleanup'] for p in (r/folder).rglob('*') if p.is_file()}
 build();baseline=digest();build();assert digest()==baseline,'Repeated generation must be stable'
 p=r/'data/city-calendar.json';original=p.read_text();feed=json.loads(original)
 for bad in [{'generatedAt':feed['generatedAt'],'items':[]},{'generatedAt':feed['generatedAt'],'items':[feed['items'][0],feed['items'][0]]},{'generatedAt':feed['generatedAt'],'items':[{'id':'1'}]}]:
  p.write_text(json.dumps(bad));build(False);assert digest()==baseline,'Bad input changed prior pages'
 p.write_text('{broken');build(False);assert digest()==baseline
 p.write_text(original);feed['items'][0]['title']='Verified updated official meeting';p.write_text(json.dumps(feed));build()
 assert 'Verified updated official meeting' in (r/'events/index.html').read_text()
 ics=(r/'events/julia-tuttle-cleanup/event.ics').read_bytes()
 assert b'DTSTART:20261219T130000Z' in ics and b'DTEND:20261219T150000Z' in ics
 assert b'\r\n' in ics and all(len(line)<=75 for line in ics.split(b'\r\n'))
 page=(r/'events/julia-tuttle-cleanup/index.html').read_text()
 assert 'julia-tuttle-cleanup-dec19.png' in page and page.count('>Add to Calendar</a>')==1
 assert '<a href="event.ics">' in page
 assert len(json.loads((r/'data/community-events.json').read_text())['items'])==len(feed['items'])+1
 print('Events tests passed: idempotence, updates, empty/malformed/duplicate rejection with last-good preservation, manual cleanup, flyer, one CTA and ICS.')

// Rebuild only the web derivatives. Source footage stays outside the repository.
// Usage: FFMPEG=/path/to/ffmpeg node scripts/render-home-film.mjs /path/to/stock /path/to/youtube
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
const ffmpeg=process.env.FFMPEG||'ffmpeg';
const [stock,channel]=process.argv.slice(2);
if(!stock||!channel)throw new Error('Provide the stock footage and channel footage directories.');
mkdirSync('work/film-render',{recursive:true});
const coastal='miami-beach-south-beach-miami-beach-skyline-miami-2025-12-17-17-26-34-utc.mov';
const shots=[
 [resolve(stock,coastal),2,6,false],
 [resolve(channel,'2fU3AA-g20k.mp4'),30,4,true],
 [resolve(stock,'miami-beach-south-beach-miami-beach-skyline-miami-2025-12-17-16-02-23-utc.mov'),3,5,false],
 [resolve(channel,'2fU3AA-g20k.mp4'),62,4,true],
 [resolve(stock,'miami-beach-skyline-at-miami-beach-florida-united-2025-12-17-14-33-51-utc.mp4'),1,4,false],
 [resolve(stock,'miami-beach-boat-sunset-2025-12-17-20-56-32-utc.mp4'),2,5,false],
];
function run(args){const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});if(r.status!==0)throw new Error('Video render failed.');}
for(const mobile of [false,true]){
 const size=mobile?'540:720':'1280:720';
 for(const [i,[file,start,length,david]] of shots.entries()){
  // Published captions occupy the bottom of the channel footage. Preserve faces above them.
  const crop=david?'scale=1280:720,crop=1280:600:0:0,':'';
  const frame=mobile&&david?`crop=450:600:${i===1?250:740}:0,scale=540:720`:`scale=${size}:force_original_aspect_ratio=increase,crop=${size}`;
  run(['-ss',String(start),'-i',file,'-t',String(length),'-an','-vf',`${crop}${frame},setsar=1,fps=24,format=yuv420p`,'-c:v','libx264','-preset','fast','-crf','20',`work/film-render/${mobile?'mobile':'wide'}-${i}.mp4`]);
 }
 const args=shots.flatMap((_,i)=>['-i',`work/film-render/${mobile?'mobile':'wide'}-${i}.mp4`]);
 let offset=shots[0][2]-.5;
 const filters=[];
 for(let i=1;i<shots.length;i++){
  filters.push(`${i===1?'[0:v]':`[x${i-1}]`}[${i}:v]xfade=transition=fade:duration=0.5:offset=${offset}[x${i}]`);
  offset+=shots[i][2]-.5;
 }
 run([...args,'-filter_complex',filters.join(';'),'-map',`[x${shots.length-1}]`,'-an','-c:v','libx264','-preset','medium','-crf',mobile?'26':'25','-pix_fmt','yuv420p','-movflags','+faststart',`assets/miami-beach-opening${mobile?'-mobile':''}.mp4`]);
 console.log(`Finished ${mobile?'mobile':'desktop'} film`);
}
run(['-ss','2','-i',resolve(stock,coastal),'-frames:v','1','-vf','scale=1600:900','-q:v','3','assets/miami-beach-opening.jpg']);
run(['-ss','2','-i',resolve(stock,'miami-beach-8th-street-life-guard-house-in-south-b-2026-01-22-09-56-48-utc.mov'),'-frames:v','1','-vf','scale=1200:-1,crop=900:675:150:0,scale=1200:900','-q:v','3','assets/miami-beach-lifeguard.jpg']);

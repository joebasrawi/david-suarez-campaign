import {isoNow,writeSnapshot} from './lib.mjs';
const jobs=['youtube','calendar','agendas','actions','news','projects','neighborhoods','records'];
const items=[];
for(const name of jobs){
 try { await import(`./sync-${name}.mjs`);items.push({name,status:'success',checkedAt:isoNow()}); }
 catch(error){console.error(`${name} refresh failed; retaining its last snapshot.`,error.message);items.push({name,status:'failed',checkedAt:isoNow(),message:'The source could not be refreshed. The last validated snapshot remains available.'});}
}
await import('./validate-data.mjs');
await import('./build-home-summary.mjs');
await writeSnapshot('data/sync-status.json',{generatedAt:isoNow(),source:{label:'Public data publishing workflow',url:'https://github.com/joebasrawi/david-suarez-campaign/actions/workflows/sync-public-data.yml'},items});
if(items.some(i=>i.status==='failed'))process.exitCode=1;

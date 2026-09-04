import {fetchJson, isoNow, writeSnapshot} from './lib.mjs';
const base='https://gis.miamibeachfl.gov/public/rest/services/gc/gc_Cadastral/MapServer';
const groups=await Promise.all([11,12].map(async layer=>{
  const query=new URL(`${base}/${layer}/query`);
  query.search=new URLSearchParams({where:'1=1',outFields:'OBJECTID,NAME',outSR:'4326',returnGeometry:'true',geometryPrecision:'5',maxAllowableOffset:'0.00002',f:'geojson'});
  const data=await fetchJson(query);
  if(!Array.isArray(data.features)||!data.features.length||data.exceededTransferLimit)throw Error('Incomplete neighborhood boundaries');
  return data.features.map(f=>({...f,properties:{name:f.properties.NAME,id:`${layer}-${f.properties.OBJECTID}`,layer}}));
}));
const features=groups.flat().filter(f=>f.properties.name&&['Polygon','MultiPolygon'].includes(f.geometry?.type));
if(features.length<15)throw Error('Too few City neighborhood boundaries');
await writeSnapshot('data/neighborhoods.json',{type:'FeatureCollection',generatedAt:isoNow(),source:{label:'City of Miami Beach neighborhoods & sub-neighborhoods',url:base},features});
console.log(`Saved ${features.length} official neighborhood boundaries.`);

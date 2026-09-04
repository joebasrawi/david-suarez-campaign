// Shared map semantics. Points locate features, not the full extent of construction.
export const phaseLegend=[['Construction','#ef9b61'],['Design','#74bcf3'],['Planning','#d4b5f2'],['Other / unspecified','#8db6ac']];
export function phaseColor(item){return phaseLegend.find(([name])=>name.toLowerCase()===(item.sourceLayer?.phase||item.phase||'').toLowerCase())?.[1]||phaseLegend[3][1];}
export function legendMarkup(){return '<div class="map-legend" aria-label="Map legend">'+phaseLegend.map(([name,color])=>`<span><i style="--marker:${color}" aria-hidden="true"></i>${name}</span>`).join('')+'<span><i class="boundary-key" aria-hidden="true"></i>City neighborhood boundary</span></div>';}
export function pointInFeature(item,feature){
  if(!feature||!Number.isFinite(item.lat)||!Number.isFinite(item.lng))return false;
  const insideRing=ring=>{let inside=false;for(let a=0,b=ring.length-1;a<ring.length;b=a++){
    const [x1,y1]=ring[a],[x2,y2]=ring[b];
    if((y1>item.lat)!==(y2>item.lat)&&item.lng<(x2-x1)*(item.lat-y1)/(y2-y1)+x1)inside=!inside;
  }return inside;};
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  return polygons.some(rings=>insideRing(rings[0])&&!rings.slice(1).some(insideRing));
}
export function neighborhoods(data){
  // Prefer a sub-neighborhood where the City uses the same name at both levels.
  const local=data.features.filter(f=>f.properties.layer===11);
  return (local.length?local:data.features).sort((a,b)=>a.properties.name.localeCompare(b.properties.name));
}
export function installBasemap(map){
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{className:'coastal-map-tiles',maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  let errors=0;
  tiles.on('tileerror',()=>{if(++errors===3){const notice=document.createElement('p');notice.className='map-tile-error';notice.textContent='Street tiles are unavailable. Project markers and the list still work.';map.getContainer().append(notice);}});
  L.control.scale({imperial:true,metric:false,position:'bottomleft'}).addTo(map);
  return tiles;
}
export function boundaryLayer(map,features,onSelect){
  return L.geoJSON({type:'FeatureCollection',features},{style:{color:'#6ab9ae',weight:1.5,fillOpacity:.05},onEachFeature:(feature,layer)=>{
    layer.bindTooltip(feature.properties.name,{sticky:true});
    if(onSelect)layer.on('click',()=>onSelect(feature));
  }}).addTo(map);
}

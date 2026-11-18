((root)=>{
"use strict";
const clamp=(v,min,max)=>Math.max(min,Math.min(v,max));
function place({map,viewport,anchor,width,height,gap=28,padding=8,avoid=[]}){
 const bounds={left:Math.max(map.left,viewport.left)+padding,top:Math.max(map.top,viewport.top)+padding,right:Math.min(map.right,viewport.right)-padding,bottom:Math.min(map.bottom,viewport.bottom)-padding};
 if(bounds.right-bounds.left<width||bounds.bottom-bounds.top<height)return {side:"below-map"};
 const cy=clamp(anchor.y-height/2,bounds.top,bounds.bottom-height),cx=clamp(anchor.x-width/2,bounds.left,bounds.right-width);
 const candidates=[
  {side:"right",x:anchor.x+gap,y:cy},
  {side:"left",x:anchor.x-gap-width,y:cy},
  {side:"bottom",x:cx,y:anchor.y+gap},
  {side:"top",x:cx,y:anchor.y-gap-height}
 ];
 const overlaps=(p,o)=>p.x<o.right&&p.x+width>o.left&&p.y<o.bottom&&p.y+height>o.top;
 const valid=[];
 for(const initial of candidates){
   const p={...initial};
   for(let i=0;i<=avoid.length;i++){
     const o=avoid.find(o=>overlaps(p,o));if(!o)break;
     if(p.side==="right")p.x=o.right+8;
     if(p.side==="left")p.x=o.left-width-8;
     if(p.side==="bottom")p.y=o.bottom+8;
     if(p.side==="top")p.y=o.top-height-8;
   }
   if(Math.abs(p.x-initial.x)>Math.min(width,height)||Math.abs(p.y-initial.y)>Math.min(width,height)||avoid.some(o=>overlaps(p,o)))continue;
   if(p.x>=bounds.left&&p.y>=bounds.top&&p.x+width<=bounds.right&&p.y+height<=bounds.bottom)
    valid.push({...p,cost:Math.abs(p.x-initial.x)+Math.abs(p.y-initial.y)+candidates.findIndex(c=>c.side===p.side)*20,arrowX:clamp(anchor.x-p.x,14,width-14),arrowY:clamp(anchor.y-p.y,14,height-14)});
 }
 if(valid.length){const {cost,...chosen}=valid.sort((a,b)=>a.cost-b.cost)[0];return chosen;}
 return {side:"below-map"};
}
function hitPolygon(center,others,size){
 let polygon=[[-size/2,-size/2],[size/2,-size/2],[size/2,size/2],[-size/2,size/2]];
 for(const o of others){
  const dx=o.x-center.x,dy=o.y-center.y,dist=Math.hypot(dx,dy);
  if(dist<.01)continue;
  const limit=(dx*dx+dy*dy)/2-.25*dist,inside=p=>dx*p[0]+dy*p[1]<=limit;
  const intersection=(a,b)=>{const t=(limit-dx*a[0]-dy*a[1])/(dx*(b[0]-a[0])+dy*(b[1]-a[1]));return [a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];};
  const next=[];
  for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],ia=inside(a),ib=inside(b);if(ia)next.push(a);if(ia!==ib)next.push(intersection(a,b));}
  polygon=next;
 }
 return polygon.map(p=>[(p[0]+size/2)/size*100,(p[1]+size/2)/size*100]);
}
const api={place,hitPolygon};root.CampusMapPlacement=api;if(typeof module!=="undefined")module.exports=api;
})(typeof window!=="undefined"?window:globalThis);





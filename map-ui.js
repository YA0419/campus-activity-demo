(()=>{"use strict";
const $=s=>document.querySelector(s),core=window.CampusMapCore,esc=window.CampusEventUI.escapeHtml;
let config,snapshot={status:"idle",events:[]},mode="today",selected=null,frame=0;
const locations=()=>config?.buildings.filter(b=>["Confirmed","Preview"].includes(b.coordinateStatus))||[];
const popup=$("#map-popup"),date=$("#map-date");date.value=core.today();
const time=e=>e.timeStatus==="Conflict"?"時間待確認":(e.displayStartTime||e.startTime)?.slice(0,5)?[(e.displayStartTime||e.startTime).slice(0,5),(e.displayEndTime||e.endTime)?.slice(0,5)].filter(Boolean).join("–"):"時間待確認";
const day=d=>{if(!core.valid(d))return "日期待確認";return d.replaceAll("-","/")+"（"+new Intl.DateTimeFormat("zh-TW",{weekday:"short",timeZone:"Asia/Taipei"}).format(new Date(d+"T12:00:00+08:00")).replace("週","")+"）";};
const list=items=>'<ul class="map-event-list">'+items.map(e=>'<li><button type="button" data-map-event="'+e.id+'"><strong>'+esc(e.title)+'</strong><span>'+esc(day(e.date)+(e.endDate&&e.endDate!==e.date?"～"+day(e.endDate):""))+'</span><span>'+esc(time(e))+'</span><span>'+esc(e.format==="Online"?"線上活動":"地點："+(e.location||"待確認"))+'</span>'+(e.organizer?'<span>主辦：'+esc(e.organizer)+'</span>':"")+'</button></li>').join("")+'</ul>';
const section=(title,items)=>items.length?'<section><h2>'+esc(title)+'（'+items.length+'場）</h2>'+list(items)+'</section>':"";
function partitionHotspots(){
 const points=locations().map(b=>{const e=$('[data-anchor="'+b.id+'"]').getBoundingClientRect();return {id:b.id,x:e.x,y:e.y};});
 for(const point of points){const button=$('[data-building="'+point.id+'"]');const polygon=window.CampusMapPlacement.hitPolygon(point,points.filter(p=>p.id!==point.id),button.offsetWidth);button.style.clipPath="polygon("+polygon.map(p=>p[0]+"% "+p[1]+"%").join(",")+")";}
}
function positionPopup(){
 if(config)partitionHotspots();
 if(popup.hidden||!selected||!config)return;
 const map=$(".interactive-map img").getBoundingClientRect(),stage=$(".map-stage").getBoundingClientRect(),b=config.buildings.find(b=>b.id===selected),v=window.visualViewport;
 const viewport={left:v?.offsetLeft||0,top:v?.offsetTop||0,right:(v?.offsetLeft||0)+(v?.width||innerWidth),bottom:(v?.offsetTop||0)+(v?.height||innerHeight)};
 const anchor={x:map.left+map.width*b.xPercent/100,y:map.top+map.height*b.yPercent/100};
 const mobile=viewport.right-viewport.left<900;
 popup.dataset.offscreen="false";
 popup.dataset.placement="right";
 popup.style.width=Math.min(340,map.width-16,viewport.right-viewport.left-24)+"px";
 popup.style.setProperty("--popup-max-height",Math.max(120,Math.min(380,viewport.bottom-viewport.top-32,mobile?380:Math.min(map.bottom,viewport.bottom)-Math.max(map.top,viewport.top)-16))+"px");
 const r=popup.getBoundingClientRect();
 const p=window.CampusMapPlacement.place({map:{left:map.left,top:map.top,right:map.right,bottom:map.bottom},viewport,anchor,width:r.width,height:r.height,avoid:locations().filter(x=>x.id!==selected).map(x=>$('[data-building="'+x.id+'"]').getBoundingClientRect())});
 if(p.side==="below-map"){
   if(!mobile){popup.dataset.offscreen="true";return;}
   popup.dataset.placement="below-map";popup.style.width="100%";popup.style.left="";popup.style.top="";
   popup.style.setProperty("--popup-max-height",Math.min(360,(viewport.bottom-viewport.top)*.5)+"px");
 }else{
   popup.dataset.placement=p.side;
   popup.style.left=(p.x-stage.left)+"px";popup.style.top=(p.y-stage.top)+"px";
   popup.style.setProperty("--arrow-x",p.arrowX+"px");popup.style.setProperty("--arrow-y",p.arrowY+"px");
   if(anchor.x<viewport.left||anchor.x>viewport.right||anchor.y<viewport.top||anchor.y>viewport.bottom)popup.dataset.offscreen="true";
 }
}
function schedulePosition(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;positionPopup();});}
function closePopup(restore=true){
 const original=selected&&$('[data-building="'+selected+'"]'),inside=popup.contains(document.activeElement);
 selected=null;popup.hidden=true;
 document.querySelectorAll("[data-building]").forEach(b=>{b.setAttribute("aria-pressed","false");b.setAttribute("aria-expanded","false");});
 if((restore||inside)&&original)original.focus({preventScroll:true});
}
function draw(){
 if(!config)return;
 const g=core.group(snapshot.events,config,mode,date.value);
 $("#map-period").textContent=g.range?(mode==="recent"?"含今天共7天：":"活動日期：")+g.range[0]+(g.range[0]!==g.range[1]?" ～ "+g.range[1]:"")+"（臺灣時間）":"請選擇有效日期";
 $("#map-retry").hidden=snapshot.status!=="error";
 const empty=mode==="today"?"今天校園內沒有符合條件的活動，可以切換日期查看其他活動。":"目前日期條件下，已設定的校園地點沒有活動。";
 $("#map-status").textContent=snapshot.status==="error"?"目前無法載入地圖活動，請確認服務連線後重新載入。":snapshot.status!=="ready"?"正在載入地圖活動…":!g.range?"請選擇有效日期。":Object.values(g.buildings).flat().length===0?empty:"點選圖上的校園地點，可查看活動泡泡。";
 locations().forEach(b=>{const button=$('[data-building="'+b.id+'"]'),n=g.buildings[b.id].length;
  button.disabled=snapshot.status!=="ready";button.setAttribute("aria-pressed",String(selected===b.id));button.setAttribute("aria-expanded",String(selected===b.id));button.setAttribute("aria-label",b.name+"，"+n+"場符合日期條件的活動");button.title=b.name+"，"+n+"場";
 });
 popup.hidden=!selected;
 if(selected){
  $("#map-popup-title").textContent=config.buildings.find(b=>b.id===selected).name+"活動";
  $("#map-popup-count").textContent=snapshot.status==="ready"?g.buildings[selected].length+"場":"";
  $("#map-results").innerHTML=snapshot.status!=="ready"?'<p class="map-empty">'+(snapshot.status==="error"?"活動暫時無法載入，請重新載入後再試。":"正在載入活動…")+'</p>':g.buildings[selected].length?list(g.buildings[selected]):'<p class="map-empty">'+esc(config.buildings.find(b=>b.id===selected).emptyMessage||"這個日期沒有活動")+'</p>';
  positionPopup();
 }
 $("#map-secondary").innerHTML=section("線上活動",g.online)+section("地點待確認的活動",g.unknown)+section("未對應校園地點的活動",g.unmapped)+section("座標待確認的活動",g.pending);
}
document.querySelectorAll("[data-map-mode]").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.mapMode;date.disabled=mode!=="date";document.querySelectorAll("[data-map-mode]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));draw();if(mode==="date")date.focus();}));
date.addEventListener("change",draw);$("#map-retry").addEventListener("click",()=>window.CampusEventApp.reload());
$("#map-popup-close").addEventListener("click",()=>closePopup());
for(const node of [$("#map-results"),$("#map-secondary")])node.addEventListener("click",e=>{const b=e.target.closest("[data-map-event]");if(b)window.CampusEventApp.openDetails(Number(b.dataset.mapEvent),b);});
document.addEventListener("pointerdown",e=>{if(selected&&!$("#event-dialog").open&&!e.target.closest("#map-popup,[data-building],.map-controls,#map-retry"))closePopup(false);});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&selected&&!$("#event-dialog").open){e.preventDefault();closePopup();}});
window.addEventListener("resize",schedulePosition);
window.addEventListener("scroll",schedulePosition,{passive:true});
window.visualViewport?.addEventListener("resize",schedulePosition);
window.visualViewport?.addEventListener("scroll",schedulePosition);
window.CampusEventApp.subscribe(s=>{snapshot=s;draw();});
fetch("campus-locations.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("config");return r.json();}).then(c=>{
 config=c;const img=$(".interactive-map img");
 function check(){if(img.naturalWidth!==c.image.width||img.naturalHeight!==c.image.height){config=null;$("#map-status").textContent="地圖尺寸與建築設定不一致，已停止顯示熱區。";$("#map-markers").replaceChildren();closePopup(false);}}
 if(img.complete)check();else img.addEventListener("load",check,{once:true});if(!config)return;
 $("#map-markers").innerHTML=locations().map(b=>'<div class="map-anchor '+(b.markerStyle==='named-point'?'named-place ':'')+'anchor-'+b.id+'" data-anchor="'+b.id+'"><button type="button" data-building="'+b.id+'" aria-controls="map-popup" aria-pressed="false" aria-expanded="false"><span class="map-sr-only">'+esc(b.name)+'</span></button>'+(b.markerLabel?'<span class="map-place-label" aria-hidden="true">'+esc(b.markerLabel)+'</span>':'')+'</div>').join("");
 $("#map-markers").addEventListener("click",e=>{const b=e.target.closest("[data-building]");if(b){selected=b.dataset.building;draw();$("#map-results").scrollTop=0;$("#map-popup-close").focus({preventScroll:true});if(popup.dataset.placement==="below-map")popup.scrollIntoView({block:"nearest"});}});
 $("#map-pending-note").textContent="點選地圖標記查看活動；地圖位置為示意，詳細地點以活動公告為準。";
 partitionHotspots();
 new ResizeObserver(schedulePosition).observe(img);
 draw();
}).catch(()=>{$("#map-status").textContent="建築設定無法載入，請重新整理；原始校園地圖仍可查看。";});
})();





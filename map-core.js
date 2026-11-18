((root)=>{
"use strict";
const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
function today(now=new Date()){const p=new Intl.DateTimeFormat("en",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);return ["year","month","day"].map(k=>p.find(x=>x.type===k).value).join("-");}
const add=(d,n)=>new Date(Date.parse(d+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
function range(mode,date,now=new Date()){const t=today(now);return mode==="recent"?[t,add(t,6)]:mode==="date"&&valid(date)?[date,date]:mode==="today"?[t,t]:null;}
function eligible(e){return e.eventStatus==="Scheduled"&&!e.isDemo&&e.isVisible!==false&&e.isPublished!==false&&!e.isArchived&&!["Draft","Withdrawn","Excluded","Archived"].includes(e.publicationStatus)&&![ "Exclude","Hold","NeedsEvidence"].includes(e.admissionDecision);}
function matches(e,r,mode,now=new Date()){
 if(!r||!eligible(e)||!valid(e.date)||e.endDate!=null&&!valid(e.endDate))return false;
 const end=e.endDate||e.date;if(end<e.date||e.date>r[1]||end<r[0])return false;
 if(mode==="recent"){
   if(e.temporalState==="Past")return false;
   const time=e.timeStatus==="Conflict"?null:e.displayEndTime||e.endTime;
   if(time&&new Date(end+"T"+(time.length===5?time+":00":time)+"+08:00")<now)return false;
 }return true;
}
function locate(e,config){
 if(e.format==="Online")return {kind:"online"};
 let s=(e.location||"").normalize("NFKC").trim().toUpperCase();
 if(!s)return {kind:"unknown"};
 for(const prefix of config.normalization?.allowedCampusPrefixes||[])if(s.startsWith(prefix))s=s.slice(prefix.length).trim();
 const compact=x=>x.normalize("NFKC").replace(/\s+/g,"").toUpperCase();
 const roomMatch=b=>{if(!b.roomPattern)return false;const match=new RegExp(b.roomPattern,"i").exec(s);return Boolean(match&&(!b.requireVerifiedRoomCode||(b.roomCodes||[]).includes(b.roomPrefix+match[1])));};
 const matches=config.buildings.filter(b=>(b.aliases||[]).some(a=>compact(a)===compact(s))||(b.roomCodes||[]).some(a=>compact(a)===compact(s))||roomMatch(b));
 if(matches.length!==1)return {kind:"unmapped",reason:matches.length>1?"AmbiguousLocation":"UnverifiedOrMultipleLocations"};
 const b=matches[0];return b.coordinateStatus==="Pending"?{kind:"pending",id:b.id,reason:"CoordinatesPending"}:{kind:"building",id:b.id};
}
function group(events,config,mode,date,now=new Date()){
 const r=range(mode,date,now),result={range:r,buildings:Object.fromEntries(config.buildings.map(b=>[b.id,[]])),online:[],unknown:[],unmapped:[],pending:[],total:0};
 for(const e of [...events].sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.timeStatus==="Conflict"?"99:99":a.displayStartTime||a.startTime||"99:99").localeCompare(b.timeStatus==="Conflict"?"99:99":b.displayStartTime||b.startTime||"99:99")||a.id-b.id)){
  if(!matches(e,r,mode,now))continue;const l=locate(e,config);result.total++;
  (l.kind==="building"?result.buildings[l.id]:result[l.kind]).push(e);
 }return result;
}
const api={valid,today,add,range,eligible,matches,locate,group};root.CampusMapCore=api;if(typeof module!=="undefined")module.exports=api;
})(typeof window!=="undefined"?window:globalThis);




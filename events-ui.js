/* Shared nullable/status adapter. Data is fetched only by app.js; no fallback or candidate data. */
((root) => {
  "use strict";
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const validDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const safeUrl = (value, manualDemo = false) => {
    try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !u.port
      && (u.hostname === "usc.edu.tw" || u.hostname.endsWith(".usc.edu.tw") || ["forms.gle", "docs.google.com", "pse.is", "meet.google.com", "teams.microsoft.com", "zoom.us"].includes(u.hostname)) ? u.href : null; }
    catch { return null; }
  };
  const formatDate = value => validDate(value) ? new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Taipei" }).format(new Date(`${value}T00:00:00+08:00`)) : "日期待公告";
  const temporal=(event,now=new Date())=>{
    if(!validDate(event.date)||!validDate(event.endDate)||event.endDate<event.date||event.eventStatus==="Postponed")return "Undetermined";
    const time=event.timeStatus==="Conflict"?null:event.displayEndTime||event.endTime;
    if(time){const close=new Date(event.endDate+"T"+(time.length===5?time+":00":time)+"+08:00");return now>=close?"Past":"Upcoming";}
    const parts=new Intl.DateTimeFormat("en",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now),today=["year","month","day"].map(k=>parts.find(p=>p.type===k).value).join("-");
    return today>event.endDate?"Past":"Upcoming";
  };
  const statusFor=(event,now=new Date())=>({Past:"past",Upcoming:"upcoming",Undetermined:"undetermined"})[temporal(event,now)];
  const registrationLabel = (event, now = new Date()) => {
    if (event.eventStatus === "Cancelled") return "已取消（公告快照）";
    if (event.eventStatus === "Postponed") return "延期中（公告快照）";
    if (event.informationLevel && event.registrationStatus === "Unknown") return "活動表單狀態請見官方來源";
    if (event.origin) return ({Full:"已額滿（公告快照）",Closed:"報名已截止（快照）",Open:"報名資訊請見官方來源",Unknown:"報名資訊請見原公告"})[event.registrationStatus];
    return event.deadline ? (new Date(`${event.deadline}T23:59:59+08:00`) < now ? "報名已截止" : "報名中") : "報名資訊請見原公告";
  };
  const canRegister = (event, now = new Date()) => Boolean(safeUrl(event.signupUrl)
    && !["Cancelled", "Postponed"].includes(event.eventStatus) && !["Full", "Closed"].includes(event.registrationStatus)
    && (event.origin ? event.canRegister === true && event.registrationStatus === "Open" : registrationLabel(event, now) === "報名中") && statusFor(event, now) === "upcoming");
  function validateEvents(data) {
    if (!Array.isArray(data) || new Set(data.map(e=>e?.id)).size !== data.length) throw new Error("Invalid events response");
    const allowed=["id","title","category","date","endDate","startTime","endTime","deadline","location","organizer","description","benefits","color","icon","format","timeStatus","displayStartTime","displayEndTime","submissionEndDate","eventStatus","registrationStatus","sourceUrl","activityFormUrl","originalTitle","meetingUrl","publisherType"];
    data=data.map(raw=>{
      if(!raw||Object.keys(raw).some(k=>!allowed.includes(k)))throw new Error("Unexpected public snapshot field");
      const e={...raw,origin:"PublicSnapshot",timeZone:"Asia/Taipei",signupUrl:raw.activityFormUrl??null,posterUrl:null,canRegister:false,informationLevel:raw.date?"Complete":"Partial"};
      e.temporalState=temporal(e);e.canOpenActivityForm=e.temporalState!=="Past"&&e.eventStatus==="Scheduled"&&!["Full","Closed"].includes(e.registrationStatus)&&Boolean(safeUrl(e.activityFormUrl,false));return e;
    });
    for (const e of data) {
      const v2 = e?.origin !== undefined;
      if (!e || !Number.isInteger(e.id) || ["title","category","description","color","icon"].some(k=>typeof e[k]!=="string")
        || ["date","endDate","deadline"].some(k=>!(validDate(e[k]) || v2 && e[k]===null))
        || ["location","organizer","sourceUrl","signupUrl"].some(k=>!(typeof e[k]==="string" || v2 && e[k]===null))
        || !Array.isArray(e.benefits) || e.benefits.some(v=>typeof v!=="string")) throw new Error("Invalid events response");
      if (v2 && (!["PublicSnapshot"].includes(e.origin) || !["Scheduled","Cancelled","Postponed"].includes(e.eventStatus)
        || !["Unknown","Open","Full","Closed"].includes(e.registrationStatus) || !["Past","Upcoming","Undetermined"].includes(e.temporalState)
        || typeof e.canRegister!=="boolean" || e.timeZone!=="Asia/Taipei"
        || ["startTime","endTime"].some(k=>e[k]!==null && !(typeof e[k]==="string" && /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(e[k]))))) throw new Error("Invalid V2 events response");
      if(v2){
        if(e.format!==undefined && !["Online","Onsite","Hybrid","Unknown"].includes(e.format))throw new Error("Invalid activity format");
        if(e.timeStatus!==undefined && !["Known","Unknown","Conflict"].includes(e.timeStatus))throw new Error("Invalid time status");
        if(e.canOpenActivityForm!==undefined && typeof e.canOpenActivityForm!=="boolean")throw new Error("Invalid form status");
        for(const k of ["activityFormUrl","meetingUrl","originalTitle","dateBasis","informationLevel","submissionEndDate"])
          if(e[k]!==undefined && e[k]!==null && typeof e[k]!=="string")throw new Error("Invalid optional metadata");
        for(const k of ["displayStartTime","displayEndTime"])
          if(e[k]!==undefined && e[k]!==null && !(typeof e[k]==="string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(e[k])))throw new Error("Invalid display time");
      }
    }
    return data;
  }
  const api = {escapeHtml,validDate,safeUrl,formatDate,statusFor,temporal,registrationLabel,canRegister,validateEvents};
  root.CampusEventUI = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);






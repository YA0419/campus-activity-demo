(() => {
  "use strict";
  const mapSubscribers = new Set();
  let events = [];
  let loadStatus = "idle";
  let pendingRequest = null;
  const dataUrl = document.querySelector('meta[name="events-data-url"]').content;
  const categories = ["講座", "競賽", "社團", "體育", "校園活動"];
  const state = { view: "upcoming", category: "全部", benefit: "全部", query: "" };
  const $ = selector => document.querySelector(selector);
  const grid = $("#activity-grid");
  const dialog = $("#event-dialog");
  const { formatDate, escapeHtml, statusFor, validateEvents, registrationLabel, canRegister, safeUrl } = window.CampusEventUI;
  const byDate = (a, b) => (a.date || "9999-12-31").localeCompare(b.date || "9999-12-31");

  function makeFilters(container, values, key, allLabel) {
    container.innerHTML = [allLabel, ...values].map(value => `<button type="button" class="filter-chip${value === "全部" ? " active" : ""}" data-filter-key="${key}" data-filter-value="${escapeHtml(value)}" aria-pressed="${value === "全部"}">${escapeHtml(value)}</button>`).join("");
    container.onclick = event => {
      const button = event.target.closest("button[data-filter-value]");
      if (!button) return;
      state[key] = button.dataset.filterValue;
      container.querySelectorAll(".filter-chip").forEach(chip => {
        const active = chip.dataset.filterValue === state[key];
        chip.classList.toggle("active", active); chip.setAttribute("aria-pressed", String(active));
      });
      render();
    };
  }

  async function loadEvents() {
    pendingRequest?.abort();
    const request = new AbortController();
    pendingRequest = request;
    events = [];
    loadStatus = "loading";
    render();
    const timeout = setTimeout(() => request.abort(), 10000);
    try {
      if (location.protocol === "file:") throw new Error("HTTP frontend required");
      const response = await fetch(dataUrl, { signal: request.signal, cache: "no-store", credentials: "omit" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot=await response.json();
      if(snapshot.schemaVersion!=="campus-activity-public-snapshot/1"||snapshot.timeZone!=="Asia/Taipei"||!Array.isArray(snapshot.events)||!Number.isFinite(Date.parse(snapshot.exportedAt)))throw new Error("Invalid public snapshot");
      const data=validateEvents(snapshot.events);
      const stamp=new Intl.DateTimeFormat("zh-TW",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(snapshot.exportedAt));
      $("#snapshot-notice").textContent="教授展示版｜資料快照："+stamp+"（臺灣時間），共"+data.length+"筆。非即時公告，報名與異動請看官方來源。";
      if (pendingRequest !== request) return;
      events = data;
      const benefits = [...new Set(events.flatMap(event => event.benefits))];
      if (state.benefit !== "全部" && !benefits.includes(state.benefit)) state.benefit = "全部";
      makeFilters($("#benefit-filters"), benefits, "benefit", "全部");
      document.querySelectorAll("#benefit-filters .filter-chip").forEach(chip => {
        const active = chip.dataset.filterValue === state.benefit;
        chip.classList.toggle("active", active); chip.setAttribute("aria-pressed", String(active));
      });
      loadStatus = "ready";
    } catch (error) {
      if (pendingRequest !== request) return;
      loadStatus = "error";
      console.warn("活動快照載入失敗：", error.message);
    } finally {
      clearTimeout(timeout);
      if (pendingRequest === request) { pendingRequest = null; render(); }
    }
  }

  function getVisibleEvents() {
    return events.filter(event => {
      if (statusFor(event) !== state.view) return false;
      if (state.category !== "全部" && event.category !== state.category) return false;
      if (state.benefit !== "全部" && !(event.benefits || []).includes(state.benefit)) return false;
      const searchable = `${event.title} ${event.description} ${event.category} ${event.location} ${event.organizer}`.toLocaleLowerCase("zh-TW");
      return !state.query || searchable.includes(state.query.toLocaleLowerCase("zh-TW"));
    }).sort(state.view === "upcoming" ? byDate : (a, b) => byDate(b, a));
  }

  const formatLabel=e=>({Online:"線上活動",Onsite:"實體活動",Hybrid:"線上與實體",Unknown:"形式未提供"})[e.format] || "";
  const timeLabel=e=>e.timeStatus==="Conflict"?"時間待確認":(e.displayStartTime||e.startTime)?`${(e.displayStartTime||e.startTime).slice(0,5)}${(e.displayEndTime||e.endTime)?`～${(e.displayEndTime||e.endTime).slice(0,5)}`:""}`:e.informationLevel?"時間待確認":"";
  const canOpenForm=e=>e.canOpenActivityForm===true&&safeUrl(e.activityFormUrl,false)&&!["Cancelled","Postponed"].includes(e.eventStatus)&&!["Full","Closed"].includes(e.registrationStatus);
  function cardMarkup(event) {
    const hasPoster=typeof event.posterUrl==="string"&&event.posterUrl.trim();
    const schedule=[timeLabel(event),event.informationLevel?formatLabel(event):"",event.format!=="Online"?event.location:""] .filter(Boolean).join(" · ");
    const registration=`<p class="poster-registration"><span class="registration-status${canRegister(event)?"":" is-closed"}">${escapeHtml(registrationLabel(event))}</span>${event.deadline?`<span>截止 ${formatDate(event.deadline)}</span>`:""}</p>`;
    return `<article class="activity-card" tabindex="0" role="button" aria-label="查看活動：${escapeHtml(event.title)}" data-event-id="${event.id}">
      <div class="poster-frame${hasPoster?"":" no-poster"}">${hasPoster?`<img class="activity-poster" src="${escapeHtml(event.posterUrl)}" alt="活動海報：${escapeHtml(event.title)}" loading="lazy">`:'<span>暫無活動海報</span>'}</div>
      <div class="card-content"><div class="card-date-row"><span>${event.date?formatDate(event.date):"日期待確認"}${event.endDate&&event.endDate!==event.date?` – ${formatDate(event.endDate)}`:""}</span><span class="card-category">${escapeHtml(event.category)}</span></div>
      <h3>${escapeHtml(event.title)}</h3><p class="card-schedule"><span class="card-time">${escapeHtml(timeLabel(event)||"時間待確認")}</span><span class="card-place">${escapeHtml(event.format==="Online"?"線上活動":event.location||(event.format==="Hybrid"?"線上與實體":""))}</span></p><p class="card-organizer">${escapeHtml(event.organizer??"主辦單位未提供")}</p>${event.isDemo?'<p class="demo-badge">示範資料・未核實</p>':event.publisherType==="校內單位發布"?'<p class="portal-badge">處室發布</p>':""}${registration}</div></article>`;
  }
  function render() {
    mapSubscribers.forEach(fn=>fn({status:loadStatus,events:events.map(e=>({...structuredClone(e),temporalState:window.CampusEventUI.temporal(e)}))}));
    const loading = loadStatus === "loading" || loadStatus === "idle";
    $(".events-section").setAttribute("aria-busy", String(loading));
    $("#load-state").hidden = loadStatus === "ready";
    $("#retry-load").hidden = loadStatus !== "error";
    if (loadStatus !== "ready") {
      $("#load-message").textContent = loading ? "正在載入活動資料快照，請稍候……"
        : location.protocol === "file:" ? "請透過網站網址開啟展示版，不要直接雙擊HTML檔案。"
        : "目前無法載入活動快照，請確認展示檔案完整，再按「重新載入活動」。";
      $("#results-summary").textContent = loading ? "正在載入活動…" : "活動載入失敗";
      grid.innerHTML = ""; grid.hidden = true; $("#empty-state").hidden = true;
      return;
    }
    const visible = getVisibleEvents();

    $("#results-summary").innerHTML = `找到 <strong>${visible.length}</strong> 個${({upcoming:"近期",past:"歷史",undetermined:"日期待確認"})[state.view]}活動${state.query ? `，符合「${escapeHtml(state.query)}」` : ""}`;
    grid.innerHTML = visible.map(cardMarkup).join("");
    grid.hidden = !visible.length;
    $("#empty-state").hidden = visible.length > 0;
  }

  let detailOpener = null;
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]')]
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
    if (!focusable.length) return;
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) {
      event.preventDefault(); focusable.at(-1).focus();
    } else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) {
      event.preventDefault(); focusable[0].focus();
    }
  });
  dialog.addEventListener("close", () => { if (detailOpener?.isConnected) detailOpener.focus({ preventScroll: true }); });
  function openDetails(eventId, opener = null) {
    const event=events.find(item=>item.id===Number(eventId));if(!event)return;
    const benefitsMarkup=(event.benefits||[]).map(x=>`<span class="benefit-tag">✳ ${escapeHtml(x)}</span>`).join("");
    const row=(label,value)=>`<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
    const dateText=event.date?(event.informationLevel?event.date:formatDate(event.date)):"日期待確認";
    const when=[dateText,timeLabel(event)].filter(Boolean).join(" ");
    const meta=row("活動日期與時間",when)+(event.submissionEndDate?row("徵件截止",event.submissionEndDate.replaceAll("-","/")):"")+(event.deadline?row("報名截止",formatDate(event.deadline)):"")+(event.informationLevel?row("活動形式",formatLabel(event)):"")+(event.format==="Online"?"":row("活動地點",event.location??"未提供"))+row("主辦單位",event.organizer??"主辦單位未提供");
    const source=safeUrl(event.sourceUrl)?`<a class="source-button" href="${escapeHtml(safeUrl(event.sourceUrl))}" target="_blank" rel="noopener noreferrer">${event.sourceUrl.includes("/450-")?"前往官方入口（可能轉至表單）":"前往原始公告"} ↗</a>`:"";
    const direct=canRegister(event)?`<a class="signup-button" href="${escapeHtml(safeUrl(event.signupUrl))}" target="_blank" rel="noopener noreferrer">前往報名 →</a>`:"";
    const form=canOpenForm(event)?`<a class="source-button activity-form" href="${escapeHtml(safeUrl(event.activityFormUrl))}" target="_blank" rel="noopener noreferrer">前往活動表單 ↗</a>`:"";
    const meeting=safeUrl(event.meetingUrl,false)&&event.eventStatus==="Scheduled"&&statusFor(event)==="upcoming"?`<a class="source-button meeting-link" href="${escapeHtml(safeUrl(event.meetingUrl,false))}" target="_blank" rel="noopener noreferrer">前往線上會議 ↗</a>`:"";
    const note=form?`<p class="form-note">${statusFor(event)==="past"?"歷史活動表單僅供參考，不表示目前開放報名。":"表單目前是否開放，請以官方資訊為準。"}報名表單不是線上會議連結。</p>`:"";
    const raw=event.originalTitle?`<details class="source-evidence"><summary>查看原公告標題與資訊依據</summary><p>${escapeHtml(event.originalTitle)}</p>${event.timeStatus==="Conflict"?"<p>原標題與正文時間不一致，時間待確認；不擇一作為正確時段。</p>":""}${event.dateBasis?.includes("list-window-weekday")?"<p>年份依官方列表日期、活動星期與前後文推導。</p>":""}</details>`:"";
    $("#dialog-content").innerHTML=`<div class="detail-hero"><span>${escapeHtml(event.category)}</span></div><div class="detail-body"><div class="eyebrow">活動詳細資訊</div><h2 id="dialog-title" tabindex="-1">${escapeHtml(event.title)}</h2>${event.posterUrl?`<figure class="detail-poster-frame"><img class="detail-poster" src="${escapeHtml(event.posterUrl)}" alt="完整活動海報：${escapeHtml(event.title)}"><figcaption>系學會已確認可公開展示；海報內容不代表目前開放報名。</figcaption></figure>`:""}<p class="detail-description">${escapeHtml(event.description)}</p><div class="detail-meta">${meta}</div>${benefitsMarkup?`<div class="detail-benefits"><span class="detail-label">活動福利</span><div class="benefit-list">${benefitsMarkup}</div></div>`:""}<p class="registration-status">${escapeHtml(registrationLabel(event))}${statusFor(event)==="undetermined"?" · 活動日期待確認":""}</p><div class="detail-actions">${source}${direct}${form}${meeting}</div>${note}${raw}${!event.origin||event.origin==="Manual"?'<p class="demo-note">示範資料：公告與報名連結為測試網址，實際使用前請替換。</p>':""}</div>`;
    // Presentation only: preserve the existing escaped content, statuses and action links.
    const info = $("#dialog-content .detail-body");
    const poster = info.querySelector(".detail-poster-frame");
    const layout = document.createElement("div");
    layout.className = "detail-layout";
    dialog.classList.toggle("has-poster", Boolean(poster));
    if (poster) {
      const media = document.createElement("div");
      media.className = "detail-media";
      media.append(poster);
      layout.append(media);
    }
    const description = info.querySelector(".detail-description");
    info.insertBefore(info.querySelector(".detail-meta"), description);
    layout.append(info);
    $("#dialog-content").append(layout);
    detailOpener = opener || grid.querySelector(`[data-event-id="${event.id}"]`);
    dialog.showModal();
    dialog.scrollTop = 0;
    $("#dialog-title").focus({ preventScroll: true });
  }
  makeFilters($("#category-filters"), categories, "category", "全部");
  makeFilters($("#benefit-filters"), [], "benefit", "全部");
  $("#retry-load").addEventListener("click", loadEvents);
  $("#search-input").addEventListener("input", event => { state.query = event.target.value.trim(); render(); });
  window.CampusEventApp = Object.freeze({
    subscribe(fn){mapSubscribers.add(fn);fn({status:loadStatus,events:structuredClone(events)});return ()=>mapSubscribers.delete(fn);},
    reload:loadEvents,
    openDetails:(id,opener)=>openDetails(id,opener)
  });
  function showPage() {
    const page = ["upcoming", "past", "undetermined"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
    const home = page === "home";
    $(".map-section").hidden = !home;
    $(".discovery-section").hidden = home;
    $(".events-section").hidden = home;
    document.querySelectorAll("[data-view]").forEach(b=>{const active=b.dataset.view===page;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
    updateNavigation();
    state.view = home ? "upcoming" : page;
    $("#list-title").textContent = page === "undetermined" ? "日期待確認" : page === "past" ? "歷史活動" : "活動列表";
    document.title = (home ? "校園活動地圖" : $("#list-title").textContent) + "｜實踐大學高雄校區";
    clearFilters();
    loadEvents();
    window.scrollTo(0, 0);
  }
  function updateNavigation() {
    const page = ["upcoming", "past", "undetermined"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
    const loginOpen = $("#demo-info-dialog").open;
    document.querySelectorAll(".top-nav > *").forEach(link => {
      const active = loginOpen ? link.id === "demo-info-entry" : link.dataset.page === (page === "undetermined" ? "upcoming" : page);
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", loginOpen ? "true" : "page");
      else link.removeAttribute("aria-current");
    });
  }
  document.querySelector(".view-switch").addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(b)location.hash=b.dataset.view;});
  window.addEventListener("hashchange", showPage);
  grid.addEventListener("click", event => { const card = event.target.closest("[data-event-id]"); if (card) openDetails(card.dataset.eventId); });
  grid.addEventListener("keydown", event => { const card = event.target.closest("[data-event-id]"); if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openDetails(card.dataset.eventId); } });
  $("#dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  $("#clear-filters").addEventListener("click", clearFilters);
  $("#empty-clear").addEventListener("click", () => {
    if (location.hash === "#upcoming") clearFilters();
    else location.hash = "upcoming";
  });
  $("#search-form").addEventListener("submit", event => { event.preventDefault(); state.query = $("#search-input").value.trim(); render(); $("#search-input").focus(); });
  $("#demo-info-entry").addEventListener("click", () => {$("#demo-info-dialog").showModal();updateNavigation();$("#demo-info-dialog-close").focus();});
  $("#demo-info-dialog").addEventListener("close", updateNavigation);
  $("#demo-info-dialog-close").addEventListener("click", () => $("#demo-info-dialog").close());
  $("#demo-info-dialog-ok").addEventListener("click", () => $("#demo-info-dialog").close());
  function clearFilters() {
    state.category = "全部"; state.benefit = "全部"; state.query = "";
    $("#search-input").value = "";
    document.querySelectorAll(".filter-chip").forEach(chip => { const active = chip.dataset.filterValue === "全部"; chip.classList.toggle("active", active); chip.setAttribute("aria-pressed", String(active)); });
    render();
  }
  document.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); if ($(".discovery-section").hidden) { location.hash = "upcoming"; requestAnimationFrame(() => $("#search-input").focus()); } else $("#search-input").focus(); } });

  showPage();
})();








// Broken authorized posters use the existing compact placeholder.
document.addEventListener("error", event => {
  const image=event.target;
  if(!(image instanceof HTMLImageElement)||!image.matches(".activity-poster,.detail-poster"))return;
  const frame=image.closest(".poster-frame,.detail-poster-frame");
  if(!frame)return;
  frame.classList.add("no-poster");
  const label=document.createElement("span");label.textContent="暫無活動海報";
  frame.replaceChildren(label);
},true);

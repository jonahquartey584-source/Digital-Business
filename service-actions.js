(() => {
  if (document.body.dataset.serviceActionsReady) return;
  document.body.dataset.serviceActionsReady = "true";
  const service = document.title.split("—")[0].trim();
  const accountId = new URLSearchParams(location.search).get("account") || "unknown-account";
  const storageKey = `qpServiceActivity:${accountId}:${service}`;
  const modal = document.createElement("div");
  modal.className = "service-action-modal"; modal.hidden = true;
  modal.innerHTML = `<section class="service-action-dialog" role="dialog" aria-modal="true" aria-labelledby="serviceActionTitle"><div class="service-action-dialog__head"><div><p class="section__tag">// Client Action</p><h2 id="serviceActionTitle"></h2></div><button class="service-action-close" type="button" aria-label="Close">×</button></div><div id="serviceActionContent"></div></section>`;
  const toast = document.createElement("div"); toast.className = "service-toast"; toast.hidden = true; toast.setAttribute("role", "status");
  document.body.append(modal, toast);
  const content = modal.querySelector("#serviceActionContent"); const title = modal.querySelector("#serviceActionTitle");
  const close = () => { modal.hidden = true; content.innerHTML = ""; };
  modal.querySelector(".service-action-close").addEventListener("click", close);
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  const notify = (message) => { toast.textContent = message; toast.hidden = false; clearTimeout(notify.timer); notify.timer = setTimeout(() => { toast.hidden = true; }, 2800); };
  const save = (type, data) => { const items = JSON.parse(localStorage.getItem(storageKey) || "[]"); items.unshift({ type, data, createdAt: new Date().toISOString() }); localStorage.setItem(storageKey, JSON.stringify(items.slice(0,100))); };
  const openForm = ({ heading, note = "", fields, submitLabel = "Save", onSubmit }) => {
    title.textContent = heading;
    content.innerHTML = `${note ? `<p class="service-action-note">${note}</p>` : ""}<form class="service-action-form">${fields.map((field) => `<label>${field.label}${field.type === "textarea" ? `<textarea name="${field.name}" ${field.required === false ? "" : "required"} placeholder="${field.placeholder || ""}"></textarea>` : field.type === "select" ? `<select name="${field.name}">${field.options.map((option) => `<option>${option}</option>`).join("")}</select>` : `<input type="${field.type || "text"}" name="${field.name}" ${field.required === false ? "" : "required"} placeholder="${field.placeholder || ""}">`}</label>`).join("")}<div class="service-action-form__buttons"><button class="btn btn--ghost" type="button" data-cancel>Cancel</button><button class="btn btn--primary" type="submit">${submitLabel}</button></div></form>`;
    modal.hidden = false; content.querySelector("input,textarea,select")?.focus();
    content.querySelector("[data-cancel]").addEventListener("click", close);
    content.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); onSubmit(data); close(); });
  };
  const refreshPipeline = () => {
    const cards = [...document.querySelectorAll(".crm-deal")];
    const wonCards = [...document.querySelectorAll('.crm-column[data-stage="won"] .crm-deal')];
    const valueOf = (card) => Number(card.dataset.value || 0);
    const openCards = cards.filter((card) => !wonCards.includes(card));
    const openValue = openCards.reduce((sum,card)=>sum+valueOf(card),0);
    const wonValue = wonCards.reduce((sum,card)=>sum+valueOf(card),0);
    document.querySelector("[data-crm-open-value]")?.replaceChildren(document.createTextNode(`£${openValue.toLocaleString("en-GB")}`));
    document.querySelector("[data-crm-active-count]")?.replaceChildren(document.createTextNode(String(openCards.length)));
    document.querySelector("[data-crm-won-value]")?.replaceChildren(document.createTextNode(`£${wonValue.toLocaleString("en-GB")}`));
    document.querySelector("[data-crm-conversion]")?.replaceChildren(document.createTextNode(cards.length ? `${Math.round((wonCards.length/cards.length)*100)}%` : "0%"));
    document.querySelectorAll(".crm-column").forEach((column)=>{ const own=[...column.querySelectorAll(".crm-deal")]; const total=own.reduce((sum,card)=>sum+valueOf(card),0); column.querySelector(".crm-column__head span").textContent=String(own.length); column.querySelector(".crm-column__total").textContent=`£${total.toLocaleString("en-GB")} ${column.dataset.stage === "won" ? "won" : "potential"}`; });
  };
  const addDeal = (data, persist = true) => {
    const column = document.querySelector(".crm-column"); if (!column) return;
    const card = document.createElement("article"); card.className = "crm-deal";
    card.innerHTML = `<div class="crm-deal__top"><strong></strong><span class="crm-deal__value"></span></div><p></p><div class="crm-deal__bottom"><span>Just added</span><span></span></div>`;
    card.dataset.value = String(Number(data.value || 0)); card.querySelector("strong").textContent = data.business; card.querySelector(".crm-deal__value").textContent = data.value ? `£${Number(data.value).toLocaleString("en-GB")}` : "Unpriced"; card.querySelector("p").textContent = data.service; card.querySelector(".crm-deal__bottom span:last-child").textContent = data.nextStep;
    column.insertBefore(card, column.querySelector(".crm-add-deal")); if (persist) save("lead", data); refreshPipeline(); if (persist) notify("Lead added to New Lead");
  };
  const importInput = document.createElement("input"); importInput.type = "file"; importInput.accept = ".csv,text/csv"; importInput.hidden = true; document.body.appendChild(importInput);
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0]; if (!file) return; const text = await file.text(); const rows = text.split(/\r?\n/).filter(Boolean); const headers = rows.shift()?.split(",").map((item) => item.trim().toLowerCase()) || [];
    let added = 0; rows.forEach((row) => { const values = row.split(",").map((item) => item.trim()); const record = Object.fromEntries(headers.map((header,index) => [header,values[index] || ""])); addDeal({ business: record.business || record.company || record.name || `Imported lead ${added + 1}`, service: record.service || record.interest || "Imported lead", value: record.value || record.price || "", nextStep: record.next_step || record.status || "Review" }); added += 1; });
    notify(`${added} lead${added === 1 ? "" : "s"} imported`); importInput.value = "";
  });
  const handlers = {
    "import leads": () => importInput.click(),
    "+ add lead": () => openForm({ heading: "Add a new lead", fields: [{ label:"Business or contact name",name:"business"},{label:"Service interested in",name:"service"},{label:"Potential value (£)",name:"value",type:"number",required:false},{label:"Next step",name:"nextStep",placeholder:"Call, email or follow up"}], submitLabel:"Add Lead", onSubmit:addDeal }),
    "+ add lead": () => openForm({ heading: "Add a new lead", fields: [{ label:"Business or contact name",name:"business"},{label:"Service interested in",name:"service"},{label:"Potential value (£)",name:"value",type:"number",required:false},{label:"Next step",name:"nextStep",placeholder:"Call, email or follow up"}], submitLabel:"Add Lead", onSubmit:addDeal }),
    "search": () => openForm({ heading:"Search leads",fields:[{label:"Name, service or status",name:"query"}],submitLabel:"Search",onSubmit:({query})=>{ const term=query.toLowerCase(); let matches=0; document.querySelectorAll(".crm-deal").forEach((card)=>{ const show=card.textContent.toLowerCase().includes(term); card.hidden=!show; if(show) matches+=1; }); notify(`${matches} matching lead${matches===1?"":"s"}`); } }),
    "edit pipeline": () => openForm({ heading:"Edit pipeline columns",note:"Rename the four stages to match your sales process.",fields:["Stage 1","Stage 2","Stage 3","Stage 4"].map((label,index)=>({label,name:`stage${index}`,placeholder:document.querySelectorAll(".crm-column h2")[index]?.textContent||label})),submitLabel:"Update Pipeline",onSubmit:(data)=>{ document.querySelectorAll(".crm-column h2").forEach((item,index)=>{ const value=data[`stage${index}`].trim(); if(value)item.textContent=value; }); save("pipeline",data); notify("Pipeline columns updated"); } }),
    "edit columns": () => handlers["edit pipeline"](),
    "edit availability": () => openForm({heading:"Update availability",fields:[{label:"Available days",name:"days",placeholder:"Monday to Friday"},{label:"Opening time",name:"start",type:"time"},{label:"Closing time",name:"end",type:"time"}],onSubmit:(data)=>{save("availability",data);notify("Availability updated");}}),
    "+ new booking": () => openForm({heading:"Create a booking",fields:[{label:"Customer name",name:"customer"},{label:"Email",name:"email",type:"email"},{label:"Date",name:"date",type:"date"},{label:"Time",name:"time",type:"time"},{label:"Service",name:"service"}],submitLabel:"Create Booking",onSubmit:(data)=>{save("booking",data);notify("Booking created");}}),
    "new change request →": () => openForm({heading:"Request a website change",fields:[{label:"Page or section",name:"page"},{label:"Describe the change",name:"request",type:"textarea"},{label:"Priority",name:"priority",type:"select",options:["Standard","Important","Urgent"]}],submitLabel:"Send Request",onSubmit:(data)=>{save("website-request",data);notify("Change request saved");}}),
    "manage services": () => openForm({heading:"Manage bookable services",fields:[{label:"Service name",name:"service"},{label:"Duration in minutes",name:"duration",type:"number"},{label:"Price (£)",name:"price",type:"number",required:false}],onSubmit:(data)=>{save("bookable-service",data);notify("Service saved");}}),
    "+ request automation": () => openForm({heading:"Request an automation",fields:[{label:"Process to automate",name:"process"},{label:"What should trigger it?",name:"trigger"},{label:"What should happen?",name:"result",type:"textarea"}],submitLabel:"Send Request",onSubmit:(data)=>{save("automation-request",data);notify("Automation request saved");}}),
    "manage assistant": () => document.querySelector(".client-ai-launcher")?.click(),
    "upload assets": () => { const input=document.createElement("input");input.type="file";input.multiple=true;input.accept="image/*,video/*,.pdf";input.addEventListener("change",()=>notify(`${input.files.length} asset${input.files.length===1?"":"s"} selected`));input.click(); },
    "request content →": () => openForm({heading:"Request social content",fields:[{label:"Campaign or topic",name:"topic"},{label:"Platform",name:"platform",type:"select",options:["Instagram","Facebook","LinkedIn","TikTok","Multiple platforms"]},{label:"Brief",name:"brief",type:"textarea"}],submitLabel:"Send Request",onSubmit:(data)=>{save("content-request",data);notify("Content request saved");}}),
    "download logo files →": () => notify("Your logo files will appear here when uploaded by Qp Digital"),
    "download print files →": () => notify("Your print files will appear here when uploaded by Qp Digital")
  };
  JSON.parse(localStorage.getItem(storageKey) || "[]").filter((item)=>item.type === "lead").reverse().forEach((item)=>addDeal(item.data,false));
  refreshPipeline();
  document.addEventListener("click", (event) => {
    const control = event.target.closest("button"); if (!control || control.closest(".client-ai-panel") || control.closest(".service-action-modal")) return;
    const label = control.textContent.trim().toLowerCase(); const handler = handlers[label];
    if (handler) { event.preventDefault(); handler(); return; }
    if (control.closest(".service-app-nav")) { document.querySelectorAll(".service-app-nav button").forEach((item)=>item.classList.remove("is-active")); control.classList.add("is-active"); notify(`${control.textContent.trim()} view selected`); }
  });
})();

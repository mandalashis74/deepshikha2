(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const l of n)if(l.type==="childList")for(const s of l.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&r(s)}).observe(document,{childList:!0,subtree:!0});function o(n){const l={};return n.integrity&&(l.integrity=n.integrity),n.referrerPolicy&&(l.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?l.credentials="include":n.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function r(n){if(n.ep)return;n.ep=!0;const l=o(n);fetch(n.href,l)}})();const he={BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,SSR:!1,VITE_SUPABASE_ANON_KEY:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE",VITE_SUPABASE_URL:"https://xkpqkbberckxblkhseim.supabase.co"};let p=null,oe=[],ae="date-wise-cashbook",q="viewer",R=null,te=[],K=null,be="ALL",z=[],we=[],ne=[];document.addEventListener("DOMContentLoaded",()=>{const e=new Date().toISOString().split("T")[0],t=document.getElementById("inc-date"),o=document.getElementById("exp-date");t&&(t.value=e),o&&(o.value=e);const r=new Date,n=r.getFullYear(),s=["January","February","March","April","May","June","July","August","September","October","November","December"][r.getMonth()],i=document.getElementById("filter-year");if(i){if(![...i.options].some(c=>c.value===String(n))){const c=document.createElement("option");c.value=String(n),c.textContent=String(n),i.appendChild(c)}i.value=String(n)}const a=document.getElementById("filter-month");a&&(a.value=s),i&&i.addEventListener("change",Y),a&&a.addEventListener("change",Y),xe()?Ee():openSupabaseConfig()});function u(e,t="success",o=null){const r=document.getElementById("toast-container");if(!r)return;const n=document.createElement("div");n.className=`toast toast-${t}`;const l=t==="success"?'<i class="fa-solid fa-circle-check"></i>':'<i class="fa-solid fa-circle-exclamation"></i>';if(n.innerHTML=`${l} <span>${e}</span>`,o){const s=document.createElement("button");s.className="toast-btn",s.innerHTML=o.text,s.onclick=o.callback,n.appendChild(s)}r.appendChild(n),setTimeout(()=>{n.style.animation="slideInRight 0.3s ease reverse",setTimeout(()=>{n.remove()},300)},4e3)}function xe(){let e=localStorage.getItem("supabaseUrl")||"",t=localStorage.getItem("supabaseKey")||"";try{!e&&typeof import.meta<"u"&&he&&(e="https://xkpqkbberckxblkhseim.supabase.co"),!t&&typeof import.meta<"u"&&he&&(t="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE")}catch(o){console.warn("Vite env variables not accessible:",o)}if(e&&t&&e!=="YOUR_SUPABASE_URL"&&t!=="YOUR_SUPABASE_ANON_KEY"&&e.trim()!==""&&t.trim()!=="")try{return console.log("Initializing Supabase client with URL:",e.trim()),p=window.supabase.createClient(e.trim(),t.trim()),ue(!0),!0}catch(o){return console.error("Failed to initialize Supabase client:",o),ue(!1,"Init Error"),!1}else return ue(!1,"Disconnected"),!1}window.scrollToTop=function(){const e=document.querySelector(".workspace");e&&e.scrollIntoView({behavior:"smooth",block:"start"})};function ue(e,t){const o=document.getElementById("db-status-badge"),r=document.getElementById("db-status-text"),n=document.getElementById("db-status-badge-side"),l=document.getElementById("db-status-text-side"),s=(i,a)=>{!i||!a||(e?(i.className="badge badge-income",i.style.borderColor="rgba(16, 185, 129, 0.4)",i.style.cursor="pointer",a.textContent="Connected"):(i.className="badge badge-expense",i.style.borderColor="rgba(244, 63, 94, 0.4)",i.style.cursor="pointer",a.textContent=t||"Disconnected"))};s(o,r),s(n,l)}window.openSupabaseConfig=function(){const e=localStorage.getItem("supabaseUrl")||"",t=localStorage.getItem("supabaseKey")||"",o=document.getElementById("sb-url"),r=document.getElementById("sb-key");o&&(o.value=e),r&&(r.value=t),openModal("supabaseConfigModal")};window.saveSupabaseConfig=function(e){e.preventDefault();const t=document.getElementById("sb-url").value.trim(),o=document.getElementById("sb-key").value.trim();localStorage.setItem("supabaseUrl",t),localStorage.setItem("supabaseKey",o),closeModal("supabaseConfigModal"),xe()?(u("Supabase credentials saved successfully!","success"),Ee()):u("Invalid credentials. Connection failed.","error")};function Ee(){p&&p.auth.onAuthStateChange((e,t)=>{if(t)R=t.user.id,setTimeout(async()=>{try{if(localStorage.getItem("isSoftLogin")==="true"){const o=localStorage.getItem("currentFlatNo");await et(t.user,o)}else await Le(t.user);document.getElementById("auth-container").style.display="none"}catch(o){console.error("Session initialization failed:",o),localStorage.removeItem("isSoftLogin"),localStorage.removeItem("currentFlatNo"),await p.auth.signOut(),R=null,document.getElementById("auth-container").style.display="block";const r=document.getElementById("side-user-profile");r&&(r.style.display="none"),q="viewer",re("viewer")}},0);else if(localStorage.getItem("isSoftLogin")==="true")localStorage.getItem("currentFlatNo"),Ae();else{R=null,document.getElementById("auth-container").style.display="block";const o=document.getElementById("side-user-profile");o&&(o.style.display="none"),q="viewer",re("viewer")}})}async function Le(e){if(p)try{await se();let{data:t,error:o}=await p.from("profiles").select("role, assigned_floors").eq("id",e.id).single();if(o){console.warn("Profile fetching failed, retrying in 1s...",o),await new Promise(i=>setTimeout(i,1e3));const s=await p.from("profiles").select("role, assigned_floors").eq("id",e.id).single();if(t=s.data,s.error)throw s.error}q=t&&t.role?t.role.toLowerCase().trim():"viewer",ne=t&&Array.isArray(t.assigned_floors)?t.assigned_floors:[];const r=document.getElementById("side-user-profile"),n=document.getElementById("side-user-email"),l=document.getElementById("side-user-role");if(r&&n&&l){n.textContent=e.email,l.textContent=q.toUpperCase();const s=Re(q);l.className="badge",l.style.borderColor=s.replace("var(","").replace(")","").trim()?"rgba(255,255,255,0.2)":"var(--border-color)",l.style.color=s,r.style.display="flex"}re(q),await Se(),ie(),le(),Y()}catch(t){console.error("handleUserSession error:",t),u("Error retrieving user profile role credentials.","error")}}async function se(){if(p)try{const{data:e,error:t}=await p.from("roles").select("*").order("priority",{ascending:!1});t?(console.warn("Could not load roles from DB, using defaults:",t),z=pe()):e&&e.length>0?z=e:z=pe()}catch(e){console.warn("Error loading roles, using defaults:",e),z=pe()}}function pe(){return[{name:"admin",label:"Administrator",permissions:["dashboard:view","income:create","income:delete","expense:create","expense:delete","history:view","reports:view","ledger:import","ledger:export","owners:upload","owners:edit_any","owners:edit_own","expense_heads:manage","expense_heads:create","expense_heads:delete","users:manage","users:role_change","tickets:assign","tickets:recommend","tickets:approve","tickets:resolve","tickets:close","tickets:reopen","tickets:archive","tickets:delete","tickets:comment"],color:"var(--color-emerald)"},{name:"editor",label:"Editor",permissions:["dashboard:view","income:create","expense:create","history:view","reports:view","ledger:export","tickets:resolve","tickets:comment"],color:"var(--color-rose)"},{name:"floor_manager",label:"Floor Manager",permissions:["dashboard:view","income:create","history:view","reports:view","tickets:recommend","tickets:comment"],color:"var(--color-yellow)"},{name:"committee_member",label:"Committee Member",permissions:["dashboard:view","history:view","reports:view","tickets:approve","tickets:comment"],color:"var(--color-violet)"},{name:"viewer",label:"Viewer (Resident)",permissions:["owners:edit_own","tickets:comment"],color:"var(--text-secondary)"}]}function x(e){return we.includes(e)}function Ie(e){return z.find(t=>t.name===e)||null}function Re(e){const t=Ie(e);return t&&t.color||"var(--text-secondary)"}function re(e){const t=Ie(e);we=t?[...t.permissions]:[];const o=(s,i)=>{const a=document.getElementById(s);a&&(a.style.display=i?"block":"none")},r=(s,i)=>{const a=document.getElementById(s);a&&(a.style.display=i?"flex":"none")};r("side-collect-fee",x("income:create")),r("side-record-expense",x("expense:create")),r("side-import",x("ledger:import")),r("side-owners-upload",x("owners:upload")),r("side-export",x("ledger:export")),r("side-manage-users",x("users:manage")),r("side-manage-roles",x("users:role_change"));const n=x("dashboard:view");r("side-dashboard",n),r("side-history",n&&x("history:view")),r("side-reports",n&&x("reports:view")),r("side-directory",!0),r("side-helpdesk",!0);const l=x("users:manage")||x("users:role_change");o("side-admin-label",l),o("side-admin-nav",l),o("workspace",n),oe.length>0&&de(oe)}function _e(e){if(!e)return null;const t=e.match(/^(\d+)/);return t?parseInt(t[1],10):null}function Ne(e){if(ne.length===0)return!0;const t=_e(e);return t!==null&&ne.includes(t)}function ke(e){return ne.length===0?e:e.filter(t=>Ne(t.flat_no))}window.toggleAuthForms=function(e){document.getElementById("login-form-wrapper").style.display=e?"none":"block",document.getElementById("register-form-wrapper").style.display=e?"block":"none"};window.handleLoginSubmit=async function(e){if(e.preventDefault(),!p){u("Database not connected.","error");return}const t=document.getElementById("login-email").value.trim(),o=document.getElementById("login-password").value,r=document.getElementById("btn-login-submit");r.disabled=!0,r.textContent="Signing In...";try{const{error:n}=await p.auth.signInWithPassword({email:t,password:o});if(n)throw n;u("Welcome back!","success")}catch(n){u(n.message||"Failed to log in","error")}finally{r.disabled=!1,r.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Sign In'}};window.handleRegisterSubmit=async function(e){if(e.preventDefault(),!p){u("Database not connected.","error");return}const t=document.getElementById("register-email").value.trim(),o=document.getElementById("register-password").value,r=document.getElementById("register-confirm-password").value;if(o!==r){u("Passwords do not match.","error");return}if(o.length<6){u("Password must be at least 6 characters.","error");return}const n=document.getElementById("btn-register-submit");n.disabled=!0,n.textContent="Registering...";try{const{data:l,error:s}=await p.auth.signUp({email:t,password:o});if(s)throw s;l.session?u("Registration successful!","success"):u("Registration successful! Verify link sent to email.","success"),toggleAuthForms(!1)}catch(l){u(l.message||"Registration failed.","error")}finally{n.disabled=!1,n.innerHTML='<i class="fa-solid fa-user-plus"></i> Create Account'}};window.handleLogout=async function(){if(p&&confirm("Are you sure you want to sign out?"))try{localStorage.removeItem("isSoftLogin"),localStorage.removeItem("currentFlatNo");const{error:e}=await p.auth.signOut();if(e)throw e;u("Logged out successfully.")}catch{u("Logout failed.","error")}};async function Se(){if(p)try{const{data:e,error:t}=await p.from("owners").select("flat_no").limit(1);if(t)throw t;if(!e||e.length===0){const o=[],r=["1","2","3","4","5","6","7","8"],n=["A","B","C","D","E","F","G","H"];r.forEach(s=>{n.forEach(i=>{o.push({flat_no:`${s}${i}`,owner_name:`Flat ${s}${i}`})})});const{error:l}=await p.from("owners").insert(o);if(l)throw l;console.log("Default building owner mappings seeded successfully!")}}catch(e){console.error("ensureOwnersPopulated error:",e)}}async function ie(){if(p)try{let{data:e,error:t}=await p.from("owners").select("flat_no, owner_name").order("flat_no");if(t)throw t;e=ke(e);const o=document.getElementById("inc-flat"),r=document.getElementById("hist-flat"),n=o?o.value:"",l=r?r.value:"ALL";o&&(o.innerHTML='<option value="" disabled selected>Select Room & Tenant</option>',e.forEach(i=>{const a=document.createElement("option"),c=`${i.flat_no} - ${i.owner_name}`;a.value=c,a.textContent=c,o.appendChild(a)}),n&&e.some(i=>`${i.flat_no} - ${i.owner_name}`===n)&&(o.value=n)),r&&(r.innerHTML='<option value="ALL">All Flats</option>',e.forEach(i=>{const a=document.createElement("option");a.value=i.flat_no,a.textContent=`${i.flat_no} - ${i.owner_name}`,r.appendChild(a)}),r.value=l);const s=document.getElementById("ticket-flat");if(s){s.innerHTML='<option value="" disabled selected>Select Your Flat</option>';const i=localStorage.getItem("isSoftLogin")==="true",a=localStorage.getItem("currentFlatNo");if(e.forEach(c=>{if(i&&c.flat_no!==a)return;const d=document.createElement("option");d.value=c.flat_no,d.textContent=`${c.flat_no} - ${c.owner_name}`,i&&c.flat_no===a&&(d.selected=!0),s.appendChild(d)}),i){const c=s.querySelector('option[value=""]');c&&c.remove()}}}catch(e){console.error("loadFlats registry error:",e),u("Could not load owners registry list.","error")}}async function Y(){if(!p)return;const e=document.getElementById("filter-year").value,t=document.getElementById("filter-month").value;try{const{data:o,error:r}=await p.from("income").select("id, flat_no, year, month, amount, date_received, category, event_name, remarks").eq("year",e).eq("month",t);if(r)throw r;const{data:n,error:l}=await p.from("expenses").select("id, year, month, expense_head, description, amount, date_spent").eq("year",e).eq("month",t);if(l)throw l;const s=o.reduce((m,h)=>m+parseFloat(h.amount),0),i=n.reduce((m,h)=>m+parseFloat(h.amount),0),a=s-i;document.getElementById("stat-income").textContent=D(s),document.getElementById("stat-expense").textContent=D(i),document.getElementById("stat-cash").textContent=D(a);const c=[];o.forEach(m=>{let h=`Flat ${m.flat_no} Maintenance Fee`;m.category==="Special Event"?h=`Flat ${m.flat_no} ${m.event_name} Subscription`:m.category==="Other"&&(h=`Flat ${m.flat_no} Other - ${m.remarks||"Misc"}`),c.push({id:m.id,type:"INCOME",description:h,year:m.year,month:m.month,amount:parseFloat(m.amount),date:m.date_received})}),n.forEach(m=>{c.push({id:m.id,type:"EXPENSE",description:`${m.expense_head}: ${m.description}`,year:m.year,month:m.month,amount:parseFloat(m.amount),date:m.date_spent})}),c.sort((m,h)=>h.date.localeCompare(m.date)),oe=c,de(oe);const d=document.getElementById("btn-export");d&&(d.removeAttribute("href"),d.onclick=m=>{m.preventDefault(),exportLedgerToExcel()})}catch(o){console.error("Dashboard refresh error:",o),u("Error loading financial dashboard.","error")}}function D(e){return"Rs. "+Number(e).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}function de(e){const t=document.getElementById("ledger-body");if(t){if(t.innerHTML="",e.length===0){t.innerHTML=`
            <tr>
                <td colspan="7" class="text-center" style="color: var(--text-muted); padding: 30px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    No ledger entries logged for this period.
                </td>
            </tr>
        `;return}e.forEach(o=>{const r=document.createElement("tr"),n=o.type==="INCOME"?'<span class="badge badge-income">Income</span>':'<span class="badge badge-expense">Expense</span>',l=o.type==="INCOME"?`<button class="btn-receipt" title="Generate PDF Receipt" onclick="generateReceipt(${o.id})">
                   <i class="fa-solid fa-file-pdf"></i>
               </button>`:"",i=o.type==="INCOME"&&x("income:delete")||o.type==="EXPENSE"&&x("expense:delete")?`<button class="btn-delete" title="Delete entry" onclick="deleteEntry('${o.type}', ${o.id}, '${o.description.replace(/'/g,"\\'").replace(/"/g,"&quot;")}')">
                    <i class="fa-solid fa-trash-can"></i>
               </button>`:"";r.innerHTML=`
            <td>#${o.id}</td>
            <td>${n}</td>
            <td><strong>${o.description}</strong></td>
            <td>${o.month} ${o.year}</td>
            <td class="text-right ${o.type==="INCOME"?"icon-emerald":"icon-rose"}" style="font-weight: 600;">
                ${o.type==="INCOME"?"+":"-"} ${Number(o.amount).toLocaleString("en-IN",{minimumFractionDigits:2})}
            </td>
            <td class="text-center">${W(o.date)}</td>
            <td class="text-center">
                ${l}
                ${i}
            </td>
        `,t.appendChild(r)})}}window.filterTable=function(){const e=document.getElementById("table-search").value.toLowerCase().trim();if(!e){de(oe);return}const t=oe.filter(o=>o.description.toLowerCase().includes(e)||o.type.toLowerCase().includes(e)||String(o.id).includes(e));de(t)};window.handleIncomeSubmit=async function(e){if(e.preventDefault(),!p){u("Database not connected.","error");return}if(!x("income:create")){u("Access Denied: You don't have permission to record income entries.","error");return}const t=document.getElementById("inc-flat").value;if(ne.length>0){const d=t.split(" - ")[0],m=_e(d);if(m===null||!ne.includes(m)){u("Access Denied: You can only collect fees for flats on your assigned floors.","error");return}}const o=document.getElementById("inc-category").value,r=document.getElementById("inc-event")?document.getElementById("inc-event").value.trim():"",n=document.getElementById("inc-remarks")?document.getElementById("inc-remarks").value.trim():"",l=document.getElementById("inc-year").value,s=document.getElementById("inc-month").value,i=document.getElementById("inc-amount").value,a=document.getElementById("inc-date").value,c=e.target.querySelector("button[type=submit]");if(c.disabled=!0,!t||t==="Select Room & Tenant"||!i||!a){u("Please fill out all fields.","error"),c.disabled=!1;return}try{const d=t.split(" - ")[0].trim(),m=parseFloat(i);if(isNaN(m))throw new Error("Amount must be a valid number.");const{data:h,error:f}=await p.from("income").insert({flat_no:d,year:l,month:s,amount:m,date_received:a,category:o,event_name:o==="Special Event"?r:null,remarks:n||null}).select("id").single();if(f)throw f;u(`Payment logged for Flat ${d}`,"success",{text:'<i class="fa-solid fa-file-pdf"></i> Receipt',callback:()=>generateReceipt(h.id)}),document.getElementById("inc-amount").value="",document.getElementById("inc-event")&&(document.getElementById("inc-event").value=""),document.getElementById("inc-remarks")&&(document.getElementById("inc-remarks").value=""),document.getElementById("inc-category").value="Monthly Maintenance",toggleEventNameField("Monthly Maintenance"),closeModal("incomeModal"),Y()}catch(d){u(d.message||"Failed to log income","error")}finally{c.disabled=!1}};window.handleExpenseSubmit=async function(e){if(e.preventDefault(),!p){u("Database not connected.","error");return}if(!x("expense:create")){u("Access Denied: You don't have permission to record expense entries.","error");return}const t=document.getElementById("exp-year").value,o=document.getElementById("exp-month").value,r=document.getElementById("exp-head").value,n=document.getElementById("exp-desc").value.trim(),l=document.getElementById("exp-amount").value,s=document.getElementById("exp-date").value,i=e.target.querySelector("button[type=submit]");if(i.disabled=!0,!r||!n||!l||!s){u("Please fill out all fields.","error"),i.disabled=!1;return}try{const a=parseFloat(l);if(isNaN(a))throw new Error("Amount must be a valid number.");const{error:c}=await p.from("expenses").insert({year:t,month:o,expense_head:r,description:n,amount:a,date_spent:s});if(c)throw c;u(`Expense saved: ${n}`),document.getElementById("exp-desc").value="",document.getElementById("exp-amount").value="",closeModal("expenseModal"),Y()}catch(a){u(a.message||"Failed to log expense","error")}finally{i.disabled=!1}};window.toggleEventNameField=function(e){const t=document.getElementById("inc-event-field"),o=document.getElementById("inc-event");t&&(e==="Special Event"?(t.classList.remove("hidden"),o&&(o.required=!0)):(t.classList.add("hidden"),o&&(o.required=!1,o.value="")))};async function le(){if(p)try{const{data:e,error:t}=await p.from("expense_heads").select("id, name").order("name");if(t)throw t;const o=document.getElementById("exp-head");if(o){const n=o.value;o.innerHTML='<option value="" disabled selected>Select Category / Head</option>',e.forEach(l=>{const s=document.createElement("option");s.value=l.name,s.textContent=l.name,o.appendChild(s)}),n&&e.some(l=>l.name===n)&&(o.value=n)}const r=document.getElementById("category-manager-list");r&&(r.innerHTML="",e.length===0?r.innerHTML='<div style="text-align: center; color: var(--text-muted); padding: 10px;">No custom expense heads defined.</div>':e.forEach(n=>{const l=document.createElement("div");l.className="category-item";const s=x("expense_heads:delete")?`<button class="btn-delete" title="Delete category" onclick="handleDeleteExpenseHead(${n.id}, '${n.name.replace(/'/g,"\\'")}')">
                               <i class="fa-solid fa-trash-can"></i>
                           </button>`:"";l.innerHTML=`
                        <span>${n.name}</span>
                        ${s}
                    `,r.appendChild(l)}))}catch(e){console.error("loadExpenseHeads error:",e),u("Could not load expense categories.","error")}}window.openExpenseHeadsModal=function(){const e=document.getElementById("add-head-form");e&&(e.style.display=x("expense_heads:create")?"flex":"none"),le(),openModal("expenseHeadsModal")};window.handleAddExpenseHead=async function(e){if(e.preventDefault(),!p)return;if(!x("expense_heads:create")){u("Access Denied: You don't have permission to add expense categories.","error");return}const t=document.getElementById("new-head-name"),o=t.value.trim();if(o)try{const{error:r}=await p.from("expense_heads").insert({name:o});if(r)throw r.code==="23505"?new Error("Category already exists."):r;u(`Category "${o}" added successfully.`,"success"),t.value="",le()}catch(r){u(r.message||"Failed to add category.","error")}};window.handleDeleteExpenseHead=async function(e,t){if(p){if(!x("expense_heads:delete")){u("Access Denied: You don't have permission to delete expense categories.","error");return}if(confirm(`Are you sure you want to delete the category "${t}"?
Note: Existing expenses using this head will remain, but this category option will be removed.`))try{const{error:o}=await p.from("expense_heads").delete().eq("id",e);if(o)throw o;u(`Category "${t}" deleted.`,"success"),le()}catch(o){u(o.message||"Failed to delete category.","error")}}};let me=[];window.openOwnersDirectoryModal=function(){openModal("ownersDirectoryModal"),loadOwnersDirectory()};window.loadOwnersDirectory=async function(e=""){if(!p)return;const t=document.getElementById("flats-grid");if(t){e||(t.innerHTML='<div style="grid-column: span 3; text-align: center; color: var(--text-secondary); padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>Loading flats...</div>');try{let{data:o,error:r}=await p.from("owners").select("*").order("flat_no");if(r)throw r;me=ke(o||[]),$e(me,e)}catch(o){console.error("loadOwnersDirectory error:",o),u("Failed to load owners directory.","error")}}};function $e(e,t="",o=""){const r=document.getElementById("flats-grid");if(!r)return;r.innerHTML="";const n=new Set;e.forEach(i=>{i.flat_no&&i.flat_no.includes("+")&&i.flat_no.split("+").map(c=>c.trim()).forEach(c=>n.add(c))});const l=t.trim().toLowerCase(),s=e.filter(i=>{if(n.has(i.flat_no))return!1;const a=i.flat_no.toLowerCase().includes(l)||i.owner_name.toLowerCase().includes(l)||i.contact_no&&i.contact_no.includes(l)||i.parking_no&&i.parking_no.toLowerCase().includes(l),c=o===""||i.flat_no.startsWith(o);return a&&c});if(s.length===0){r.innerHTML='<div style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 20px;">No matching flats found.</div>';return}s.forEach(i=>{const a=document.createElement("div");a.className="flat-card",a.dataset.flatNo=i.flat_no,a.onclick=()=>selectFlatForEdit(i.flat_no);let c="Owner";i.occupancy_status==="tenant-occupied"?c="Tenant":i.occupancy_status==="vacant"&&(c="Vacant"),a.innerHTML=`
            <h4>${i.flat_no}</h4>
            <p style="font-weight: 600;">${i.owner_name}</p>
            <span class="badge ${i.occupancy_status==="vacant"?"badge-expense":"badge-income"}" style="font-size: 0.6rem; padding: 1px 6px;">${c}</span>
        `,r.appendChild(a)})}window.filterOwnersDirectory=function(){const e=document.getElementById("directory-search").value,t=document.getElementById("directory-floor-filter")?document.getElementById("directory-floor-filter").value:"";$e(me,e,t)};window.selectFlatForEdit=function(e){document.querySelectorAll(".flat-card").forEach(c=>{c.dataset.flatNo===e?c.classList.add("active"):c.classList.remove("active")});const t=me.find(c=>c.flat_no===e),o=document.getElementById("directory-detail-side");if(!o||!t)return;const r=x("owners:edit_any"),n=localStorage.getItem("isSoftLogin")==="true"&&localStorage.getItem("currentFlatNo")===e,l=r||x("owners:edit_own")&&n,s=l?"":"disabled",i=[{value:"owner-occupied",label:"Owner Occupied"},{value:"tenant-occupied",label:"Tenant Occupied"},{value:"vacant",label:"Vacant"}];let a=`<select id="edit-status" ${s}>`;i.forEach(c=>{const d=c.value===t.occupancy_status?"selected":"";a+=`<option value="${c.value}" ${d}>${c.label}</option>`}),a+="</select>",o.innerHTML=`
        <div class="card" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 16px;">
                <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--color-indigo);">Flat ${t.flat_no} Details</h3>
                <span class="badge ${t.occupancy_status==="vacant"?"badge-expense":"badge-income"}">${t.occupancy_status.replace("-"," ")}</span>
            </div>
            
            <form id="edit-owner-form" onsubmit="saveOwnerProfile(event)">
                <input type="hidden" id="edit-flat-no" value="${t.flat_no}">
                
                <div class="input-field">
                    <label for="edit-owner-name">Owner Name</label>
                    <input type="text" id="edit-owner-name" value="${t.owner_name||""}" ${s} required>
                </div>
                
                <div class="input-field">
                    <label for="edit-contact">Contact No</label>
                    <input type="text" id="edit-contact" value="${t.contact_no||""}" ${s}>
                </div>
                
                ${l?`
                <div class="input-field">
                    <label for="edit-passcode">Passcode (For Soft Login)</label>
                    <input type="text" id="edit-passcode" placeholder="e.g. 1234" value="${t.passcode||""}" ${s}>
                </div>
                `:""}
                
                <div class="grid-two-cols">
                    <div class="input-field">
                        <label for="edit-parking">Parking Space No</label>
                        <input type="text" id="edit-parking" value="${t.parking_no||"None"}" ${s}>
                    </div>
                    <div class="input-field">
                        <label for="edit-mc-rate">Monthly MC Rate (Rs.)</label>
                        <input type="number" step="0.01" id="edit-mc-rate" value="${t.monthly_mc_rate||1e3}" ${s} required>
                    </div>
                </div>
                
                <div class="input-field">
                    <label for="edit-status">Occupancy Status</label>
                    ${a}
                </div>
                
                <div class="input-field">
                    <label for="edit-family">Family Members Details</label>
                    <textarea id="edit-family" rows="3" placeholder="e.g. Spouse, Son (12), Daughter (8)" style="background-color: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-primary); padding: 10px; font-family: inherit; font-size: 0.9rem; resize: vertical;" ${s}>${t.family_members||""}</textarea>
                </div>
                
                <div class="input-field">
                    <label for="edit-combined">Combined Flat No(s)</label>
                    <input type="text" id="edit-combined" placeholder="e.g. 1B (leave empty if none)" value="${t.combined_flat_nos||""}" ${s}>
                </div>
                
                ${l?`<div class="modal-actions" style="margin-top: 16px;">
                            <button type="submit" class="btn btn-indigo" style="width: 100%;">
                                <i class="fa-solid fa-floppy-disk"></i> Save Profile
                            </button>
                       </div>`:`<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; margin-top: 10px;">
                            <i class="fa-solid fa-lock"></i> Edit restricted to Owner or Administrators.
                       </div>`}
            </form>
        </div>
    `};window.saveOwnerProfile=async function(e){if(e.preventDefault(),!p)return;const t=document.getElementById("edit-flat-no").value,o=localStorage.getItem("isSoftLogin")==="true"&&localStorage.getItem("currentFlatNo")===t;if(!x("owners:edit_any")&&!(x("owners:edit_own")&&o)){u("Access Denied: Only Admins or the flat owner can save profiles.","error");return}const r=document.getElementById("edit-owner-name").value.trim(),n=document.getElementById("edit-contact").value.trim(),l=document.getElementById("edit-passcode");let s;if(l){const f=l.value.trim();s=f?parseInt(f):null}const i=document.getElementById("edit-parking").value.trim(),a=parseFloat(document.getElementById("edit-mc-rate").value),c=document.getElementById("edit-status").value,d=document.getElementById("edit-family").value.trim(),m=document.getElementById("edit-combined").value.trim(),h=e.target.querySelector("button[type=submit]");h&&(h.disabled=!0,h.textContent="Saving...");try{const f={owner_name:r,contact_no:n,parking_no:i,monthly_mc_rate:a,occupancy_status:c,family_members:d,combined_flat_nos:m};s!==void 0&&(f.passcode=s);const{error:b}=await p.from("owners").update(f).eq("flat_no",t);if(b)throw b;u(`Profile for Flat ${t} updated!`,"success"),await loadOwnersDirectory(),selectFlatForEdit(t),ie()}catch(f){console.error("saveOwnerProfile error:",f),u(f.message||"Failed to update profile.","error")}finally{h&&(h.disabled=!1,h.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Save Profile')}};window.deleteEntry=async function(e,t,o){if(!p){u("Database not connected.","error");return}if(!x("income:delete")&&!x("expense:delete")){u("Access Denied: You don't have permission to delete entries.","error");return}if(confirm(`Are you sure you want to permanently delete this entry?

"${o}"`))try{const r=e==="INCOME"?"income":"expenses",{error:n}=await p.from(r).delete().eq("id",t);if(n)throw n;u("Entry removed successfully."),Y()}catch(r){u(r.message||"Deletion failed","error")}};window.openModal=function(e){const t=document.getElementById(e);t&&(t.style.display="block")};window.closeModal=function(e){const t=document.getElementById(e);if(!t)return;t.style.display="none";const o=t.querySelector("form");if(o){o.reset();const r=o.querySelector(".dropzone-text");r&&(e==="importModal"?r.textContent="Click or drag Excel file here":r.textContent="Click or drag owners.xlsx file here",r.style.color="var(--text-secondary)")}};window.updateDropzoneText=function(e){const t=e.parentElement.querySelector(".dropzone-text");e.files&&e.files[0]&&t&&(t.textContent=`Selected: ${e.files[0].name}`,t.style.color="var(--color-emerald)")};window.onclick=function(e){e.target.classList.contains("modal")&&e.target.id!=="auth-container"&&closeModal(e.target.id)};async function Oe(){try{const e=await fetch("/static/logo.png");if(!e.ok)return null;const t=await e.blob();return new Promise(o=>{const r=new FileReader;r.onloadend=()=>o(r.result),r.readAsDataURL(t)})}catch(e){return console.error("Failed to load logo image:",e),null}}window.generateReceipt=async function(e){if(!p){u("Database not connected.","error");return}try{u("Fetching receipt details...","success");const{data:t,error:o}=await p.from("income").select("id, flat_no, year, month, amount, date_received, category, event_name, remarks").eq("id",e).single();if(o||!t)throw new Error("Receipt data not found.");const{data:r}=await p.from("owners").select("owner_name").eq("flat_no",t.flat_no).single(),n=r?r.owner_name:`Flat ${t.flat_no}`;let l=t.year;try{const w=parseInt(t.year.substring(0,4),10);l=`${w}-${String(w+1).substring(2)}`}catch{}const s=`DR-${l}-${String(t.id).padStart(4,"0")}`,{jsPDF:i}=window.jspdf,a=new i({orientation:"landscape",unit:"mm",format:"a5"});a.setDrawColor(15,23,42),a.setLineWidth(.3),a.rect(5,5,200,138),a.setDrawColor(2,132,199),a.setLineWidth(.6),a.rect(7,7,196,134),a.setTextColor(248,250,252),a.setFont("helvetica","bold"),a.setFontSize(28),a.text("DEEPSIKHA RESIDENCY",105,74,{align:"center",angle:15});const c=await Oe();c?a.addImage(c,"PNG",12,12,18,18):(a.setDrawColor(148,163,184),a.rect(12,12,18,18),a.setFont("helvetica","bold"),a.setFontSize(8),a.setTextColor(148,163,184),a.text("LOGO",21,22,{align:"center"})),a.setTextColor(15,23,42),a.setFont("helvetica","bold"),a.setFontSize(14),a.text("DEEPSIKHA RESIDENCY (BLOCK - 2)",34,17),a.setTextColor(71,85,105),a.setFont("helvetica","normal"),a.setFontSize(8),a.text("Flat Owners Association",34,22),a.text("Deepsikha Residency, Block 2, Flat 1-8 A-H, Asansol",34,26),a.setDrawColor(203,213,225),a.setLineWidth(.4),a.line(10,32,200,32),a.setTextColor(15,23,42),a.setFont("helvetica","bold"),a.setFontSize(11),a.text("MONEY RECEIPT",12,40),a.setFont("helvetica","bold"),a.setFontSize(8),a.text("Receipt No:",140,40),a.text("Date:",140,45),a.setFont("helvetica","normal"),a.text(s,160,40),a.text(W(t.date_received),160,45),a.setFillColor(248,250,252),a.rect(12,50,186,22,"F"),a.setDrawColor(226,232,240),a.setLineWidth(.3),a.rect(12,50,186,22),a.setFont("helvetica","bold"),a.setFontSize(8.5),a.setTextColor(51,65,85),a.text("Received From:",16,56),a.text("For Period:",16,66),a.setFont("helvetica","normal"),a.setTextColor(15,23,42),a.text(n,42,56),a.text(`${t.month} ${t.year}`,42,66),a.setFont("helvetica","bold"),a.setTextColor(51,65,85),a.text("Flat No:",120,56),a.text("Purpose:",120,66),a.setFont("helvetica","normal"),a.setTextColor(15,23,42),a.text(t.flat_no,138,56);let d="Maintenance Charge Collection";t.category==="Special Event"?d=`${t.event_name} Subscription`:t.category==="Other"&&(d=t.remarks||"Other Collection"),a.text(d,138,66),a.setFont("helvetica","bold"),a.setFontSize(11),a.setTextColor(15,23,42),a.text("Total Paid:",12,84),a.setFont("helvetica","bold"),a.setFontSize(12),a.setTextColor(5,150,105),a.text(`Rs. ${t.amount.toLocaleString("en-IN",{minimumFractionDigits:2})}`,34,84);const m=Ve(t.amount);a.setFont("helvetica","bold"),a.setFontSize(8.5),a.setTextColor(51,65,85),a.text("Amount in Words:",12,94),a.setFont("helvetica","oblique"),a.setFontSize(8),a.setTextColor(71,85,105);const h=a.splitTextToSize(m,115);if(a.text(h,12,99),t.remarks&&t.category!=="Other"){a.setFont("helvetica","bold"),a.setFontSize(8.5),a.setTextColor(51,65,85),a.text("Remarks:",12,112),a.setFont("helvetica","normal"),a.setFontSize(8),a.setTextColor(71,85,105);const w=a.splitTextToSize(t.remarks,115);a.text(w,12,117)}a.setDrawColor(203,213,225),a.setLineWidth(.3),a.line(140,94,185,94),a.setFont("helvetica","bold"),a.setFontSize(8),a.setTextColor(15,23,42),a.text("Authorized Signatory",162.5,98,{align:"center"}),a.setFont("helvetica","normal"),a.setFontSize(7.5),a.setTextColor(71,85,105),a.text("Deepsikha Residency",162.5,102,{align:"center"});const f=a.output("datauristring"),b=window.open();b?b.document.write(`<iframe width='100%' height='100%' src='${f}'></iframe>`):(a.save(`Receipt_${s}.pdf`),u("Receipt downloaded (new window blocked)."))}catch(t){console.error("Receipt generation failed:",t),u(t.message||"Failed to generate receipt PDF.","error")}};window.openHistoryModal=async function(){openModal("historyModal");const e=new Date,t=e.getFullYear(),o=e.toISOString().split("T")[0],r=`${t}-01-01`,n=document.getElementById("hist-start-date"),l=document.getElementById("hist-end-date");n&&(n.value=r),l&&(l.value=o),await ie(),fetchHistory()};window.fetchHistory=async function(){if(!p)return;const e=document.getElementById("hist-type").value;let t=document.getElementById("hist-flat").value;const o=document.getElementById("hist-year").value,r=document.getElementById("hist-month").value,n=document.getElementById("hist-start-date").value,l=document.getElementById("hist-end-date").value,s=document.getElementById("hist-search").value.trim().toLowerCase();t&&t.includes(" - ")&&(t=t.split(" - ")[0].trim()),t==="ALL"&&(t="");try{const i=[],{data:a}=await p.from("owners").select("flat_no, owner_name"),c={};if(a&&a.forEach(d=>{c[d.flat_no]=d.owner_name}),e==="ALL"||e==="INCOME"){let d=p.from("income").select("id, flat_no, year, month, amount, date_received, category, event_name, remarks");t&&(d=d.eq("flat_no",t)),o&&o!=="ALL"&&(d=d.eq("year",o)),r&&r!=="ALL"&&(d=d.eq("month",r)),n&&(d=d.gte("date_received",n)),l&&(d=d.lte("date_received",l));const{data:m,error:h}=await d;if(h)throw h;m.forEach(f=>{const b=c[f.flat_no]||`Flat ${f.flat_no}`;let w=`Flat ${f.flat_no} Maintenance Fee`;f.category==="Special Event"?w=`Flat ${f.flat_no} ${f.event_name} Subscription`:f.category==="Other"&&(w=`Flat ${f.flat_no} Other - ${f.remarks||"Misc"}`);const g=String(f.amount);let v=!0;s&&(v=w.toLowerCase().includes(s)||b.toLowerCase().includes(s)||g.includes(s)||f.date_received.includes(s)||f.month.toLowerCase().includes(s)||f.year.includes(s)),v&&i.push({id:f.id,type:"INCOME",flat_no:f.flat_no,owner_name:b,description:w,year:f.year,month:f.month,amount:parseFloat(f.amount),date:f.date_received})})}if((e==="ALL"||e==="EXPENSE")&&!t){let d=p.from("expenses").select("id, year, month, expense_head, description, amount, date_spent");o&&o!=="ALL"&&(d=d.eq("year",o)),r&&r!=="ALL"&&(d=d.eq("month",r)),n&&(d=d.gte("date_spent",n)),l&&(d=d.lte("date_spent",l));const{data:m,error:h}=await d;if(h)throw h;m.forEach(f=>{const b=String(f.amount),w=`${f.expense_head}: ${f.description}`;let g=!0;s&&(g=w.toLowerCase().includes(s)||b.includes(s)||f.date_spent.includes(s)||f.month.toLowerCase().includes(s)||f.year.includes(s)),g&&i.push({id:f.id,type:"EXPENSE",flat_no:"",owner_name:"",description:w,year:f.year,month:f.month,amount:parseFloat(f.amount),date:f.date_spent})})}i.sort((d,m)=>m.date.localeCompare(d.date)),ze(i)}catch(i){console.error("History search error:",i),u("Error searching history ledger.","error")}};function ze(e){const t=document.getElementById("history-body"),o=document.getElementById("history-total");if(!t)return;t.innerHTML="";let r=0;if(e.length===0){t.innerHTML=`
            <tr>
                <td colspan="5" class="text-center" style="color: var(--text-muted); padding: 30px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    No ledger history matches the current filters.
                </td>
            </tr>
        `,o&&(o.innerHTML="₹0.00");return}if(e.forEach(n=>{const l=document.createElement("tr"),s=Number(n.amount)||0;n.type==="INCOME"?r+=s:r-=s;const i=n.type==="INCOME"?'<span class="badge badge-income">Income</span>':'<span class="badge badge-expense">Expense</span>',a=n.type==="INCOME"?`<button class="btn-receipt" title="Generate PDF Receipt" onclick="generateReceipt(${n.id})">
                   <i class="fa-solid fa-file-pdf"></i> Receipt
               </button>`:"",d=n.type==="INCOME"&&x("income:delete")||n.type==="EXPENSE"&&x("expense:delete")?`<button class="btn-delete" title="Delete entry" onclick="deleteHistoryEntry('${n.type}', ${n.id}, '${n.description.replace(/'/g,"\\'").replace(/"/g,"&quot;")}')">
                    <i class="fa-solid fa-trash-can"></i>
               </button>`:"";l.innerHTML=`
            <td>${W(n.date)}</td>
            <td>${i}</td>
            <td><strong>${n.description}</strong></td>
            <td class="text-right ${n.type==="INCOME"?"icon-emerald":"icon-rose"}" style="font-weight: 600;">
                ${n.type==="INCOME"?"+":"-"} ${s.toLocaleString("en-IN",{minimumFractionDigits:2})}
            </td>
            <td class="text-center">
                ${a}
                ${d}
            </td>
        `,t.appendChild(l)}),o){const n=r>=0?"+":"-",l=r>=0?"icon-emerald":"icon-rose";o.className=`text-right ${l}`,o.innerHTML=`${n} ₹${Math.abs(r).toLocaleString("en-IN",{minimumFractionDigits:2})}`}}window.deleteHistoryEntry=async function(e,t,o){if(!p){u("Database not connected.","error");return}if(!x("income:delete")&&!x("expense:delete")){u("Access Denied: You don't have permission to delete entries.","error");return}if(confirm(`Are you sure you want to permanently delete this entry from history?

"${o}"`))try{const r=e==="INCOME"?"income":"expenses",{error:n}=await p.from(r).delete().eq("id",t);if(n)throw n;u("Entry removed successfully."),fetchHistory(),Y()}catch(r){u(r.message||"Deletion failed","error")}};window.openReportsModal=function(){openModal("reportsModal");const e=new Date,t=e.getFullYear(),o=e.toISOString().split("T")[0],r=String(e.getMonth()+1).padStart(2,"0"),n=`${t}-${r}-01`,l=document.getElementById("rep-start-date"),s=document.getElementById("rep-end-date"),i=document.getElementById("rep-year");l&&(l.value=n),s&&(s.value=o),i&&(i.value=t.toString()),switchReportTab("date-wise-cashbook")};window.switchReportTab=function(e){ae=e,document.querySelectorAll(".report-tab-btn").forEach(n=>{n.classList.remove("active")});const t=document.getElementById(`tab-${e}`);t&&t.classList.add("active");const o=document.getElementById("rep-filter-dates"),r=document.getElementById("rep-filter-year");e==="date-wise-cashbook"?(o&&o.classList.remove("hidden"),r&&r.classList.add("hidden")):e==="helpdesk-stats"?(o&&o.classList.add("hidden"),r&&r.classList.add("hidden")):(o&&o.classList.add("hidden"),r&&r.classList.remove("hidden")),loadActiveReport()};window.loadActiveReport=async function(){const e=document.getElementById("report-sheet");if(e){e.innerHTML=`
        <div class="text-center" style="padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 12px; display: block;"></i>
            Generating report, please wait...
        </div>
    `;try{if(ae==="date-wise-cashbook"){const t=document.getElementById("rep-start-date").value,o=document.getElementById("rep-end-date").value;if(!t||!o){e.innerHTML='<div class="text-center" style="padding: 30px; color: #e11d48;">Please select both Start and End dates.</div>';return}const r=await He(t,o);qe(r)}else if(ae==="month-wise-cashbook"){const t=document.getElementById("rep-year").value,o=await Pe(t);Ye(o)}else if(ae==="income-expenditure"){const t=document.getElementById("rep-year").value,o=await Ue(t);Je(o)}else ae==="helpdesk-stats"&&await Qe()}catch(t){console.error("Report loader error:",t),e.innerHTML='<div class="text-center" style="padding: 30px; color: #e11d48;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading report. Please try again.</div>'}}};window.printActiveReport=function(){window.print()};function W(e){if(!e)return"";const t=e.split("-");return t.length===3?`${t[2]}/${t[1]}/${t[0]}`:e}async function He(e,t){const{data:o,error:r}=await p.from("income").select("amount").lt("date_received",e);if(r)throw r;const n=o.reduce((y,I)=>y+parseFloat(I.amount),0),{data:l,error:s}=await p.from("expenses").select("amount").lt("date_spent",e);if(s)throw s;const i=l.reduce((y,I)=>y+parseFloat(I.amount),0),a=n-i,{data:c,error:d}=await p.from("income").select("id, flat_no, year, amount, date_received, category, event_name, remarks").gte("date_received",e).lte("date_received",t);if(d)throw d;const{data:m,error:h}=await p.from("expenses").select("id, expense_head, description, amount, date_spent").gte("date_spent",e).lte("date_spent",t);if(h)throw h;const{data:f}=await p.from("owners").select("flat_no, owner_name"),b={};f&&f.forEach(y=>{b[y.flat_no]=y.owner_name});const w=[];c.forEach(y=>{let I=y.year;try{const S=parseInt(y.year.substring(0,4),10);I=`${S}-${String(S+1).substring(2)}`}catch{}const G=`DR-${I}-${String(y.id).padStart(4,"0")}`,Z=b[y.flat_no]||`Flat ${y.flat_no}`;let A=`Flat ${y.flat_no} - ${Z}`;y.category==="Special Event"?A+=` (${y.event_name} Subscription)`:y.category==="Other"?A+=` (Other: ${y.remarks||"Misc"})`:A+=" (Maintenance)",w.push({id:y.id,date:y.date_received,type:"INCOME",particulars:A,ref_no:G,debit:parseFloat(y.amount),credit:0})}),m.forEach(y=>{w.push({id:y.id,date:y.date_spent,type:"EXPENSE",particulars:`[${y.expense_head}] ${y.description}`,ref_no:`EXP-${String(y.id).padStart(4,"0")}`,debit:0,credit:parseFloat(y.amount)})}),w.sort((y,I)=>y.date!==I.date?y.date.localeCompare(I.date):y.type==="INCOME"?-1:1);const g=w.reduce((y,I)=>y+I.debit,0),v=w.reduce((y,I)=>y+I.credit,0);return{start_date:e,end_date:t,opening_balance:a,transactions:w,total_debit:g,total_credit:v,closing_balance:a+g-v}}async function Pe(e){const t=`${e}-01-01`,{data:o,error:r}=await p.from("income").select("amount").lt("date_received",t);if(r)throw r;const n=o.reduce((y,I)=>y+parseFloat(I.amount),0),{data:l,error:s}=await p.from("expenses").select("amount").lt("date_spent",t);if(s)throw s;const i=l.reduce((y,I)=>y+parseFloat(I.amount),0),a=n-i,{data:c,error:d}=await p.from("income").select("amount, month").eq("year",e);if(d)throw d;const{data:m,error:h}=await p.from("expenses").select("amount, month").eq("year",e);if(h)throw h;const f={},b={};c.forEach(y=>{f[y.month]=(f[y.month]||0)+parseFloat(y.amount)}),m.forEach(y=>{b[y.month]=(b[y.month]||0)+parseFloat(y.amount)});const w=["January","February","March","April","May","June","July","August","September","October","November","December"],g=[];let v=a;return w.forEach(y=>{const I=f[y]||0,G=b[y]||0,Z=v,A=Z+I-G;v=A,g.push({month:y,opening_balance:Z,receipts:I,payments:G,closing_balance:A})}),{year:e,opening_balance_year:a,monthly_summaries:g,total_receipts:g.reduce((y,I)=>y+I.receipts,0),total_payments:g.reduce((y,I)=>y+I.payments,0),closing_balance_year:v}}async function Ue(e){const{data:t,error:o}=await p.from("income").select("flat_no, amount, category, event_name").eq("year",e);if(o)throw o;const{data:r,error:n}=await p.from("expenses").select("expense_head, amount").eq("year",e);if(n)throw n;const l={},s={};t.forEach(g=>{l[g.flat_no]=(l[g.flat_no]||0)+parseFloat(g.amount);let v="Monthly Maintenance Charge Collections";g.category==="Special Event"?v=`${g.event_name} Collections`:g.category==="Other"&&(v="Other Collections"),s[v]=(s[v]||0)+parseFloat(g.amount)});const i={};r.forEach(g=>{const v=g.expense_head||"Miscellaneous";i[v]=(i[v]||0)+parseFloat(g.amount)});const{data:a}=await p.from("owners").select("flat_no, owner_name"),c={};a&&a.forEach(g=>{c[g.flat_no]=g.owner_name});const d=[];Object.keys(l).forEach(g=>{const v=l[g];d.push({flat_no:g,owner_name:c[g]||`Flat ${g}`,amount:v})}),d.sort((g,v)=>g.flat_no.localeCompare(v.flat_no));const m=[];let h=0;Object.keys(i).forEach(g=>{const v=i[g];h+=v,m.push({category:g,amount:v})}),m.sort((g,v)=>g.category.localeCompare(v.category));const f=[];let b=0;Object.keys(s).forEach(g=>{const v=s[g];b+=v,f.push({category:g,amount:v})}),f.sort((g,v)=>g.category.localeCompare(v.category));const w=b-h;return{year:e,incomes:f,income_details:d,expenditures:m,total_income:b,total_expenditure:h,surplus_deficit:w}}function qe(e){const t=document.getElementById("report-sheet");if(!t)return;let o="",r=e.opening_balance;o+=`
        <tr class="row-opening">
            <td>${W(e.start_date)}</td>
            <td>-</td>
            <td>Opening Balance B/F</td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right rep-bal">${D(r)}</td>
        </tr>
    `,e.transactions.length===0?o+=`
            <tr>
                <td colspan="6" class="text-center" style="color: #64748b; padding: 20px;">
                    No transactions recorded during this period.
                </td>
            </tr>
        `:e.transactions.forEach(n=>{r=r+n.debit-n.credit;const l=n.debit>0?D(n.debit):"-",s=n.credit>0?D(n.credit):"-";o+=`
                <tr>
                    <td>${W(n.date)}</td>
                    <td><code>${n.ref_no}</code></td>
                    <td>${n.particulars}</td>
                    <td class="text-right ${n.debit>0?"amt-dr":""}">${l}</td>
                    <td class="text-right ${n.credit>0?"amt-cr":""}">${s}</td>
                    <td class="text-right rep-bal">${D(r)}</td>
                </tr>
            `}),o+=`
        <tr class="row-closing">
            <td>${W(e.end_date)}</td>
            <td>-</td>
            <td>Closing Balance C/F</td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right rep-bal">${D(e.closing_balance)}</td>
        </tr>
    `,t.innerHTML=`
        <div class="report-header">
            <h2>DEEPSIKHA RESIDENCY (BLOCK - 2)</h2>
            <p><strong>DATE-WISE CASH BOOK</strong></p>
            <p>Period: ${W(e.start_date)} to ${W(e.end_date)}</p>
        </div>
        
        <div class="report-summary-cards">
            <div class="report-sum-card">
                <h4>Opening Balance</h4>
                <p>${D(e.opening_balance)}</p>
            </div>
            <div class="report-sum-card sum-debit">
                <h4>Total Receipts (+)</h4>
                <p>${D(e.total_debit)}</p>
            </div>
            <div class="report-sum-card sum-credit">
                <h4>Total Payments (-)</h4>
                <p>${D(e.total_credit)}</p>
            </div>
        </div>
        
        <table class="report-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Voucher/Ref No</th>
                    <th>Particulars</th>
                    <th class="text-right">Receipts (Dr)</th>
                    <th class="text-right">Payments (Cr)</th>
                    <th class="text-right">Balance</th>
                </tr>
            </thead>
            <tbody>
                ${o}
            </tbody>
        </table>
    `}function Ye(e){const t=document.getElementById("report-sheet");if(!t)return;let o="";e.monthly_summaries.forEach(r=>{const n=r.receipts>0?D(r.receipts):"-",l=r.payments>0?D(r.payments):"-";o+=`
            <tr>
                <td><strong>${r.month}</strong></td>
                <td class="text-right">${D(r.opening_balance)}</td>
                <td class="text-right amt-dr">${n}</td>
                <td class="text-right amt-cr">${l}</td>
                <td class="text-right rep-bal">${D(r.closing_balance)}</td>
            </tr>
        `}),t.innerHTML=`
        <div class="report-header">
            <h2>DEEPSIKHA RESIDENCY (BLOCK - 2)</h2>
            <p><strong>MONTH-WISE CASH BOOK SUMMARY</strong></p>
            <p>Year: ${e.year}</p>
        </div>
        
        <div class="report-summary-cards">
            <div class="report-sum-card">
                <h4>Year Opening</h4>
                <p>${D(e.opening_balance_year)}</p>
            </div>
            <div class="report-sum-card sum-debit">
                <h4>Total Receipts</h4>
                <p>${D(e.total_receipts)}</p>
            </div>
            <div class="report-sum-card sum-credit">
                <h4>Total Payments</h4>
                <p>${D(e.total_payments)}</p>
            </div>
        </div>
        
        <table class="report-table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th class="text-right">Opening Balance</th>
                    <th class="text-right">Receipts (Dr)</th>
                    <th class="text-right">Payments (Cr)</th>
                    <th class="text-right">Closing Balance</th>
                </tr>
            </thead>
            <tbody>
                ${o}
            </tbody>
        </table>
    `}function Je(e){const t=document.getElementById("report-sheet");if(!t)return;let o="";e.incomes.length===0?o+='<tr><td colspan="2" class="text-center" style="color: #64748b;">No Income Recorded</td></tr>':e.incomes.forEach(i=>{o+=`
                <tr>
                    <td>${i.category}</td>
                    <td class="text-right amt-dr">${D(i.amount)}</td>
                </tr>
            `});let r="";e.expenditures.length===0?r+='<tr><td colspan="2" class="text-center" style="color: #64748b;">No Expenditures Recorded</td></tr>':e.expenditures.forEach(i=>{r+=`
                <tr>
                    <td>${i.category}</td>
                    <td class="text-right amt-cr">${D(i.amount)}</td>
                </tr>
            `});const n=e.surplus_deficit>=0,l=Math.abs(e.surplus_deficit);let s="";e.income_details.length===0?s+='<tr><td colspan="3" class="text-center" style="color: #64748b;">No Flat collections found.</td></tr>':e.income_details.forEach(i=>{s+=`
                <tr>
                    <td><strong>Flat ${i.flat_no}</strong></td>
                    <td>${i.owner_name}</td>
                    <td class="text-right amt-dr">${D(i.amount)}</td>
                </tr>
            `}),t.innerHTML=`
        <div class="report-header">
            <h2>DEEPSIKHA RESIDENCY (BLOCK - 2)</h2>
            <p><strong>INCOME AND EXPENDITURE ACCOUNT</strong></p>
            <p>For the Year Ended: 31st December ${e.year}</p>
        </div>
        
        <div class="inc-exp-grid">
            <div class="inc-exp-column col-expense">
                <h3>Expenditure (Debit)</h3>
                <table class="inc-exp-table">
                    <tbody>
                        ${r}
                        <tr class="total-row">
                            <td><strong>Total Expenditure</strong></td>
                            <td class="text-right">${D(e.total_expenditure)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="inc-exp-column col-income">
                <h3>Income (Credit)</h3>
                <table class="inc-exp-table">
                    <tbody>
                        ${o}
                        <tr class="total-row">
                            <td><strong>Total Income</strong></td>
                            <td class="text-right">${D(e.total_income)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="surplus-card ${n?"positive":"negative"}">
            ${n?`<i class="fa-solid fa-circle-arrow-up"></i> Excess of Income over Expenditure (Surplus): <strong>${D(l)}</strong>`:`<i class="fa-solid fa-circle-arrow-down"></i> Excess of Expenditure over Income (Deficit): <strong>${D(l)}</strong>`}
        </div>
        
        <div style="margin-top: 30px;">
            <h4 style="color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 12px; font-weight: 700;">
                <i class="fa-solid fa-list-ul"></i> Flat Collections Detailed breakdown:
            </h4>
            <table class="report-table" style="font-size: 0.8rem;">
                <thead>
                    <tr>
                        <th>Flat No</th>
                        <th>Owner / Tenant Name</th>
                        <th class="text-right">Total Maintenance Paid (Rs.)</th>
                    </tr>
                </thead>
                <tbody>
                    ${s}
                </tbody>
            </table>
        </div>
    `}function Ve(e){try{let t=function(i){const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],c=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];let d="";return i>=100&&(d+=a[Math.floor(i/100)]+" Hundred ",i%=100),i>=20&&(d+=c[Math.floor(i/10)]+" ",i%=10),i>0&&(d+=a[i]+" "),d.trim()},o=function(i){if(i===0)return"Zero";let a=Math.floor(i/1e7);i%=1e7;let c=Math.floor(i/1e5);i%=1e5;let d=Math.floor(i/1e3);i%=1e3;let m=[];return a>0&&m.push(t(a)+" Crore"),c>0&&m.push(t(c)+" Lakh"),d>0&&m.push(t(d)+" Thousand"),i>0&&m.push(t(i)),m.join(" ").trim()};const r=Math.round(parseFloat(e)*100)/100;if(isNaN(r))return"";const n=Math.floor(r),l=Math.round((r-n)*100);if(n===0&&l===0)return"Zero Rupees Only";let s="";return n>0&&(s+=o(n)+" Rupees"),l>0&&(n>0&&(s+=" and "),s+=t(l)+" Paise"),s.trim()+" Only"}catch(t){return console.error("Number to words conversion failed:",t),""}}function ce(e,t,o){const n={January:"01",February:"02",March:"03",April:"04",May:"05",June:"06",July:"07",August:"08",September:"09",October:"10",November:"11",December:"12"}[o]||"05",l=`${t}-${n}-01`;if(!e)return l;if(e instanceof Date){const c=new Date(e.getTime()+432e5),d=c.getFullYear(),m=String(c.getMonth()+1).padStart(2,"0"),h=String(c.getDate()).padStart(2,"0");return`${d}-${m}-${h}`}const s=String(e).trim();if(!s||s.toLowerCase()==="nan"||s.toLowerCase()==="null")return l;if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.split(" ")[0];const i=s.split(" ")[0],a=["/",".","-"];for(let c of a){const d=i.split(c);if(d.length===3){let m,h,f;if(d[0].length===4?(f=d[0],h=d[1],m=d[2]):(m=d[0],h=d[1],f=d[2]),m.length<2&&(m="0"+m),h.length<2&&(h="0"+h),f.length===2&&(f="20"+f),m.length===2&&h.length===2&&f.length===4){const b=parseInt(m,10),w=parseInt(h,10),g=parseInt(f,10);if(b>=1&&b<=31&&w>=1&&w<=12&&g>=1900&&g<=2100)return`${f}-${h}-${m}`}}}return l}function Xe(e){if(!e)return null;const o=String(e).trim().match(/([A-Za-z]+)['\-\s]*(\d+)/);if(o){let r=o[1].trim();r=r.charAt(0).toUpperCase()+r.slice(1).toLowerCase();let n=o[2].trim();return n.length===2&&(n="20"+n),{year:n,month:r}}return null}window.handleImportSubmit=async function(e){if(e.preventDefault(),!p){u("Database not connected.","error");return}if(!x("ledger:import")){u("Access Denied: You don't have permission to import ledgers.","error");return}const t=document.getElementById("import-file");if(!t.files||!t.files[0])return;const o=document.getElementById("btn-import-submit");o.disabled=!0,o.textContent="Uploading & Parsing...";const r=t.files[0],n=new FileReader;n.onload=async function(l){try{const s=new Uint8Array(l.target.result),i=XLSX.read(s,{type:"array",cellDates:!0}),a=i.SheetNames;let c=null,d=null;a.forEach(A=>{const S=A.trim().toUpperCase();(S.includes("DETAIL")||S.includes("MC")&&!S.includes("WISE")&&!c)&&(c=A),S.includes("EXPENSE")&&!S.includes("INCOME")&&(d=A)}),c||(c=a[0]);const{error:m}=await p.from("income").delete().gt("id",-1);if(m)throw m;const{error:h}=await p.from("expenses").delete().gt("id",-1);if(h)throw h;let f=0,b=0;const w=i.Sheets[c],g=XLSX.utils.sheet_to_json(w,{header:1});let v=-1,y=!1,I=-1,G=-1,Z=-1;for(let A=0;A<g.length;A++){const S=g[A].map(_=>String(_||"").toUpperCase().trim()),N=S.findIndex(_=>_==="FLAT NO"||_==="FLAT NO."),P=S.findIndex(_=>_==="DATE RECEIVED"||_==="DATE"),U=S.findIndex(_=>_==="AMOUNT");if(N!==-1&&P!==-1&&U!==-1){y=!0,I=N,G=P,Z=U,v=A;break}if(S.includes("FLAT NO.")||S.includes("FLAT NO")){v=A;break}}if(v!==-1){const A=g[v],S=g.slice(v+1),N=[];let P=-1;for(let _=0;_<A.length;_++)if(String(A[_]||"").toUpperCase().includes("FLAT")){P=_;break}let U=[];if(v>0){const _=g[v-1];for(let B=5;B<_.length;B++){const k=_[B];if(k){let M=null;if(k instanceof Date)M=k;else{const $=new Date(k);isNaN($.getTime())||(M=$)}if(M){const $=String(M.getFullYear()),T=M.toLocaleString("en-US",{month:"long"});U.push({year:$,month:T,amtIdx:B,dtIdx:B+1})}}}}if(U.length===0&&(U=[{year:"2025",month:"April",amtIdx:5,dtIdx:6},{year:"2025",month:"May",amtIdx:7,dtIdx:8},{year:"2025",month:"June",amtIdx:9,dtIdx:10},{year:"2025",month:"July",amtIdx:11,dtIdx:12},{year:"2025",month:"August",amtIdx:13,dtIdx:14},{year:"2025",month:"September",amtIdx:15,dtIdx:16},{year:"2025",month:"October",amtIdx:17,dtIdx:18},{year:"2025",month:"November",amtIdx:19,dtIdx:20},{year:"2025",month:"December",amtIdx:21,dtIdx:22},{year:"2026",month:"January",amtIdx:23,dtIdx:24},{year:"2026",month:"February",amtIdx:25,dtIdx:26},{year:"2026",month:"March",amtIdx:27,dtIdx:28},{year:"2026",month:"April",amtIdx:29,dtIdx:30},{year:"2026",month:"May",amtIdx:31,dtIdx:32}]),y?S.forEach(_=>{const B=String(_[I]||"").trim().toUpperCase().replace(/\s+/g,"");if(!B||B==="NAN"||B.includes("FLOOR")||B.length>8)return;const k=_[Z],M=_[G];let $=parseFloat(k);if(!isNaN($)&&$>0){const T=ce(M,"2026","May"),O=new Date(T),J=String(O.getFullYear()),F=["January","February","March","April","May","June","July","August","September","October","November","December"][O.getMonth()]||"May";N.push({flat_no:B,year:J,month:F,amount:$,date_received:T})}}):P!==-1&&S.forEach(_=>{const B=String(_[P]||"").trim().toUpperCase().replace(/\s+/g,"");!B||B==="NAN"||B.includes("FLOOR")||B.length>8||U.forEach(k=>{if(k.amtIdx<_.length){const M=_[k.amtIdx],$=k.dtIdx<_.length?_[k.dtIdx]:"";let T=parseFloat(M);if((isNaN(T)||String(M).toUpperCase().includes("ROOM")||String(M).toUpperCase().includes("TYPE"))&&(T=0),T>0){const O=ce($,k.year,k.month),J=new Date(O),E=String(J.getFullYear()),L=["January","February","March","April","May","June","July","August","September","October","November","December"][J.getMonth()]||k.month;N.push({flat_no:B,year:E,month:L,amount:T,date_received:O})}}})}),N.length>0){const B=[...new Set(N.map($=>$.flat_no))].map($=>({flat_no:$,owner_name:`Flat ${$}`})),{error:k}=await p.from("owners").upsert(B,{onConflict:"flat_no",ignoreDuplicates:!0});k&&console.warn("Owner upsert warning:",k);const M=200;for(let $=0;$<N.length;$+=M){const T=N.slice($,$+M),{error:O}=await p.from("income").insert(T);if(O)throw O}f=N.length}}if(d){const A=i.Sheets[d],S=XLSX.utils.sheet_to_json(A,{header:1});let N=-1,P=!1,U=-1,_=-1,B=-1;for(let k=0;k<S.length;k++){const M=S[k].map(E=>String(E||"").toUpperCase().trim()),$=M.findIndex(E=>E==="DESCRIPTION"),T=M.findIndex(E=>E==="DATE SPENT"||E==="DATE"),O=M.findIndex(E=>E==="AMOUNT");if($!==-1&&T!==-1&&O!==-1){P=!0,U=$,_=T,B=O,N=k;break}if(S[k].map(E=>String(E||"")).join("").toUpperCase().includes("DESCRIPTION")){N=k;break}}if(N!==-1&&(P||S.length>2)){const k=S.slice(N+1),M=[],$=S[1]||[],T=S[2]||[];let O=null;const J=[];for(let E=2;E<$.length;E++){const F=$[E],L=T[E];if(F&&String(F).trim()!==""&&(O=String(F).trim()),O&&L&&String(L).trim().toUpperCase().includes("AMOUNT")){let V=null;if(E+1<T.length){const X=T[E+1];if(X){const j=String(X).trim().toUpperCase();(j.includes("DATE")||j.includes("DT OF")||j.includes("PAYMENT"))&&(V=E+1)}}const H=Xe(O);H&&J.push({year:H.year,month:H.month,amtCol:E,dtCol:V})}}if(P?k.forEach(E=>{const F=String(E[U]||"").trim();if(!F||F.toUpperCase().includes("SR.")||F.toUpperCase().includes("TOTAL")||F.length<3)return;const L=E[B],Q=E[_];let V=parseFloat(L);if(!isNaN(V)&&V>0){const H=ce(Q,"2026","May"),X=new Date(H),j=String(X.getFullYear()),ye=["January","February","March","April","May","June","July","August","September","October","November","December"][X.getMonth()]||"May";M.push({year:j,month:ye,expense_head:"Uncategorized",description:F,amount:V,date_spent:H})}}):k.forEach(E=>{if(E.length<3)return;const F=String(E[1]||"").trim();!F||F.toUpperCase().includes("SR.")||F.toUpperCase().includes("TOTAL")||F.length<3||J.forEach(L=>{if(L.amtCol<E.length){const Q=E[L.amtCol],V=L.dtCol!==null&&L.dtCol<E.length?E[L.dtCol]:"";let H=parseFloat(Q);if(isNaN(H)&&(H=0),H>0){const X=ce(V,L.year,L.month),j=new Date(X),ge=String(j.getFullYear()),Te=["January","February","March","April","May","June","July","August","September","October","November","December"][j.getMonth()]||L.month;M.push({year:ge,month:Te,expense_head:"Uncategorized",description:F,amount:H,date_spent:X})}}})}),M.length>0){for(let F=0;F<M.length;F+=200){const L=M.slice(F,F+200),{error:Q}=await p.from("expenses").insert(L);if(Q)throw Q}b=M.length}}}u(`Excel imports finished successfully!
Parsed ${f} income collections and ${b} expense vouchers.`,"success"),closeModal("importModal"),Y()}catch(s){console.error("Ledger import error:",s),u(s.message||"Failed parsing document structure.","error")}finally{o.disabled=!1,o.textContent="Upload & Parse"}},n.readAsArrayBuffer(r)};window.handleOwnersSubmit=async function(e){if(e.preventDefault(),!p){u("Database not connected.","error");return}if(!x("owners:upload")){u("Access Denied: You don't have permission to upload owner mappings.","error");return}const t=document.getElementById("owners-file");if(!t.files||!t.files[0])return;const o=document.getElementById("btn-owners-submit");o.disabled=!0,o.textContent="Uploading...";const r=t.files[0],n=new FileReader;n.onload=async function(l){try{const s=new Uint8Array(l.target.result),i=XLSX.read(s,{type:"array"}),a=i.SheetNames[0],c=i.Sheets[a],d=XLSX.utils.sheet_to_json(c,{header:1});let m=-1;for(let w=0;w<d.length;w++){const g=d[w].map(v=>String(v||"").toUpperCase()).join(" ");if(g.includes("FLAT NO")||g.includes("FLAT")){m=w;break}}let h=m!==-1?m+1:0;const f=[];for(let w=h;w<d.length;w++){const g=d[w];if(!g||g.length<3)continue;const v=String(g[1]||"").trim(),y=String(g[2]||"").trim().toUpperCase().replace(/\s+/g,"");if(y&&y!=="NAN"&&y!=="UNDEFINED"){const I=v&&v!=="nan"&&v!=="undefined"?v:`Flat ${y}`;f.push({flat_no:y,owner_name:I})}}if(f.length===0)throw new Error("No valid owner mappings found in the spreadsheet.");const{error:b}=await p.from("owners").upsert(f,{onConflict:"flat_no"});if(b)throw b;u(`Successfully loaded ${f.length} owner mappings!`),closeModal("ownersModal"),ie()}catch(s){console.error("Owners import error:",s),u(s.message||"Failed parsing owners spreadsheet.","error")}finally{o.disabled=!1,o.textContent="Upload Mapping"}},n.readAsArrayBuffer(r)};window.exportLedgerToExcel=async function(){if(!p){u("Database not connected.","error");return}try{u("Generating spreadsheet...","success");const{data:e,error:t}=await p.from("income").select("id, flat_no, year, month, amount, date_received").order("id");if(t)throw t;const{data:o,error:r}=await p.from("expenses").select("id, year, month, description, amount, date_spent").order("id");if(r)throw r;const n=e.map(m=>({ID:m.id,"Flat Details":m.flat_no,Year:m.year,Month:m.month,"Amount Paid (Rs.)":m.amount,"Date Received":m.date_received})),l=o.map(m=>({ID:m.id,Year:m.year,Month:m.month,Description:m.description,"Amount Spent (Rs.)":m.amount,"Date Spent":m.date_spent})),s=XLSX.utils.book_new(),i=XLSX.utils.json_to_sheet(n),a=XLSX.utils.json_to_sheet(l);XLSX.utils.book_append_sheet(s,i,"Income Summary"),XLSX.utils.book_append_sheet(s,a,"Expense Summary");const d=`Deepsikha_Ledger_${new Date().toISOString().replace(/T/,"_").replace(/\..+/,"").replace(/:/g,"")}.xlsx`;XLSX.writeFile(s,d),u("Spreadsheet downloaded successfully!")}catch(e){console.error("Export ledger error:",e),u("Could not export ledger.","error")}};window.openTicketsModal=async function(){openModal("ticketsModal"),await loadTickets()};window.openNewTicketModal=function(){openModal("newTicketModal"),document.getElementById("new-ticket-form").reset()};window.setTicketScope=function(e){be=e;const t=document.getElementById("scope-btn-all"),o=document.getElementById("scope-btn-my");t&&t.classList.toggle("active",e==="ALL"),o&&o.classList.toggle("active",e==="MY"),filterTickets()};window.loadTickets=async function(){if(!p)return;const e=document.getElementById("tickets-list");e&&(e.innerHTML='<div style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--color-yellow);"></i><p style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">Loading tickets...</p></div>');try{const{data:t,error:o}=await p.from("tickets").select("*").order("created_at",{ascending:!1});if(o)throw o;const{data:r,error:n}=await p.from("profiles").select("id, email, role");if(n)throw n;const l={};r&&r.forEach(s=>{l[s.id]=s}),te=(t||[]).map(s=>{const i=l[s.created_by],a=l[s.floor_manager_id],c=l[s.resolved_by],d=l[s.assigned_to],h=(Array.isArray(s.committee_approvals)?s.committee_approvals:[]).map(f=>{var b;return((b=l[f])==null?void 0:b.email)||"Unknown Member"});return{...s,creator_email:i?i.email:"Unknown",floor_manager_email:a?a.email:"Unknown",resolver_email:c?c.email:"Unknown",assigned_email:d?d.email:"Unassigned",approver_emails:h}}),je(),filterTickets(),K?te.some(i=>i.id===K)?selectTicket(K):(K=null,ve()):ve()}catch(t){console.error("loadTickets error:",t),u("Failed to load helpdesk tickets.","error"),e&&(e.innerHTML='<div style="text-align: center; padding: 20px; color: var(--color-rose);"><i class="fa-solid fa-triangle-exclamation"></i><p style="margin-top: 8px; font-size: 0.85rem;">Error loading tickets.</p></div>')}};function je(){const e=["Pending","Recommended","Approved","Reopened"],t=["Resolved","Closed"];let o=0,r=0,n=0,l=0;te.forEach(c=>{if(e.includes(c.status)?o++:t.includes(c.status)&&r++,c.resolved_at&&c.created_at){const d=new Date(c.resolved_at)-new Date(c.created_at);d>0&&(n+=d,l++)}});const s=document.getElementById("kpi-open-count"),i=document.getElementById("kpi-resolved-count"),a=document.getElementById("kpi-avg-time");if(s&&(s.textContent=o),i&&(i.textContent=r),a)if(l>0){const d=n/l/(1e3*60*60);d<24?a.textContent=`${d.toFixed(1)}h`:a.textContent=`${(d/24).toFixed(1)}d`}else a.textContent="N/A"}function ve(){const e=document.getElementById("tickets-detail-side");e&&(e.innerHTML=`
            <div class="detail-placeholder">
                <i class="fa-solid fa-clipboard-list" style="font-size: 3.5rem; color: var(--text-muted);"></i>
                <p style="margin-top: 10px;">Select a complaint ticket from the list to view its details and workflow tracking.</p>
            </div>
        `)}window.filterTickets=function(){const e=document.getElementById("ticket-filter-status").value,t=document.getElementById("ticket-filter-category").value,o=document.getElementById("ticket-search").value.toLowerCase().trim(),r=te.filter(n=>{if(be==="MY"&&n.created_by!==R||n.archived&&!x("tickets:archive"))return!1;const l=e==="ALL"||n.status===e,s=t==="ALL"||n.category===t,i=`${n.ticket_number||""} ${n.title} ${n.flat_no||""} ${n.creator_email} ${n.description}`.toLowerCase(),a=!o||i.includes(o);return l&&s&&a});We(r)};function We(e){const t=document.getElementById("tickets-list");if(t){if(e.length===0){t.innerHTML='<div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.9rem;"><i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 8px;"></i><p>No complaints found</p></div>';return}t.innerHTML="",e.forEach(o=>{const r=document.createElement("div");r.className=`ticket-card ${o.id===K?"active":""}`,r.onclick=()=>selectTicket(o.id);const n=new Date(o.created_at),l=new Date-n,s=Math.floor(l/(1e3*60*60*24));let i=`${s} days open`;s===0&&(i="Filed today");const c=s>=3&&!["Closed","Resolved"].includes(o.status)?'<span class="sla-overdue-tag"><i class="fa-solid fa-clock"></i> SLA Overdue</span>':"",d=Me(o.priority);r.innerHTML=`
            <div class="ticket-card-header">
                <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">${C(o.ticket_number||"#"+o.id)}</span>
                <span class="badge ${Ce(o.status)}">${o.status}</span>
            </div>
            <h4 style="margin: 4px 0;">${C(o.title)}</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0;">
                <span class="badge ${d}" style="font-size:0.7rem; padding: 2px 6px;">${o.priority||"Medium"}</span>
                ${c}
            </div>
            <div class="ticket-card-meta">
                <span><i class="fa-solid fa-door-open"></i> Flat ${C(o.flat_no||"N/A")}</span>
                <span><i class="fa-solid fa-calendar-day"></i> ${i}</span>
            </div>
        `,t.appendChild(r)})}}function Ce(e){switch(e){case"Pending":return"badge-pending";case"Recommended":return"badge-recommended";case"Approved":return"badge-approved";case"Resolved":return"badge-resolved";case"Closed":return"badge-closed";case"Reopened":return"badge-reopened";default:return"badge-pending"}}function Me(e){switch(e){case"Low":return"badge-low";case"Medium":return"badge-medium";case"High":return"badge-high";case"Urgent":return"badge-urgent";default:return"badge-medium"}}window.selectTicket=function(e){const t=K!==e;K=e,filterTickets();const o=te.find(y=>y.id===e);if(!o)return;const r=document.getElementById("tickets-detail-side");if(!r)return;const n=Ge(o),l=Ze(o),s=new Date(o.created_at),i=new Date-s,a=Math.floor(i/(1e3*60*60*24)),d=a>=3&&!["Closed","Resolved"].includes(o.status)?`<div style="background: rgba(244,63,94,0.08); border: 1px solid var(--color-rose); color: var(--color-rose); padding: 10px 14px; border-radius: var(--border-radius-sm); font-size: 0.85rem; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-circle-exclamation" style="font-size: 1.1rem;"></i>
            <strong>SLA Warning:</strong> This complaint has been open for ${a} days without resolution (exceeds 3-day SLA limit).
         </div>`:"";let m="";const h=Array.isArray(o.attachments)?o.attachments:[];h.length>0&&(m+=`<div style="margin-top: 14px;">
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Complaint Attachments</h4>
            <div class="comment-attachments">`,h.forEach(y=>{y.type.startsWith("image/")?m+=`
                    <div class="attachment-thumb" onclick="window.open('${y.data}', '_blank')">
                        <img src="${y.data}" alt="${C(y.name)}">
                    </div>`:m+=`
                    <a href="${y.data}" target="_blank" class="btn btn-slate" style="font-size:0.75rem; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-file-pdf"></i> ${C(y.name)}
                    </a>`}),m+="</div></div>");let f="";x("tickets:assign")&&(f=`
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 12px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <span style="font-size: 0.85rem; font-weight:600;"><i class="fa-solid fa-user-tag"></i> Assign Complaint:</span>
                <select id="assign-ticket-select" onchange="assignTicket(${o.id}, this.value)" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-primary); padding: 4px 8px; font-size: 0.85rem;">
                    <option value="">-- Select Assignee --</option>
                </select>
            </div>
        `,Ke(o.assigned_to));let b="";const w=x("tickets:archive"),g=x("tickets:delete");if(w||g){let y="";w&&(y=`<button class="btn btn-slate" onclick="archiveTicket(${o.id})" style="flex: 1; font-size: 0.8rem; padding: 8px;">
                <i class="fa-solid fa-box-archive"></i> ${o.archived?"Unarchive":"Archive"} Ticket
            </button>`);let I="";g&&(I=`<button class="btn btn-rose" onclick="deleteTicket(${o.id})" style="flex: 1; font-size: 0.8rem; padding: 8px;">
                <i class="fa-solid fa-trash-can"></i> Delete Permanently
            </button>`),b=`
            <div style="display: flex; gap: 12px; margin-top: 16px;">
                ${y}
                ${I}
            </div>
        `}const v=t?"animate-status-change":"";r.innerHTML=`
        <div class="ticket-detail-view ${v}" style="animation: fadeIn 0.3s ease;">
            ${d}
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; gap: 10px;">
                <div>
                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 2px;">
                        ${C(o.ticket_number||"#"+o.id)}
                    </span>
                    <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin: 0;">${C(o.title)}</h3>
                    <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 0.8rem; color: var(--text-secondary); flex-wrap: wrap;">
                        <span><i class="fa-solid fa-tag"></i> ${o.category.toUpperCase()}</span>
                        <span><i class="fa-solid fa-door-open"></i> Flat ${C(o.flat_no||"N/A")}</span>
                        <span><i class="fa-solid fa-user"></i> By: ${C(o.creator_email)}</span>
                        <span><i class="fa-solid fa-user-shield"></i> Assigned: <strong>${C(o.assigned_email)}</strong></span>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                    <span class="badge ${Ce(o.status)}" style="padding: 4px 10px; font-size: 0.8rem;">${o.status}</span>
                    <span class="badge ${Me(o.priority)}" style="font-size: 0.75rem; padding: 2px 8px;">${o.priority||"Medium"}</span>
                </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 14px; margin-bottom: 14px;">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Complaint Description</h4>
                <p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-primary); white-space: pre-wrap; margin: 0;">${C(o.description)}</p>
                ${m}
            </div>
            
            ${f}
            
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 12px;">Workflow Tracking</h4>
            <div class="workflow-timeline">
                ${n}
            </div>
            
            ${l}
            
            <!-- Threaded Comments Section -->
            <div class="comments-section">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 12px;">Comments & Resolution History</h4>
                <div class="comments-container" id="comments-container">
                    <div style="text-align: center; padding: 10px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading comments...</div>
                </div>
                
                <form id="comment-submit-form" onsubmit="submitComment(event, ${o.id})" class="comment-form">
                    <div class="input-field" style="margin: 0;">
                        <textarea id="comment-new-text" placeholder="Add a comment or update note here..." rows="2" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;" required></textarea>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <input type="file" id="comment-attachment" accept="image/*,application/pdf" style="font-size:0.75rem; color:var(--text-secondary); max-width: 200px;">
                        <button type="submit" class="btn btn-yellow" style="font-size: 0.8rem; padding: 6px 12px;">
                            <i class="fa-solid fa-paper-plane"></i> Send
                        </button>
                    </div>
                </form>
            </div>
            
            ${b}
        </div>
    `,loadComments(o.id)};async function Ke(e){if(p)try{const{data:t,error:o}=await p.from("profiles").select("id, email, role").order("email");if(o)throw o;const r=document.getElementById("assign-ticket-select");if(!r)return;r.innerHTML='<option value="">-- Unassigned --</option>',t.forEach(n=>{const l=n.role.replace("_"," ").toUpperCase();r.innerHTML+=`<option value="${n.id}" ${n.id===e?"selected":""}>
                ${C(n.email)} (${l})
            </option>`})}catch(t){console.error("fetchAssigneesForDropdown error:",t)}}window.assignTicket=async function(e,t){if(p)try{const o=t===""?null:t,{error:r}=await p.from("tickets").update({assigned_to:o}).eq("id",e);if(r)throw r;u("Ticket assignee updated successfully!","success"),await loadTickets()}catch(o){console.error("assignTicket error:",o),u("Failed to assign ticket.","error")}};window.archiveTicket=async function(e){if(!p)return;const t=te.find(o=>o.id===e);if(t)try{const{error:o}=await p.from("tickets").update({archived:!t.archived}).eq("id",e);if(o)throw o;u(t.archived?"Ticket unarchived successfully!":"Ticket archived successfully!","success"),await loadTickets()}catch(o){console.error("archiveTicket error:",o),u("Failed to change ticket archive state.","error")}};window.deleteTicket=async function(e){if(p&&confirm("Are you sure you want to permanently delete this complaint ticket? This cannot be undone."))try{const{error:t}=await p.from("tickets").delete().eq("id",e);if(t)throw t;u("Ticket deleted permanently.","success"),K=null,await loadTickets()}catch(t){console.error("deleteTicket error:",t),u("Failed to delete ticket.","error")}};window.loadComments=async function(e){const t=document.getElementById("comments-container");if(t)try{const{data:o,error:r}=await p.from("ticket_comments").select("*").eq("ticket_id",e).order("created_at",{ascending:!0});if(r)throw r;const{data:n}=await p.from("profiles").select("id, email"),l={};if(n&&n.forEach(s=>{l[s.id]=s.email}),!o||o.length===0){t.innerHTML='<div style="text-align: center; padding: 14px; color: var(--text-muted); font-size: 0.8rem;">No comments yet. Add the first comment below!</div>';return}t.innerHTML="",o.forEach(s=>{const i=l[s.user_id]||"Unknown User",a=s.user_id===R;let c="";const d=Array.isArray(s.attachments)?s.attachments:[];d.length>0&&(c+='<div class="comment-attachments">',d.forEach(m=>{m.type.startsWith("image/")?c+=`
                            <div class="attachment-thumb" onclick="window.open('${m.data}', '_blank')">
                                <img src="${m.data}" alt="${C(m.name)}">
                            </div>`:c+=`
                            <a href="${m.data}" target="_blank" class="btn btn-slate" style="font-size:0.7rem; padding: 4px 8px; display:inline-flex; align-items:center; gap: 4px;">
                                <i class="fa-solid fa-file-pdf"></i> ${C(m.name)}
                            </a>`}),c+="</div>"),t.innerHTML+=`
                <div class="comment-bubble ${a?"own-comment":""}">
                    <div class="comment-meta">
                        <span class="comment-author">${C(i)}</span>
                        <span>${ee(s.created_at)}</span>
                    </div>
                    <div class="comment-text">${C(s.comment)}</div>
                    ${c}
                </div>
            `}),t.scrollTop=t.scrollHeight}catch(o){console.error("loadComments error:",o),t.innerHTML='<div style="text-align: center; padding: 10px; color: var(--color-rose);">Failed to load comments history.</div>'}};window.submitComment=async function(e,t){if(e.preventDefault(),!p||!R)return;if(!x("tickets:comment")){u("You don't have permission to comment on tickets.","error");return}const o=document.getElementById("comment-new-text"),r=o.value.trim(),n=document.getElementById("comment-attachment"),l=document.querySelector("#comment-submit-form button[type='submit']");l.disabled=!0;try{let s=[];if(n&&n.files&&n.files[0]){const a=n.files[0],c=await De(a);s.push({name:a.name,type:a.type,data:c})}const{error:i}=await p.from("ticket_comments").insert({ticket_id:t,user_id:R,comment:r,attachments:s});if(i)throw i;o.value="",n&&(n.value=""),u("Comment added!","success"),await loadComments(t)}catch(s){console.error("submitComment error:",s),u("Failed to post comment.","error")}finally{l.disabled=!1}};function De(e){return new Promise((t,o)=>{const r=new FileReader;r.readAsDataURL(e),r.onload=()=>t(r.result),r.onerror=n=>o(n)})}function Ge(e){const t=e.status,o=t==="Pending",r=t==="Recommended",n=t==="Approved",l=t==="Resolved",s=t==="Reopened";let i="completed",a=`Filed by ${C(e.creator_email)} on ${ee(e.created_at)}`;s?(i="active pulse-status",a=`Complaint reopened by complainer on ${ee(e.created_at)}.<br><strong>Reason:</strong> ${C(e.complainer_feedback||"")}`):o&&(i="active pulse-status");let c="",d="Awaiting Floor Manager review & recommendation.";e.recommended_at?(c="completed",d=`Recommended by Floor Manager (${C(e.floor_manager_email)}) on ${ee(e.recommended_at)}.<br><strong>Note:</strong> ${C(e.floor_manager_recommendation)}`):(o||s)&&(c="active pulse-status");let m="";const h=Array.isArray(e.committee_approvals)?e.committee_approvals.length:0;let f=`Awaiting Committee approvals (${h} of 3 approved).`;e.approved_at?(m="completed",f=`Approved by 3 Committee Members on ${ee(e.approved_at)}.<br><strong>Approvers:</strong> ${C(e.approver_emails.join(", "))}`):r&&(m="active pulse-status",h>0&&(f+=`<br><strong>Approved so far:</strong> ${C(e.approver_emails.join(", "))}`));let b="",w="Awaiting resolution actions by maintenance team/editor.";e.resolved_at?(b="completed",w=`Resolved by ${C(e.resolver_email)} on ${ee(e.resolved_at)}.<br><strong>Action Details:</strong> ${C(e.resolution_details)}`):n&&(b="active pulse-status");let g="",v="Awaiting resident closure acknowledgement.";return e.closed_at?(g="completed",v=`Closed on ${ee(e.closed_at)}.<br><strong>Resident Feedback:</strong> ${C(e.complainer_feedback||"No feedback provided.")}`):l&&(g="active pulse-status"),`
        <div class="workflow-step ${i}">
            <div class="workflow-step-title"><i class="fa-solid fa-file-invoice"></i> Step 1: Filed</div>
            <div class="workflow-step-desc">${a}</div>
        </div>
        <div class="workflow-step ${c}">
            <div class="workflow-step-title"><i class="fa-solid fa-user-tie"></i> Step 2: Manager Recommendation</div>
            <div class="workflow-step-desc">${d}</div>
        </div>
        <div class="workflow-step ${m}">
            <div class="workflow-step-title"><i class="fa-solid fa-users"></i> Step 3: Committee Approvals</div>
            <div class="workflow-step-desc">${f}</div>
        </div>
        <div class="workflow-step ${b}">
            <div class="workflow-step-title"><i class="fa-solid fa-wrench"></i> Step 4: Resolution Action</div>
            <div class="workflow-step-desc">${w}</div>
        </div>
        <div class="workflow-step ${g}">
            <div class="workflow-step-title"><i class="fa-solid fa-circle-check"></i> Step 5: Closure & Feedback</div>
            <div class="workflow-step-desc">${v}</div>
        </div>
    `}function Ze(e){const t=e.status,o=t==="Pending",r=t==="Recommended",n=t==="Approved",l=t==="Resolved",s=t==="Reopened",i=e.created_by===R,a=x("tickets:recommend"),c=x("tickets:approve"),d=x("tickets:resolve"),m=x("tickets:close"),h=x("tickets:reopen");let f="";if(a&&(o||s)&&(f+=`
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-yellow); margin-bottom: 10px;"><i class="fa-solid fa-user-edit"></i> Floor Manager Action</h4>
                <form id="fm-recommend-form" onsubmit="submitRecommendation(event, ${e.id})">
                    <div class="input-field" style="margin-bottom: 10px;">
                        <label for="fm-recommend-text">Recommendation Notes</label>
                        <textarea id="fm-recommend-text" placeholder="Explain your assessment and recommend specific actions..." rows="3" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-yellow btn-full">
                        <i class="fa-solid fa-check"></i> Submit Recommendation
                    </button>
                </form>
            </div>
        `),c&&r){const b=Array.isArray(e.committee_approvals)?e.committee_approvals:[],w=b.includes(R);f+=`
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-violet); margin-bottom: 10px;"><i class="fa-solid fa-signature"></i> Committee Approval Action</h4>
        `,w?f+=`
                <div style="padding: 10px; background: rgba(139,92,246,0.05); border: 1px solid rgba(139,92,246,0.2); border-radius: var(--border-radius-sm); color: var(--color-violet); font-size: 0.85rem; text-align: center;">
                    <i class="fa-solid fa-circle-check"></i> You have already approved this complaint. Awaiting other members (${b.length} of 3 approved).
                </div>
            `:f+=`
                <button type="button" class="btn btn-violet btn-full" onclick="approveComplaint(${e.id})">
                    <i class="fa-solid fa-thumbs-up"></i> Approve Complaint (${b.length} of 3 approvals)
                </button>
            `,f+="</div>"}return d&&n&&(f+=`
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-teal); margin-bottom: 10px;"><i class="fa-solid fa-wrench"></i> Record Action & Resolution</h4>
                <form id="editor-resolve-form" onsubmit="submitResolution(event, ${e.id})">
                    <div class="input-field" style="margin-bottom: 10px;">
                        <label for="editor-resolve-text">Resolution Details</label>
                        <textarea id="editor-resolve-text" placeholder="Detail the resolution actions taken (e.g. replaced parts, repaired leakage)..." rows="3" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-teal btn-full">
                        <i class="fa-solid fa-check-double"></i> Mark Resolved
                    </button>
                </form>
            </div>
        `),(i||m||h)&&l&&(f+=`
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-emerald); margin-bottom: 10px;"><i class="fa-solid fa-comment-dots"></i> Resident Acknowledgement</h4>
                <div class="input-field" style="margin-bottom: 10px;">
                    <label for="complainer-feedback-text">Feedback / Comments (Required for Reopening)</label>
                    <textarea id="complainer-feedback-text" placeholder="Optional comments on resolution. REQUIRED if reopening the ticket for further review..." rows="3" style="width: 100%; padding: 8px; background-color: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); outline: none; font-family: inherit; font-size: 0.85rem;"></textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <button type="button" class="btn btn-rose btn-full" onclick="reopenTicket(${e.id})">
                        <i class="fa-solid fa-redo"></i> Reopen / Request Review
                    </button>
                    <button type="button" class="btn btn-emerald btn-full" onclick="closeTicket(${e.id})">
                        <i class="fa-solid fa-lock"></i> Accept & Close
                    </button>
                </div>
            </div>
        `),f}window.handleCreateTicket=async function(e){if(e.preventDefault(),!p||!R){u("You must be logged in to file a complaint.","error");return}const t=document.getElementById("ticket-title").value.trim(),o=document.getElementById("ticket-category").value,r=document.getElementById("ticket-flat").value,n=document.getElementById("ticket-priority").value,l=document.getElementById("ticket-desc").value.trim(),s=document.getElementById("ticket-attachments"),i=document.querySelector("#new-ticket-form button[type='submit']");i.disabled=!0,i.textContent="Submitting...";try{let a=[];if(s&&s.files&&s.files[0]){const w=s.files[0],g=await De(w);a.push({name:w.name,type:w.type,data:g})}const{count:c,error:d}=await p.from("tickets").select("*",{count:"exact",head:!0});if(d)throw d;const m=c||0,f=`TKT-${new Date().getFullYear()}-${String(m+1).padStart(3,"0")}`,{error:b}=await p.from("tickets").insert({title:t,category:o,flat_no:r,priority:n,description:l,created_by:R,attachments:a,ticket_number:f,status:"Pending"});if(b)throw b;u(`Complaint filed! Assigned Ticket Number: ${f}`,"success"),closeModal("newTicketModal"),await loadTickets()}catch(a){console.error("handleCreateTicket error:",a),u(a.message||"Failed to submit complaint.","error")}finally{i.disabled=!1,i.textContent="Submit Ticket"}};window.submitRecommendation=async function(e,t){if(e.preventDefault(),!p)return;const o=document.getElementById("fm-recommend-text").value.trim(),r=document.querySelector("#fm-recommend-form button[type='submit']");r.disabled=!0,r.textContent="Submitting...";try{const{error:n}=await p.from("tickets").update({floor_manager_id:R,floor_manager_recommendation:o,recommended_at:new Date().toISOString(),status:"Recommended"}).eq("id",t);if(n)throw n;u("Recommendation submitted successfully!","success"),await loadTickets()}catch(n){console.error("submitRecommendation error:",n),u("Failed to submit recommendation.","error")}};window.approveComplaint=async function(e){if(!p||!R)return;const t=te.find(l=>l.id===e);if(!t)return;const o=Array.isArray(t.committee_approvals)?[...t.committee_approvals]:[];if(o.includes(R)){u("You have already approved this ticket.","warning");return}o.push(R);const r=o.length>=3,n={committee_approvals:o};r&&(n.status="Approved",n.approved_at=new Date().toISOString());try{const{error:l}=await p.from("tickets").update(n).eq("id",e);if(l)throw l;u(r?"Approved! Ticket transitioned to Approved status.":`Approval recorded (${o.length}/3 approvals).`,"success"),await loadTickets()}catch(l){console.error("approveComplaint error:",l),u("Failed to record approval.","error")}};window.submitResolution=async function(e,t){if(e.preventDefault(),!p)return;const o=document.getElementById("editor-resolve-text").value.trim(),r=document.querySelector("#editor-resolve-form button[type='submit']");r.disabled=!0,r.textContent="Saving...";try{const{error:n}=await p.from("tickets").update({resolved_by:R,resolution_details:o,resolved_at:new Date().toISOString(),status:"Resolved"}).eq("id",t);if(n)throw n;u("Resolution details logged successfully!","success"),await loadTickets()}catch(n){console.error("submitResolution error:",n),u("Failed to save resolution details.","error")}};window.reopenTicket=async function(e){if(!p)return;const t=document.getElementById("complainer-feedback-text").value.trim();if(!t){u("Please provide comments explaining why you are reopening this complaint.","warning");return}try{const{error:o}=await p.from("tickets").update({status:"Reopened",complainer_feedback:t,floor_manager_id:null,floor_manager_recommendation:null,recommended_at:null,committee_approvals:[],approved_at:null,resolved_by:null,resolution_details:null,resolved_at:null,closed_at:null}).eq("id",e);if(o)throw o;u("Complaint reopened for further review.","info"),await loadTickets()}catch(o){console.error("reopenTicket error:",o),u("Failed to reopen ticket.","error")}};window.closeTicket=async function(e){if(!p)return;const t=document.getElementById("complainer-feedback-text").value.trim();try{const{error:o}=await p.from("tickets").update({status:"Closed",complainer_feedback:t||"Closed by resident.",closed_at:new Date().toISOString()}).eq("id",e);if(o)throw o;u("Complaint successfully acknowledged and closed.","success"),await loadTickets()}catch(o){console.error("closeTicket error:",o),u("Failed to close ticket.","error")}};async function Qe(){const e=document.getElementById("report-sheet");if(!(!e||!p))try{const{data:t,error:o}=await p.from("tickets").select("*");if(o)throw o;const r=t||[],n=r.length,l={},s={},i={};let a=0,c=0;r.forEach(g=>{if(l[g.category]=(l[g.category]||0)+1,s[g.status]=(s[g.status]||0)+1,i[g.priority||"Medium"]=(i[g.priority||"Medium"]||0)+1,g.resolved_at&&g.created_at){const v=new Date(g.resolved_at)-new Date(g.created_at);v>0&&(a++,c+=v)}});const d=a>0?c/a/(1e3*60*60):0,m=d>0?d<24?`${d.toFixed(1)} hrs`:`${(d/24).toFixed(1)} days`:"N/A";let h=`
            <div style="font-family: inherit; color: var(--text-primary);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 12px; margin-bottom: 24px;">
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--color-yellow);"><i class="fa-solid fa-chart-line"></i> Support Helpdesk & Complaints Analytics</h2>
                        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">Summary of resident complaints, workflow execution, and performance metrics.</p>
                    </div>
                    <button class="btn btn-slate" onclick="printActiveReport()"><i class="fa-solid fa-print"></i> Print Summary</button>
                </div>
                
                <!-- Summary Metrics cards -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px;">
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 16px; text-align: center;">
                        <span style="font-size: 2rem; font-weight: 800; color: var(--text-primary);">${n}</span>
                        <span style="display: block; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px;">Total Filed</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 16px; text-align: center;">
                        <span style="font-size: 2rem; font-weight: 800; color: var(--color-yellow);">${s.Pending||0}</span>
                        <span style="display: block; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px;">Pending Review</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 16px; text-align: center;">
                        <span style="font-size: 2rem; font-weight: 800; color: var(--color-emerald);">${(s.Closed||0)+(s.Resolved||0)}</span>
                        <span style="display: block; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px;">Resolved/Closed</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 16px; text-align: center;">
                        <span style="font-size: 1.8rem; font-weight: 800; color: var(--color-indigo);">${m}</span>
                        <span style="display: block; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px;">Avg Resolution Speed</span>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                    <!-- Category Chart -->
                    <div>
                        <h3 style="font-size: 1.05rem; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">Complaints by Category</h3>
                        <div style="display: flex; flex-direction: column; gap: 12px;">`;["plumbing","electrical","lift","security","cleanliness","billing","other"].forEach(g=>{const v=l[g]||0,y=n>0?v/n*100:0;h+=`
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                        <span style="text-transform: capitalize;">${g}</span>
                        <span style="font-weight: 600;">${v} (${y.toFixed(0)}%)</span>
                    </div>
                    <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${y}%; height: 100%; background: var(--color-yellow); border-radius: 4px;"></div>
                    </div>
                </div>`}),h+=`       </div>
                    </div>
                    
                    <!-- Priority Breakdown -->
                    <div>
                        <h3 style="font-size: 1.05rem; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">Complaints by Priority</h3>
                        <div style="display: flex; flex-direction: column; gap: 12px;">`;const b=["Low","Medium","High","Urgent"],w={Low:"#9ca3af",Medium:"var(--color-yellow)",High:"#f97316",Urgent:"var(--color-rose)"};b.forEach(g=>{const v=i[g]||0,y=n>0?v/n*100:0;h+=`
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                        <span>${g} Priority</span>
                        <span style="font-weight: 600;">${v}</span>
                    </div>
                    <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${y}%; height: 100%; background: ${w[g]||"var(--color-yellow)"}; border-radius: 4px;"></div>
                    </div>
                </div>`}),h+=`       </div>
                    </div>
                </div>
            </div>
        `,e.innerHTML=h}catch(t){console.error("renderHelpdeskReport error:",t),e.innerHTML='<div style="color:var(--color-rose); padding:20px; text-align:center;">Failed to generate helpdesk report summary.</div>'}}function C(e){return e?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}function ee(e){return e?new Date(e).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):""}window.switchAuthMode=function(e){const t=document.getElementById("btn-mode-soft"),o=document.getElementById("btn-mode-hard");t&&t.classList.toggle("active",e==="soft"),o&&o.classList.toggle("active",e==="hard");const r=document.getElementById("soft-login-form-wrapper"),n=document.getElementById("login-form-wrapper"),l=document.getElementById("register-form-wrapper");r&&(r.style.display=e==="soft"?"block":"none"),n&&(n.style.display=e==="hard"?"block":"none"),l&&(l.style.display="none")};window.handleSoftLoginSubmit=async function(e){if(e.preventDefault(),!p){u("Database not connected.","error");return}const t=document.getElementById("soft-flat-no").value.trim().toUpperCase(),o=document.getElementById("soft-verify-code").value.trim().toLowerCase(),r=document.getElementById("btn-soft-login-submit");r.disabled=!0,r.textContent="Verifying...",console.log("Starting verification for flat:",t,"with code:",o);try{console.log("Querying Supabase owners table via raw fetch...");const n=localStorage.getItem("supabaseUrl")||"https://xkpqkbberckxblkhseim.supabase.co",l=localStorage.getItem("supabaseKey")||"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE",s=`${n}/rest/v1/owners?flat_no=eq.${encodeURIComponent(t)}&select=*`,i=fetch(s,{method:"GET",headers:{apikey:l,Authorization:`Bearer ${l}`,"Content-Type":"application/json"}}),a=new Promise((g,v)=>setTimeout(()=>v(new Error("Raw fetch query timed out after 6 seconds.")),6e3));console.log("Waiting for raw fetch response...");const c=await Promise.race([i,a]);if(console.log("Raw fetch response received. Status:",c.status),!c.ok){const g=await c.text();throw new Error(`Database error (${c.status}): ${g}`)}const d=await c.json(),m=d&&d.length>0?d[0]:null;if(console.log("Owner details loaded via raw fetch:",m),!m)throw new Error("Flat details not found in registry.");const h=String(m.contact_no||"").trim().replace(/\D/g,""),f=o.replace(/\D/g,""),b=m.passcode?String(m.passcode).trim():"";if(console.log("Comparing input code with database contact:",h,"and passcode:",b),!(f&&h&&h.includes(f)||o&&b&&b===o))throw new Error("Verification code does not match. Please contact Administrator.");localStorage.setItem("isSoftLogin","true"),localStorage.setItem("currentFlatNo",t),u("Access Verified! Signing in...","success"),console.log("Soft login verified. Triggering background auth sync..."),await Ae(t),console.log("Background auth sync completed.")}catch(n){console.error("handleSoftLoginSubmit error:",n),u(n.message||"Verification failed.","error")}finally{r.disabled=!1,r.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Verify & Sign In'}};async function et(e,t){if(p)try{await se();const o=document.getElementById("side-user-profile"),r=document.getElementById("side-user-email"),n=document.getElementById("side-user-role");o&&r&&n&&(r.textContent=`Flat ${t}`,n.textContent="RESIDENT",n.className="badge",n.style.borderColor="var(--border-color)",n.style.color="var(--text-secondary)",o.style.display="flex"),q="viewer",re("viewer"),await Se(),ie(),le(),Y()}catch(o){console.error("handleSoftUserSession error:",o),u("Error retrieving flat details.","error")}}async function Ae(e){if(!p)return;const t="resident_v2@deepsikha.in",o="resident123";try{const{error:r}=await p.auth.signInWithPassword({email:t,password:o});if(r){const{error:n}=await p.auth.signUp({email:t,password:o});if(n)throw n;const{error:l}=await p.auth.signInWithPassword({email:t,password:o});if(l)throw l}}catch(r){console.error("autoLoginSharedAccount error:",r),localStorage.removeItem("isSoftLogin"),localStorage.removeItem("currentFlatNo"),document.getElementById("auth-container").style.display="block",r.message&&r.message.toLowerCase().includes("invalid login credentials")?u("Soft Login blocked by Supabase. Please disable 'Confirm Email' in Supabase Auth Settings, or manually confirm 'resident@deepsikha.in' via SQL.","error"):u("Authentication failed: "+r.message,"error")}}window.openUsersModal=async function(){if(!x("users:manage")){u("Access Denied. You don't have permission to manage users.","error");return}openModal("usersModal");const e=document.getElementById("users-table-body");e.innerHTML='<tr><td colspan="4" style="text-align: center;">Loading users...</td></tr>';try{const{data:t,error:o}=await p.from("profiles").select("id, email, role, assigned_floors").order("email");if(o)throw o;if(!t||t.length===0){e.innerHTML='<tr><td colspan="4" style="text-align: center;">No registered users found.</td></tr>';return}const r=z.map(n=>({value:n.name,label:n.label||n.name}));e.innerHTML="",t.forEach(n=>{const l=document.createElement("tr");let s=r.map(d=>`<option value="${d.value}" ${d.value===n.role?"selected":""}>${d.label}</option>`).join("");const i=n.id===R?'disabled title="Cannot change your own role"':"",a=Array.isArray(n.assigned_floors)?n.assigned_floors:[],c=a.length>0?`Floor ${a.sort().join(", Floor ")}`:"All";l.innerHTML=`
                <td>${n.email}</td>
                <td>
                    <select id="role-select-${n.id}" class="filter-select" ${i}>
                        ${s}
                    </select>
                </td>
                <td style="text-align: center;">
                    <span style="font-size:0.8rem; color:var(--text-secondary);">${c}</span>
                    <button class="btn btn-slate" style="padding: 2px 6px; font-size: 0.65rem; margin-left: 4px;" onclick="openAssignFloorsModal('${n.id}', '${C(n.email)}')">
                        <i class="fa-solid fa-layer-group"></i>
                    </button>
                </td>
                <td>
                    <button class="btn btn-emerald" style="padding: 4px 8px; font-size: 0.8rem;" ${i} onclick="updateUserRole('${n.id}')">Save Role</button>
                </td>
            `,e.appendChild(l)})}catch(t){console.error("Error fetching users:",t),e.innerHTML='<tr><td colspan="4" style="text-align: center; color: red;">Failed to load users.</td></tr>',u("Error loading users.","error")}};window.updateUserRole=async function(e){if(!x("users:role_change")){u("Access Denied.","error");return}const o=document.getElementById(`role-select-${e}`).value;try{const{error:r}=await p.from("profiles").update({role:o}).eq("id",e);if(r)throw r;u("User role updated successfully!","success")}catch(r){console.error("Error updating user role:",r),u("Failed to update user role.","error")}};window.openAssignFloorsModal=async function(e,t){if(!x("users:role_change")){u("Access Denied.","error");return}document.getElementById("assign-floors-user-id").value=e,document.getElementById("assign-floors-user-email").textContent=t;try{const{data:o,error:r}=await p.from("profiles").select("assigned_floors").eq("id",e).single();if(r)throw r;const n=o&&Array.isArray(o.assigned_floors)?o.assigned_floors:[];document.querySelectorAll(".floor-checkbox").forEach(l=>{l.checked=n.includes(parseInt(l.value))})}catch(o){console.error("Error fetching floor assignments:",o),u("Failed to load floor assignments.","error");return}openModal("floorAssignmentModal")};window.saveFloorAssignment=async function(){if(!x("users:role_change")){u("Access Denied.","error");return}const e=document.getElementById("assign-floors-user-id").value,t=document.querySelectorAll(".floor-checkbox:checked"),o=Array.from(t).map(r=>parseInt(r.value));try{const{error:r}=await p.from("profiles").update({assigned_floors:o}).eq("id",e);if(r)throw r;u("Floor assignments saved!","success"),closeModal("floorAssignmentModal"),openUsersModal()}catch(r){console.error("Error saving floor assignments:",r),u("Failed to save floor assignments.","error")}};window.openPasswordModal=function(){document.getElementById("new-password").value="",document.getElementById("confirm-new-password").value="",openModal("passwordModal")};window.updateUserPassword=async function(){const e=document.getElementById("new-password").value,t=document.getElementById("confirm-new-password").value;if(e.length<6){u("Password must be at least 6 characters.","error");return}if(e!==t){u("Passwords do not match.","error");return}if(p)try{const{error:o}=await p.auth.updateUser({password:e});if(o)throw o;u("Password updated successfully!","success"),closeModal("passwordModal")}catch(o){console.error("Error updating password:",o),u("Failed to update password: "+o.message,"error")}};const Fe=[{id:"dashboard:view",label:"View Dashboard"},{id:"income:create",label:"Record Income"},{id:"income:delete",label:"Delete Income"},{id:"expense:create",label:"Record Expense"},{id:"expense:delete",label:"Delete Expense"},{id:"history:view",label:"View Ledger History"},{id:"reports:view",label:"View Reports"},{id:"ledger:import",label:"Import Ledger"},{id:"ledger:export",label:"Export Ledger"},{id:"owners:upload",label:"Upload Owners"},{id:"owners:edit_any",label:"Edit Any Owner Profile"},{id:"owners:edit_own",label:"Edit Own Profile"},{id:"expense_heads:manage",label:"Access Expense Heads"},{id:"expense_heads:create",label:"Add Expense Heads"},{id:"expense_heads:delete",label:"Delete Expense Heads"},{id:"users:manage",label:"View Users List"},{id:"users:role_change",label:"Change User Roles"},{id:"tickets:assign",label:"Assign Tickets"},{id:"tickets:recommend",label:"Recommend Tickets"},{id:"tickets:approve",label:"Approve Tickets"},{id:"tickets:resolve",label:"Resolve Tickets"},{id:"tickets:close",label:"Close Tickets"},{id:"tickets:reopen",label:"Reopen Tickets"},{id:"tickets:archive",label:"Archive/View Archived"},{id:"tickets:delete",label:"Delete Tickets"},{id:"tickets:comment",label:"Comment on Tickets"}];window.openRolesModal=async function(){if(!x("users:role_change")){u("Access Denied.","error");return}await se(),fe(),openModal("rolesModal")};function fe(){const e=document.getElementById("roles-manager-list");if(e){if(z.length===0){e.innerHTML='<div style="text-align: center; padding: 20px; color: var(--text-muted);">No roles defined.</div>';return}e.innerHTML="",z.forEach(t=>{const o=document.createElement("div");o.className="category-item",o.style.flexDirection="column",o.style.alignItems="stretch",o.style.padding="12px",o.style.marginBottom="8px";const r=(t.permissions||[]).length,n=t.permissions.map(l=>{const s=Fe.find(i=>i.id===l);return s?s.label:l}).join(", ");o.innerHTML=`
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div>
                    <strong style="color: var(--text-primary); font-size: 0.95rem;">${t.label||t.name}</strong>
                    <code style="margin-left: 8px; font-size: 0.7rem; color: var(--text-muted);">${t.name}</code>
                    <span class="badge badge-income" style="margin-left: 8px; font-size: 0.6rem; padding: 1px 6px;">${r} permissions</span>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button class="btn btn-indigo" style="padding: 4px 10px; font-size: 0.7rem;" onclick="openEditRoleModal('${t.name}')">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    ${t.name!=="admin"?`<button class="btn btn-rose" style="padding: 4px 10px; font-size: 0.7rem;" onclick="handleDeleteRole('${t.name}')">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>`:""}
                </div>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.5;">
                ${n||"<em>No permissions</em>"}
            </div>
        `,e.appendChild(o)})}}window.openAddRoleModal=function(){document.getElementById("editRoleModal")&&(document.getElementById("edit-role-mode").value="add",document.getElementById("edit-role-original-name").value="",document.getElementById("edit-role-name").value="",document.getElementById("edit-role-label").value="",document.getElementById("edit-role-color").value="var(--text-secondary)",Be([]),document.getElementById("edit-role-modal-title").textContent="Add New Role",openModal("editRoleModal"))};window.openEditRoleModal=function(e){const t=z.find(r=>r.name===e);!t||!document.getElementById("editRoleModal")||(document.getElementById("edit-role-mode").value="edit",document.getElementById("edit-role-original-name").value=t.name,document.getElementById("edit-role-name").value=t.name,document.getElementById("edit-role-label").value=t.label||"",document.getElementById("edit-role-color").value=t.color||"var(--text-secondary)",Be(t.permissions||[]),document.getElementById("edit-role-modal-title").textContent="Edit Role",openModal("editRoleModal"))};function Be(e){const t=document.getElementById("edit-role-permissions");t&&(t.innerHTML="",Fe.forEach(o=>{const r=e.includes(o.id)?"checked":"",n=document.createElement("div");n.style.cssText="display: flex; align-items: center; gap: 8px; padding: 4px 0;",n.innerHTML=`
            <input type="checkbox" id="perm-${o.id}" value="${o.id}" ${r} style="accent-color: var(--color-indigo);">
            <label for="perm-${o.id}" style="font-size: 0.85rem; cursor: pointer; color: var(--text-primary);">${o.label}</label>
        `,t.appendChild(n)}))}window.handleSaveRole=async function(e){if(e.preventDefault(),!p)return;if(!x("users:role_change")){u("Access Denied.","error");return}const t=document.getElementById("edit-role-mode").value,o=document.getElementById("edit-role-original-name").value,r=document.getElementById("edit-role-name").value.trim(),n=document.getElementById("edit-role-label").value.trim(),l=document.getElementById("edit-role-color").value.trim(),s=document.querySelectorAll("#edit-role-permissions input[type='checkbox']:checked"),i=Array.from(s).map(c=>c.value);if(!r||!n){u("Role name and label are required.","error");return}const a=e.target.querySelector("button[type=submit]");a&&(a.disabled=!0,a.textContent="Saving...");try{if(t==="add"){const{error:c}=await p.from("roles").insert({name:r,label:n,permissions:i,color:l||"var(--text-secondary)",priority:z.length>0?Math.min(...z.map(d=>d.priority||0))-10:0});if(c)throw c;u(`Role "${n}" created!`,"success")}else{const{error:c}=await p.from("roles").update({name:r,label:n,permissions:i,color:l||"var(--text-secondary)"}).eq("name",o);if(c)throw c;u(`Role "${n}" updated!`,"success")}closeModal("editRoleModal"),await se(),fe(),re(q)}catch(c){console.error("handleSaveRole error:",c),u(c.message||"Failed to save role.","error")}finally{a&&(a.disabled=!1,a.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Save Role')}};window.handleDeleteRole=async function(e){if(!p)return;if(!x("users:role_change")){u("Access Denied.","error");return}if(e==="admin"){u("Cannot delete the default admin role.","error");return}const t=z.find(o=>o.name===e);if(t&&confirm(`Are you sure you want to delete the role "${t.label||e}"?

Users with this role will retain it but lose all associated permissions until reassigned.`))try{const{error:o}=await p.from("roles").delete().eq("name",e);if(o)throw o;u(`Role "${t.label||e}" deleted.`,"success"),await se(),fe(),re(q)}catch(o){console.error("handleDeleteRole error:",o),u(o.message||"Failed to delete role.","error")}};

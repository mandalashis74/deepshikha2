(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const s of i.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&r(s)}).observe(document,{childList:!0,subtree:!0});function t(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function r(n){if(n.ep)return;n.ep=!0;const i=t(n);fetch(n.href,i)}})();const me={BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,SSR:!1,VITE_SUPABASE_ANON_KEY:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE",VITE_SUPABASE_URL:"https://xkpqkbberckxblkhseim.supabase.co"};let u=null,ee=[],te="date-wise-cashbook",I="viewer",N=null,Q=[],j=null,pe="ALL";document.addEventListener("DOMContentLoaded",()=>{const e=new Date().toISOString().split("T")[0],o=document.getElementById("inc-date"),t=document.getElementById("exp-date");o&&(o.value=e),t&&(t.value=e);const r=new Date,n=r.getFullYear(),s=["January","February","March","April","May","June","July","August","September","October","November","December"][r.getMonth()],l=document.getElementById("filter-year");if(l){if(![...l.options].some(c=>c.value===String(n))){const c=document.createElement("option");c.value=String(n),c.textContent=String(n),l.appendChild(c)}l.value=String(n)}const a=document.getElementById("filter-month");a&&(a.value=s),l&&l.addEventListener("change",U),a&&a.addEventListener("change",U),fe()?ge():openSupabaseConfig()});function p(e,o="success",t=null){const r=document.getElementById("toast-container");if(!r)return;const n=document.createElement("div");n.className=`toast toast-${o}`;const i=o==="success"?'<i class="fa-solid fa-circle-check"></i>':'<i class="fa-solid fa-circle-exclamation"></i>';if(n.innerHTML=`${i} <span>${e}</span>`,t){const s=document.createElement("button");s.className="toast-btn",s.innerHTML=t.text,s.onclick=t.callback,n.appendChild(s)}r.appendChild(n),setTimeout(()=>{n.style.animation="slideInRight 0.3s ease reverse",setTimeout(()=>{n.remove()},300)},4e3)}function fe(){let e=localStorage.getItem("supabaseUrl")||"",o=localStorage.getItem("supabaseKey")||"";try{!e&&typeof import.meta<"u"&&me&&(e="https://xkpqkbberckxblkhseim.supabase.co"),!o&&typeof import.meta<"u"&&me&&(o="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE")}catch(t){console.warn("Vite env variables not accessible:",t)}if(e&&o&&e!=="YOUR_SUPABASE_URL"&&o!=="YOUR_SUPABASE_ANON_KEY"&&e.trim()!==""&&o.trim()!=="")try{return console.log("Initializing Supabase client with URL:",e.trim()),u=window.supabase.createClient(e.trim(),o.trim()),le(!0),!0}catch(t){return console.error("Failed to initialize Supabase client:",t),le(!1,"Init Error"),!1}else return le(!1,"Disconnected"),!1}function le(e,o){const t=document.getElementById("db-status-badge"),r=document.getElementById("db-status-text");!t||!r||(e?(t.className="badge badge-income",t.style.borderColor="rgba(16, 185, 129, 0.4)",t.style.cursor="pointer",r.textContent="Connected"):(t.className="badge badge-expense",t.style.borderColor="rgba(244, 63, 94, 0.4)",t.style.cursor="pointer",r.textContent=o||"Disconnected"))}window.openSupabaseConfig=function(){const e=localStorage.getItem("supabaseUrl")||"",o=localStorage.getItem("supabaseKey")||"",t=document.getElementById("sb-url"),r=document.getElementById("sb-key");t&&(t.value=e),r&&(r.value=o),openModal("supabaseConfigModal")};window.saveSupabaseConfig=function(e){e.preventDefault();const o=document.getElementById("sb-url").value.trim(),t=document.getElementById("sb-key").value.trim();localStorage.setItem("supabaseUrl",o),localStorage.setItem("supabaseKey",t),closeModal("supabaseConfigModal"),fe()?(p("Supabase credentials saved successfully!","success"),ge()):p("Invalid credentials. Connection failed.","error")};function ge(){u&&u.auth.onAuthStateChange((e,o)=>{o?(N=o.user.id,setTimeout(async()=>{try{if(localStorage.getItem("isSoftLogin")==="true"){const t=localStorage.getItem("currentFlatNo");await ze(o.user,t)}else await Ie(o.user);document.getElementById("auth-container").style.display="none"}catch(t){console.error("Session initialization failed:",t),localStorage.removeItem("isSoftLogin"),localStorage.removeItem("currentFlatNo"),await u.auth.signOut(),N=null,document.getElementById("auth-container").style.display="block",document.getElementById("user-profile-badge").style.display="none",I="viewer",ae("viewer")}},0)):localStorage.getItem("isSoftLogin")==="true"?(localStorage.getItem("currentFlatNo"),xe()):(N=null,document.getElementById("auth-container").style.display="block",document.getElementById("user-profile-badge").style.display="none",I="viewer",ae("viewer"))})}async function Ie(e){if(u)try{let{data:o,error:t}=await u.from("profiles").select("role").eq("id",e.id).single();if(t){console.warn("Profile fetching failed, retrying in 1s...",t),await new Promise(l=>setTimeout(l,1e3));const s=await u.from("profiles").select("role").eq("id",e.id).single();if(o=s.data,s.error)throw s.error}I=o&&o.role?o.role.toLowerCase().trim():"viewer";const r=document.getElementById("user-profile-badge"),n=document.getElementById("user-email-text"),i=document.getElementById("user-role-text");r&&n&&i&&(n.textContent=e.email,i.textContent=I.toUpperCase(),I==="admin"?(i.className="badge badge-income",i.style.borderColor="rgba(16, 185, 129, 0.4)",i.style.color="var(--color-emerald)"):I==="editor"?(i.className="badge badge-expense",i.style.borderColor="rgba(244, 63, 94, 0.4)",i.style.color="var(--color-rose)"):(i.className="badge",i.style.borderColor="var(--border-color)",i.style.color="var(--text-secondary)"),r.style.display="inline-flex"),ae(I),await ye(),oe(),ne(),U()}catch(o){console.error("handleUserSession error:",o),p("Error retrieving user profile role credentials.","error")}}function ae(e){const o=document.querySelector(`button[onclick="openModal('importModal')"]`),t=document.querySelector(`button[onclick="openModal('ownersModal')"]`),r=document.querySelector('button[onclick="openExpenseHeadsModal()"]'),n=document.querySelector(`button[onclick="openModal('incomeModal')"]`),i=document.querySelector(`button[onclick="openModal('expenseModal')"]`),s=document.getElementById("btn-manage-users");if(e==="admin")o&&(o.style.display="inline-flex"),t&&(t.style.display="inline-flex"),r&&(r.style.display="inline-flex"),n&&(n.style.display="inline-flex"),i&&(i.style.display="inline-flex"),document.querySelector(".workspace").style.display="block",document.querySelector('button[onclick="openHistoryModal()"]').style.display="inline-flex",document.querySelector('button[onclick="openReportsModal()"]').style.display="inline-flex",document.getElementById("btn-export").style.display="inline-flex",s&&(s.style.display="inline-flex");else if(e==="editor")o&&(o.style.display="none"),t&&(t.style.display="none"),r&&(r.style.display="none"),n&&(n.style.display="inline-flex"),i&&(i.style.display="inline-flex"),document.querySelector(".workspace").style.display="block",document.querySelector('button[onclick="openHistoryModal()"]').style.display="inline-flex",document.querySelector('button[onclick="openReportsModal()"]').style.display="inline-flex",document.getElementById("btn-export").style.display="inline-flex",s&&(s.style.display="none");else{o&&(o.style.display="none"),t&&(t.style.display="none"),r&&(r.style.display="none"),n&&(n.style.display="none"),i&&(i.style.display="none"),document.querySelector(".workspace").style.display="none";const l=document.querySelector('button[onclick="openHistoryModal()"]');l&&(l.style.display="none");const a=document.querySelector('button[onclick="openReportsModal()"]');a&&(a.style.display="none");const c=document.getElementById("btn-export");c&&(c.style.display="none"),s&&(s.style.display="none")}ee.length>0&&se(ee)}window.toggleAuthForms=function(e){document.getElementById("login-form-wrapper").style.display=e?"none":"block",document.getElementById("register-form-wrapper").style.display=e?"block":"none"};window.handleLoginSubmit=async function(e){if(e.preventDefault(),!u){p("Database not connected.","error");return}const o=document.getElementById("login-email").value.trim(),t=document.getElementById("login-password").value,r=document.getElementById("btn-login-submit");r.disabled=!0,r.textContent="Signing In...";try{const{error:n}=await u.auth.signInWithPassword({email:o,password:t});if(n)throw n;p("Welcome back!","success")}catch(n){p(n.message||"Failed to log in","error")}finally{r.disabled=!1,r.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Sign In'}};window.handleRegisterSubmit=async function(e){if(e.preventDefault(),!u){p("Database not connected.","error");return}const o=document.getElementById("register-email").value.trim(),t=document.getElementById("register-password").value,r=document.getElementById("register-confirm-password").value;if(t!==r){p("Passwords do not match.","error");return}if(t.length<6){p("Password must be at least 6 characters.","error");return}const n=document.getElementById("btn-register-submit");n.disabled=!0,n.textContent="Registering...";try{const{data:i,error:s}=await u.auth.signUp({email:o,password:t});if(s)throw s;i.session?p("Registration successful!","success"):p("Registration successful! Verify link sent to email.","success"),toggleAuthForms(!1)}catch(i){p(i.message||"Registration failed.","error")}finally{n.disabled=!1,n.innerHTML='<i class="fa-solid fa-user-plus"></i> Create Account'}};window.handleLogout=async function(){if(u&&confirm("Are you sure you want to sign out?"))try{localStorage.removeItem("isSoftLogin"),localStorage.removeItem("currentFlatNo");const{error:e}=await u.auth.signOut();if(e)throw e;p("Logged out successfully.")}catch{p("Logout failed.","error")}};async function ye(){if(u)try{const{data:e,error:o}=await u.from("owners").select("flat_no").limit(1);if(o)throw o;if(!e||e.length===0){const t=[],r=["1","2","3","4","5","6","7","8"],n=["A","B","C","D","E","F","G","H"];r.forEach(s=>{n.forEach(l=>{t.push({flat_no:`${s}${l}`,owner_name:`Flat ${s}${l}`})})});const{error:i}=await u.from("owners").insert(t);if(i)throw i;console.log("Default building owner mappings seeded successfully!")}}catch(e){console.error("ensureOwnersPopulated error:",e)}}async function oe(){if(u)try{const{data:e,error:o}=await u.from("owners").select("flat_no, owner_name").order("flat_no");if(o)throw o;const t=document.getElementById("inc-flat"),r=document.getElementById("hist-flat"),n=t?t.value:"",i=r?r.value:"ALL";t&&(t.innerHTML='<option value="" disabled selected>Select Room & Tenant</option>',e.forEach(l=>{const a=document.createElement("option"),c=`${l.flat_no} - ${l.owner_name}`;a.value=c,a.textContent=c,t.appendChild(a)}),n&&e.some(l=>`${l.flat_no} - ${l.owner_name}`===n)&&(t.value=n)),r&&(r.innerHTML='<option value="ALL">All Flats</option>',e.forEach(l=>{const a=document.createElement("option");a.value=l.flat_no,a.textContent=`${l.flat_no} - ${l.owner_name}`,r.appendChild(a)}),r.value=i);const s=document.getElementById("ticket-flat");if(s){s.innerHTML='<option value="" disabled selected>Select Your Flat</option>';const l=localStorage.getItem("isSoftLogin")==="true",a=localStorage.getItem("currentFlatNo");if(e.forEach(c=>{if(l&&c.flat_no!==a)return;const d=document.createElement("option");d.value=c.flat_no,d.textContent=`${c.flat_no} - ${c.owner_name}`,l&&c.flat_no===a&&(d.selected=!0),s.appendChild(d)}),l){const c=s.querySelector('option[value=""]');c&&c.remove()}}}catch(e){console.error("loadFlats registry error:",e),p("Could not load owners registry list.","error")}}async function U(){if(!u)return;const e=document.getElementById("filter-year").value,o=document.getElementById("filter-month").value;try{const{data:t,error:r}=await u.from("income").select("id, flat_no, year, month, amount, date_received, category, event_name, remarks").eq("year",e).eq("month",o);if(r)throw r;const{data:n,error:i}=await u.from("expenses").select("id, year, month, expense_head, description, amount, date_spent").eq("year",e).eq("month",o);if(i)throw i;const s=t.reduce((m,y)=>m+parseFloat(y.amount),0),l=n.reduce((m,y)=>m+parseFloat(y.amount),0),a=s-l;document.getElementById("stat-income").textContent=F(s),document.getElementById("stat-expense").textContent=F(l),document.getElementById("stat-cash").textContent=F(a);const c=[];t.forEach(m=>{let y=`Flat ${m.flat_no} Maintenance Fee`;m.category==="Special Event"?y=`Flat ${m.flat_no} ${m.event_name} Subscription`:m.category==="Other"&&(y=`Flat ${m.flat_no} Other - ${m.remarks||"Misc"}`),c.push({id:m.id,type:"INCOME",description:y,year:m.year,month:m.month,amount:parseFloat(m.amount),date:m.date_received})}),n.forEach(m=>{c.push({id:m.id,type:"EXPENSE",description:`${m.expense_head}: ${m.description}`,year:m.year,month:m.month,amount:parseFloat(m.amount),date:m.date_spent})}),c.sort((m,y)=>y.date.localeCompare(m.date)),ee=c,se(ee);const d=document.getElementById("btn-export");d&&(d.removeAttribute("href"),d.onclick=m=>{m.preventDefault(),exportLedgerToExcel()})}catch(t){console.error("Dashboard refresh error:",t),p("Error loading financial dashboard.","error")}}function F(e){return"Rs. "+Number(e).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}function se(e){const o=document.getElementById("ledger-body");if(o){if(o.innerHTML="",e.length===0){o.innerHTML=`
            <tr>
                <td colspan="7" class="text-center" style="color: var(--text-muted); padding: 30px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    No ledger entries logged for this period.
                </td>
            </tr>
        `;return}e.forEach(t=>{const r=document.createElement("tr"),n=t.type==="INCOME"?'<span class="badge badge-income">Income</span>':'<span class="badge badge-expense">Expense</span>',i=t.type==="INCOME"?`<button class="btn-receipt" title="Generate PDF Receipt" onclick="generateReceipt(${t.id})">
                   <i class="fa-solid fa-file-pdf"></i>
               </button>`:"",s=I==="admin"?`<button class="btn-delete" title="Delete entry" onclick="deleteEntry('${t.type}', ${t.id}, '${t.description.replace(/'/g,"\\'").replace(/"/g,"&quot;")}')">
                    <i class="fa-solid fa-trash-can"></i>
               </button>`:"";r.innerHTML=`
            <td>#${t.id}</td>
            <td>${n}</td>
            <td><strong>${t.description}</strong></td>
            <td>${t.month} ${t.year}</td>
            <td class="text-right ${t.type==="INCOME"?"icon-emerald":"icon-rose"}" style="font-weight: 600;">
                ${t.type==="INCOME"?"+":"-"} ${Number(t.amount).toLocaleString("en-IN",{minimumFractionDigits:2})}
            </td>
            <td class="text-center">${V(t.date)}</td>
            <td class="text-center">
                ${i}
                ${s}
            </td>
        `,o.appendChild(r)})}}window.filterTable=function(){const e=document.getElementById("table-search").value.toLowerCase().trim();if(!e){se(ee);return}const o=ee.filter(t=>t.description.toLowerCase().includes(e)||t.type.toLowerCase().includes(e)||String(t.id).includes(e));se(o)};window.handleIncomeSubmit=async function(e){if(e.preventDefault(),!u){p("Database not connected.","error");return}if(I!=="admin"&&I!=="editor"){p("Access Denied: Only Admins and Editors can record entries.","error");return}const o=document.getElementById("inc-flat").value,t=document.getElementById("inc-category").value,r=document.getElementById("inc-event")?document.getElementById("inc-event").value.trim():"",n=document.getElementById("inc-remarks")?document.getElementById("inc-remarks").value.trim():"",i=document.getElementById("inc-year").value,s=document.getElementById("inc-month").value,l=document.getElementById("inc-amount").value,a=document.getElementById("inc-date").value,c=e.target.querySelector("button[type=submit]");if(c.disabled=!0,!o||o==="Select Room & Tenant"||!l||!a){p("Please fill out all fields.","error"),c.disabled=!1;return}try{const d=o.split(" - ")[0].trim(),m=parseFloat(l);if(isNaN(m))throw new Error("Amount must be a valid number.");const{data:y,error:f}=await u.from("income").insert({flat_no:d,year:i,month:s,amount:m,date_received:a,category:t,event_name:t==="Special Event"?r:null,remarks:n||null}).select("id").single();if(f)throw f;p(`Payment logged for Flat ${d}`,"success",{text:'<i class="fa-solid fa-file-pdf"></i> Receipt',callback:()=>generateReceipt(y.id)}),document.getElementById("inc-amount").value="",document.getElementById("inc-event")&&(document.getElementById("inc-event").value=""),document.getElementById("inc-remarks")&&(document.getElementById("inc-remarks").value=""),document.getElementById("inc-category").value="Monthly Maintenance",toggleEventNameField("Monthly Maintenance"),closeModal("incomeModal"),U()}catch(d){p(d.message||"Failed to log income","error")}finally{c.disabled=!1}};window.handleExpenseSubmit=async function(e){if(e.preventDefault(),!u){p("Database not connected.","error");return}if(I!=="admin"&&I!=="editor"){p("Access Denied: Only Admins and Editors can record entries.","error");return}const o=document.getElementById("exp-year").value,t=document.getElementById("exp-month").value,r=document.getElementById("exp-head").value,n=document.getElementById("exp-desc").value.trim(),i=document.getElementById("exp-amount").value,s=document.getElementById("exp-date").value,l=e.target.querySelector("button[type=submit]");if(l.disabled=!0,!r||!n||!i||!s){p("Please fill out all fields.","error"),l.disabled=!1;return}try{const a=parseFloat(i);if(isNaN(a))throw new Error("Amount must be a valid number.");const{error:c}=await u.from("expenses").insert({year:o,month:t,expense_head:r,description:n,amount:a,date_spent:s});if(c)throw c;p(`Expense saved: ${n}`),document.getElementById("exp-desc").value="",document.getElementById("exp-amount").value="",closeModal("expenseModal"),U()}catch(a){p(a.message||"Failed to log expense","error")}finally{l.disabled=!1}};window.toggleEventNameField=function(e){const o=document.getElementById("inc-event-field"),t=document.getElementById("inc-event");o&&(e==="Special Event"?(o.classList.remove("hidden"),t&&(t.required=!0)):(o.classList.add("hidden"),t&&(t.required=!1,t.value="")))};async function ne(){if(u)try{const{data:e,error:o}=await u.from("expense_heads").select("id, name").order("name");if(o)throw o;const t=document.getElementById("exp-head");if(t){const n=t.value;t.innerHTML='<option value="" disabled selected>Select Category / Head</option>',e.forEach(i=>{const s=document.createElement("option");s.value=i.name,s.textContent=i.name,t.appendChild(s)}),n&&e.some(i=>i.name===n)&&(t.value=n)}const r=document.getElementById("category-manager-list");r&&(r.innerHTML="",e.length===0?r.innerHTML='<div style="text-align: center; color: var(--text-muted); padding: 10px;">No custom expense heads defined.</div>':e.forEach(n=>{const i=document.createElement("div");i.className="category-item";const s=I==="admin"?`<button class="btn-delete" title="Delete category" onclick="handleDeleteExpenseHead(${n.id}, '${n.name.replace(/'/g,"\\'")}')">
                               <i class="fa-solid fa-trash-can"></i>
                           </button>`:"";i.innerHTML=`
                        <span>${n.name}</span>
                        ${s}
                    `,r.appendChild(i)}))}catch(e){console.error("loadExpenseHeads error:",e),p("Could not load expense categories.","error")}}window.openExpenseHeadsModal=function(){const e=document.getElementById("add-head-form");e&&(e.style.display=I==="admin"?"flex":"none"),ne(),openModal("expenseHeadsModal")};window.handleAddExpenseHead=async function(e){if(e.preventDefault(),!u)return;if(I!=="admin"){p("Access Denied: Only Admins can add expense categories.","error");return}const o=document.getElementById("new-head-name"),t=o.value.trim();if(t)try{const{error:r}=await u.from("expense_heads").insert({name:t});if(r)throw r.code==="23505"?new Error("Category already exists."):r;p(`Category "${t}" added successfully.`,"success"),o.value="",ne()}catch(r){p(r.message||"Failed to add category.","error")}};window.handleDeleteExpenseHead=async function(e,o){if(u){if(I!=="admin"){p("Access Denied: Only Admins can delete expense categories.","error");return}if(confirm(`Are you sure you want to delete the category "${o}"?
Note: Existing expenses using this head will remain, but this category option will be removed.`))try{const{error:t}=await u.from("expense_heads").delete().eq("id",e);if(t)throw t;p(`Category "${o}" deleted.`,"success"),ne()}catch(t){p(t.message||"Failed to delete category.","error")}}};let ie=[];window.openOwnersDirectoryModal=function(){openModal("ownersDirectoryModal"),loadOwnersDirectory()};window.loadOwnersDirectory=async function(e=""){if(!u)return;const o=document.getElementById("flats-grid");if(o){e||(o.innerHTML='<div style="grid-column: span 3; text-align: center; color: var(--text-secondary); padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>Loading flats...</div>');try{let{data:t,error:r}=await u.from("owners").select("*").order("flat_no");if(r)throw r;ie=t||[],he(ie,e)}catch(t){console.error("loadOwnersDirectory error:",t),p("Failed to load owners directory.","error")}}};function he(e,o="",t=""){const r=document.getElementById("flats-grid");if(!r)return;r.innerHTML="";const n=new Set;e.forEach(l=>{l.flat_no&&l.flat_no.includes("+")&&l.flat_no.split("+").map(c=>c.trim()).forEach(c=>n.add(c))});const i=o.trim().toLowerCase(),s=e.filter(l=>{if(n.has(l.flat_no))return!1;const a=l.flat_no.toLowerCase().includes(i)||l.owner_name.toLowerCase().includes(i)||l.contact_no&&l.contact_no.includes(i)||l.parking_no&&l.parking_no.toLowerCase().includes(i),c=t===""||l.flat_no.startsWith(t);return a&&c});if(s.length===0){r.innerHTML='<div style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 20px;">No matching flats found.</div>';return}s.forEach(l=>{const a=document.createElement("div");a.className="flat-card",a.dataset.flatNo=l.flat_no,a.onclick=()=>selectFlatForEdit(l.flat_no);let c="Owner";l.occupancy_status==="tenant-occupied"?c="Tenant":l.occupancy_status==="vacant"&&(c="Vacant"),a.innerHTML=`
            <h4>${l.flat_no}</h4>
            <p style="font-weight: 600;">${l.owner_name}</p>
            <span class="badge ${l.occupancy_status==="vacant"?"badge-expense":"badge-income"}" style="font-size: 0.6rem; padding: 1px 6px;">${c}</span>
        `,r.appendChild(a)})}window.filterOwnersDirectory=function(){const e=document.getElementById("directory-search").value,o=document.getElementById("directory-floor-filter")?document.getElementById("directory-floor-filter").value:"";he(ie,e,o)};window.selectFlatForEdit=function(e){document.querySelectorAll(".flat-card").forEach(c=>{c.dataset.flatNo===e?c.classList.add("active"):c.classList.remove("active")});const o=ie.find(c=>c.flat_no===e),t=document.getElementById("directory-detail-side");if(!t||!o)return;const r=I==="admin",n=localStorage.getItem("isSoftLogin")==="true"&&localStorage.getItem("currentFlatNo")===e,i=r||n,s=i?"":"disabled",l=[{value:"owner-occupied",label:"Owner Occupied"},{value:"tenant-occupied",label:"Tenant Occupied"},{value:"vacant",label:"Vacant"}];let a=`<select id="edit-status" ${s}>`;l.forEach(c=>{const d=c.value===o.occupancy_status?"selected":"";a+=`<option value="${c.value}" ${d}>${c.label}</option>`}),a+="</select>",t.innerHTML=`
        <div class="card" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 16px;">
                <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--color-indigo);">Flat ${o.flat_no} Details</h3>
                <span class="badge ${o.occupancy_status==="vacant"?"badge-expense":"badge-income"}">${o.occupancy_status.replace("-"," ")}</span>
            </div>
            
            <form id="edit-owner-form" onsubmit="saveOwnerProfile(event)">
                <input type="hidden" id="edit-flat-no" value="${o.flat_no}">
                
                <div class="input-field">
                    <label for="edit-owner-name">Owner Name</label>
                    <input type="text" id="edit-owner-name" value="${o.owner_name||""}" ${s} required>
                </div>
                
                <div class="input-field">
                    <label for="edit-contact">Contact No</label>
                    <input type="text" id="edit-contact" value="${o.contact_no||""}" ${s}>
                </div>
                
                ${i?`
                <div class="input-field">
                    <label for="edit-passcode">Passcode (For Soft Login)</label>
                    <input type="text" id="edit-passcode" placeholder="e.g. 1234" value="${o.passcode||""}" ${s}>
                </div>
                `:""}
                
                <div class="grid-two-cols">
                    <div class="input-field">
                        <label for="edit-parking">Parking Space No</label>
                        <input type="text" id="edit-parking" value="${o.parking_no||"None"}" ${s}>
                    </div>
                    <div class="input-field">
                        <label for="edit-mc-rate">Monthly MC Rate (Rs.)</label>
                        <input type="number" step="0.01" id="edit-mc-rate" value="${o.monthly_mc_rate||1e3}" ${s} required>
                    </div>
                </div>
                
                <div class="input-field">
                    <label for="edit-status">Occupancy Status</label>
                    ${a}
                </div>
                
                <div class="input-field">
                    <label for="edit-family">Family Members Details</label>
                    <textarea id="edit-family" rows="3" placeholder="e.g. Spouse, Son (12), Daughter (8)" style="background-color: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-primary); padding: 10px; font-family: inherit; font-size: 0.9rem; resize: vertical;" ${s}>${o.family_members||""}</textarea>
                </div>
                
                <div class="input-field">
                    <label for="edit-combined">Combined Flat No(s)</label>
                    <input type="text" id="edit-combined" placeholder="e.g. 1B (leave empty if none)" value="${o.combined_flat_nos||""}" ${s}>
                </div>
                
                ${i?`<div class="modal-actions" style="margin-top: 16px;">
                            <button type="submit" class="btn btn-indigo" style="width: 100%;">
                                <i class="fa-solid fa-floppy-disk"></i> Save Profile
                            </button>
                       </div>`:`<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; margin-top: 10px;">
                            <i class="fa-solid fa-lock"></i> Edit restricted to Owner or Administrators.
                       </div>`}
            </form>
        </div>
    `};window.saveOwnerProfile=async function(e){if(e.preventDefault(),!u)return;const o=document.getElementById("edit-flat-no").value,t=localStorage.getItem("isSoftLogin")==="true"&&localStorage.getItem("currentFlatNo")===o;if(I!=="admin"&&!t){p("Access Denied: Only Admins or the flat owner can save profiles.","error");return}const r=document.getElementById("edit-owner-name").value.trim(),n=document.getElementById("edit-contact").value.trim(),i=document.getElementById("edit-passcode");let s;if(i){const f=i.value.trim();s=f?parseInt(f):null}const l=document.getElementById("edit-parking").value.trim(),a=parseFloat(document.getElementById("edit-mc-rate").value),c=document.getElementById("edit-status").value,d=document.getElementById("edit-family").value.trim(),m=document.getElementById("edit-combined").value.trim(),y=e.target.querySelector("button[type=submit]");y&&(y.disabled=!0,y.textContent="Saving...");try{const f={owner_name:r,contact_no:n,parking_no:l,monthly_mc_rate:a,occupancy_status:c,family_members:d,combined_flat_nos:m};s!==void 0&&(f.passcode=s);const{error:v}=await u.from("owners").update(f).eq("flat_no",o);if(v)throw v;p(`Profile for Flat ${o} updated!`,"success"),await loadOwnersDirectory(),selectFlatForEdit(o),oe()}catch(f){console.error("saveOwnerProfile error:",f),p(f.message||"Failed to update profile.","error")}finally{y&&(y.disabled=!1,y.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Save Profile')}};window.deleteEntry=async function(e,o,t){if(!u){p("Database not connected.","error");return}if(I!=="admin"){p("Access Denied: Only Admins can delete entries.","error");return}if(confirm(`Are you sure you want to permanently delete this entry?

"${t}"`))try{const r=e==="INCOME"?"income":"expenses",{error:n}=await u.from(r).delete().eq("id",o);if(n)throw n;p("Entry removed successfully."),U()}catch(r){p(r.message||"Deletion failed","error")}};window.openModal=function(e){const o=document.getElementById(e);o&&(o.style.display="block")};window.closeModal=function(e){const o=document.getElementById(e);if(!o)return;o.style.display="none";const t=o.querySelector("form");if(t){t.reset();const r=t.querySelector(".dropzone-text");r&&(e==="importModal"?r.textContent="Click or drag Excel file here":r.textContent="Click or drag owners.xlsx file here",r.style.color="var(--text-secondary)")}};window.updateDropzoneText=function(e){const o=e.parentElement.querySelector(".dropzone-text");e.files&&e.files[0]&&o&&(o.textContent=`Selected: ${e.files[0].name}`,o.style.color="var(--color-emerald)")};window.onclick=function(e){e.target.classList.contains("modal")&&e.target.id!=="auth-container"&&closeModal(e.target.id)};async function Se(){try{const e=await fetch("/static/logo.png");if(!e.ok)return null;const o=await e.blob();return new Promise(t=>{const r=new FileReader;r.onloadend=()=>t(r.result),r.readAsDataURL(o)})}catch(e){return console.error("Failed to load logo image:",e),null}}window.generateReceipt=async function(e){if(!u){p("Database not connected.","error");return}try{p("Fetching receipt details...","success");const{data:o,error:t}=await u.from("income").select("id, flat_no, year, month, amount, date_received, category, event_name, remarks").eq("id",e).single();if(t||!o)throw new Error("Receipt data not found.");const{data:r}=await u.from("owners").select("owner_name").eq("flat_no",o.flat_no).single(),n=r?r.owner_name:`Flat ${o.flat_no}`;let i=o.year;try{const w=parseInt(o.year.substring(0,4),10);i=`${w}-${String(w+1).substring(2)}`}catch{}const s=`DR-${i}-${String(o.id).padStart(4,"0")}`,{jsPDF:l}=window.jspdf,a=new l({orientation:"landscape",unit:"mm",format:"a5"});a.setDrawColor(15,23,42),a.setLineWidth(.3),a.rect(5,5,200,138),a.setDrawColor(2,132,199),a.setLineWidth(.6),a.rect(7,7,196,134),a.setTextColor(248,250,252),a.setFont("helvetica","bold"),a.setFontSize(28),a.text("DEEPSIKHA RESIDENCY",105,74,{align:"center",angle:15});const c=await Se();c?a.addImage(c,"PNG",12,12,18,18):(a.setDrawColor(148,163,184),a.rect(12,12,18,18),a.setFont("helvetica","bold"),a.setFontSize(8),a.setTextColor(148,163,184),a.text("LOGO",21,22,{align:"center"})),a.setTextColor(15,23,42),a.setFont("helvetica","bold"),a.setFontSize(14),a.text("DEEPSIKHA RESIDENCY (BLOCK - 2)",34,17),a.setTextColor(71,85,105),a.setFont("helvetica","normal"),a.setFontSize(8),a.text("Flat Owners Association",34,22),a.text("Deepsikha Residency, Block 2, Flat 1-8 A-H, Asansol",34,26),a.setDrawColor(203,213,225),a.setLineWidth(.4),a.line(10,32,200,32),a.setTextColor(15,23,42),a.setFont("helvetica","bold"),a.setFontSize(11),a.text("MONEY RECEIPT",12,40),a.setFont("helvetica","bold"),a.setFontSize(8),a.text("Receipt No:",140,40),a.text("Date:",140,45),a.setFont("helvetica","normal"),a.text(s,160,40),a.text(V(o.date_received),160,45),a.setFillColor(248,250,252),a.rect(12,50,186,22,"F"),a.setDrawColor(226,232,240),a.setLineWidth(.3),a.rect(12,50,186,22),a.setFont("helvetica","bold"),a.setFontSize(8.5),a.setTextColor(51,65,85),a.text("Received From:",16,56),a.text("For Period:",16,66),a.setFont("helvetica","normal"),a.setTextColor(15,23,42),a.text(n,42,56),a.text(`${o.month} ${o.year}`,42,66),a.setFont("helvetica","bold"),a.setTextColor(51,65,85),a.text("Flat No:",120,56),a.text("Purpose:",120,66),a.setFont("helvetica","normal"),a.setTextColor(15,23,42),a.text(o.flat_no,138,56);let d="Maintenance Charge Collection";o.category==="Special Event"?d=`${o.event_name} Subscription`:o.category==="Other"&&(d=o.remarks||"Other Collection"),a.text(d,138,66),a.setFont("helvetica","bold"),a.setFontSize(11),a.setTextColor(15,23,42),a.text("Total Paid:",12,84),a.setFont("helvetica","bold"),a.setFontSize(12),a.setTextColor(5,150,105),a.text(`Rs. ${o.amount.toLocaleString("en-IN",{minimumFractionDigits:2})}`,34,84);const m=Be(o.amount);a.setFont("helvetica","bold"),a.setFontSize(8.5),a.setTextColor(51,65,85),a.text("Amount in Words:",12,94),a.setFont("helvetica","oblique"),a.setFontSize(8),a.setTextColor(71,85,105);const y=a.splitTextToSize(m,115);if(a.text(y,12,99),o.remarks&&o.category!=="Other"){a.setFont("helvetica","bold"),a.setFontSize(8.5),a.setTextColor(51,65,85),a.text("Remarks:",12,112),a.setFont("helvetica","normal"),a.setFontSize(8),a.setTextColor(71,85,105);const w=a.splitTextToSize(o.remarks,115);a.text(w,12,117)}a.setDrawColor(203,213,225),a.setLineWidth(.3),a.line(140,94,185,94),a.setFont("helvetica","bold"),a.setFontSize(8),a.setTextColor(15,23,42),a.text("Authorized Signatory",162.5,98,{align:"center"}),a.setFont("helvetica","normal"),a.setFontSize(7.5),a.setTextColor(71,85,105),a.text("Deepsikha Residency",162.5,102,{align:"center"});const f=a.output("datauristring"),v=window.open();v?v.document.write(`<iframe width='100%' height='100%' src='${f}'></iframe>`):(a.save(`Receipt_${s}.pdf`),p("Receipt downloaded (new window blocked)."))}catch(o){console.error("Receipt generation failed:",o),p(o.message||"Failed to generate receipt PDF.","error")}};window.openHistoryModal=async function(){openModal("historyModal");const e=new Date,o=e.getFullYear(),t=e.toISOString().split("T")[0],r=`${o}-01-01`,n=document.getElementById("hist-start-date"),i=document.getElementById("hist-end-date");n&&(n.value=r),i&&(i.value=t),await oe(),fetchHistory()};window.fetchHistory=async function(){if(!u)return;const e=document.getElementById("hist-type").value;let o=document.getElementById("hist-flat").value;const t=document.getElementById("hist-year").value,r=document.getElementById("hist-month").value,n=document.getElementById("hist-start-date").value,i=document.getElementById("hist-end-date").value,s=document.getElementById("hist-search").value.trim().toLowerCase();o&&o.includes(" - ")&&(o=o.split(" - ")[0].trim()),o==="ALL"&&(o="");try{const l=[],{data:a}=await u.from("owners").select("flat_no, owner_name"),c={};if(a&&a.forEach(d=>{c[d.flat_no]=d.owner_name}),e==="ALL"||e==="INCOME"){let d=u.from("income").select("id, flat_no, year, month, amount, date_received, category, event_name, remarks");o&&(d=d.eq("flat_no",o)),t&&t!=="ALL"&&(d=d.eq("year",t)),r&&r!=="ALL"&&(d=d.eq("month",r)),n&&(d=d.gte("date_received",n)),i&&(d=d.lte("date_received",i));const{data:m,error:y}=await d;if(y)throw y;m.forEach(f=>{const v=c[f.flat_no]||`Flat ${f.flat_no}`;let w=`Flat ${f.flat_no} Maintenance Fee`;f.category==="Special Event"?w=`Flat ${f.flat_no} ${f.event_name} Subscription`:f.category==="Other"&&(w=`Flat ${f.flat_no} Other - ${f.remarks||"Misc"}`);const g=String(f.amount);let b=!0;s&&(b=w.toLowerCase().includes(s)||v.toLowerCase().includes(s)||g.includes(s)||f.date_received.includes(s)||f.month.toLowerCase().includes(s)||f.year.includes(s)),b&&l.push({id:f.id,type:"INCOME",flat_no:f.flat_no,owner_name:v,description:w,year:f.year,month:f.month,amount:parseFloat(f.amount),date:f.date_received})})}if((e==="ALL"||e==="EXPENSE")&&!o){let d=u.from("expenses").select("id, year, month, expense_head, description, amount, date_spent");t&&t!=="ALL"&&(d=d.eq("year",t)),r&&r!=="ALL"&&(d=d.eq("month",r)),n&&(d=d.gte("date_spent",n)),i&&(d=d.lte("date_spent",i));const{data:m,error:y}=await d;if(y)throw y;m.forEach(f=>{const v=String(f.amount),w=`${f.expense_head}: ${f.description}`;let g=!0;s&&(g=w.toLowerCase().includes(s)||v.includes(s)||f.date_spent.includes(s)||f.month.toLowerCase().includes(s)||f.year.includes(s)),g&&l.push({id:f.id,type:"EXPENSE",flat_no:"",owner_name:"",description:w,year:f.year,month:f.month,amount:parseFloat(f.amount),date:f.date_spent})})}l.sort((d,m)=>m.date.localeCompare(d.date)),_e(l)}catch(l){console.error("History search error:",l),p("Error searching history ledger.","error")}};function _e(e){const o=document.getElementById("history-body"),t=document.getElementById("history-total");if(!o)return;o.innerHTML="";let r=0;if(e.length===0){o.innerHTML=`
            <tr>
                <td colspan="5" class="text-center" style="color: var(--text-muted); padding: 30px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    No ledger history matches the current filters.
                </td>
            </tr>
        `,t&&(t.innerHTML="₹0.00");return}if(e.forEach(n=>{const i=document.createElement("tr"),s=Number(n.amount)||0;n.type==="INCOME"?r+=s:r-=s;const l=n.type==="INCOME"?'<span class="badge badge-income">Income</span>':'<span class="badge badge-expense">Expense</span>',a=n.type==="INCOME"?`<button class="btn-receipt" title="Generate PDF Receipt" onclick="generateReceipt(${n.id})">
                   <i class="fa-solid fa-file-pdf"></i> Receipt
               </button>`:"",c=I==="admin"?`<button class="btn-delete" title="Delete entry" onclick="deleteHistoryEntry('${n.type}', ${n.id}, '${n.description.replace(/'/g,"\\'").replace(/"/g,"&quot;")}')">
                    <i class="fa-solid fa-trash-can"></i>
               </button>`:"";i.innerHTML=`
            <td>${V(n.date)}</td>
            <td>${l}</td>
            <td><strong>${n.description}</strong></td>
            <td class="text-right ${n.type==="INCOME"?"icon-emerald":"icon-rose"}" style="font-weight: 600;">
                ${n.type==="INCOME"?"+":"-"} ${s.toLocaleString("en-IN",{minimumFractionDigits:2})}
            </td>
            <td class="text-center">
                ${a}
                ${c}
            </td>
        `,o.appendChild(i)}),t){const n=r>=0?"+":"-",i=r>=0?"icon-emerald":"icon-rose";t.className=`text-right ${i}`,t.innerHTML=`${n} ₹${Math.abs(r).toLocaleString("en-IN",{minimumFractionDigits:2})}`}}window.deleteHistoryEntry=async function(e,o,t){if(!u){p("Database not connected.","error");return}if(I!=="admin"){p("Access Denied: Only Admins can delete entries.","error");return}if(confirm(`Are you sure you want to permanently delete this entry from history?

"${t}"`))try{const r=e==="INCOME"?"income":"expenses",{error:n}=await u.from(r).delete().eq("id",o);if(n)throw n;p("Entry removed successfully."),fetchHistory(),U()}catch(r){p(r.message||"Deletion failed","error")}};window.openReportsModal=function(){openModal("reportsModal");const e=new Date,o=e.getFullYear(),t=e.toISOString().split("T")[0],r=String(e.getMonth()+1).padStart(2,"0"),n=`${o}-${r}-01`,i=document.getElementById("rep-start-date"),s=document.getElementById("rep-end-date"),l=document.getElementById("rep-year");i&&(i.value=n),s&&(s.value=t),l&&(l.value=o.toString()),switchReportTab("date-wise-cashbook")};window.switchReportTab=function(e){te=e,document.querySelectorAll(".report-tab-btn").forEach(n=>{n.classList.remove("active")});const o=document.getElementById(`tab-${e}`);o&&o.classList.add("active");const t=document.getElementById("rep-filter-dates"),r=document.getElementById("rep-filter-year");e==="date-wise-cashbook"?(t&&t.classList.remove("hidden"),r&&r.classList.add("hidden")):e==="helpdesk-stats"?(t&&t.classList.add("hidden"),r&&r.classList.add("hidden")):(t&&t.classList.add("hidden"),r&&r.classList.remove("hidden")),loadActiveReport()};window.loadActiveReport=async function(){const e=document.getElementById("report-sheet");if(e){e.innerHTML=`
        <div class="text-center" style="padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 12px; display: block;"></i>
            Generating report, please wait...
        </div>
    `;try{if(te==="date-wise-cashbook"){const o=document.getElementById("rep-start-date").value,t=document.getElementById("rep-end-date").value;if(!o||!t){e.innerHTML='<div class="text-center" style="padding: 30px; color: #e11d48;">Please select both Start and End dates.</div>';return}const r=await ke(o,t);Me(r)}else if(te==="month-wise-cashbook"){const o=document.getElementById("rep-year").value,t=await $e(o);Fe(t)}else if(te==="income-expenditure"){const o=document.getElementById("rep-year").value,t=await Ce(o);Te(t)}else te==="helpdesk-stats"&&await He()}catch(o){console.error("Report loader error:",o),e.innerHTML='<div class="text-center" style="padding: 30px; color: #e11d48;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading report. Please try again.</div>'}}};window.printActiveReport=function(){window.print()};function V(e){if(!e)return"";const o=e.split("-");return o.length===3?`${o[2]}/${o[1]}/${o[0]}`:e}async function ke(e,o){const{data:t,error:r}=await u.from("income").select("amount").lt("date_received",e);if(r)throw r;const n=t.reduce((h,S)=>h+parseFloat(S.amount),0),{data:i,error:s}=await u.from("expenses").select("amount").lt("date_spent",e);if(s)throw s;const l=i.reduce((h,S)=>h+parseFloat(S.amount),0),a=n-l,{data:c,error:d}=await u.from("income").select("id, flat_no, year, amount, date_received, category, event_name, remarks").gte("date_received",e).lte("date_received",o);if(d)throw d;const{data:m,error:y}=await u.from("expenses").select("id, expense_head, description, amount, date_spent").gte("date_spent",e).lte("date_spent",o);if(y)throw y;const{data:f}=await u.from("owners").select("flat_no, owner_name"),v={};f&&f.forEach(h=>{v[h.flat_no]=h.owner_name});const w=[];c.forEach(h=>{let S=h.year;try{const k=parseInt(h.year.substring(0,4),10);S=`${k}-${String(k+1).substring(2)}`}catch{}const W=`DR-${S}-${String(h.id).padStart(4,"0")}`,K=v[h.flat_no]||`Flat ${h.flat_no}`;let T=`Flat ${h.flat_no} - ${K}`;h.category==="Special Event"?T+=` (${h.event_name} Subscription)`:h.category==="Other"?T+=` (Other: ${h.remarks||"Misc"})`:T+=" (Maintenance)",w.push({id:h.id,date:h.date_received,type:"INCOME",particulars:T,ref_no:W,debit:parseFloat(h.amount),credit:0})}),m.forEach(h=>{w.push({id:h.id,date:h.date_spent,type:"EXPENSE",particulars:`[${h.expense_head}] ${h.description}`,ref_no:`EXP-${String(h.id).padStart(4,"0")}`,debit:0,credit:parseFloat(h.amount)})}),w.sort((h,S)=>h.date!==S.date?h.date.localeCompare(S.date):h.type==="INCOME"?-1:1);const g=w.reduce((h,S)=>h+S.debit,0),b=w.reduce((h,S)=>h+S.credit,0);return{start_date:e,end_date:o,opening_balance:a,transactions:w,total_debit:g,total_credit:b,closing_balance:a+g-b}}async function $e(e){const o=`${e}-01-01`,{data:t,error:r}=await u.from("income").select("amount").lt("date_received",o);if(r)throw r;const n=t.reduce((h,S)=>h+parseFloat(S.amount),0),{data:i,error:s}=await u.from("expenses").select("amount").lt("date_spent",o);if(s)throw s;const l=i.reduce((h,S)=>h+parseFloat(S.amount),0),a=n-l,{data:c,error:d}=await u.from("income").select("amount, month").eq("year",e);if(d)throw d;const{data:m,error:y}=await u.from("expenses").select("amount, month").eq("year",e);if(y)throw y;const f={},v={};c.forEach(h=>{f[h.month]=(f[h.month]||0)+parseFloat(h.amount)}),m.forEach(h=>{v[h.month]=(v[h.month]||0)+parseFloat(h.amount)});const w=["January","February","March","April","May","June","July","August","September","October","November","December"],g=[];let b=a;return w.forEach(h=>{const S=f[h]||0,W=v[h]||0,K=b,T=K+S-W;b=T,g.push({month:h,opening_balance:K,receipts:S,payments:W,closing_balance:T})}),{year:e,opening_balance_year:a,monthly_summaries:g,total_receipts:g.reduce((h,S)=>h+S.receipts,0),total_payments:g.reduce((h,S)=>h+S.payments,0),closing_balance_year:b}}async function Ce(e){const{data:o,error:t}=await u.from("income").select("flat_no, amount, category, event_name").eq("year",e);if(t)throw t;const{data:r,error:n}=await u.from("expenses").select("expense_head, amount").eq("year",e);if(n)throw n;const i={},s={};o.forEach(g=>{i[g.flat_no]=(i[g.flat_no]||0)+parseFloat(g.amount);let b="Monthly Maintenance Charge Collections";g.category==="Special Event"?b=`${g.event_name} Collections`:g.category==="Other"&&(b="Other Collections"),s[b]=(s[b]||0)+parseFloat(g.amount)});const l={};r.forEach(g=>{const b=g.expense_head||"Miscellaneous";l[b]=(l[b]||0)+parseFloat(g.amount)});const{data:a}=await u.from("owners").select("flat_no, owner_name"),c={};a&&a.forEach(g=>{c[g.flat_no]=g.owner_name});const d=[];Object.keys(i).forEach(g=>{const b=i[g];d.push({flat_no:g,owner_name:c[g]||`Flat ${g}`,amount:b})}),d.sort((g,b)=>g.flat_no.localeCompare(b.flat_no));const m=[];let y=0;Object.keys(l).forEach(g=>{const b=l[g];y+=b,m.push({category:g,amount:b})}),m.sort((g,b)=>g.category.localeCompare(b.category));const f=[];let v=0;Object.keys(s).forEach(g=>{const b=s[g];v+=b,f.push({category:g,amount:b})}),f.sort((g,b)=>g.category.localeCompare(b.category));const w=v-y;return{year:e,incomes:f,income_details:d,expenditures:m,total_income:v,total_expenditure:y,surplus_deficit:w}}function Me(e){const o=document.getElementById("report-sheet");if(!o)return;let t="",r=e.opening_balance;t+=`
        <tr class="row-opening">
            <td>${V(e.start_date)}</td>
            <td>-</td>
            <td>Opening Balance B/F</td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right rep-bal">${F(r)}</td>
        </tr>
    `,e.transactions.length===0?t+=`
            <tr>
                <td colspan="6" class="text-center" style="color: #64748b; padding: 20px;">
                    No transactions recorded during this period.
                </td>
            </tr>
        `:e.transactions.forEach(n=>{r=r+n.debit-n.credit;const i=n.debit>0?F(n.debit):"-",s=n.credit>0?F(n.credit):"-";t+=`
                <tr>
                    <td>${V(n.date)}</td>
                    <td><code>${n.ref_no}</code></td>
                    <td>${n.particulars}</td>
                    <td class="text-right ${n.debit>0?"amt-dr":""}">${i}</td>
                    <td class="text-right ${n.credit>0?"amt-cr":""}">${s}</td>
                    <td class="text-right rep-bal">${F(r)}</td>
                </tr>
            `}),t+=`
        <tr class="row-closing">
            <td>${V(e.end_date)}</td>
            <td>-</td>
            <td>Closing Balance C/F</td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right rep-bal">${F(e.closing_balance)}</td>
        </tr>
    `,o.innerHTML=`
        <div class="report-header">
            <h2>DEEPSIKHA RESIDENCY (BLOCK - 2)</h2>
            <p><strong>DATE-WISE CASH BOOK</strong></p>
            <p>Period: ${V(e.start_date)} to ${V(e.end_date)}</p>
        </div>
        
        <div class="report-summary-cards">
            <div class="report-sum-card">
                <h4>Opening Balance</h4>
                <p>${F(e.opening_balance)}</p>
            </div>
            <div class="report-sum-card sum-debit">
                <h4>Total Receipts (+)</h4>
                <p>${F(e.total_debit)}</p>
            </div>
            <div class="report-sum-card sum-credit">
                <h4>Total Payments (-)</h4>
                <p>${F(e.total_credit)}</p>
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
                ${t}
            </tbody>
        </table>
    `}function Fe(e){const o=document.getElementById("report-sheet");if(!o)return;let t="";e.monthly_summaries.forEach(r=>{const n=r.receipts>0?F(r.receipts):"-",i=r.payments>0?F(r.payments):"-";t+=`
            <tr>
                <td><strong>${r.month}</strong></td>
                <td class="text-right">${F(r.opening_balance)}</td>
                <td class="text-right amt-dr">${n}</td>
                <td class="text-right amt-cr">${i}</td>
                <td class="text-right rep-bal">${F(r.closing_balance)}</td>
            </tr>
        `}),o.innerHTML=`
        <div class="report-header">
            <h2>DEEPSIKHA RESIDENCY (BLOCK - 2)</h2>
            <p><strong>MONTH-WISE CASH BOOK SUMMARY</strong></p>
            <p>Year: ${e.year}</p>
        </div>
        
        <div class="report-summary-cards">
            <div class="report-sum-card">
                <h4>Year Opening</h4>
                <p>${F(e.opening_balance_year)}</p>
            </div>
            <div class="report-sum-card sum-debit">
                <h4>Total Receipts</h4>
                <p>${F(e.total_receipts)}</p>
            </div>
            <div class="report-sum-card sum-credit">
                <h4>Total Payments</h4>
                <p>${F(e.total_payments)}</p>
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
                ${t}
            </tbody>
        </table>
    `}function Te(e){const o=document.getElementById("report-sheet");if(!o)return;let t="";e.incomes.length===0?t+='<tr><td colspan="2" class="text-center" style="color: #64748b;">No Income Recorded</td></tr>':e.incomes.forEach(l=>{t+=`
                <tr>
                    <td>${l.category}</td>
                    <td class="text-right amt-dr">${F(l.amount)}</td>
                </tr>
            `});let r="";e.expenditures.length===0?r+='<tr><td colspan="2" class="text-center" style="color: #64748b;">No Expenditures Recorded</td></tr>':e.expenditures.forEach(l=>{r+=`
                <tr>
                    <td>${l.category}</td>
                    <td class="text-right amt-cr">${F(l.amount)}</td>
                </tr>
            `});const n=e.surplus_deficit>=0,i=Math.abs(e.surplus_deficit);let s="";e.income_details.length===0?s+='<tr><td colspan="3" class="text-center" style="color: #64748b;">No Flat collections found.</td></tr>':e.income_details.forEach(l=>{s+=`
                <tr>
                    <td><strong>Flat ${l.flat_no}</strong></td>
                    <td>${l.owner_name}</td>
                    <td class="text-right amt-dr">${F(l.amount)}</td>
                </tr>
            `}),o.innerHTML=`
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
                            <td class="text-right">${F(e.total_expenditure)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="inc-exp-column col-income">
                <h3>Income (Credit)</h3>
                <table class="inc-exp-table">
                    <tbody>
                        ${t}
                        <tr class="total-row">
                            <td><strong>Total Income</strong></td>
                            <td class="text-right">${F(e.total_income)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="surplus-card ${n?"positive":"negative"}">
            ${n?`<i class="fa-solid fa-circle-arrow-up"></i> Excess of Income over Expenditure (Surplus): <strong>${F(i)}</strong>`:`<i class="fa-solid fa-circle-arrow-down"></i> Excess of Expenditure over Income (Deficit): <strong>${F(i)}</strong>`}
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
    `}function Be(e){try{let o=function(l){const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],c=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];let d="";return l>=100&&(d+=a[Math.floor(l/100)]+" Hundred ",l%=100),l>=20&&(d+=c[Math.floor(l/10)]+" ",l%=10),l>0&&(d+=a[l]+" "),d.trim()},t=function(l){if(l===0)return"Zero";let a=Math.floor(l/1e7);l%=1e7;let c=Math.floor(l/1e5);l%=1e5;let d=Math.floor(l/1e3);l%=1e3;let m=[];return a>0&&m.push(o(a)+" Crore"),c>0&&m.push(o(c)+" Lakh"),d>0&&m.push(o(d)+" Thousand"),l>0&&m.push(o(l)),m.join(" ").trim()};const r=Math.round(parseFloat(e)*100)/100;if(isNaN(r))return"";const n=Math.floor(r),i=Math.round((r-n)*100);if(n===0&&i===0)return"Zero Rupees Only";let s="";return n>0&&(s+=t(n)+" Rupees"),i>0&&(n>0&&(s+=" and "),s+=o(i)+" Paise"),s.trim()+" Only"}catch(o){return console.error("Number to words conversion failed:",o),""}}function re(e,o,t){const n={January:"01",February:"02",March:"03",April:"04",May:"05",June:"06",July:"07",August:"08",September:"09",October:"10",November:"11",December:"12"}[t]||"05",i=`${o}-${n}-01`;if(!e)return i;if(e instanceof Date){const c=new Date(e.getTime()+432e5),d=c.getFullYear(),m=String(c.getMonth()+1).padStart(2,"0"),y=String(c.getDate()).padStart(2,"0");return`${d}-${m}-${y}`}const s=String(e).trim();if(!s||s.toLowerCase()==="nan"||s.toLowerCase()==="null")return i;if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.split(" ")[0];const l=s.split(" ")[0],a=["/",".","-"];for(let c of a){const d=l.split(c);if(d.length===3){let m,y,f;if(d[0].length===4?(f=d[0],y=d[1],m=d[2]):(m=d[0],y=d[1],f=d[2]),m.length<2&&(m="0"+m),y.length<2&&(y="0"+y),f.length===2&&(f="20"+f),m.length===2&&y.length===2&&f.length===4){const v=parseInt(m,10),w=parseInt(y,10),g=parseInt(f,10);if(v>=1&&v<=31&&w>=1&&w<=12&&g>=1900&&g<=2100)return`${f}-${y}-${m}`}}}return i}function De(e){if(!e)return null;const t=String(e).trim().match(/([A-Za-z]+)['\-\s]*(\d+)/);if(t){let r=t[1].trim();r=r.charAt(0).toUpperCase()+r.slice(1).toLowerCase();let n=t[2].trim();return n.length===2&&(n="20"+n),{year:n,month:r}}return null}window.handleImportSubmit=async function(e){if(e.preventDefault(),!u){p("Database not connected.","error");return}if(I!=="admin"){p("Access Denied: Only Admins can import ledgers.","error");return}const o=document.getElementById("import-file");if(!o.files||!o.files[0])return;const t=document.getElementById("btn-import-submit");t.disabled=!0,t.textContent="Uploading & Parsing...";const r=o.files[0],n=new FileReader;n.onload=async function(i){try{const s=new Uint8Array(i.target.result),l=XLSX.read(s,{type:"array",cellDates:!0}),a=l.SheetNames;let c=null,d=null;a.forEach(T=>{const k=T.trim().toUpperCase();(k.includes("DETAIL")||k.includes("MC")&&!k.includes("WISE")&&!c)&&(c=T),k.includes("EXPENSE")&&!k.includes("INCOME")&&(d=T)}),c||(c=a[0]);const{error:m}=await u.from("income").delete().gt("id",-1);if(m)throw m;const{error:y}=await u.from("expenses").delete().gt("id",-1);if(y)throw y;let f=0,v=0;const w=l.Sheets[c],g=XLSX.utils.sheet_to_json(w,{header:1});let b=-1,h=!1,S=-1,W=-1,K=-1;for(let T=0;T<g.length;T++){const k=g[T].map(E=>String(E||"").toUpperCase().trim()),R=k.findIndex(E=>E==="FLAT NO"||E==="FLAT NO."),z=k.findIndex(E=>E==="DATE RECEIVED"||E==="DATE"),P=k.findIndex(E=>E==="AMOUNT");if(R!==-1&&z!==-1&&P!==-1){h=!0,S=R,W=z,K=P,b=T;break}if(k.includes("FLAT NO.")||k.includes("FLAT NO")){b=T;break}}if(b!==-1){const T=g[b],k=g.slice(b+1),R=[];let z=-1;for(let E=0;E<T.length;E++)if(String(T[E]||"").toUpperCase().includes("FLAT")){z=E;break}let P=[];if(b>0){const E=g[b-1];for(let D=5;D<E.length;D++){const _=E[D];if(_){let C=null;if(_ instanceof Date)C=_;else{const $=new Date(_);isNaN($.getTime())||(C=$)}if(C){const $=String(C.getFullYear()),A=C.toLocaleString("en-US",{month:"long"});P.push({year:$,month:A,amtIdx:D,dtIdx:D+1})}}}}if(P.length===0&&(P=[{year:"2025",month:"April",amtIdx:5,dtIdx:6},{year:"2025",month:"May",amtIdx:7,dtIdx:8},{year:"2025",month:"June",amtIdx:9,dtIdx:10},{year:"2025",month:"July",amtIdx:11,dtIdx:12},{year:"2025",month:"August",amtIdx:13,dtIdx:14},{year:"2025",month:"September",amtIdx:15,dtIdx:16},{year:"2025",month:"October",amtIdx:17,dtIdx:18},{year:"2025",month:"November",amtIdx:19,dtIdx:20},{year:"2025",month:"December",amtIdx:21,dtIdx:22},{year:"2026",month:"January",amtIdx:23,dtIdx:24},{year:"2026",month:"February",amtIdx:25,dtIdx:26},{year:"2026",month:"March",amtIdx:27,dtIdx:28},{year:"2026",month:"April",amtIdx:29,dtIdx:30},{year:"2026",month:"May",amtIdx:31,dtIdx:32}]),h?k.forEach(E=>{const D=String(E[S]||"").trim().toUpperCase().replace(/\s+/g,"");if(!D||D==="NAN"||D.includes("FLOOR")||D.length>8)return;const _=E[K],C=E[W];let $=parseFloat(_);if(!isNaN($)&&$>0){const A=re(C,"2026","May"),O=new Date(A),q=String(O.getFullYear()),B=["January","February","March","April","May","June","July","August","September","October","November","December"][O.getMonth()]||"May";R.push({flat_no:D,year:q,month:B,amount:$,date_received:A})}}):z!==-1&&k.forEach(E=>{const D=String(E[z]||"").trim().toUpperCase().replace(/\s+/g,"");!D||D==="NAN"||D.includes("FLOOR")||D.length>8||P.forEach(_=>{if(_.amtIdx<E.length){const C=E[_.amtIdx],$=_.dtIdx<E.length?E[_.dtIdx]:"";let A=parseFloat(C);if((isNaN(A)||String(C).toUpperCase().includes("ROOM")||String(C).toUpperCase().includes("TYPE"))&&(A=0),A>0){const O=re($,_.year,_.month),q=new Date(O),x=String(q.getFullYear()),L=["January","February","March","April","May","June","July","August","September","October","November","December"][q.getMonth()]||_.month;R.push({flat_no:D,year:x,month:L,amount:A,date_received:O})}}})}),R.length>0){const D=[...new Set(R.map($=>$.flat_no))].map($=>({flat_no:$,owner_name:`Flat ${$}`})),{error:_}=await u.from("owners").upsert(D,{onConflict:"flat_no",ignoreDuplicates:!0});_&&console.warn("Owner upsert warning:",_);const C=200;for(let $=0;$<R.length;$+=C){const A=R.slice($,$+C),{error:O}=await u.from("income").insert(A);if(O)throw O}f=R.length}}if(d){const T=l.Sheets[d],k=XLSX.utils.sheet_to_json(T,{header:1});let R=-1,z=!1,P=-1,E=-1,D=-1;for(let _=0;_<k.length;_++){const C=k[_].map(x=>String(x||"").toUpperCase().trim()),$=C.findIndex(x=>x==="DESCRIPTION"),A=C.findIndex(x=>x==="DATE SPENT"||x==="DATE"),O=C.findIndex(x=>x==="AMOUNT");if($!==-1&&A!==-1&&O!==-1){z=!0,P=$,E=A,D=O,R=_;break}if(k[_].map(x=>String(x||"")).join("").toUpperCase().includes("DESCRIPTION")){R=_;break}}if(R!==-1&&(z||k.length>2)){const _=k.slice(R+1),C=[],$=k[1]||[],A=k[2]||[];let O=null;const q=[];for(let x=2;x<$.length;x++){const B=$[x],L=A[x];if(B&&String(B).trim()!==""&&(O=String(B).trim()),O&&L&&String(L).trim().toUpperCase().includes("AMOUNT")){let Y=null;if(x+1<A.length){const J=A[x+1];if(J){const X=String(J).trim().toUpperCase();(X.includes("DATE")||X.includes("DT OF")||X.includes("PAYMENT"))&&(Y=x+1)}}const H=De(O);H&&q.push({year:H.year,month:H.month,amtCol:x,dtCol:Y})}}if(z?_.forEach(x=>{const B=String(x[P]||"").trim();if(!B||B.toUpperCase().includes("SR.")||B.toUpperCase().includes("TOTAL")||B.length<3)return;const L=x[D],G=x[E];let Y=parseFloat(L);if(!isNaN(Y)&&Y>0){const H=re(G,"2026","May"),J=new Date(H),X=String(J.getFullYear()),de=["January","February","March","April","May","June","July","August","September","October","November","December"][J.getMonth()]||"May";C.push({year:X,month:de,expense_head:"Uncategorized",description:B,amount:Y,date_spent:H})}}):_.forEach(x=>{if(x.length<3)return;const B=String(x[1]||"").trim();!B||B.toUpperCase().includes("SR.")||B.toUpperCase().includes("TOTAL")||B.length<3||q.forEach(L=>{if(L.amtCol<x.length){const G=x[L.amtCol],Y=L.dtCol!==null&&L.dtCol<x.length?x[L.dtCol]:"";let H=parseFloat(G);if(isNaN(H)&&(H=0),H>0){const J=re(Y,L.year,L.month),X=new Date(J),ce=String(X.getFullYear()),Ee=["January","February","March","April","May","June","July","August","September","October","November","December"][X.getMonth()]||L.month;C.push({year:ce,month:Ee,expense_head:"Uncategorized",description:B,amount:H,date_spent:J})}}})}),C.length>0){for(let B=0;B<C.length;B+=200){const L=C.slice(B,B+200),{error:G}=await u.from("expenses").insert(L);if(G)throw G}v=C.length}}}p(`Excel imports finished successfully!
Parsed ${f} income collections and ${v} expense vouchers.`,"success"),closeModal("importModal"),U()}catch(s){console.error("Ledger import error:",s),p(s.message||"Failed parsing document structure.","error")}finally{t.disabled=!1,t.textContent="Upload & Parse"}},n.readAsArrayBuffer(r)};window.handleOwnersSubmit=async function(e){if(e.preventDefault(),!u){p("Database not connected.","error");return}if(I!=="admin"){p("Access Denied: Only Admins can upload owner mappings.","error");return}const o=document.getElementById("owners-file");if(!o.files||!o.files[0])return;const t=document.getElementById("btn-owners-submit");t.disabled=!0,t.textContent="Uploading...";const r=o.files[0],n=new FileReader;n.onload=async function(i){try{const s=new Uint8Array(i.target.result),l=XLSX.read(s,{type:"array"}),a=l.SheetNames[0],c=l.Sheets[a],d=XLSX.utils.sheet_to_json(c,{header:1});let m=-1;for(let w=0;w<d.length;w++){const g=d[w].map(b=>String(b||"").toUpperCase()).join(" ");if(g.includes("FLAT NO")||g.includes("FLAT")){m=w;break}}let y=m!==-1?m+1:0;const f=[];for(let w=y;w<d.length;w++){const g=d[w];if(!g||g.length<3)continue;const b=String(g[1]||"").trim(),h=String(g[2]||"").trim().toUpperCase().replace(/\s+/g,"");if(h&&h!=="NAN"&&h!=="UNDEFINED"){const S=b&&b!=="nan"&&b!=="undefined"?b:`Flat ${h}`;f.push({flat_no:h,owner_name:S})}}if(f.length===0)throw new Error("No valid owner mappings found in the spreadsheet.");const{error:v}=await u.from("owners").upsert(f,{onConflict:"flat_no"});if(v)throw v;p(`Successfully loaded ${f.length} owner mappings!`),closeModal("ownersModal"),oe()}catch(s){console.error("Owners import error:",s),p(s.message||"Failed parsing owners spreadsheet.","error")}finally{t.disabled=!1,t.textContent="Upload Mapping"}},n.readAsArrayBuffer(r)};window.exportLedgerToExcel=async function(){if(!u){p("Database not connected.","error");return}try{p("Generating spreadsheet...","success");const{data:e,error:o}=await u.from("income").select("id, flat_no, year, month, amount, date_received").order("id");if(o)throw o;const{data:t,error:r}=await u.from("expenses").select("id, year, month, description, amount, date_spent").order("id");if(r)throw r;const n=e.map(m=>({ID:m.id,"Flat Details":m.flat_no,Year:m.year,Month:m.month,"Amount Paid (Rs.)":m.amount,"Date Received":m.date_received})),i=t.map(m=>({ID:m.id,Year:m.year,Month:m.month,Description:m.description,"Amount Spent (Rs.)":m.amount,"Date Spent":m.date_spent})),s=XLSX.utils.book_new(),l=XLSX.utils.json_to_sheet(n),a=XLSX.utils.json_to_sheet(i);XLSX.utils.book_append_sheet(s,l,"Income Summary"),XLSX.utils.book_append_sheet(s,a,"Expense Summary");const d=`Deepsikha_Ledger_${new Date().toISOString().replace(/T/,"_").replace(/\..+/,"").replace(/:/g,"")}.xlsx`;XLSX.writeFile(s,d),p("Spreadsheet downloaded successfully!")}catch(e){console.error("Export ledger error:",e),p("Could not export ledger.","error")}};window.openTicketsModal=async function(){openModal("ticketsModal"),await loadTickets()};window.openNewTicketModal=function(){openModal("newTicketModal"),document.getElementById("new-ticket-form").reset()};window.setTicketScope=function(e){pe=e;const o=document.getElementById("scope-btn-all"),t=document.getElementById("scope-btn-my");o&&o.classList.toggle("active",e==="ALL"),t&&t.classList.toggle("active",e==="MY"),filterTickets()};window.loadTickets=async function(){if(!u)return;const e=document.getElementById("tickets-list");e&&(e.innerHTML='<div style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--color-yellow);"></i><p style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">Loading tickets...</p></div>');try{const{data:o,error:t}=await u.from("tickets").select("*").order("created_at",{ascending:!1});if(t)throw t;const{data:r,error:n}=await u.from("profiles").select("id, email, role");if(n)throw n;const i={};r&&r.forEach(s=>{i[s.id]=s}),Q=(o||[]).map(s=>{const l=i[s.created_by],a=i[s.floor_manager_id],c=i[s.resolved_by],d=i[s.assigned_to],y=(Array.isArray(s.committee_approvals)?s.committee_approvals:[]).map(f=>{var v;return((v=i[f])==null?void 0:v.email)||"Unknown Member"});return{...s,creator_email:l?l.email:"Unknown",floor_manager_email:a?a.email:"Unknown",resolver_email:c?c.email:"Unknown",assigned_email:d?d.email:"Unassigned",approver_emails:y}}),Ae(),filterTickets(),j?Q.some(l=>l.id===j)?selectTicket(j):(j=null,ue()):ue()}catch(o){console.error("loadTickets error:",o),p("Failed to load helpdesk tickets.","error"),e&&(e.innerHTML='<div style="text-align: center; padding: 20px; color: var(--color-rose);"><i class="fa-solid fa-triangle-exclamation"></i><p style="margin-top: 8px; font-size: 0.85rem;">Error loading tickets.</p></div>')}};function Ae(){const e=["Pending","Recommended","Approved","Reopened"],o=["Resolved","Closed"];let t=0,r=0,n=0,i=0;Q.forEach(c=>{if(e.includes(c.status)?t++:o.includes(c.status)&&r++,c.resolved_at&&c.created_at){const d=new Date(c.resolved_at)-new Date(c.created_at);d>0&&(n+=d,i++)}});const s=document.getElementById("kpi-open-count"),l=document.getElementById("kpi-resolved-count"),a=document.getElementById("kpi-avg-time");if(s&&(s.textContent=t),l&&(l.textContent=r),a)if(i>0){const d=n/i/(1e3*60*60);d<24?a.textContent=`${d.toFixed(1)}h`:a.textContent=`${(d/24).toFixed(1)}d`}else a.textContent="N/A"}function ue(){const e=document.getElementById("tickets-detail-side");e&&(e.innerHTML=`
            <div class="detail-placeholder">
                <i class="fa-solid fa-clipboard-list" style="font-size: 3.5rem; color: var(--text-muted);"></i>
                <p style="margin-top: 10px;">Select a complaint ticket from the list to view its details and workflow tracking.</p>
            </div>
        `)}window.filterTickets=function(){const e=document.getElementById("ticket-filter-status").value,o=document.getElementById("ticket-filter-category").value,t=document.getElementById("ticket-search").value.toLowerCase().trim(),r=Q.filter(n=>{if(pe==="MY"&&n.created_by!==N||n.archived&&I!=="admin")return!1;const i=e==="ALL"||n.status===e,s=o==="ALL"||n.category===o,l=`${n.ticket_number||""} ${n.title} ${n.flat_no||""} ${n.creator_email} ${n.description}`.toLowerCase(),a=!t||l.includes(t);return i&&s&&a});Le(r)};function Le(e){const o=document.getElementById("tickets-list");if(o){if(e.length===0){o.innerHTML='<div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.9rem;"><i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 8px;"></i><p>No complaints found</p></div>';return}o.innerHTML="",e.forEach(t=>{const r=document.createElement("div");r.className=`ticket-card ${t.id===j?"active":""}`,r.onclick=()=>selectTicket(t.id);const n=new Date(t.created_at),i=new Date-n,s=Math.floor(i/(1e3*60*60*24));let l=`${s} days open`;s===0&&(l="Filed today");const c=s>=3&&!["Closed","Resolved"].includes(t.status)?'<span class="sla-overdue-tag"><i class="fa-solid fa-clock"></i> SLA Overdue</span>':"",d=ve(t.priority);r.innerHTML=`
            <div class="ticket-card-header">
                <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">${M(t.ticket_number||"#"+t.id)}</span>
                <span class="badge ${be(t.status)}">${t.status}</span>
            </div>
            <h4 style="margin: 4px 0;">${M(t.title)}</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0;">
                <span class="badge ${d}" style="font-size:0.7rem; padding: 2px 6px;">${t.priority||"Medium"}</span>
                ${c}
            </div>
            <div class="ticket-card-meta">
                <span><i class="fa-solid fa-door-open"></i> Flat ${M(t.flat_no||"N/A")}</span>
                <span><i class="fa-solid fa-calendar-day"></i> ${l}</span>
            </div>
        `,o.appendChild(r)})}}function be(e){switch(e){case"Pending":return"badge-pending";case"Recommended":return"badge-recommended";case"Approved":return"badge-approved";case"Resolved":return"badge-resolved";case"Closed":return"badge-closed";case"Reopened":return"badge-reopened";default:return"badge-pending"}}function ve(e){switch(e){case"Low":return"badge-low";case"Medium":return"badge-medium";case"High":return"badge-high";case"Urgent":return"badge-urgent";default:return"badge-medium"}}window.selectTicket=function(e){const o=j!==e;j=e,filterTickets();const t=Q.find(g=>g.id===e);if(!t)return;const r=document.getElementById("tickets-detail-side");if(!r)return;const n=Re(t),i=Oe(t),s=new Date(t.created_at),l=new Date-s,a=Math.floor(l/(1e3*60*60*24)),d=a>=3&&!["Closed","Resolved"].includes(t.status)?`<div style="background: rgba(244,63,94,0.08); border: 1px solid var(--color-rose); color: var(--color-rose); padding: 10px 14px; border-radius: var(--border-radius-sm); font-size: 0.85rem; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-circle-exclamation" style="font-size: 1.1rem;"></i>
            <strong>SLA Warning:</strong> This complaint has been open for ${a} days without resolution (exceeds 3-day SLA limit).
         </div>`:"";let m="";const y=Array.isArray(t.attachments)?t.attachments:[];y.length>0&&(m+=`<div style="margin-top: 14px;">
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Complaint Attachments</h4>
            <div class="comment-attachments">`,y.forEach(g=>{g.type.startsWith("image/")?m+=`
                    <div class="attachment-thumb" onclick="window.open('${g.data}', '_blank')">
                        <img src="${g.data}" alt="${M(g.name)}">
                    </div>`:m+=`
                    <a href="${g.data}" target="_blank" class="btn btn-slate" style="font-size:0.75rem; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-file-pdf"></i> ${M(g.name)}
                    </a>`}),m+="</div></div>");let f="";I==="admin"&&(f=`
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 12px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <span style="font-size: 0.85rem; font-weight:600;"><i class="fa-solid fa-user-tag"></i> Assign Complaint:</span>
                <select id="assign-ticket-select" onchange="assignTicket(${t.id}, this.value)" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-primary); padding: 4px 8px; font-size: 0.85rem;">
                    <option value="">-- Select Assignee --</option>
                </select>
            </div>
        `,Ne(t.assigned_to));let v="";I==="admin"&&(v=`
            <div style="display: flex; gap: 12px; margin-top: 16px;">
                <button class="btn btn-slate" onclick="archiveTicket(${t.id})" style="flex: 1; font-size: 0.8rem; padding: 8px;">
                    <i class="fa-solid fa-box-archive"></i> ${t.archived?"Unarchive":"Archive"} Ticket
                </button>
                <button class="btn btn-rose" onclick="deleteTicket(${t.id})" style="flex: 1; font-size: 0.8rem; padding: 8px;">
                    <i class="fa-solid fa-trash-can"></i> Delete Permanently
                </button>
            </div>
        `);const w=o?"animate-status-change":"";r.innerHTML=`
        <div class="ticket-detail-view ${w}" style="animation: fadeIn 0.3s ease;">
            ${d}
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; gap: 10px;">
                <div>
                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 2px;">
                        ${M(t.ticket_number||"#"+t.id)}
                    </span>
                    <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin: 0;">${M(t.title)}</h3>
                    <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 0.8rem; color: var(--text-secondary); flex-wrap: wrap;">
                        <span><i class="fa-solid fa-tag"></i> ${t.category.toUpperCase()}</span>
                        <span><i class="fa-solid fa-door-open"></i> Flat ${M(t.flat_no||"N/A")}</span>
                        <span><i class="fa-solid fa-user"></i> By: ${M(t.creator_email)}</span>
                        <span><i class="fa-solid fa-user-shield"></i> Assigned: <strong>${M(t.assigned_email)}</strong></span>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                    <span class="badge ${be(t.status)}" style="padding: 4px 10px; font-size: 0.8rem;">${t.status}</span>
                    <span class="badge ${ve(t.priority)}" style="font-size: 0.75rem; padding: 2px 8px;">${t.priority||"Medium"}</span>
                </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 14px; margin-bottom: 14px;">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Complaint Description</h4>
                <p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-primary); white-space: pre-wrap; margin: 0;">${M(t.description)}</p>
                ${m}
            </div>
            
            ${f}
            
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 12px;">Workflow Tracking</h4>
            <div class="workflow-timeline">
                ${n}
            </div>
            
            ${i}
            
            <!-- Threaded Comments Section -->
            <div class="comments-section">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 12px;">Comments & Resolution History</h4>
                <div class="comments-container" id="comments-container">
                    <div style="text-align: center; padding: 10px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading comments...</div>
                </div>
                
                <form id="comment-submit-form" onsubmit="submitComment(event, ${t.id})" class="comment-form">
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
            
            ${v}
        </div>
    `,loadComments(t.id)};async function Ne(e){if(u)try{const{data:o,error:t}=await u.from("profiles").select("id, email, role").order("email");if(t)throw t;const r=document.getElementById("assign-ticket-select");if(!r)return;r.innerHTML='<option value="">-- Unassigned --</option>',o.forEach(n=>{const i=n.role.replace("_"," ").toUpperCase();r.innerHTML+=`<option value="${n.id}" ${n.id===e?"selected":""}>
                ${M(n.email)} (${i})
            </option>`})}catch(o){console.error("fetchAssigneesForDropdown error:",o)}}window.assignTicket=async function(e,o){if(u)try{const t=o===""?null:o,{error:r}=await u.from("tickets").update({assigned_to:t}).eq("id",e);if(r)throw r;p("Ticket assignee updated successfully!","success"),await loadTickets()}catch(t){console.error("assignTicket error:",t),p("Failed to assign ticket.","error")}};window.archiveTicket=async function(e){if(!u)return;const o=Q.find(t=>t.id===e);if(o)try{const{error:t}=await u.from("tickets").update({archived:!o.archived}).eq("id",e);if(t)throw t;p(o.archived?"Ticket unarchived successfully!":"Ticket archived successfully!","success"),await loadTickets()}catch(t){console.error("archiveTicket error:",t),p("Failed to change ticket archive state.","error")}};window.deleteTicket=async function(e){if(u&&confirm("Are you sure you want to permanently delete this complaint ticket? This cannot be undone."))try{const{error:o}=await u.from("tickets").delete().eq("id",e);if(o)throw o;p("Ticket deleted permanently.","success"),j=null,await loadTickets()}catch(o){console.error("deleteTicket error:",o),p("Failed to delete ticket.","error")}};window.loadComments=async function(e){const o=document.getElementById("comments-container");if(o)try{const{data:t,error:r}=await u.from("ticket_comments").select("*").eq("ticket_id",e).order("created_at",{ascending:!0});if(r)throw r;const{data:n}=await u.from("profiles").select("id, email"),i={};if(n&&n.forEach(s=>{i[s.id]=s.email}),!t||t.length===0){o.innerHTML='<div style="text-align: center; padding: 14px; color: var(--text-muted); font-size: 0.8rem;">No comments yet. Add the first comment below!</div>';return}o.innerHTML="",t.forEach(s=>{const l=i[s.user_id]||"Unknown User",a=s.user_id===N;let c="";const d=Array.isArray(s.attachments)?s.attachments:[];d.length>0&&(c+='<div class="comment-attachments">',d.forEach(m=>{m.type.startsWith("image/")?c+=`
                            <div class="attachment-thumb" onclick="window.open('${m.data}', '_blank')">
                                <img src="${m.data}" alt="${M(m.name)}">
                            </div>`:c+=`
                            <a href="${m.data}" target="_blank" class="btn btn-slate" style="font-size:0.7rem; padding: 4px 8px; display:inline-flex; align-items:center; gap: 4px;">
                                <i class="fa-solid fa-file-pdf"></i> ${M(m.name)}
                            </a>`}),c+="</div>"),o.innerHTML+=`
                <div class="comment-bubble ${a?"own-comment":""}">
                    <div class="comment-meta">
                        <span class="comment-author">${M(l)}</span>
                        <span>${Z(s.created_at)}</span>
                    </div>
                    <div class="comment-text">${M(s.comment)}</div>
                    ${c}
                </div>
            `}),o.scrollTop=o.scrollHeight}catch(t){console.error("loadComments error:",t),o.innerHTML='<div style="text-align: center; padding: 10px; color: var(--color-rose);">Failed to load comments history.</div>'}};window.submitComment=async function(e,o){if(e.preventDefault(),!u||!N)return;const t=document.getElementById("comment-new-text"),r=t.value.trim(),n=document.getElementById("comment-attachment"),i=document.querySelector("#comment-submit-form button[type='submit']");i.disabled=!0;try{let s=[];if(n&&n.files&&n.files[0]){const a=n.files[0],c=await we(a);s.push({name:a.name,type:a.type,data:c})}const{error:l}=await u.from("ticket_comments").insert({ticket_id:o,user_id:N,comment:r,attachments:s});if(l)throw l;t.value="",n&&(n.value=""),p("Comment added!","success"),await loadComments(o)}catch(s){console.error("submitComment error:",s),p("Failed to post comment.","error")}finally{i.disabled=!1}};function we(e){return new Promise((o,t)=>{const r=new FileReader;r.readAsDataURL(e),r.onload=()=>o(r.result),r.onerror=n=>t(n)})}function Re(e){const o=e.status,t=o==="Pending",r=o==="Recommended",n=o==="Approved",i=o==="Resolved",s=o==="Reopened";let l="completed",a=`Filed by ${M(e.creator_email)} on ${Z(e.created_at)}`;s?(l="active pulse-status",a=`Complaint reopened by complainer on ${Z(e.created_at)}.<br><strong>Reason:</strong> ${M(e.complainer_feedback||"")}`):t&&(l="active pulse-status");let c="",d="Awaiting Floor Manager review & recommendation.";e.recommended_at?(c="completed",d=`Recommended by Floor Manager (${M(e.floor_manager_email)}) on ${Z(e.recommended_at)}.<br><strong>Note:</strong> ${M(e.floor_manager_recommendation)}`):(t||s)&&(c="active pulse-status");let m="";const y=Array.isArray(e.committee_approvals)?e.committee_approvals.length:0;let f=`Awaiting Committee approvals (${y} of 3 approved).`;e.approved_at?(m="completed",f=`Approved by 3 Committee Members on ${Z(e.approved_at)}.<br><strong>Approvers:</strong> ${M(e.approver_emails.join(", "))}`):r&&(m="active pulse-status",y>0&&(f+=`<br><strong>Approved so far:</strong> ${M(e.approver_emails.join(", "))}`));let v="",w="Awaiting resolution actions by maintenance team/editor.";e.resolved_at?(v="completed",w=`Resolved by ${M(e.resolver_email)} on ${Z(e.resolved_at)}.<br><strong>Action Details:</strong> ${M(e.resolution_details)}`):n&&(v="active pulse-status");let g="",b="Awaiting resident closure acknowledgement.";return e.closed_at?(g="completed",b=`Closed on ${Z(e.closed_at)}.<br><strong>Resident Feedback:</strong> ${M(e.complainer_feedback||"No feedback provided.")}`):i&&(g="active pulse-status"),`
        <div class="workflow-step ${l}">
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
        <div class="workflow-step ${v}">
            <div class="workflow-step-title"><i class="fa-solid fa-wrench"></i> Step 4: Resolution Action</div>
            <div class="workflow-step-desc">${w}</div>
        </div>
        <div class="workflow-step ${g}">
            <div class="workflow-step-title"><i class="fa-solid fa-circle-check"></i> Step 5: Closure & Feedback</div>
            <div class="workflow-step-desc">${b}</div>
        </div>
    `}function Oe(e){const o=e.status,t=o==="Pending",r=o==="Recommended",n=o==="Approved",i=o==="Resolved",s=o==="Reopened",l=I,a=e.created_by===N,c=l==="admin",d=l==="floor_manager",m=l==="committee_member",y=l==="editor";let f="";if((d||c)&&(t||s)&&(f+=`
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
        `),(m||c)&&r){const v=Array.isArray(e.committee_approvals)?e.committee_approvals:[],w=v.includes(N);f+=`
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-violet); margin-bottom: 10px;"><i class="fa-solid fa-signature"></i> Committee Approval Action</h4>
        `,w?f+=`
                <div style="padding: 10px; background: rgba(139,92,246,0.05); border: 1px solid rgba(139,92,246,0.2); border-radius: var(--border-radius-sm); color: var(--color-violet); font-size: 0.85rem; text-align: center;">
                    <i class="fa-solid fa-circle-check"></i> You have already approved this complaint. Awaiting other members (${v.length} of 3 approved).
                </div>
            `:f+=`
                <button type="button" class="btn btn-violet btn-full" onclick="approveComplaint(${e.id})">
                    <i class="fa-solid fa-thumbs-up"></i> Approve Complaint (${v.length} of 3 approvals)
                </button>
            `,f+="</div>"}return(y||c)&&n&&(f+=`
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
        `),(a||c)&&i&&(f+=`
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
        `),f}window.handleCreateTicket=async function(e){if(e.preventDefault(),!u||!N){p("You must be logged in to file a complaint.","error");return}const o=document.getElementById("ticket-title").value.trim(),t=document.getElementById("ticket-category").value,r=document.getElementById("ticket-flat").value,n=document.getElementById("ticket-priority").value,i=document.getElementById("ticket-desc").value.trim(),s=document.getElementById("ticket-attachments"),l=document.querySelector("#new-ticket-form button[type='submit']");l.disabled=!0,l.textContent="Submitting...";try{let a=[];if(s&&s.files&&s.files[0]){const w=s.files[0],g=await we(w);a.push({name:w.name,type:w.type,data:g})}const{count:c,error:d}=await u.from("tickets").select("*",{count:"exact",head:!0});if(d)throw d;const m=c||0,f=`TKT-${new Date().getFullYear()}-${String(m+1).padStart(3,"0")}`,{error:v}=await u.from("tickets").insert({title:o,category:t,flat_no:r,priority:n,description:i,created_by:N,attachments:a,ticket_number:f,status:"Pending"});if(v)throw v;p(`Complaint filed! Assigned Ticket Number: ${f}`,"success"),closeModal("newTicketModal"),await loadTickets()}catch(a){console.error("handleCreateTicket error:",a),p(a.message||"Failed to submit complaint.","error")}finally{l.disabled=!1,l.textContent="Submit Ticket"}};window.submitRecommendation=async function(e,o){if(e.preventDefault(),!u)return;const t=document.getElementById("fm-recommend-text").value.trim(),r=document.querySelector("#fm-recommend-form button[type='submit']");r.disabled=!0,r.textContent="Submitting...";try{const{error:n}=await u.from("tickets").update({floor_manager_id:N,floor_manager_recommendation:t,recommended_at:new Date().toISOString(),status:"Recommended"}).eq("id",o);if(n)throw n;p("Recommendation submitted successfully!","success"),await loadTickets()}catch(n){console.error("submitRecommendation error:",n),p("Failed to submit recommendation.","error")}};window.approveComplaint=async function(e){if(!u||!N)return;const o=Q.find(i=>i.id===e);if(!o)return;const t=Array.isArray(o.committee_approvals)?[...o.committee_approvals]:[];if(t.includes(N)){p("You have already approved this ticket.","warning");return}t.push(N);const r=t.length>=3,n={committee_approvals:t};r&&(n.status="Approved",n.approved_at=new Date().toISOString());try{const{error:i}=await u.from("tickets").update(n).eq("id",e);if(i)throw i;p(r?"Approved! Ticket transitioned to Approved status.":`Approval recorded (${t.length}/3 approvals).`,"success"),await loadTickets()}catch(i){console.error("approveComplaint error:",i),p("Failed to record approval.","error")}};window.submitResolution=async function(e,o){if(e.preventDefault(),!u)return;const t=document.getElementById("editor-resolve-text").value.trim(),r=document.querySelector("#editor-resolve-form button[type='submit']");r.disabled=!0,r.textContent="Saving...";try{const{error:n}=await u.from("tickets").update({resolved_by:N,resolution_details:t,resolved_at:new Date().toISOString(),status:"Resolved"}).eq("id",o);if(n)throw n;p("Resolution details logged successfully!","success"),await loadTickets()}catch(n){console.error("submitResolution error:",n),p("Failed to save resolution details.","error")}};window.reopenTicket=async function(e){if(!u)return;const o=document.getElementById("complainer-feedback-text").value.trim();if(!o){p("Please provide comments explaining why you are reopening this complaint.","warning");return}try{const{error:t}=await u.from("tickets").update({status:"Reopened",complainer_feedback:o,floor_manager_id:null,floor_manager_recommendation:null,recommended_at:null,committee_approvals:[],approved_at:null,resolved_by:null,resolution_details:null,resolved_at:null,closed_at:null}).eq("id",e);if(t)throw t;p("Complaint reopened for further review.","info"),await loadTickets()}catch(t){console.error("reopenTicket error:",t),p("Failed to reopen ticket.","error")}};window.closeTicket=async function(e){if(!u)return;const o=document.getElementById("complainer-feedback-text").value.trim();try{const{error:t}=await u.from("tickets").update({status:"Closed",complainer_feedback:o||"Closed by resident.",closed_at:new Date().toISOString()}).eq("id",e);if(t)throw t;p("Complaint successfully acknowledged and closed.","success"),await loadTickets()}catch(t){console.error("closeTicket error:",t),p("Failed to close ticket.","error")}};async function He(){const e=document.getElementById("report-sheet");if(!(!e||!u))try{const{data:o,error:t}=await u.from("tickets").select("*");if(t)throw t;const r=o||[],n=r.length,i={},s={},l={};let a=0,c=0;r.forEach(g=>{if(i[g.category]=(i[g.category]||0)+1,s[g.status]=(s[g.status]||0)+1,l[g.priority||"Medium"]=(l[g.priority||"Medium"]||0)+1,g.resolved_at&&g.created_at){const b=new Date(g.resolved_at)-new Date(g.created_at);b>0&&(a++,c+=b)}});const d=a>0?c/a/(1e3*60*60):0,m=d>0?d<24?`${d.toFixed(1)} hrs`:`${(d/24).toFixed(1)} days`:"N/A";let y=`
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
                        <div style="display: flex; flex-direction: column; gap: 12px;">`;["plumbing","electrical","lift","security","cleanliness","billing","other"].forEach(g=>{const b=i[g]||0,h=n>0?b/n*100:0;y+=`
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                        <span style="text-transform: capitalize;">${g}</span>
                        <span style="font-weight: 600;">${b} (${h.toFixed(0)}%)</span>
                    </div>
                    <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${h}%; height: 100%; background: var(--color-yellow); border-radius: 4px;"></div>
                    </div>
                </div>`}),y+=`       </div>
                    </div>
                    
                    <!-- Priority Breakdown -->
                    <div>
                        <h3 style="font-size: 1.05rem; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">Complaints by Priority</h3>
                        <div style="display: flex; flex-direction: column; gap: 12px;">`;const v=["Low","Medium","High","Urgent"],w={Low:"#9ca3af",Medium:"var(--color-yellow)",High:"#f97316",Urgent:"var(--color-rose)"};v.forEach(g=>{const b=l[g]||0,h=n>0?b/n*100:0;y+=`
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                        <span>${g} Priority</span>
                        <span style="font-weight: 600;">${b}</span>
                    </div>
                    <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${h}%; height: 100%; background: ${w[g]||"var(--color-yellow)"}; border-radius: 4px;"></div>
                    </div>
                </div>`}),y+=`       </div>
                    </div>
                </div>
            </div>
        `,e.innerHTML=y}catch(o){console.error("renderHelpdeskReport error:",o),e.innerHTML='<div style="color:var(--color-rose); padding:20px; text-align:center;">Failed to generate helpdesk report summary.</div>'}}function M(e){return e?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}function Z(e){return e?new Date(e).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):""}window.switchAuthMode=function(e){const o=document.getElementById("btn-mode-soft"),t=document.getElementById("btn-mode-hard");o&&o.classList.toggle("active",e==="soft"),t&&t.classList.toggle("active",e==="hard");const r=document.getElementById("soft-login-form-wrapper"),n=document.getElementById("login-form-wrapper"),i=document.getElementById("register-form-wrapper");r&&(r.style.display=e==="soft"?"block":"none"),n&&(n.style.display=e==="hard"?"block":"none"),i&&(i.style.display="none")};window.handleSoftLoginSubmit=async function(e){if(e.preventDefault(),!u){p("Database not connected.","error");return}const o=document.getElementById("soft-flat-no").value.trim().toUpperCase(),t=document.getElementById("soft-verify-code").value.trim().toLowerCase(),r=document.getElementById("btn-soft-login-submit");r.disabled=!0,r.textContent="Verifying...",console.log("Starting verification for flat:",o,"with code:",t);try{console.log("Querying Supabase owners table via raw fetch...");const n=localStorage.getItem("supabaseUrl")||"https://xkpqkbberckxblkhseim.supabase.co",i=localStorage.getItem("supabaseKey")||"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE",s=`${n}/rest/v1/owners?flat_no=eq.${encodeURIComponent(o)}&select=*`,l=fetch(s,{method:"GET",headers:{apikey:i,Authorization:`Bearer ${i}`,"Content-Type":"application/json"}}),a=new Promise((g,b)=>setTimeout(()=>b(new Error("Raw fetch query timed out after 6 seconds.")),6e3));console.log("Waiting for raw fetch response...");const c=await Promise.race([l,a]);if(console.log("Raw fetch response received. Status:",c.status),!c.ok){const g=await c.text();throw new Error(`Database error (${c.status}): ${g}`)}const d=await c.json(),m=d&&d.length>0?d[0]:null;if(console.log("Owner details loaded via raw fetch:",m),!m)throw new Error("Flat details not found in registry.");const y=String(m.contact_no||"").trim().replace(/\D/g,""),f=t.replace(/\D/g,""),v=m.passcode?String(m.passcode).trim():"";if(console.log("Comparing input code with database contact:",y,"and passcode:",v),!(f&&y&&y.includes(f)||t&&v&&v===t))throw new Error("Verification code does not match. Please contact Administrator.");localStorage.setItem("isSoftLogin","true"),localStorage.setItem("currentFlatNo",o),p("Access Verified! Signing in...","success"),console.log("Soft login verified. Triggering background auth sync..."),await xe(o),console.log("Background auth sync completed.")}catch(n){console.error("handleSoftLoginSubmit error:",n),p(n.message||"Verification failed.","error")}finally{r.disabled=!1,r.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Verify & Sign In'}};async function ze(e,o){if(u)try{const t=document.getElementById("user-profile-badge"),r=document.getElementById("user-email-text"),n=document.getElementById("user-role-text");t&&r&&n&&(r.textContent=`Flat ${o}`,n.textContent="RESIDENT",n.className="badge",n.style.borderColor="var(--border-color)",n.style.color="var(--text-secondary)",t.style.display="inline-flex"),I="viewer",ae("viewer"),await ye(),oe(),ne(),U()}catch(t){console.error("handleSoftUserSession error:",t),p("Error retrieving flat details.","error")}}async function xe(e){if(!u)return;const o="resident_v2@deepsikha.in",t="resident123";try{const{error:r}=await u.auth.signInWithPassword({email:o,password:t});if(r){const{error:n}=await u.auth.signUp({email:o,password:t});if(n)throw n;const{error:i}=await u.auth.signInWithPassword({email:o,password:t});if(i)throw i}}catch(r){console.error("autoLoginSharedAccount error:",r),localStorage.removeItem("isSoftLogin"),localStorage.removeItem("currentFlatNo"),document.getElementById("auth-container").style.display="block",r.message&&r.message.toLowerCase().includes("invalid login credentials")?p("Soft Login blocked by Supabase. Please disable 'Confirm Email' in Supabase Auth Settings, or manually confirm 'resident@deepsikha.in' via SQL.","error"):p("Authentication failed: "+r.message,"error")}}window.openUsersModal=async function(){if(I!=="admin"){p("Access Denied. Only Admins can manage users.","error");return}openModal("usersModal");const e=document.getElementById("users-table-body");e.innerHTML='<tr><td colspan="3" style="text-align: center;">Loading users...</td></tr>';try{const{data:o,error:t}=await u.from("profiles").select("id, email, role").order("email");if(t)throw t;if(!o||o.length===0){e.innerHTML='<tr><td colspan="3" style="text-align: center;">No registered users found.</td></tr>';return}const r=[{value:"admin",label:"Admin"},{value:"floor_manager",label:"Floor Manager"},{value:"committee_member",label:"Committee Member"},{value:"editor",label:"Editor"},{value:"viewer",label:"Viewer"}];e.innerHTML="",o.forEach(n=>{const i=document.createElement("tr");let s=r.map(a=>`<option value="${a.value}" ${a.value===n.role?"selected":""}>${a.label}</option>`).join("");const l=n.id===N?'disabled title="Cannot change your own role"':"";i.innerHTML=`
                <td>${n.email}</td>
                <td>
                    <select id="role-select-${n.id}" class="filter-select" ${l}>
                        ${s}
                    </select>
                </td>
                <td>
                    <button class="btn btn-emerald" style="padding: 4px 8px; font-size: 0.8rem;" ${l} onclick="updateUserRole('${n.id}')">Save Role</button>
                </td>
            `,e.appendChild(i)})}catch(o){console.error("Error fetching users:",o),e.innerHTML='<tr><td colspan="3" style="text-align: center; color: red;">Failed to load users.</td></tr>',p("Error loading users.","error")}};window.updateUserRole=async function(e){if(I!=="admin"){p("Access Denied.","error");return}const t=document.getElementById(`role-select-${e}`).value;try{const{error:r}=await u.from("profiles").update({role:t}).eq("id",e);if(r)throw r;p("User role updated successfully!","success")}catch(r){console.error("Error updating user role:",r),p("Failed to update user role.","error")}};window.openPasswordModal=function(){document.getElementById("new-password").value="",document.getElementById("confirm-new-password").value="",openModal("passwordModal")};window.updateUserPassword=async function(){const e=document.getElementById("new-password").value,o=document.getElementById("confirm-new-password").value;if(e.length<6){p("Password must be at least 6 characters.","error");return}if(e!==o){p("Passwords do not match.","error");return}if(u)try{const{error:t}=await u.auth.updateUser({password:e});if(t)throw t;p("Password updated successfully!","success"),closeModal("passwordModal")}catch(t){console.error("Error updating password:",t),p("Failed to update password: "+t.message,"error")}};

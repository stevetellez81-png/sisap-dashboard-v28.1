let DB={countries:[],commercials:[],clients:[],analysts:[],projects:[],weeks:[],loads:[],users:[],roles:[],assignments:[]};
const TALENT_APTITUDE=["Dominio Técnico","Autonomía","Calidad","Resolución de Problemas","Aprendizaje"];
const TALENT_ATTITUDE=["Iniciativa","Resiliencia","Colaboración","Compromiso","Recepción de Feedback"];
let loadRows=[];let currentSession=null;let currentProfile=null;
let projectFilterState={analysts:new Set(),statuses:new Set(),countries:new Set()};
let loadFilterState={analysts:new Set(),clients:new Set(),statuses:new Set()};
document.addEventListener('DOMContentLoaded',async()=>{setupNav();document.addEventListener('click',closeMultiFilters);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeProjectModal?.();});const {data}=await db.auth.getSession();currentSession=data.session;if(currentSession){await bootApp();}else{showLogin();}});
async function bootApp(){showApp();await ensureProfile();applyPermissions();await loadAll();}
function showLogin(){loginScreen.classList.remove('hidden');appShell.classList.add('hidden')}
function showApp(){loginScreen.classList.add('hidden');appShell.classList.remove('hidden')}
async function login(){const email=v('loginEmail'),password=v('loginPassword');if(!email||!password)return toast('Ingrese correo y contraseña');const {data,error}=await db.auth.signInWithPassword({email,password});if(error)return toast(error.message);currentSession=data.session;await bootApp();}
async function logout(){await db.auth.signOut();currentSession=null;currentProfile=null;showLogin()}

async function bootstrapSignup() {
  const email = v('loginEmail');
  const password = v('loginPassword');
  if (!email || !password) {
    return toast('Ingrese correo y contraseña');
  }
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Administrador SISAP'
      }
    }
  });

  if (error) {
    console.error('ERROR SIGNUP:', error);
    alert(JSON.stringify(error));
    return;
}
  await db.from('app_users').insert([{
    email: email,
    name: 'Administrador SISAP',
    full_name: 'Administrador SISAP',
    status: 'Activo',
    can_dashboard: true,
    can_clients: true,
    can_analysts: true,
    can_projects: true,
    can_load: true,
    can_weeks: true,
    can_users: true
  }]);
  toast('Administrador creado correctamente. Ya puede iniciar sesión.');
}
async function ensureProfile(){
  const {data:{user}} = await db.auth.getUser();
  if(!user) return;
  const {data:profiles,error} = await db
    .from('app_users')
    .select('*, roles(name)')
    .eq('email', user.email)
    .limit(1);
  if(error) throw error;
  if(profiles && profiles.length){
    currentProfile = profiles[0];
    currentUserName.textContent = currentProfile.full_name || currentProfile.name || user.email;
    currentUserRole.textContent = currentProfile.roles?.name || 'Usuario';
    if(currentProfile.status !== 'Activo'){
      toast('Usuario inactivo');
      await logout();
    }
    return;
  }
  const {count} = await db
    .from('app_users')
    .select('*', {count:'exact', head:true});
  const {data:adminRole} = await db
    .from('roles')
    .select('*')
    .eq('name','Administrador')
    .single();

  const isFirst = (count || 0) === 0;
  const payload = {
    email: user.email,
    name: user.user_metadata?.full_name || user.email,
    full_name: user.user_metadata?.full_name || user.email,
    role_id: isFirst ? adminRole?.id : null,
    status: isFirst ? 'Activo' : 'Inactivo',
    can_dashboard: true,
    can_clients: isFirst,
    can_analysts: isFirst,
    can_projects: true,
    can_load: isFirst,
    can_weeks: isFirst,
    can_users: isFirst
  };
  const {data:newProfile,error:insertError} = await db
    .from('app_users')
    .insert([payload])
    .select('*, roles(name)')
    .single();
  if(insertError) throw insertError;
  currentProfile = newProfile;
  currentUserName.textContent = currentProfile.full_name || currentProfile.name || user.email;
  currentUserRole.textContent = currentProfile.roles?.name || 'Usuario';

  if(!isFirst){
    toast('Usuario inactivo. Un administrador debe habilitarlo.');
    await logout();
  }
}

function setupNav(){document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.view).classList.add('active');const t={dashboard:['Dashboard Ejecutivo','Cartera, capacidad semanal y alertas automáticas'],clients:['Clientes','Administración de clientes maestros'],commercials:['Comerciales','Administración de comerciales'],analysts:['Analistas','Capacidad y carga del equipo'],projects:['Proyectos','Tabla dinámica de cartera'],load:['Cargabilidad','Proyección semanal editable'],weeks:['Semanas','Administración de semanas'],talent:['Talento y Desempeño','Evaluación por consultor, producción y cuadrante'],users:['Usuarios','Administración de accesos y permisos']};pageTitle.textContent=t[b.dataset.view][0];pageSubtitle.textContent=t[b.dataset.view][1];});}
function applyPermissions(){document.querySelectorAll('.nav').forEach(b=>{const p=b.dataset.permission;if(p&&!currentProfile?.[p])b.classList.add('hidden');else b.classList.remove('hidden');});const first=document.querySelector('.nav:not(.hidden)');if(first){document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));first.classList.add('active');document.getElementById(first.dataset.view).classList.add('active');}}
async function loadAll(){try{
  const [countries,commercials,clients,analysts,projects,weeks,loads,roles,users,assignments]=await Promise.all([
    db.from('countries').select('*').order('code'),
    db.from('commercials').select('*').order('name'),
    db.from('clients').select('*, commercials(name)').order('name'),
    db.from('analysts').select('*').order('name'),
    db.from('projects').select('*, clients(name), commercials(name)').order('source_no'),
    db.from('weeks').select('*').order('start_date'),
    db.from('weekly_project_load').select('*, projects(id,name,client_id,status,clients(name)), analysts(id,name,weekly_capacity), weeks(id,week_label,start_date)').order('created_at'),
    db.from('roles').select('*').order('name'),
    db.from('app_users').select('*, roles(name)').order('full_name'),
    db.from('project_assignments').select('*, projects(id,name,status,created_at,client_id), analysts(id,name)').order('created_at')
  ]);
  [countries,commercials,clients,analysts,projects,weeks,loads,roles,users,assignments].forEach(r=>{if(r.error)throw r.error});
  DB={countries:countries.data||[],commercials:commercials.data||[],clients:clients.data||[],analysts:analysts.data||[],projects:projects.data||[],weeks:weeks.data||[],loads:loads.data||[],roles:roles.data||[],users:users.data||[],assignments:assignments.data||[]};
  buildLoadRows();renderAll();toast('Datos cargados');
}catch(e){console.error(e);toast('Error: '+e.message)}}
function renderAll(){fillSelects();renderDashboard();renderClients();renderCommercials();renderAnalysts();renderProjects();renderLoadMatrix();renderWeeks();renderTalent();renderUsers();renderSidebarStatusWidget();}
function fillSelects(){
  fill('clientCountry',DB.countries,'País','code',x=>countryLabel(x.code));fill('clientCommercial',activeCommercials(),'Comercial','id',x=>x.name);
  fill('userRole',DB.roles,'Rol','id',x=>x.name);
  fill('projectClient',DB.clients,'Seleccione cliente','id',x=>`${x.name} · ${normalizeCountry(x.country_code||x.country)}`);
  fill('projectCountry',DB.countries,'País','code',x=>countryLabel(x.code));
  fill('projectCommercial',activeCommercials(),'Comercial','id',x=>x.name);
  buildMultiFilter('filterAnalystBox','Analista',DB.analysts,'id',x=>x.name,projectFilterState.analysts,renderProjects);
  buildMultiFilter('filterStatusBox','Estado',[...new Set(DB.projects.map(p=>normalizeProjectStatus(p.status)).filter(Boolean).filter(x=>x!=='Suspendido'))].map(x=>({id:x,name:x})),'id',x=>x.name,projectFilterState.statuses,renderProjects);
  buildMultiFilter('filterCountryBox','País',DB.countries,'code',x=>countryLabel(x.code),projectFilterState.countries,renderProjects);
  const loadProjects=activeProjects();
  const loadClientIds=new Set(loadProjects.map(p=>p.client_id).filter(Boolean));
  const loadClients=DB.clients.filter(c=>loadClientIds.has(c.id));
  const loadStatuses=[...new Set(loadProjects.map(p=>normalizeProjectStatus(p.status)).filter(Boolean))].sort().map(x=>({id:x,name:x}));
  buildMultiFilter('loadFilterAnalystBox','Consultor',DB.analysts,'id',x=>x.name,loadFilterState.analysts,renderLoadMatrix);
  buildMultiFilter('loadFilterClientBox','Cliente',loadClients,'id',x=>x.name,loadFilterState.clients,renderLoadMatrix);
  buildMultiFilter('loadFilterStatusBox','Estado',loadStatuses,'id',x=>x.name,loadFilterState.statuses,renderLoadMatrix);
  fillTalentControls();
}
function fill(id,items,ph,val,txt){const e=document.getElementById(id);if(!e)return;const c=e.value;e.innerHTML=`<option value="">${ph}</option>`+items.map(x=>`<option value="${x[val]}">${esc(txt(x))}</option>`).join('');e.value=c}
function fillStatic(id,ph,items){const e=document.getElementById(id);if(!e)return;const c=e.value;e.innerHTML=`<option value="">${ph}</option>`+items.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');e.value=c}
function renderDashboard(){
  renderDashboardDateControls();
  renderWeekMonthControls();
  updateQuarterRangeLabel();
  const projects=dashboardProjects();
  const totalProjects=projects.length;
  const activeProjectList=projects.filter(p=>normalizeProjectStatus(p.status).toLowerCase()!=='finalizado');
  const activeClients=new Set(projects.map(p=>p.client_id).filter(Boolean)).size || DB.clients.filter(c=>(c.status||'Activo')==='Activo').length;
  const activeProjects=activeProjectList.length;
  const finalizedProjects=projects.filter(p=>normalizeProjectStatus(p.status).toLowerCase()==='finalizado').length;
  const activeAnalysts=DB.analysts.filter(a=>(a.status||'Activo')==='Activo').length;
  const risk=activeProjectList.filter(p=>{const h=num(p.contracted_hours||p.estimated_hours),c=num(p.consumed_hours);return h>0&&c<=h&&(c/h)>=.9}).length;
  const pending=activeProjectList.reduce((s,p)=>s+Math.max(0,num(p.contracted_hours||p.estimated_hours)-num(p.consumed_hours)),0);
  const weeks=displayWeeks('dashboard');
  const capTotal=DB.analysts.filter(a=>a.status==='Activo').reduce((s,a)=>s+num(a.weekly_capacity||44),0);
  const overloaded=new Set(capacityOverloads(weeks).filter(x=>x.level==='over').map(x=>x.analyst_id)).size;
  if(typeof kpiTotalProjects!=='undefined')animateNumber(kpiTotalProjects,totalProjects);
  animateNumber(kpiClients,activeClients);
  animateNumber(kpiProjects,activeProjects);
  if(typeof kpiCompletedProjects!=='undefined')animateNumber(kpiCompletedProjects,finalizedProjects);
  animateNumber(kpiAnalysts,activeAnalysts);
  if(typeof kpiRisk!=='undefined')animateNumber(kpiRisk,risk);
  animateNumber(kpiOver,overloaded);
  if(typeof kpiPendingHours!=='undefined')animateNumber(kpiPendingHours,Math.round(pending),'h');
  updateGlobalCompliance(activeProjectList,risk,overloaded);renderWeekSummary(weeks,capTotal);renderConsultantLoad(weeks);renderCapacityAlerts(dashboardAlertWeeks());renderCountryCards(projects);renderProjectAlerts(activeProjectList);renderAnalystProjectCounts(activeProjectList);renderSidebarStatusWidget();
}

function updateQuarterRangeLabel(){
  const el=document.getElementById('quarterRangeLabel');if(!el)return;
  const from=v('dashboardFrom'),to=v('dashboardTo'),year=v('dashboardYear');
  if(from&&to){el.textContent=`${fmtShort(from)} - ${fmtShort(to)}`;return;}
  if(year){el.textContent=`Año ${year}`;return;}
  el.textContent='Vista acumulada de cartera';
}
function fmtShort(d){const dt=new Date(d+'T00:00:00');return dt.toLocaleDateString('es-NI',{month:'short',day:'numeric',year:'numeric'}).replace('.', '');}
function updateGlobalCompliance(projects,risk,overloaded){
  const el=document.getElementById('globalComplianceBadge');if(!el)return;
  const total=Math.max(projects.length,1);
  const score=Math.max(0,Math.round(100-((risk/total)*45)-(overloaded*6)));
  el.textContent=score+'%';
  el.className='compliance-badge '+(score>=85?'green':score>=70?'amber':'red');
}
function renderSidebarStatusWidget(){
  const box=document.getElementById('sidebarStatusWidget');if(!box)return;
  const counts={};DB.projects.forEach(p=>{const st=normalizeProjectStatus(p.status)||'Sin estado';counts[st]=(counts[st]||0)+1});
  const total=Object.values(counts).reduce((s,n)=>s+n,0)||1;
  box.innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([st,n])=>`<div class="status-mini-row"><span>${esc(st)}</span><b>${n}</b><i style="width:${Math.round(n/total*100)}%"></i></div>`).join('')||'<small>Sin proyectos</small>';
}

function renderDashboardDateControls(){
  const year=document.getElementById('dashboardYear');
  if(!year||year.options.length>1)return;
  const years=[...new Set(DB.projects.map(p=>projectYear(p)).filter(Boolean))].sort((a,b)=>b-a);
  year.innerHTML='<option value="">Todos los años</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join('');
  const current=new Date().getFullYear(); if(years.includes(current))year.value=String(current);
}
function dashboardProjects(){
  const y=v('dashboardYear'),from=v('dashboardFrom'),to=v('dashboardTo');
  return DB.projects.filter(p=>{
    const d=projectDate(p); if(!d)return !y&&!from&&!to;
    if(y && d.getFullYear()!==Number(y))return false;
    if(from && d<new Date(from+'T00:00:00'))return false;
    if(to && d>new Date(to+'T23:59:59'))return false;
    return true;
  });
}
function projectDate(p){const raw=p.start_date||p.created_at||p.fecha_ingreso||p.end_date;const d=raw?new Date(raw):null;return d&&!isNaN(d)?d:null}
function projectYear(p){const d=projectDate(p);return d?d.getFullYear():null}
function renderWeekSummary(weeks,capTotal){weekSummary.innerHTML=weeks.map(w=>{const h=sumWeek(w.id);const p=new Set(DB.loads.filter(l=>l.week_id===w.id&&num(l.planned_hours)>0&&isActiveLoad(l)).map(l=>l.project_id)).size;const pct=capTotal?Math.round(h/capTotal*100):0;return `<div class="week-card"><h4>${esc(w.week_label)}</h4><small>${p} proyectos</small><strong>${Math.round(h)}h</strong><div class="bar"><div style="width:${Math.min(pct,100)}%"></div></div><small>${pct}% de capacidad equipo</small></div>`}).join('')}
function renderConsultantLoad(weeks){
  const rows=capacityRows(weeks);
  const headWeeks=weeks.map(w=>`<th title="${esc(w.week_label)}">${esc(shortWeek(w.week_label))}</th>`).join('');
  const bodyRows=rows.map(r=>{
    const min=Math.min(...r.values.map(v=>r.capacity-v.hours));
    const weekCells=r.values.map(v=>`<td><span class="heat-pill ${pillClass(v.hours,r.capacity)}" title="${esc(v.week)}">${Math.round(v.hours)}h</span></td>`).join('');
    const available=Math.round(min);
    return `<tr>
      <td class="heat-consultant"><div class="heat-consultant-main"><button class="expand-dot" title="Ver proyectos">+</button><strong>${esc(r.name)}</strong></div><small>Cap. ${Math.round(r.capacity)}h/sem</small></td>
      ${weekCells}
      <td><span class="heat-available ${available<=0?'full':available<=5?'warn':''}">${available>0?'+':''}${available}h</span></td>
    </tr>`;
  }).join('');

  consultantLoad.innerHTML=`<div class="heatmap-shell"><table class="heatmap-table"><thead><tr><th>Consultor</th>${headWeeks}<th>Disponible</th></tr></thead><tbody>${bodyRows || '<tr><td colspan="10">Sin información de capacidad.</td></tr>'}</tbody></table></div>`;
}
function capacityOverloads(weeks){const items=[];capacityRows(weeks).forEach(r=>r.values.forEach(v=>{const cap=num(r.capacity);const hours=num(v.hours);if(!cap)return;const pct=Math.round(hours/cap*100);if(hours>cap)items.push({level:'over',analyst_id:r.id,name:r.name,week:v.week,hours,capacity:cap,excess:hours-cap,pct});else if(hours>=cap*.9)items.push({level:'warn',analyst_id:r.id,name:r.name,week:v.week,hours,capacity:cap,excess:0,pct});}));return items}
function renderCapacityAlerts(weeks){
  const alerts=capacityOverloads(weeks).sort((a,b)=>a.level===b.level?b.pct-a.pct:a.level==='over'?-1:1);
  capacityAlerts.innerHTML=alerts.map(a=>`<div class="alert-card ${a.level==='warn'?'warn':'over'}"><div class="alert-icon">${a.level==='over'?'!':'⚠'}</div><div><strong>${esc(a.name)}</strong><span>${esc(shortWeek(a.week))} · ${a.level==='over'?'Crítica':'Advertencia'}</span></div><div class="alert-metric"><b>${Math.round(a.hours)}h / ${Math.round(a.capacity)}h</b><small>${a.pct}%${a.level==='over'?` · Exceso ${Math.round(a.excess)}h`:''}</small></div><button class="mini-btn blue" onclick="document.querySelector('[data-view=load]')?.click()">Ver detalles y reasignar</button></div>`).join('')||'<small>Sin alertas para la semana corriente</small>'
}
function renderCountryCards(projects=DB.projects){const counts={};projects.forEach(p=>{const code=normalizeCountry(p.country_code);counts[code]=(counts[code]||0)+1});countryCards.innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([code,total])=>{const c=country(code);return `<div class="country"><div class="flag">${flagFor(code)}</div><strong>${code}</strong><small>${c.name||code}</small><b>${total}<br>proyectos</b></div>`}).join('')}
function renderProjectAlerts(projects=DB.projects){
  const arr=projects.map(p=>({p,pct:percent(p)})).filter(x=>x.pct>=90).sort((a,b)=>b.pct-a.pct).slice(0,12);
  projectAlerts.innerHTML=arr.map(x=>{const code=normalizeCountry(x.p.country_code);const cls=x.pct>100?'':'warn';return `<div class="alert ${cls}"><strong>${flagFor(code)} ${code} · ${esc(x.p.clients?.name||'-')}</strong><br><span>${esc(x.p.name)}</span><br><small>${Math.round(x.pct)}% consumido · ${Math.round(num(x.p.consumed_hours))}/${Math.round(num(x.p.contracted_hours||x.p.estimated_hours))}h · ${esc(x.p.status||'-')}</small></div>`}).join('')||'<small>Sin proyectos en riesgo</small>';
}
function renderClients(){clientsTable.innerHTML=DB.clients.map(c=>{const proy=DB.projects.filter(p=>p.client_id===c.id).length;const code=normalizeCountry(c.country_code||c.country);return `<tr><td><strong>${esc(c.name)}</strong></td><td>${flagFor(code)} ${esc(code||'-')}</td><td>${esc(c.commercials?.name||'-')}</td><td><span class="badge ${c.status==='Activo'?'green':'red'}">${esc(c.status||'-')}</span></td><td>${proy}</td><td class="actions"><button class="mini-btn" onclick="editClient('${c.id}')">Editar</button><button class="mini-btn delete" onclick="disableClient('${c.id}')">Inactivar</button></td></tr>`}).join('')}
async function saveClient(){
  const id=clientId.value;
  const payload={name:v('clientName'),country_code:normalizeCountry(v('clientCountry')),commercial_id:v('clientCommercial')||null,status:v('clientStatus'),observation:v('clientObservation')};
  if(!payload.name)return toast('Nombre requerido');
  let r;
  if(id){
    r=await db.from('clients').update(payload).eq('id',id).select('id').single();
  }else{
    r=await db.from('clients').insert([payload]).select('id').single();
  }
  if(r.error)return toast(r.error.message);
  const clientSavedId=r.data?.id||id;
  if(clientSavedId){
    const pr=await db.from('projects').update({country_code:payload.country_code,commercial_id:payload.commercial_id}).eq('client_id',clientSavedId);
    if(pr.error){console.error(pr.error);return toast('Cliente guardado, pero no se pudieron actualizar proyectos: '+pr.error.message)}
  }
  clearClient();await loadAll();toast(id?'Cliente actualizado y proyectos sincronizados':'Cliente creado')
}
function editClient(id){const c=DB.clients.find(x=>x.id===id);clientId.value=c.id;clientName.value=c.name||'';clientCountry.value=normalizeCountry(c.country_code)||'';clientCommercial.value=c.commercial_id||'';clientStatus.value=c.status||'Activo';clientObservation.value=c.observation||''}
async function disableClient(id){await db.from('clients').update({status:'Inactivo'}).eq('id',id);await loadAll()}function clearClient(){clientId.value='';clientName.value='';clientCountry.value='';clientCommercial.value='';clientStatus.value='Activo';clientObservation.value=''}
function activeCommercials(){return DB.commercials.filter(c=>(c.status||'Activo')==='Activo')}
function renderCommercials(){
  const table=document.getElementById('commercialsTable');if(!table)return;
  table.innerHTML=DB.commercials.map(c=>{const clients=DB.clients.filter(x=>x.commercial_id===c.id).length;const projects=DB.projects.filter(x=>x.commercial_id===c.id).length;return `<tr><td><strong>${esc(c.name)}</strong></td><td><span class="badge ${(c.status||'Activo')==='Activo'?'green':'red'}">${esc(c.status||'Activo')}</span></td><td>${clients}</td><td>${projects}</td><td class="actions"><button class="mini-btn" onclick="editCommercial('${c.id}')">Editar</button><button class="mini-btn delete" onclick="disableCommercial('${c.id}')">Inactivar</button><button class="mini-btn danger" onclick="deleteCommercial('${c.id}')">Eliminar</button></td></tr>`}).join('')||'<tr><td colspan="5">Sin comerciales.</td></tr>';
}
async function saveCommercial(){const id=commercialId.value;const payload={name:v('commercialName'),status:v('commercialStatus')||'Activo'};if(!payload.name)return toast('Nombre requerido');const duplicate=DB.commercials.some(c=>c.id!==id&&norm(c.name)===norm(payload.name));if(duplicate)return toast('Ese comercial ya existe');const r=id?await db.from('commercials').update(payload).eq('id',id):await db.from('commercials').insert([payload]);if(r.error)return toast(r.error.message);clearCommercial();await loadAll()}
function editCommercial(id){const c=DB.commercials.find(x=>x.id===id);if(!c)return;commercialId.value=c.id;commercialName.value=c.name||'';commercialStatus.value=c.status||'Activo'}
function clearCommercial(){commercialId.value='';commercialName.value='';commercialStatus.value='Activo'}
async function disableCommercial(id){const {error}=await db.from('commercials').update({status:'Inactivo'}).eq('id',id);if(error)return toast(error.message);await loadAll()}
async function deleteCommercial(id){const c=DB.commercials.find(x=>x.id===id);if(!c)return;const hasClients=DB.clients.some(x=>x.commercial_id===id);const hasProjects=DB.projects.some(x=>x.commercial_id===id);if(hasClients||hasProjects){alert('No se puede eliminar porque tiene clientes o proyectos asociados. Se puede inactivar.');return;}if(!confirm(`¿Eliminar comercial ${c.name}?`))return;const {error}=await db.from('commercials').delete().eq('id',id);if(error)return toast(error.message);await loadAll()}
function norm(s){return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[-–—]/g,' ').replace(/\s+/g,' ')}
function renderAnalystProjectCounts(projects=DB.projects){
  const box=document.getElementById('analystProjectCounts');if(!box)return;
  const allowed=new Set(projects.map(p=>p.id));
  const rows=DB.analysts.filter(a=>(a.status||'Activo')==='Activo').map(a=>{
    const asg=DB.assignments.filter(x=>x.analyst_id===a.id&&allowed.has(x.project_id));
    const leader=new Set(asg.filter(x=>x.role==='Líder').map(x=>x.project_id)).size;
    const support=new Set(asg.filter(x=>x.role!=='Líder').map(x=>x.project_id)).size;
    const total=new Set(asg.map(x=>x.project_id)).size;
    return {name:a.name,leader,support,total};
  }).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
  box.innerHTML=rows.map(r=>`<div class="analyst-count-row"><strong>${esc(r.name)}</strong><span>${r.total} proyectos</span><small>Líder: ${r.leader} · Apoyo: ${r.support}</small></div>`).join('')||'<small>Sin asignaciones.</small>';
}
function renderAnalysts(){analystsTable.innerHTML=DB.analysts.map(a=>{const p=new Set(DB.loads.filter(l=>l.analyst_id===a.id).map(l=>l.project_id)).size;return `<tr><td><strong>${esc(a.name)}</strong></td><td>${esc(a.email||'-')}</td><td>${esc(a.role||'-')}</td><td>${Math.round(num(a.weekly_capacity||44))}</td><td>${p}</td><td><span class="badge ${a.status==='Activo'?'green':'red'}">${esc(a.status||'-')}</span></td><td class="actions"><button class="mini-btn" onclick="editAnalyst('${a.id}')">Editar</button><button class="mini-btn delete" onclick="disableAnalyst('${a.id}')">Inactivar</button><button class="mini-btn danger" onclick="deleteAnalyst('${a.id}')">Eliminar</button></td></tr>`}).join('')}
async function saveAnalyst(){const id=analystId.value;const payload={name:v('analystName'),email:v('analystEmail'),role:v('analystRole'),weekly_capacity:Math.round(num(v('analystCapacity')||44)),status:v('analystStatus')};if(!payload.name)return toast('Nombre requerido');const r=id?await db.from('analysts').update(payload).eq('id',id):await db.from('analysts').insert([payload]);if(r.error)return toast(r.error.message);clearAnalyst();await loadAll()}
function editAnalyst(id){const a=DB.analysts.find(x=>x.id===id);analystId.value=a.id;analystName.value=a.name||'';analystEmail.value=a.email||'';analystRole.value=a.role||'';analystCapacity.value=Math.round(num(a.weekly_capacity||44));analystStatus.value=a.status||'Activo'}async function disableAnalyst(id){await db.from('analysts').update({status:'Inactivo'}).eq('id',id);await loadAll()}async function deleteAnalyst(id){const a=DB.analysts.find(x=>x.id===id);if(!a)return;if(!confirm(`¿Eliminar definitivamente a ${a.name}?`))return;if(DB.loads.some(l=>l.analyst_id===id)){alert('No puede eliminarse porque tiene proyectos asignados.');return;}const {error}=await db.from('analysts').delete().eq('id',id);if(error)return toast(error.message);await loadAll()}function clearAnalyst(){analystId.value='';analystName.value='';analystEmail.value='';analystRole.value='';analystCapacity.value=44;analystStatus.value='Activo'}
function renderProjects(){
  const q=v('projectSearch').toLowerCase();
  const fa=projectFilterState.analysts,fs=projectFilterState.statuses,fc=projectFilterState.countries;
  let rows=DB.projects.filter(p=>{const txt=[p.clients?.name,p.name,p.commercials?.name,p.commercial,p.observation].join(' ').toLowerCase();const anIds=DB.assignments.filter(l=>l.project_id===p.id).map(l=>l.analyst_id);const code=normalizeCountry(p.country_code);return(!q||txt.includes(q))&&(fa.size===0||anIds.some(id=>fa.has(id)))&&(fs.size===0||fs.has(p.status))&&(fc.size===0||fc.has(code))});
  visibleProjects.textContent=rows.length;
  projectsTable.innerHTML=rows.map(p=>{const pct=Math.round(percent(p));const code=normalizeCountry(p.country_code);const rowClass=pct>100?'overloaded':pct>=90?'risk':'';const pctClass=pct>100?'pct-over':pct>=90?'pct-risk':'pct-ok';const st=(p.status||'').toLowerCase().includes('ejec')?'blue':(p.status||'').toLowerCase().includes('final')?'green':'';return `<tr class="${rowClass}"><td><input type="checkbox"></td><td class="country-cell">${flagFor(code)} ${esc(code||'-')}</td><td class="client-name">${esc(p.clients?.name||'-')}</td><td class="project-name">${esc(p.name)}</td><td>${Math.round(num(p.contracted_hours||p.estimated_hours))}</td><td>${Math.round(num(p.consumed_hours))}</td><td><span class="pct-pill ${pctClass}">${pct}%</span></td><td>${esc(projectAnalysts(p.id)||'-')}</td><td class="project-status-cell"><span class="badge ${st}">${esc(p.status||'-')}</span></td><td class="project-observation-cell">${esc(p.observation||'-')}</td><td class="project-actions-cell"><button class="mini-btn" onclick="openProjectModal('${p.id}')">Editar</button><button class="mini-btn delete" onclick="deleteProject('${p.id}')">Eliminar</button></td></tr>`}).join('')||'<tr><td colspan="11">Sin proyectos para mostrar.</td></tr>';
}
function buildLoadRows(){
  renderWeekMonthControls();
  const weeks=displayWeeks('load');
  const visibleWeekIds=new Set(weeks.map(w=>w.id));
  const activeIds=new Set(activeProjects().map(p=>p.id));
  const map=new Map();

  // V29.5: Cargabilidad es planeación de capacidad, no asignación formal.
  // La fuente principal es weekly_project_load: Analista + Proyecto + Semana + Horas presupuestadas.
  // project_assignments se usa en Proyectos, no para decidir qué puede presupuestarse aquí.
  DB.loads
    .filter(l=>l.analyst_id&&l.project_id&&activeIds.has(l.project_id)&&visibleWeekIds.has(l.week_id))
    .forEach(l=>{
      const key=`${l.analyst_id}|${l.project_id}`;
      if(!map.has(key))map.set(key,{analyst_id:l.analyst_id,project_id:l.project_id,hours:{}});
      map.get(key).hours[l.week_id]=Math.round(num(l.planned_hours));
    });

  // Oculta ruido heredado: filas existentes con 0h en todas las semanas visibles.
  // Si el usuario quiere proyectar un caso nuevo, usa Agregar fila.
  loadRows=[...map.values()].filter(r=>weeks.some(w=>num(r.hours[w.id])>0)).sort(sortLoadRows);
  if(loadRows.length===0 && activeProjects().length && activeAnalysts().length)addLoadRow(false);
}
function sortLoadRows(a,b){
  const an=(DB.analysts.find(x=>x.id===a.analyst_id)?.name||'').localeCompare(DB.analysts.find(x=>x.id===b.analyst_id)?.name||'');
  if(an!==0)return an;
  const pa=DB.projects.find(x=>x.id===a.project_id),pb=DB.projects.find(x=>x.id===b.project_id);
  const ca=DB.clients.find(x=>x.id===pa?.client_id)?.name||'';
  const cb=DB.clients.find(x=>x.id===pb?.client_id)?.name||'';
  return ca.localeCompare(cb)||(pa?.name||'').localeCompare(pb?.name||'');
}
function normalizeProjectStatus(status){
  const clean=String(status||'').trim();
  const low=clean.toLowerCase();
  if(low==='suspendido')return 'En pausa';
  if(low==='en ejecucion')return 'En ejecución';
  return clean;
}
function isLoadableProject(p){
  const st=normalizeProjectStatus(p?.status).toLowerCase();
  return st && st!=='finalizado' && st!=='en pausa' && st!=='suspendido';
}
function activeProjects(){return DB.projects.filter(isLoadableProject)}
function activeAnalysts(){return DB.analysts.filter(a=>(a.status||'Activo')==='Activo')}
function renderLoadMatrix(){
  renderWeekMonthControls();
  const weeks=displayWeeks('load'),q=v('loadSearch').toLowerCase();
  const fa=loadFilterState.analysts,fc=loadFilterState.clients,fs=loadFilterState.statuses;
  loadHead.innerHTML=`<tr><th>Consultor</th><th>Cliente</th><th>Proyecto</th>${weeks.map(w=>`<th title="${esc(w.week_label)}">${esc(shortWeek(w.week_label))}</th>`).join('')}<th></th></tr>`;
  const filtered=loadRows.map((r,idx)=>({r,idx})).filter(({r})=>{
    const a=DB.analysts.find(x=>x.id===r.analyst_id),p=DB.projects.find(x=>x.id===r.project_id),c=DB.clients.find(x=>x.id===p?.client_id);
    const txt=[a?.name,c?.name,p?.name,normalizeProjectStatus(p?.status)].join(' ').toLowerCase();
    const st=normalizeProjectStatus(p?.status);
    return p&&isLoadableProject(p)&&(!q||txt.includes(q))&&(fa.size===0||fa.has(r.analyst_id))&&(fc.size===0||fc.has(p?.client_id))&&(fs.size===0||fs.has(st));
  });
  loadBody.innerHTML=filtered.map(({r,idx})=>{const p=DB.projects.find(x=>x.id===r.project_id);return `<tr><td>${selectHtml('analyst',idx,activeAnalysts(),r.analyst_id)}</td><td>${selectHtml('client',idx,DB.clients,p?.client_id||'')}</td><td>${selectHtml('project',idx,activeProjects(),r.project_id)}</td>${weeks.map(w=>`<td><input type="number" min="0" step="1" value="${Math.round(num(r.hours[w.id]||0))}" onchange="setLoadHour(${idx},'${w.id}',this.value)"></td>`).join('')}<td><button class="mini-btn" onclick="removeLoadRow(${idx})">Borrar</button></td></tr>`}).join('')||'<tr><td colspan="20">Sin cargas activas para mostrar.</td></tr>';
}
function selectHtml(type,i,items,value){const onchange=type==='analyst'?`loadRows[${i}].analyst_id=this.value`:type==='project'?`loadRows[${i}].project_id=this.value`:`changeLoadClient(${i},this.value)`;return `<select onchange="${onchange}">${items.map(x=>`<option value="${x.id}" ${x.id===value?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`}
function changeLoadClient(i,cid){const p=activeProjects().find(x=>x.client_id===cid);if(p)loadRows[i].project_id=p.id;renderLoadMatrix()}
function setLoadHour(i,wid,val){loadRows[i].hours[wid]=Math.max(0,Math.round(num(val)))}
function addLoadRow(render=true){loadRows.push({analyst_id:activeAnalysts()[0]?.id||DB.analysts[0]?.id||'',project_id:activeProjects()[0]?.id||'',hours:{}});if(render)renderLoadMatrix()}
function removeLoadRow(i){loadRows.splice(i,1);renderLoadMatrix()}
function clearLoadFilters(){loadSearch.value='';loadFilterState.analysts.clear();loadFilterState.clients.clear();loadFilterState.statuses.clear();fillSelects();renderLoadMatrix()}
async function saveLoadMatrix(){
  const weeks=displayWeeks('load'),activeIds=new Set(activeProjects().map(p=>p.id));
  const payload=[];
  loadRows.filter(r=>r.analyst_id&&r.project_id&&activeIds.has(r.project_id)).forEach(r=>weeks.forEach(w=>payload.push({analyst_id:r.analyst_id,project_id:r.project_id,week_id:w.id,planned_hours:Math.round(num(r.hours[w.id]||0)),real_hours:0})));
  if(payload.length===0)return toast('No hay cargas válidas para guardar');
  const r=await db.from('weekly_project_load').upsert(payload,{onConflict:'project_id,analyst_id,week_id'});
  if(r.error){console.error(r.error);return toast(r.error.message)}
  await loadAll();toast('Proyección guardada y actualizada')
}
async function saveWeek(){
  const month=Number(v('weekMonth'));
  const year=Number(v('weekYear'));
  if(!month||!year)return toast('Seleccione mes y año');
  const payload=generateWeeksForMonth(year,month);
  const existingLabels=new Set(DB.weeks.map(w=>norm(w.week_label)));
  const existingDates=new Set(DB.weeks.map(w=>`${w.start_date}|${w.end_date}`));
  const rows=payload.filter(w=>!existingLabels.has(norm(w.week_label))&&!existingDates.has(`${w.start_date}|${w.end_date}`));
  if(rows.length===0)return toast('Las semanas de ese mes ya existen');
  const r=await db.from('weeks').insert(rows);
  if(r.error)return toast(r.error.message);
  await loadAll();toast(`${rows.length} semanas generadas automáticamente`)
}
function generateWeeksForMonth(year,month){
  const monthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const first=new Date(year,month-1,1);
  const last=new Date(year,month,0);
  const rows=[];
  let start=new Date(first);
  let i=1;
  while(start<=last){
    const end=new Date(start);
    end.setDate(end.getDate()+6);
    if(end>last)end.setTime(last.getTime());
    rows.push({
      week_label:`Semana ${i} - ${monthNames[month-1]} ${year}`,
      start_date:toISODate(start),
      end_date:toISODate(end)
    });
    start=new Date(end);
    start.setDate(start.getDate()+1);
    i++;
  }
  return rows;
}
function toISODate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function renderWeeks(){weeksTable.innerHTML=DB.weeks.map(w=>`<tr><td>${esc(w.week_label)}</td><td>${fmt(w.start_date)}</td><td>${fmt(w.end_date)}</td><td><button class="mini-btn delete" onclick="deleteWeek('${w.id}')">Eliminar</button></td></tr>`).join('')}async function deleteWeek(id){const w=DB.weeks.find(x=>x.id===id);if(!w)return;if(!confirm(`¿Eliminar la semana "${w.week_label}"?`))return;if(DB.loads.some(l=>l.week_id===id)){alert('No puede eliminarse porque tiene cargas registradas.');return;}const {error}=await db.from('weeks').delete().eq('id',id);if(error)return toast(error.message);await loadAll()}

function fillTalentControls(){
  const analyst=document.getElementById('talentAnalyst');
  if(analyst){
    const current=analyst.value;
    const active=DB.analysts.filter(a=>(a.status||'Activo')==='Activo');
    analyst.innerHTML=active.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
    analyst.value=active.some(a=>a.id===current)?current:(active[0]?.id||'');
  }
  const year=document.getElementById('talentYear');
  if(year){
    const current=year.value||String(new Date().getFullYear());
    const years=new Set([new Date().getFullYear(),2025,2026,2027]);
    DB.weeks.forEach(w=>{if(w.start_date)years.add(new Date(w.start_date+'T00:00:00').getFullYear())});
    DB.projects.forEach(p=>{if(p.created_at)years.add(new Date(p.created_at).getFullYear())});
    year.innerHTML=[...years].sort((a,b)=>b-a).map(y=>`<option value="${y}">${y}</option>`).join('');
    year.value=[...years].map(String).includes(String(current))?current:String([...years].sort((a,b)=>b-a)[0]||new Date().getFullYear());
  }
}
function talentStorage(){try{return JSON.parse(localStorage.getItem('sisapTalentReviews')||'{}')}catch(e){return {}}}
function saveTalentStorage(data){localStorage.setItem('sisapTalentReviews',JSON.stringify(data||{}))}
function talentKey(analystId,year,quarter){return `${analystId}|${year}|${quarter}`}
function talentPeriod(){
  const y=Number(document.getElementById('talentYear')?.value||new Date().getFullYear());
  const q=Number(document.getElementById('talentQuarter')?.value||0);
  const start=q?new Date(y,(q-1)*3,1):new Date(y,0,1);
  const end=q?new Date(y,q*3,0):new Date(y,11,31);
  start.setHours(0,0,0,0);end.setHours(23,59,59,999);
  return {year:y,quarter:q,start,end,label:q?`Q${q} ${y}`:`Año ${y}`};
}
function weeksInTalentPeriod(){const p=talentPeriod();return DB.weeks.filter(w=>{if(!w.start_date)return false;const d=new Date(w.start_date+'T00:00:00');return d>=p.start&&d<=p.end;})}
function loadReview(analystId,year,quarter){return talentStorage()[talentKey(analystId,year,quarter)]||null}
function currentTalentReview(){const p=talentPeriod();return loadReview(document.getElementById('talentAnalyst')?.value,p.year,p.quarter)}
function talentScoresFromReview(r){
  const apt=TALENT_APTITUDE.reduce((s,q)=>s+num(r?.aptitude?.[q]||0),0);
  const att=TALENT_ATTITUDE.reduce((s,q)=>s+num(r?.attitude?.[q]||0),0);
  return {aptitude:apt,attitude:att};
}
function talentQuadrant(aptitude,attitude){
  if(aptitude>=16&&attitude>=16)return {key:'star',label:'⭐ ESTRELLA',desc:'Alta Aptitud / Alta Actitud. Delegar, dar autonomía y preparar liderazgo.'};
  if(aptitude<16&&attitude>=16)return {key:'potential',label:'🌱 APRENDIZ',desc:'Baja Aptitud / Alta Actitud. Requiere capacitación técnica y acompañamiento.'};
  if(aptitude>=16&&attitude<16)return {key:'difficult',label:'⚠️ CÍNICO',desc:'Alta Aptitud / Baja Actitud. Requiere feedback de comportamiento y seguimiento cercano.'};
  return {key:'low',label:'🚨 PROBLEMA',desc:'Baja Aptitud / Baja Actitud. Requiere plan de mejora urgente.'};
}
function talentProduction(analystId){
  const weekIds=new Set(weeksInTalentPeriod().map(w=>w.id));
  const periodLoads=DB.loads.filter(l=>l.analyst_id===analystId&&weekIds.has(l.week_id)&&isActiveLoad(l));
  const loadProjectIds=new Set(periodLoads.map(l=>l.project_id).filter(Boolean));
  const assignedProjectIds=new Set(DB.assignments.filter(a=>a.analyst_id===analystId).map(a=>a.project_id));
  const projectIds=new Set([...loadProjectIds]);
  if(projectIds.size===0)assignedProjectIds.forEach(id=>projectIds.add(id));
  const projects=[...projectIds].map(id=>DB.projects.find(p=>p.id===id)).filter(Boolean);
  const hours=periodLoads.reduce((s,l)=>s+num(l.planned_hours),0);
  const closed=projects.filter(p=>normalizeProjectStatus(p.status).toLowerCase()==='finalizado').length;
  const pending=projects.filter(p=>normalizeProjectStatus(p.status).toLowerCase()!=='finalizado').length;
  const clients=new Set(projects.map(p=>p.client_id).filter(Boolean)).size;
  const leader=DB.assignments.filter(a=>a.analyst_id===analystId&&a.role==='Líder'&&projectIds.has(a.project_id)).length;
  const support=DB.assignments.filter(a=>a.analyst_id===analystId&&a.role!=='Líder'&&projectIds.has(a.project_id)).length;
  const projectRows=projects.map(p=>{
    const assignment=DB.assignments.find(a=>a.project_id===p.id&&a.analyst_id===analystId);
    const projectHours=periodLoads.filter(l=>l.project_id===p.id).reduce((s,l)=>s+num(l.planned_hours),0);
    return {project:p,role:assignment?.role||'-',hours:projectHours};
  }).sort((a,b)=>b.hours-a.hours||String(a.project.name).localeCompare(String(b.project.name)));
  return {projects,projectRows,total:projects.length,closed,pending,clients,hours,leader,support};
}
function renderTalent(){
  fillTalentControls();
  renderTalentQuestions();
  const analystId=document.getElementById('talentAnalyst')?.value;
  if(!analystId)return;
  const p=talentPeriod();
  const store=talentStorage();
  const counts={star:0,potential:0,difficult:0,low:0};
  const active=DB.analysts.filter(a=>(a.status||'Activo')==='Activo');
  const rows=active.map(a=>{
    const r=store[talentKey(a.id,p.year,p.quarter)];
    const scores=talentScoresFromReview(r);
    const has=r&&scores.aptitude>0&&scores.attitude>0;
    const q=has?talentQuadrant(scores.aptitude,scores.attitude):{key:'none',label:'Sin evaluar',desc:'Pendiente'};
    if(has)counts[q.key]++;
    const prod=talentProduction(a.id);
    return `<tr class="${a.id===analystId?'selected-row':''}" onclick="talentAnalyst.value='${a.id}';renderTalent()"><td><strong>${esc(a.name)}</strong><small>${esc(a.role||'Consultor')}</small></td><td><span class="talent-badge ${q.key}">${esc(q.label)}</span></td><td>${prod.total}</td><td>${prod.closed}</td><td>${prod.pending}</td><td>${Math.round(prod.hours)}h</td><td>${prod.clients}</td></tr>`;
  });
  document.getElementById('talentSummaryTable').innerHTML=rows.join('');
  talentStarCount.textContent=counts.star;talentPotentialCount.textContent=counts.potential;talentDifficultCount.textContent=counts.difficult;talentLowCount.textContent=counts.low;
  renderTalentDetail();
}
function renderTalentQuestions(){
  const analystId=document.getElementById('talentAnalyst')?.value;
  const p=talentPeriod();
  const r=loadReview(analystId,p.year,p.quarter)||{};
  const make=(arr,cat)=>arr.map(q=>`<label class="review-row"><span>${esc(q)}</span><select data-cat="${cat}" data-question="${esc(q)}">${[1,2,3,4,5].map(n=>`<option value="${n}" ${num(r?.[cat]?.[q]||3)===n?'selected':''}>${n}</option>`).join('')}</select></label>`).join('');
  const apt=document.getElementById('aptitudeQuestions'),att=document.getElementById('attitudeQuestions');
  if(apt)apt.innerHTML=make(TALENT_APTITUDE,'aptitude');
  if(att)att.innerHTML=make(TALENT_ATTITUDE,'attitude');
  if(document.getElementById('talentStrengths'))talentStrengths.value=r.strengths||'';
  if(document.getElementById('talentImprovements'))talentImprovements.value=r.improvements||'';
  if(document.getElementById('talentActionPlan'))talentActionPlan.value=r.actionPlan||'';
  if(document.getElementById('talentComments'))talentComments.value=r.comments||'';
}
function renderTalentDetail(){
  const analystId=document.getElementById('talentAnalyst')?.value;
  const analyst=DB.analysts.find(a=>a.id===analystId);
  const p=talentPeriod();
  const r=loadReview(analystId,p.year,p.quarter)||{};
  const scores=talentScoresFromReview(r);
  const q=talentQuadrant(scores.aptitude,scores.attitude);
  const prod=talentProduction(analystId);
  const dot=document.getElementById('talentDot');
  if(dot){dot.style.left=`${Math.max(4,Math.min(96,(scores.aptitude/25)*100))}%`;dot.style.bottom=`${Math.max(4,Math.min(96,(scores.attitude/25)*100))}%`;dot.title=`${analyst?.name||''}: Aptitud ${scores.aptitude}, Actitud ${scores.attitude}`;}
  talentClassification.innerHTML=`<strong>${esc(analyst?.name||'Consultor')}</strong><span>${esc(p.label)}</span><h2>${esc(q.label)}</h2><p>${esc(q.desc)}</p><div class="score-line"><b>Aptitud:</b> ${scores.aptitude}/25 · <b>Actitud:</b> ${scores.attitude}/25</div>`;
  talentProductionCards.innerHTML=`<div><strong>${prod.total}</strong><span>Proyectos</span></div><div><strong>${prod.closed}</strong><span>Cerrados</span></div><div><strong>${prod.pending}</strong><span>Pendientes</span></div><div><strong>${Math.round(prod.hours)}h</strong><span>Horas</span></div><div><strong>${prod.clients}</strong><span>Clientes</span></div><div><strong>${prod.leader}/${prod.support}</strong><span>Líder / Apoyo</span></div>`;
  talentProjectsTable.innerHTML=prod.projectRows.map(x=>{const c=DB.clients.find(c=>c.id===x.project.client_id);return `<tr><td>${esc(c?.name||x.project.clients?.name||'-')}</td><td><strong>${esc(x.project.name)}</strong></td><td>${esc(x.role)}</td><td><span class="badge ${normalizeProjectStatus(x.project.status).toLowerCase()==='finalizado'?'green':'yellow'}">${esc(normalizeProjectStatus(x.project.status)||'-')}</span></td><td>${Math.round(x.hours)}h</td></tr>`}).join('')||'<tr><td colspan="5">Sin proyectos/cargas en el periodo seleccionado.</td></tr>';
  generateTalentText(false);
}
function collectTalentReview(){
  const aptitude={},attitude={};
  document.querySelectorAll('#aptitudeQuestions select').forEach(s=>aptitude[s.dataset.question]=num(s.value));
  document.querySelectorAll('#attitudeQuestions select').forEach(s=>attitude[s.dataset.question]=num(s.value));
  const p=talentPeriod();
  return {analyst_id:talentAnalyst.value,year:p.year,quarter:p.quarter,aptitude,attitude,strengths:talentStrengths.value,improvements:talentImprovements.value,actionPlan:talentActionPlan.value,comments:talentComments.value,updated_at:new Date().toISOString()};
}
function saveTalentReview(){
  const r=collectTalentReview();
  if(!r.analyst_id)return toast('Seleccione consultor');
  const data=talentStorage();data[talentKey(r.analyst_id,r.year,r.quarter)]=r;saveTalentStorage(data);
  renderTalent();toast('Evaluación guardada localmente');
}
function generateTalentText(showToast=true){
  const analystId=document.getElementById('talentAnalyst')?.value;
  const analyst=DB.analysts.find(a=>a.id===analystId);if(!analyst)return;
  const p=talentPeriod();
  const r=loadReview(analystId,p.year,p.quarter)||collectTalentReview();
  const s=talentScoresFromReview(r);const q=talentQuadrant(s.aptitude,s.attitude);const prod=talentProduction(analystId);
  const text=`Evaluación trimestral SISAP - ${analyst.name}\nPeriodo: ${p.label}\n\nResultado del cuadrante: ${q.label}\nAptitud: ${s.aptitude}/25\nActitud: ${s.attitude}/25\n\nProducción del periodo:\n- Proyectos asignados: ${prod.total}\n- Proyectos cerrados: ${prod.closed}\n- Proyectos pendientes: ${prod.pending}\n- Horas cargadas: ${Math.round(prod.hours)}h\n- Clientes atendidos: ${prod.clients}\n- Participación líder/apoyo: ${prod.leader}/${prod.support}\n\nFortalezas:\n${r.strengths||'Pendiente de documentar.'}\n\nÁreas de mejora:\n${r.improvements||'Pendiente de documentar.'}\n\nPlan de acción:\n${r.actionPlan||'Pendiente de definir.'}\n\nComentarios del Team Lead:\n${r.comments||'Sin comentarios adicionales.'}`;
  const box=document.getElementById('talentGeneratedReport');if(box)box.textContent=text;
  if(showToast)toast('Resumen generado');
  return text;
}

function renderUsers(){usersTable.innerHTML=DB.users.map(u=>{const views=[u.can_dashboard?'Dashboard':'',u.can_clients?'Clientes':'',u.can_analysts?'Analistas':'',u.can_projects?'Proyectos':'',u.can_load?'Carga':'',u.can_weeks?'Semanas':'',u.can_users?'Usuarios':''].filter(Boolean).join(', ');return `<tr><td><strong>${esc(u.full_name)}</strong></td><td>${esc(u.email)}</td><td>${esc(u.roles?.name||'-')}</td><td><span class="badge ${u.status==='Activo'?'green':'red'}">${esc(u.status)}</span></td><td>${esc(views)}</td><td class="actions"><button class="mini-btn" onclick="editAppUser('${u.id}')">Editar</button><button class="mini-btn delete" onclick="disableAppUser('${u.id}')">Inactivar</button></td></tr>`}).join('')}
async function saveAppUser(){const id=userId.value,email=v('userEmail'),password=v('userPassword');const payload={email,full_name:v('userName'),role_id:v('userRole')||null,status:v('userStatus'),can_dashboard:permDashboard.checked,can_clients:permClients.checked,can_analysts:permAnalysts.checked,can_projects:permProjects.checked,can_load:permLoad.checked,can_weeks:permWeeks.checked,can_users:permUsers.checked};if(!payload.email||!payload.full_name)return toast('Nombre y correo requeridos');if(!id&&!password)return toast('Contraseña inicial requerida');if(!id){const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name:payload.full_name}}});if(error)return toast(error.message);payload.auth_user_id=data.user?.id||null;}const r=id?await db.from('app_users').update(payload).eq('id',id):await db.from('app_users').insert([payload]);if(r.error)return toast(r.error.message);clearUserForm();await loadAll();toast('Usuario guardado')}
function editAppUser(id){const u=DB.users.find(x=>x.id===id);userId.value=u.id;userName.value=u.full_name||'';userEmail.value=u.email||'';userPassword.value='';userRole.value=u.role_id||'';userStatus.value=u.status||'Activo';permDashboard.checked=!!u.can_dashboard;permClients.checked=!!u.can_clients;permAnalysts.checked=!!u.can_analysts;permProjects.checked=!!u.can_projects;permLoad.checked=!!u.can_load;permWeeks.checked=!!u.can_weeks;permUsers.checked=!!u.can_users}async function disableAppUser(id){await db.from('app_users').update({status:'Inactivo'}).eq('id',id);await loadAll()}function clearUserForm(){userId.value='';userName.value='';userEmail.value='';userPassword.value='';userRole.value='';userStatus.value='Activo';permDashboard.checked=true;permClients.checked=false;permAnalysts.checked=false;permProjects.checked=true;permLoad.checked=true;permWeeks.checked=false;permUsers.checked=false}

function buildMultiFilter(id,label,items,valKey,textFn,state,onChange){const box=document.getElementById(id);if(!box)return;const selected=items.filter(x=>state.has(String(x[valKey])));const title=selected.length?`${label}: ${selected.length}`:`${label}: Todos`;box.innerHTML=`<button class="multi-btn" type="button" onclick="toggleMultiFilter(event,'${id}')"><span>${esc(title)}</span><small>▾</small></button><div class="multi-menu" onclick="event.stopPropagation()"><input class="multi-search" placeholder="Buscar ${esc(label.toLowerCase())}..." oninput="filterMultiOptions(this)"><div class="multi-list">${items.map(x=>{const value=String(x[valKey]);return `<label class="multi-option"><input type="checkbox" value="${esc(value)}" ${state.has(value)?'checked':''} onchange="setMultiValue('${id}',this.value,this.checked)"><span>${esc(textFn(x))}</span></label>`}).join('')}</div><div class="multi-actions"><button class="mini-link" onclick="selectAllMulti('${id}',true)">Todos</button><button class="mini-link red" onclick="selectAllMulti('${id}',false)">Limpiar</button></div></div>`;box._items=items;box._valKey=valKey;box._textFn=textFn;box._state=state;box._onChange=onChange;}
function toggleMultiFilter(e,id){e.stopPropagation();document.querySelectorAll('.multi-filter').forEach(x=>{if(x.id!==id)x.classList.remove('open')});document.getElementById(id)?.classList.toggle('open')}
function closeMultiFilters(){document.querySelectorAll('.multi-filter').forEach(x=>x.classList.remove('open'))}
function setMultiValue(id,value,checked){const box=document.getElementById(id);if(!box)return;checked?box._state.add(String(value)):box._state.delete(String(value));box._onChange?.();}
function selectAllMulti(id,all){const box=document.getElementById(id);if(!box)return;box._state.clear();if(all)box._items.forEach(x=>box._state.add(String(x[box._valKey])));box._onChange?.();fillSelects();document.getElementById(id)?.classList.add('open')}
function filterMultiOptions(input){const q=input.value.toLowerCase();input.closest('.multi-menu').querySelectorAll('.multi-option').forEach(opt=>opt.style.display=opt.textContent.toLowerCase().includes(q)?'flex':'none')}
function selectableWeeks(){
  return [...DB.weeks]
    .filter(w=>!String(w.week_label||'').toLowerCase().includes('cartera general') && w.start_date)
    .sort((a,b)=>new Date(a.start_date+'T00:00:00')-new Date(b.start_date+'T00:00:00'));
}
function weekMonthKey(w){
  if(!w?.start_date)return '';
  const d=new Date(w.start_date+'T00:00:00');
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function monthLabelFromKey(key){
  if(!key)return 'Sin semanas';
  const [y,m]=key.split('-').map(Number);
  return new Date(y,m-1,1).toLocaleDateString('es-NI',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
}
function defaultWeekMonthKey(){
  const weeks=selectableWeeks();
  if(!weeks.length)return '';
  const today=new Date();today.setHours(12,0,0,0);
  const current=weeks.find(w=>{
    const start=new Date(w.start_date+'T00:00:00');
    const end=w.end_date?new Date(w.end_date+'T23:59:59'):new Date(start.getTime()+6*24*60*60*1000);
    return today>=start&&today<=end;
  });
  if(current)return weekMonthKey(current);
  const future=weeks.find(w=>new Date(w.start_date+'T00:00:00')>today);
  return weekMonthKey(future||weeks[weeks.length-1]);
}
function selectedWeekMonthKey(context='dashboard'){
  const id=context==='load'?'loadWeekMonth':'dashboardWeekMonth';
  const el=document.getElementById(id);
  return el?.value||defaultWeekMonthKey();
}
function renderWeekMonthControls(){
  const weeks=selectableWeeks();
  const keys=[...new Set(weeks.map(weekMonthKey).filter(Boolean))];
  const def=defaultWeekMonthKey();
  ['dashboardWeekMonth','dashboardHeatmapMonth','loadWeekMonth'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const current=el.value||def;
    el.innerHTML=keys.map(k=>`<option value="${k}">${esc(monthLabelFromKey(k))}</option>`).join('');
    el.value=keys.includes(current)?current:def;
  });
  const dash=document.getElementById('dashboardWeekMonth'),heat=document.getElementById('dashboardHeatmapMonth');
  if(dash&&heat&&heat.value!==dash.value)heat.value=dash.value;
}
function displayWeeks(context='dashboard'){
  const key=selectedWeekMonthKey(context);
  return selectableWeeks().filter(w=>weekMonthKey(w)===key);
}
function animateNumber(el,value,suffix=''){
  if(!el)return;
  const start=Number(String(el.textContent).replace(/[^0-9.-]/g,''))||0;
  const end=Number(value)||0;
  const duration=650;
  const started=performance.now();
  el.classList.remove('number-pop');
  void el.offsetWidth;
  el.classList.add('number-pop');
  function easeOutCubic(t){return 1-Math.pow(1-t,3)}
  function tick(now){
    const progress=Math.min((now-started)/duration,1);
    const v=Math.round(start+(end-start)*easeOutCubic(progress));
    el.textContent=v.toLocaleString('es-NI')+suffix;
    if(progress<1)requestAnimationFrame(tick);
    else el.textContent=Math.round(end).toLocaleString('es-NI')+suffix;
  }
  requestAnimationFrame(tick);
}
function openProjectModal(id=''){
  projectId.value=id||'';
  projectModalTitle.textContent=id?'Editar proyecto':'Nuevo proyecto';
  const p=DB.projects.find(x=>x.id===id);
  projectName.value=p?.name||'';
  projectClient.value=p?.client_id||'';
  projectCountry.value=normalizeCountry(p?.country_code||'')||'';
  projectCommercial.value=p?.commercial_id||'';
  projectStatus.value=p?.status||'Asignado';
  projectServiceType.value=p?.service_type||'';
  projectContractedHours.value=Math.round(num(p?.contracted_hours||p?.estimated_hours||0));
  projectConsumedHours.value=Math.round(num(p?.consumed_hours||0));
  projectPriority.value=p?.priority||'Baja';
  projectSourceNo.value=p?.source_no||'';
  projectObservation.value=p?.observation||'';
  renderProjectAssignmentEditor(id);
  projectModal.classList.remove('hidden')
}

function analystOptions(selected=''){
  return `<option value="">Seleccione analista</option>`+DB.analysts.filter(a=>(a.status||'Activo')==='Activo').map(a=>`<option value="${a.id}" ${a.id===selected?'selected':''}>${esc(a.name)}</option>`).join('')
}
function renderProjectAssignmentEditor(projectId=''){
  const leader=DB.assignments.find(a=>a.project_id===projectId&&a.role==='Líder');
  const supports=DB.assignments.filter(a=>a.project_id===projectId&&a.role!=='Líder');
  const leaderSelect=document.getElementById('projectLeaderAnalyst');
  const leaderPct=document.getElementById('projectLeaderPct');
  if(leaderSelect)leaderSelect.innerHTML=analystOptions(leader?.analyst_id||'');
  if(leaderPct)leaderPct.value=Math.round(num(leader?.allocation_pct||100));
  const box=document.getElementById('projectSupportRows');
  if(!box)return;
  box.innerHTML='';
  supports.forEach(s=>addSupportAssignment(s.analyst_id,Math.round(num(s.allocation_pct||0))));
}
function addSupportAssignment(analystId='',pct=0){
  const box=document.getElementById('projectSupportRows');if(!box)return;
  const row=document.createElement('div');
  row.className='assignment-row support-row';
  row.innerHTML=`<select class="support-analyst">${analystOptions(analystId)}</select><input class="support-pct" type="number" min="0" max="100" step="1" value="${Math.round(num(pct||0))}" placeholder="%"><button type="button" class="mini-btn delete" onclick="removeSupportAssignment(this)">Quitar</button>`;
  box.appendChild(row);
}
function removeSupportAssignment(btn){btn.closest('.support-row')?.remove()}
function getProjectAssignments(projectId){
  const rows=[];
  const seen=new Set();
  const leaderId=v('projectLeaderAnalyst');
  const leaderPct=num(v('projectLeaderPct')||100);
  if(leaderId){rows.push({project_id:projectId,analyst_id:leaderId,role:'Líder',allocation_pct:leaderPct});seen.add(leaderId)}
  document.querySelectorAll('#projectSupportRows .support-row').forEach(row=>{
    const analyst_id=row.querySelector('.support-analyst')?.value||'';
    const allocation_pct=num(row.querySelector('.support-pct')?.value||0);
    if(analyst_id){rows.push({project_id:projectId,analyst_id,role:'Apoyo',allocation_pct});}
  });
  const ids=rows.map(r=>r.analyst_id);
  if(ids.length!==new Set(ids).size){toast('No se puede repetir el mismo analista en un proyecto');return null}
  const total=rows.reduce((s,r)=>s+num(r.allocation_pct),0);
  if(rows.length&&total>100){toast('La asignación total no puede ser mayor a 100%');return null}
  if(rows.some(r=>num(r.allocation_pct)<=0)){toast('Cada asignación debe tener porcentaje mayor a 0');return null}
  return rows;
}
async function saveProjectAssignments(projectId){
  const rows=getProjectAssignments(projectId);
  if(rows===null)return false;
  const del=await db.from('project_assignments').delete().eq('project_id',projectId);
  if(del.error){toast(del.error.message);return false}
  if(rows.length){
    const ins=await db.from('project_assignments').insert(rows);
    if(ins.error){toast(ins.error.message);return false}
  }
  return true;
}

function closeProjectModal(){const m=document.getElementById('projectModal');if(m)m.classList.add('hidden')}
async function saveProject(){
  const id=projectId.value;
  const client=DB.clients.find(c=>c.id===projectClient.value);
  const payload={client_id:projectClient.value||null,name:v('projectName'),service_type:v('projectServiceType'),status:normalizeProjectStatus(v('projectStatus')),country_code:v('projectCountry')||normalizeCountry(client?.country_code||client?.country),commercial_id:v('projectCommercial')||null,contracted_hours:num(v('projectContractedHours')),estimated_hours:num(v('projectContractedHours')),consumed_hours:num(v('projectConsumedHours')),priority:v('projectPriority')||'Baja',source_no:v('projectSourceNo')?num(v('projectSourceNo')):null,observation:v('projectObservation')||null};
  if(!payload.client_id||!payload.name)return toast('Cliente y proyecto son requeridos');
  const exists=DB.projects.some(p=>p.id!==id&&p.client_id===payload.client_id&&norm(p.name)===norm(payload.name));
  if(exists)return toast('Este proyecto ya existe para este cliente');
  let projectSavedId=id;
  let r;
  if(id){
    r=await db.from('projects').update(payload).eq('id',id).select('id').single();
  }else{
    r=await db.from('projects').insert([payload]).select('id').single();
  }
  if(r.error)return toast(r.error.message);
  projectSavedId=r.data?.id||id;
  const ok=await saveProjectAssignments(projectSavedId);
  if(!ok)return;
  closeProjectModal();await loadAll();toast(id?'Proyecto actualizado':'Proyecto creado')
}
async function deleteProject(id){
  const p=DB.projects.find(x=>x.id===id);if(!p)return;
  if(!confirm(`¿Eliminar proyecto "${p.name}"? Esta acción eliminará también sus cargas semanales y asignaciones.`))return;
  try{
    // V29.2: primero se eliminan las dependencias para evitar errores por llaves foráneas.
    const delLoads=await db.from('weekly_project_load').delete().eq('project_id',id);
    if(delLoads.error)throw delLoads.error;
    const delAssignments=await db.from('project_assignments').delete().eq('project_id',id);
    if(delAssignments.error)throw delAssignments.error;
    const delProject=await db.from('projects').delete().eq('id',id);
    if(delProject.error)throw delProject.error;
    await loadAll();toast('Proyecto eliminado correctamente');
  }catch(e){
    console.error('Error eliminando proyecto:',e);
    toast('No se pudo eliminar: '+e.message);
  }
}
function capacityRows(weeks){return DB.analysts.filter(a=>a.status==='Activo').map(a=>({id:a.id,name:a.name,capacity:num(a.weekly_capacity||44),values:weeks.map(w=>({week:w.week_label,hours:sumAnalystWeek(a.id,w.id)}))})).sort((a,b)=>{const avA=Math.min(...a.values.map(v=>a.capacity-v.hours));const avB=Math.min(...b.values.map(v=>b.capacity-v.hours));return avB-avA||a.name.localeCompare(b.name);})}
function isActiveLoad(load){return isLoadableProject(load.projects)}
function sumWeek(wid){return DB.loads.filter(l=>l.week_id===wid&&isActiveLoad(l)).reduce((s,l)=>s+num(l.planned_hours),0)}
function sumAnalystWeek(aid,wid){return DB.loads.filter(l=>l.analyst_id===aid&&l.week_id===wid&&isActiveLoad(l)).reduce((s,l)=>s+num(l.planned_hours),0)}
function pillClass(h,c){if(h>=c)return'red';if(h>=c*.9)return'yellow';return'green'}function projectAnalysts(pid){
  const rows=DB.assignments.filter(l=>l.project_id===pid);
  if(!rows.length)return '';
  return rows
    .sort((a,b)=>String(a.role)==='Líder'?-1:String(b.role)==='Líder'?1:0)
    .map(l=>`${l.analysts?.name||'Sin nombre'} (${l.role||'Apoyo'}${l.allocation_pct?` ${Math.round(num(l.allocation_pct))}%`:''})`)
    .join(', ')
}function percent(p){const h=num(p.contracted_hours||p.estimated_hours);return h?num(p.consumed_hours)/h*100:0}function country(code){const clean=normalizeCountry(code);return DB.countries.find(c=>c.code===clean)||{code:clean,name:clean,flag:flagFor(clean)}}function countryLabel(code){const clean=normalizeCountry(code);const c=country(clean);return `${clean} · ${c.name||clean}`}function normalizeCountry(code){const clean=String(code||'').trim().toUpperCase();const map={NIC:'NI',RD:'DO',SLV:'SV',SVL:'SV',HD:'HN',GI:'GT',PANAMA:'PA','PANAMÁ':'PA'};return map[clean]||clean}function flagFor(code){const clean=normalizeCountry(code);const known=['NI','GT','PA','DO','SV','HN','CR','MX','PY','CO','PE','US','ES','AR','BR','CL','EC','UY','VE','BO','CA'];if(known.includes(clean))return `<img class="flag-img" src="assets/flags/${clean}.svg" alt="${clean}" loading="lazy" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<span class=\'flag-fallback\'>🏳️</span>')">`;return '<span class="flag-fallback">🏳️</span>'}function dashboardAlertWeeks(){const w=currentWeek();return w?[w]:displayWeeks('dashboard').slice(-1)}
function currentWeek(){
  const today=new Date();today.setHours(12,0,0,0);
  const weeks=displayWeeks('dashboard');
  const current=weeks.find(w=>{const start=new Date(w.start_date+'T00:00:00');const end=new Date(w.end_date+'T23:59:59');return today>=start&&today<=end;});
  if(current)return current;
  const future=weeks.find(w=>new Date(w.start_date+'T00:00:00')>today);
  return future||weeks[weeks.length-1]||null;
}
function shortWeek(label){
  const meses={enero:'Ene',febrero:'Feb',marzo:'Mar',abril:'Abr',mayo:'May',junio:'Jun',julio:'Jul',agosto:'Ago',septiembre:'Sep',octubre:'Oct',noviembre:'Nov',diciembre:'Dic'};
  const txt=String(label||'').toLowerCase();
  const sem=txt.match(/semana\s*(\d+)/i);
  const mes=txt.match(/enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/i);
  if(!sem||!mes)return label;
  return `${meses[mes[0]]}-S${sem[1]}`;
}function num(v){const n=Number(v);return Number.isFinite(n)?n:0}function v(id){return document.getElementById(id)?.value?.trim()||''}function esc(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;")}function fmt(d){return d?new Date(d).toLocaleDateString('es-NI'):'-'}function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}

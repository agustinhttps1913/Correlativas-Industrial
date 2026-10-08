import { courses, byId, planId } from './data.js';
import { statusLabels, statusOf, isRegular, eligibility, metrics, cleanRecord, cleanMilestones, parseBackup } from './engine.js';
import { icon } from './icons.js';
import { firebaseConfig } from './firebase-config.js';
import { createCloud, friendlyError } from './cloud.js';

const $=s=>document.querySelector(s);
const main=$('#main'),sheet=$('#sheet'),sheetBody=$('#sheet-body');
const guestKey='correlativas:industrial-2023:guest',configKey='correlativas:firebase-config';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storageError=false;
function readLocal(key,fallback){try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback;}catch{storageError=true;return fallback;}}
let guest;
try{guest=parseBackup(readLocal(guestKey,{version:1,plan:planId,records:{},milestones:{}}));}catch{guest={records:{},milestones:cleanMilestones()};storageError=true;}
const state={view:'plan',year:1,filter:'all',query:'',records:guest.records,milestones:guest.milestones,user:null,loaded:true,sync:'local',error:'',pending:{},pendingMilestones:null};
let cloud=null,config=readLocal(configKey,null)||firebaseConfig,connecting=false,toastTimer,detail=null,authMode='login',lastFocus;
const levels={1:'Primer nivel',2:'Segundo nivel',3:'Tercer nivel',4:'Cuarto nivel',5:'Quinto nivel',E:'Electivas'};
const views=[['plan','grid','Mi plan'],['available','unlock','Disponibles'],['progress','chart','Progreso'],['account','user','Mi cuenta']];
const statusIcon={pending:'circle',studying:'clock',regular:'book',approved:'check'};
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),5000);}
function storageLabel(){
  if(!state.user)return storageError?'No se pudo guardar en este navegador. Descargá un respaldo.':'Guardado en este dispositivo · sin sincronizar';
  if(state.error)return 'Hay cambios o conexión pendientes de revisar';
  if(!navigator.onLine)return 'Sin conexión · sincronización pendiente';
  if(Object.keys(state.pending).length||state.pendingMilestones||state.sync==='pending')return 'Sincronizando cambios…';
  if(!state.loaded)return 'Cargando tu avance…';
  return state.sync==='cache'?'Mostrando una copia guardada':'Sincronizado con tu cuenta';
}
function persistGuest(){
  guest={records:state.records,milestones:state.milestones};
  try{localStorage.setItem(guestKey,JSON.stringify({version:1,plan:planId,...guest}));storageError=false;}
  catch{storageError=true;toast('No se pudo guardar en este navegador. Descargá un respaldo desde Mi cuenta.');}
}
function ring(percent){return `<div class="ring" aria-label="${percent}% de obligatorias aprobadas"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43"/><circle class="ring-value" cx="50" cy="50" r="43" stroke-dasharray="270.18" stroke-dashoffset="${270.18*(1-percent/100)}"/></svg><strong>${percent}%</strong></div>`;}
function intro(title,caption=''){return `<div class="intro"><p class="eyebrow">INGENIERÍA INDUSTRIAL <span>PLAN 2023</span></p><h1>${title}<span>.</span></h1>${caption?`<p class="muted">${caption}</p>`:''}</div>`;}
function summary(){const m=metrics(state.records);return `<section class="summary" aria-label="Resumen de tu avance"><div class="summary-top"><div><p class="summary-label">Tu recorrido</p><p class="summary-number">${m.approved}<span>/ ${m.total}</span></p><p class="summary-caption">obligatorias aprobadas</p></div>${ring(m.percent)}</div><div class="summary-stats"><div class="stat"><span class="stat-value">${m.regular}</span><span class="stat-label"><i class="dot amber"></i>Regulares</span></div><div class="stat"><span class="stat-value">${m.studying}</span><span class="stat-label"><i class="dot blue"></i>Cursando</span></div><div class="stat"><span class="stat-value">${m.available.length}</span><span class="stat-label">Habilitadas</span></div></div></section>`;}
function card(c){
  const status=statusOf(state.records,c.id),e=eligibility(c,state.records);
  const visual=status==='pending'?(e.canStudy?'available':'blocked'):status;
  const label=visual==='available'?'Habilitada':visual==='blocked'?'Bloqueada':statusLabels[status];
  const modality=c.modality==='A'?'Anual':c.modality==='1C'?'1.er cuatr.':'2.º cuatr.';
  const second=visual==='blocked'?`${e.missingRegular.length===1?'Falta':'Faltan'} ${e.missingRegular.length} correlativa${e.missingRegular.length===1?'':'s'}`:status==='regular'?(e.canExam?'Podés rendir':'Final bloqueado'):status==='approved'&&state.records[c.id]?.grade!=null?`Nota ${state.records[c.id].grade}`:c.credits?`${c.credits} créditos`:modality;
  return `<button class="course-card ${visual}" data-course="${c.id}" ${state.user&&!state.loaded?'disabled':''}><span class="course-code">${c.id.padStart(2,'0')}</span><span class="course-content"><span class="course-name">${esc(c.name)}</span><span class="course-meta"><span class="badge ${visual}">${icon(visual==='blocked'?'lock':visual==='available'?'unlock':statusIcon[status],12)}${label}</span><span>${second}</span></span></span><span class="course-chevron">${icon('chevron',16)}</span></button>`;
}
function empty(title,copy){return `<div class="empty">${icon('book',28)}<h3>${title}</h3><p>${copy}</p></div>`;}
function renderPlan(){
  main.innerHTML=intro('Mi carrera')+summary()+`<div class="toolbar-title"><h2>Plan de estudios</h2><button class="text-button" data-action="about" aria-label="Cómo funcionan las correlativas">${icon('info',19)}</button></div><div class="year-tabs" role="group" aria-label="Nivel del plan">${[1,2,3,4,5,'E'].map(y=>`<button class="year-tab ${state.year===y?'active':''}" data-year="${y}" aria-pressed="${state.year===y}">${y==='E'?'Electivas':y+'°'}</button>`).join('')}</div><label class="search">${icon('search',19)}<input id="search-input" type="search" placeholder="Buscar en todo el plan" aria-label="Buscar materia en todo el plan" value="${esc(state.query)}" autocomplete="off"></label><div class="filters" role="group" aria-label="Filtrar materias">${[['all','Todas'],['available','Habilitadas'],['blocked','Bloqueadas'],['studying','Cursando'],['regular','Regulares'],['approved','Aprobadas']].map(([key,label])=>`<button class="filter ${state.filter===key?'active':''}" data-filter="${key}" aria-pressed="${state.filter===key}">${key==='blocked'?'<i class="dot red"></i>':''}${label}</button>`).join('')}</div><div id="plan-results"></div>`;
  renderPlanResults();
}
function renderPlanResults(){
  const search=normalize(state.query.trim());
  const shown=courses.filter(c=>search?normalize(c.name+' '+c.id).includes(search):c.level===state.year).filter(c=>{
    const status=statusOf(state.records,c.id),e=eligibility(c,state.records);
    return state.filter==='all'||(state.filter==='available'?status==='pending'&&e.canStudy:state.filter==='blocked'?status==='pending'&&!e.canStudy:status===state.filter);
  });
  $('#plan-results').innerHTML=`<div class="list-heading"><h3>${search?'Resultados en todo el plan':levels[state.year]}</h3><span>${shown.length} materia${shown.length===1?'':'s'}</span></div>${shown.length?`<div class="course-list">${shown.map(card).join('')}</div>`:empty('Sin materias aquí','Probá otro filtro o buscá por nombre.')}<p class="storage-note" data-storage>${icon('cloud',15)}<span>${storageLabel()}</span></p>`;
}
function renderAvailable(){
  const m=metrics(state.records);
  main.innerHTML=intro('Lo que sigue','Las opciones que se abren con tu avance.')+`<div class="section-title"><h2>Para cursar</h2><span>${m.available.length} disponibles</span></div>${m.available.length?`<div class="course-list">${m.available.map(card).join('')}</div>`:empty('Por ahora, ninguna','Completá las correlativas que te faltan y aparecerán acá.')}<section class="view-section"><div class="section-title"><h2>Para rendir</h2><span>${m.exams.length} finales</span></div>${m.exams.length?`<div class="course-list">${m.exams.map(card).join('')}</div>`:empty('Tus próximos finales','Las materias regulares con las correlativas aprobadas aparecerán acá.')}</section><p class="storage-note" data-storage>${icon('cloud',15)}<span>${storageLabel()}</span></p>`;
}
function renderProgress(){
  const m=metrics(state.records),third=courses.filter(c=>typeof c.level==='number'&&c.level<=3),thirdDone=third.filter(c=>statusOf(state.records,c.id)==='approved').length;
  const final=eligibility(byId['42'],state.records),ppsAcademic=final.canStudy&&final.missingApproved.length===0;
  main.innerHTML=intro('Tu progreso','Cada materia cuenta.')+summary()+`<div class="progress-layout"><div><section class="panel"><h3>Avance por nivel</h3>${[1,2,3,4,5].map(y=>{const list=courses.filter(c=>c.level===y),done=list.filter(c=>statusOf(state.records,c.id)==='approved').length;return `<div class="year-progress"><div class="year-progress-head"><span>${levels[y]}</span><span>${done} de ${list.length}</span></div><div class="bar" role="progressbar" aria-label="${levels[y]}" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${list.length}"><span style="width:${done/list.length*100}%"></span></div></div>`;}).join('')}</section><div class="progress-cards"><section class="panel credits"><h3>Créditos electivos</h3><strong>${m.credits} <span>/ 10</span></strong><div class="bar" style="margin-top:15px"><span style="width:${Math.min(100,m.credits*10)}%"></span></div></section><section class="panel"><h3>Promedio registrado</h3><strong>${m.average?m.average.replace('.',','):'—'}</strong><p class="muted small" style="margin-top:8px">Obligatorias aprobadas con nota</p></section></div></div><div><section class="panel milestone"><span class="icon-wrap">${icon('trophy',23)}</span><div class="milestone-content"><h3>Título intermedio</h3><p class="muted">Técnico Universitario en Administración, Producción y Gestión Industrial.</p><p class="small ${thirdDone===third.length?'green':'muted'}" style="margin-top:14px">${thirdDone} / ${third.length} materias de 1.º a 3.º aprobadas</p><p class="small ${state.milestones.industrialManagement?'green':'amber'}">Gestión Industrial: ${state.milestones.industrialManagement?'aprobada':'pendiente'}</p></div><button class="icon-button" data-action="milestones" aria-label="Editar título intermedio y práctica">${icon('edit',16)}</button></section><section class="panel milestone"><span class="icon-wrap">${icon('clock',23)}</span><div class="milestone-content"><h3>Práctica supervisada</h3><p class="large-stat">${state.milestones.ppsHours}<span> / 200 h</span></p><p class="small ${ppsAcademic?'green':'amber'}" style="margin-top:13px">${ppsAcademic?'Requisitos académicos de Proyecto Final completos':'Faltan requisitos académicos de Proyecto Final'}</p><p class="small muted" style="margin-top:7px">Las horas registradas no acreditan automáticamente la práctica.</p></div><button class="icon-button" data-action="milestones" aria-label="Registrar horas de práctica">${icon('edit',16)}</button></section></div></div>`;
}
function renderAccount(){
  const hasGuest=Object.keys(guest.records).length>0;
  main.innerHTML=intro('Mi cuenta','Tu avance, siempre a mano.')+`<div class="account-layout"><div><section class="panel"><div class="account-avatar">${icon('user',27)}</div><h2>${state.user?'Tu espacio personal':'Conectá tu avance'}</h2>${state.user?`<p class="account-email muted" style="margin-top:9px">${esc(state.user.email)}</p>`:`<p class="muted" style="margin:12px 0 18px">Iniciá sesión para guardar tus materias en la nube y seguir desde otro dispositivo.</p><button class="primary full" data-action="${config?'auth':'setup'}">${config?'Ingresar o crear cuenta':'Conectar Firebase'}</button>`}<p class="account-status" data-storage>${icon('cloud',16)}<span>${storageLabel()}</span></p>${state.error?`<div class="notice warning">${esc(state.error)}</div>${Object.keys(state.pending).length||state.pendingMilestones?'<button class="secondary full" style="margin-top:12px" data-action="retry">Reintentar sincronización</button>':''}`:''}${state.user?`<button class="text-button" data-action="logout" style="margin-top:17px">${icon('logout',17)}Cerrar sesión</button>`:''}</section>${state.user&&hasGuest?'<section class="panel"><h3>Avance de este dispositivo</h3><p class="muted">Tenés materias que cargaste antes de iniciar sesión.</p><button class="secondary full" style="margin-top:15px" data-action="migrate">Pasar ese avance a mi cuenta</button></section>':''}</div><div><section class="panel"><h3>Una copia de tu recorrido</h3><p class="muted" style="margin-bottom:18px">Descargá tus estados, notas y fechas. Podés recuperarlos cuando necesites.</p><div class="backup-row"><button class="secondary" data-action="export">${icon('download',17)}Exportar</button><button class="secondary" data-action="import">${icon('upload',17)}Importar</button></div></section><div class="account-actions"><button data-action="about">${icon('info',20)}<span>Cómo funcionan las correlativas</span>${icon('chevron',16)}</button><a href="./plan-2023.pdf" target="_blank" rel="noopener">${icon('book',20)}<span>Consultar el PDF del plan</span>${icon('chevron',16)}</a>${!state.user?`<button data-action="setup">${icon('cloud',20)}<span>${config?'Configuración de Firebase':'Configurar la nube'}</span>${icon('chevron',16)}</button>`:''}</div><p class="install-note">En tu navegador, elegí “Agregar a pantalla de inicio” para tener la app a mano.</p></div></div>`;
}
function render(){
  const scroll=window.scrollY;
  const searchFocused=document.activeElement?.id==='search-input';
  document.title=views.find(v=>v[0]===state.view)[2]+' · Correlativas';
  $('#account-shortcut').innerHTML=icon('user',19);
  $('#bottom-nav').innerHTML=views.map(([id,ic,label])=>`<button class="nav-item ${state.view===id?'active':''}" data-view="${id}" ${state.view===id?'aria-current="page"':''}>${icon(ic,21)}<span>${label}</span></button>`).join('');
  ({plan:renderPlan,available:renderAvailable,progress:renderProgress,account:renderAccount})[state.view]();
  if(searchFocused&&$('#search-input'))$('#search-input').focus({preventScroll:true});
  window.scrollTo({top:scroll,behavior:'instant'});
}
function navigate(view){if(!views.some(v=>v[0]===view))view='plan';state.view=view;render();window.scrollTo({top:0,behavior:'instant'});history.replaceState(null,'','#'+view);}
function openSheet(content){lastFocus=document.activeElement;sheetBody.innerHTML=content;if(!sheet.open)sheet.showModal();document.body.style.overflow='hidden';sheet.scrollTop=0;}
function closeSheet(){sheet.close();}
function sheetHead(label){return `<div class="sheet-head"><p class="eyebrow">${label}</p><button class="icon-button" data-close aria-label="Cerrar">${icon('close',18)}</button></div>`;}
function showDetail(id){
  const c=byId[id];if(!c)return;
  const r=state.records[id]||{status:'pending',grade:null,date:''};detail={id,status:r.status,tab:'study'};
  openSheet(sheetHead(c.level==='E'?'ELECTIVA':`MATERIA ${id.padStart(2,'0')} · ${c.level}.º NIVEL`)+`<div class="sheet-content"><h2 id="sheet-title">${esc(c.name)}</h2><p class="sheet-subtitle"><span>${c.modality==='A'?'Anual':c.modality==='1C'?'Primer cuatrimestre':'Segundo cuatrimestre'}</span><span>Carga horaria: ${c.hours} h</span>${c.credits?`<span>${c.credits} créditos</span>`:''}</p><form id="course-form"><span class="section-label" id="status-label">Mi estado</span><div class="status-picker" role="group" aria-labelledby="status-label">${Object.entries(statusLabels).map(([key,label])=>`<button type="button" class="status-option ${r.status===key?'selected':''}" data-status="${key}" aria-pressed="${r.status===key}">${icon(statusIcon[key],18)}${label}</button>`).join('')}</div><div class="form-row"><label class="field">Nota (opcional)<input id="course-grade" name="grade" type="number" inputmode="decimal" min="1" max="10" step="0.01" placeholder="—" value="${r.grade??''}"></label><label class="field">Fecha (opcional)<input id="course-date" name="date" type="date" value="${esc(r.date)}"></label></div><p id="course-error" class="form-error" role="alert"></p><button class="primary full" type="submit">Guardar cambios</button></form><div class="segmented" role="group" aria-label="Requisitos"><button class="active" data-detail-tab="study" aria-pressed="true">Para cursar</button><button data-detail-tab="exam" aria-pressed="false">Para rendir</button></div><div id="requirements"></div></div>`);
  renderRequirements();
}
function requirement(name,met,description){return `<div class="requirement ${met?'met':''}"><span class="requirement-icon">${icon(met?'check':'lock',14)}</span><div><p class="requirement-name">${esc(name)}</p><p class="requirement-state">${description}</p></div></div>`;}
function renderRequirements(){
  if(!detail)return;
  const c=byId[detail.id],draft={...state.records,[c.id]:{...state.records[c.id],status:detail.status}},e=eligibility(c,draft),exam=detail.tab==='exam',can=exam?e.canExam:e.canStudy;
  const reqs=exam?c.approved:c.regular;
  $('#requirements').innerHTML=`<p class="requirement-summary ${can?'green':'red'}">${icon(can?'check':'lock',17)}${can?(exam?'Cumplís los requisitos para rendir':'Cumplís los requisitos para cursar'):'Todavía faltan requisitos'}</p><div class="requirements">${exam?requirement('Esta materia regular',isRegular(draft,c.id),`Tu estado: ${statusLabels[detail.status]}`):''}${reqs.map(id=>requirement(byId[id].name,exam?statusOf(draft,id)==='approved':isRegular(draft,id),`Necesitás ${exam?'aprobada':'regular o aprobada'} · Tenés ${statusLabels[statusOf(draft,id)].toLowerCase()}`)).join('')}</div>${!reqs.length?`<p class="muted small">${exam?'No se indican otras materias aprobadas en esta columna del PDF.':'No tiene correlativas en la columna Regular del PDF.'}</p>`:''}<p class="detail-note">${exam?'Usamos la columna “Aprobada” del PDF y la regularidad de esta materia.':'Usamos la columna “Regular” del PDF. Una materia aprobada también cumple el requisito de regularidad.'} Podés cargar tu historial aunque falten estados anteriores.</p>`;
}
function refreshStatus(){document.querySelectorAll('[data-storage] span').forEach(el=>el.textContent=storageLabel());}
function sendRecord(id,record){
  const marker=record.updatedAt;state.pending[id]=record;state.sync='pending';state.error='';refreshStatus();
  cloud.save(id,record).then(()=>{if(state.pending[id]?.updatedAt===marker)delete state.pending[id];state.sync='synced';refreshStatus();}).catch(err=>{state.error=friendlyError(err);refreshStatus();toast(state.error);if(state.view==='account')render();});
}
function saveRecord(id,record){
  const before=metrics(state.records).available.map(c=>c.id);
  state.records={...state.records,[id]:record};
  if(state.user)sendRecord(id,record);else persistGuest();render();
  const unlocked=metrics(state.records).available.filter(c=>c.id!==id&&!before.includes(c.id));
  toast(unlocked.length?`Guardado · ${unlocked.length} materia${unlocked.length===1?' nueva habilitada':'s nuevas habilitadas'}`:'Estado actualizado');
}
function showMilestones(){openSheet(sheetHead('OTROS REQUISITOS')+`<div class="sheet-content"><h2 id="sheet-title">Más allá de las materias</h2><form id="milestones-form"><label class="field" style="margin-top:22px">Horas de práctica supervisada<input name="hours" type="number" min="0" max="10000" step="1" inputmode="numeric" value="${state.milestones.ppsHours}" required></label><label class="check-row"><input type="checkbox" name="management" ${state.milestones.industrialManagement?'checked':''}>Tengo aprobada Gestión Industrial, la materia del título intermedio.</label><p class="detail-note" style="margin-bottom:20px">El PDF exige tercer año aprobado y Gestión Industrial para el título intermedio. Para la práctica, registra un mínimo de 200 horas y los requisitos académicos de Proyecto Final.</p><button class="primary full" type="submit">Guardar registro</button></form></div>`);}
function showAbout(){openSheet(sheetHead('TU PLAN')+`<div class="sheet-content"><h2 id="sheet-title">Un estado, un próximo paso</h2><p class="muted">Podés registrar tus 42 materias obligatorias y 12 electivas del Plan 2023 de Ingeniería Industrial.</p><div class="legend"><span class="badge approved">Aprobada</span><span class="badge regular">Regular</span><span class="badge studying">Cursando</span><span class="badge blocked">Bloqueada</span><span class="badge available">Habilitada</span></div><h3 class="section-label">Regla de desbloqueo elegida</h3><p class="muted small">Para cursar: cumplir la columna <b>Regular</b> con materias regulares o aprobadas. Para rendir: tener esta materia regular y cumplir la columna <b>Aprobada</b> con materias aprobadas.</p><p class="detail-note">Esta interpretación fue elegida para la app. El PDF no incluye una explicación formal de esas columnas. Confirmá con tu facultad si ambas columnas son requisitos conjuntos para cursar antes de usarla para una inscripción.</p><h3 class="section-label">Tu historial es tuyo</h3><p class="muted small">Los bloqueos son informativos: podés cargar una materia ya aprobada sin completar primero todas las anteriores. Al corregir un estado, se recalculan las opciones; tus otras materias no se borran. La app no calcula vencimientos de regularidad porque el PDF no los especifica.</p><h3 class="section-label">Fuente</h3><p class="muted small">Régimen de correlativas y electivas vigentes, Plan 2023. Documento de CET / AETI proporcionado por vos. Los nombres y números se conservaron; “CNH CÁTEDRA IN STU” figura así en el original.</p><a class="secondary full" style="margin-top:20px;text-decoration:none" href="./plan-2023.pdf" target="_blank" rel="noopener">Consultar documento original</a></div>`);}
function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportBackup(){const date=new Date();const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');download(`correlativas-${day}.json`,JSON.stringify({version:1,plan:planId,exportedAt:date.toISOString(),records:state.records,milestones:state.milestones},null,2));toast('Respaldo preparado para descargar');}
function confirmImport(data,label){
  const count=Object.keys(data.records).length;
  openSheet(sheetHead('RECUPERAR AVANCE')+`<div class="sheet-content"><h2 id="sheet-title">Importar ${count} materias</h2><p class="muted">${label} Se reemplazarán los estados, notas y fechas de las materias incluidas, y el registro de práctica y título intermedio. Las demás materias conservarán su estado.</p><p class="detail-note">Podés exportar el avance actual antes de continuar.</p><div class="action-row"><button class="secondary" data-action="export">Exportar actual</button><button id="confirm-import" class="primary">Importar</button></div></div>`);
  $('#confirm-import').onclick=()=>{
    state.records={...state.records,...data.records};state.milestones=data.milestones;
    if(state.user){
      Object.assign(state.pending,data.records);state.pendingMilestones=data.milestones;state.sync='pending';
      const imported={...data.records},profile=data.milestones;
      cloud.importRecords(imported,profile).then(()=>{for(const id of Object.keys(imported))if(state.pending[id]===imported[id])delete state.pending[id];if(state.pendingMilestones===profile)state.pendingMilestones=null;state.sync='synced';refreshStatus();}).catch(err=>{state.error=friendlyError(err);toast(state.error);refreshStatus();});
    }else persistGuest();closeSheet();render();toast('Avance importado');
  };
}
function showAuth(){
  if(!cloud){toast(connecting?'Conectando con Firebase…':'No se pudo conectar. Revisá la configuración o tu conexión.');return;}
  openSheet(sheetHead('TU CUENTA')+`<div class="sheet-content"><h2 id="sheet-title">${authMode==='register'?'Empezá tu recorrido':'Qué bueno verte'}</h2><div class="segmented auth-tabs"><button class="${authMode==='login'?'active':''}" data-auth-mode="login">Ingresar</button><button class="${authMode==='register'?'active':''}" data-auth-mode="register">Crear cuenta</button></div><form id="auth-form" class="form-stack"><label class="field">Correo electrónico<input type="email" name="email" required autocomplete="email" inputmode="email" placeholder="vos@ejemplo.com"></label><label class="field">Contraseña<input type="password" name="password" required minlength="6" autocomplete="${authMode==='register'?'new-password':'current-password'}" placeholder="Al menos 6 caracteres"></label><label class="check-row" style="margin:0"><input type="checkbox" name="remember">Este dispositivo es mío. Recordar mi sesión y guardar una copia del avance para usar sin conexión.</label><p id="auth-error" class="form-error" role="alert"></p><button class="primary full" type="submit">${authMode==='register'?'Crear mi cuenta':'Ingresar'}</button><button class="text-button" type="button" data-action="reset-password">Olvidé mi contraseña</button></form><p class="detail-note">El avance que cargaste antes de iniciar sesión queda en este dispositivo. Después podés pasarlo a tu cuenta desde Mi cuenta.</p></div>`);
}
function parseConfig(text){
  const begin=text.indexOf('{'),end=text.lastIndexOf('}');if(begin<0||end<begin)throw new Error('Pegá el objeto firebaseConfig que te da Firebase.');
  const raw=text.slice(begin,end+1).replace(/([{,]\s*)([a-zA-Z][a-zA-Z0-9]*)\s*:/g,'$1"$2":').replace(/,\s*}/g,'}');
  let value;try{value=JSON.parse(raw);}catch{throw new Error('El formato no es válido. Copiá el objeto completo, desde { hasta }.');}
  const allowed=['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId','measurementId'];
  if(value.private_key||value.type==='service_account')throw new Error('Usá la configuración web pública, nunca una clave privada.');
  if(!['apiKey','authDomain','projectId','appId'].every(k=>typeof value[k]==='string'&&value[k].length>0))throw new Error('Faltan apiKey, authDomain, projectId o appId.');
  if(!/^[a-z0-9-]+$/.test(value.projectId)||!/^[-a-zA-Z0-9.]+$/.test(value.authDomain))throw new Error('Revisá el nombre del proyecto y el dominio.');
  return Object.fromEntries(allowed.filter(k=>typeof value[k]==='string').map(k=>[k,value[k]]));
}
function showSetup(){openSheet(sheetHead('CONEXIÓN INICIAL')+`<div class="sheet-content"><h2 id="sheet-title">Firebase conectado</h2><p class="muted small">Esta versión ya tiene la configuración web del proyecto plan-del-ingeniero. Para habilitar cuentas y sincronizar avances, completá estos pasos en Firebase Console.</p><ol class="setup-list"><li>En Authentication → Sign-in method, habilitá Correo electrónico/contraseña.</li><li>Creá Cloud Firestore Standard en modo producción con la base predeterminada.</li><li>Publicá en Firestore → Rules el contenido de <b>firestore.rules</b> incluido con la app.</li><li>En Authentication → Settings → Authorized domains, agregá tu dominio de GitHub Pages.</li></ol><p class="detail-note">Solo cambiá la configuración de abajo si vas a conectar otro proyecto. La configuración web es pública; nunca pegues una clave privada ni una cuenta de servicio.</p><form id="setup-form" class="form-stack"><label class="field">Configuración web<textarea name="config" spellcheck="false">${config?esc(JSON.stringify(config,null,2)):''}</textarea></label><p id="setup-error" class="form-error" role="alert"></p><button class="primary full" type="submit">Guardar y conectar</button><button class="secondary full" type="button" data-action="download-config">Descargar firebase-config.js</button></form></div>`);}
async function connectCloud(){
  if(!config||connecting||cloud)return;connecting=true;
  try{cloud=await createCloud(config,{
    user(user){const changed=state.user?.uid!==user?.uid;state.user=user;state.pending={};state.pendingMilestones=null;state.error='';state.loaded=!user;state.records=user?{}:guest.records;state.milestones=user?cleanMilestones():guest.milestones;state.sync=user?'loading':'local';if(changed&&sheet.open)closeSheet();render();},
    records(records,meta){const clean={};for(const [id,value] of Object.entries(records)){if(!Object.hasOwn(byId,id))continue;try{clean[id]=cleanRecord(value);}catch{state.error='Hay un registro inválido en tu cuenta. Descargá un respaldo para revisarlo.';}}state.records={...clean,...state.pending};state.loaded=true;state.sync=meta.pending?'pending':meta.cache?'cache':'synced';render();},
    milestones(value){state.milestones=state.pendingMilestones||cleanMilestones(value);if(state.view==='progress')render();},
    error(err){state.error=friendlyError(err);state.loaded=true;render();toast(state.error);}
  });}catch(err){state.error=friendlyError(err);if(state.view==='account')render();}finally{connecting=false;}
}
function submitMilestones(value){
  state.milestones=value;if(!state.user){persistGuest();return;}
  state.pendingMilestones=value;state.sync='pending';
  cloud.saveMilestones(value).then(()=>{if(state.pendingMilestones===value)state.pendingMilestones=null;state.sync='synced';refreshStatus();}).catch(err=>{state.error=friendlyError(err);toast(state.error);refreshStatus();});
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-close'))return closeSheet();
  if(button.dataset.view)return navigate(button.dataset.view);
  if(button.id==='account-shortcut')return navigate('account');
  if(button.dataset.course)return showDetail(button.dataset.course);
  if(button.dataset.year){state.year=button.dataset.year==='E'?'E':Number(button.dataset.year);state.query='';renderPlan();return;}
  if(button.dataset.filter){state.filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button);});renderPlanResults();return;}
  if(button.dataset.status){detail.status=button.dataset.status;document.querySelectorAll('[data-status]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',b===button);});renderRequirements();return;}
  if(button.dataset.detailTab){detail.tab=button.dataset.detailTab;document.querySelectorAll('[data-detail-tab]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button);});renderRequirements();return;}
  if(button.dataset.authMode){authMode=button.dataset.authMode;showAuth();return;}
  const action=button.dataset.action;
  if(action==='about')showAbout();if(action==='milestones')showMilestones();if(action==='export')exportBackup();if(action==='import')$('#backup-file').click();if(action==='migrate')confirmImport(guest,'Se copiará el avance local a tu cuenta.');if(action==='setup')showSetup();
  if(action==='auth'){await connectCloud();showAuth();}
  if(action==='download-config'){try{const value=parseConfig($('#setup-form textarea').value);download('firebase-config.js','export const firebaseConfig = '+JSON.stringify(value,null,2)+';\n','text/javascript');toast('Reemplazá el archivo de la app por el descargado');}catch(err){$('#setup-error').textContent=err.message;}}
  if(action==='reset-password'){
    const email=$('#auth-form [name=email]');if(!email.reportValidity())return;button.disabled=true;
    try{await cloud.resetPassword(email.value.trim());$('#auth-error').textContent='Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso.';}catch(err){$('#auth-error').textContent=friendlyError(err);}finally{button.disabled=false;}
  }
  if(action==='logout'){
    if(Object.keys(state.pending).length||state.pendingMilestones){toast('Hay cambios pendientes. Sincronizalos antes de cerrar sesión y descargá un respaldo.');return;}
    try{await cloud.logout();toast('Sesión cerrada');}catch(err){toast(friendlyError(err));}
  }
  if(action==='retry'){state.error='';for(const [id,record] of Object.entries(state.pending))sendRecord(id,record);if(state.pendingMilestones)submitMilestones(state.pendingMilestones);render();}
});
document.addEventListener('input',event=>{if(event.target.id==='search-input'){state.query=event.target.value;renderPlanResults();}});
document.addEventListener('submit',async event=>{
  const form=event.target;event.preventDefault();
  if(form.id==='course-form'){try{const record=cleanRecord({status:detail.status,grade:form.grade.value,date:form.date.value,updatedAt:Date.now()});const id=detail.id;closeSheet();saveRecord(id,record);}catch(err){$('#course-error').textContent=err.message;}}
  if(form.id==='milestones-form'){submitMilestones(cleanMilestones({ppsHours:form.hours.value,industrialManagement:form.management.checked}));closeSheet();render();toast('Registro actualizado');}
  if(form.id==='auth-form'){
    const submit=form.querySelector('[type=submit]');submit.disabled=true;
    try{await cloud.login(form.email.value.trim(),form.password.value,authMode==='register',form.remember.checked);if(sheet.open)closeSheet();navigate('account');toast('Tu cuenta está conectada');}catch(err){if($('#auth-error'))$('#auth-error').textContent=friendlyError(err);}finally{submit.disabled=false;}
  }
  if(form.id==='setup-form'){
    try{const value=parseConfig(form.config.value);localStorage.setItem(configKey,JSON.stringify(value));if(cloud){toast('Configuración guardada. Recargando la conexión…');location.reload();return;}config=value;await connectCloud();if(!cloud)throw new Error(state.error||'No se pudo conectar con Firebase.');closeSheet();navigate('account');showAuth();}catch(err){if($('#setup-error'))$('#setup-error').textContent=err.message;else toast(err.message);}
  }
});
$('#backup-file').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{if(file.size>200000)throw new Error('El archivo es demasiado grande para un respaldo de este plan.');confirmImport(parseBackup(JSON.parse(await file.text())),'Se recuperará el archivo seleccionado.');}catch(err){toast(err instanceof SyntaxError?'El archivo no es un JSON válido.':err.message);}
});
sheet.addEventListener('close',()=>{if(!sheet.open){document.body.style.overflow='';detail=null;if(lastFocus?.isConnected)lastFocus.focus();}});
sheet.addEventListener('click',event=>{if(event.target===sheet){const r=sheet.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSheet();}});
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)));
window.addEventListener('online',refreshStatus);window.addEventListener('offline',refreshStatus);
window.addEventListener('beforeunload',event=>{if(state.user&&(Object.keys(state.pending).length||state.pendingMilestones)){event.preventDefault();event.returnValue='';}});
window.addEventListener('storage',event=>{if(event.key===guestKey&&!state.user){try{guest=parseBackup(JSON.parse(event.newValue));state.records=guest.records;state.milestones=guest.milestones;render();}catch{}}});
navigate(location.hash.slice(1)||'plan');connectCloud();
if(storageError)toast('No pudimos recuperar el guardado local. Podés importar un respaldo desde Mi cuenta.');
if('serviceWorker' in navigator&&location.hostname!=='127.0.0.1'&&location.hostname!=='localhost')navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  try{Promise.resolve(document.modelContext.registerTool({name:'consultar_correlativas',description:'Consulta el estado y los requisitos de materias del plan Industrial 2023. No modifica datos.',inputSchema:{type:'object',properties:{ids:{type:'array',items:{type:'string'},maxItems:54}},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Object.keys(input).some(k=>k!=='ids')||(input.ids&&(!Array.isArray(input.ids)||input.ids.length>54||input.ids.some(id=>typeof id!=='string'||!Object.hasOwn(byId,id)))))throw new Error('Indicá IDs válidos del plan.');return (input.ids||courses.map(c=>c.id)).map(id=>({id,name:byId[id].name,status:statusOf(state.records,id),...eligibility(byId[id],state.records)}));}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
}

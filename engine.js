import { courses, byId, planId } from './data.js';
export const statusLabels = {pending:'Pendiente',studying:'Cursando',regular:'Regular',approved:'Aprobada'};
export const statusOf = (records,id)=>records[id]?.status || 'pending';
export const isRegular = (records,id)=>['regular','approved'].includes(statusOf(records,id));
export function eligibility(course, records) {
  // Interpretación confirmada por el usuario: Regular -> cursar; Aprobada -> final.
  const missingRegular = course.regular.filter(id=>!isRegular(records,id));
  const missingApproved = course.approved.filter(id=>statusOf(records,id)!=='approved');
  return {missingRegular,missingApproved,canStudy:missingRegular.length===0,
    canExam:isRegular(records,course.id) && missingApproved.length===0};
}
export function metrics(records) {
  const required=courses.filter(c=>c.level!=='E');
  const approved=required.filter(c=>statusOf(records,c.id)==='approved').length;
  const grades=required.filter(c=>statusOf(records,c.id)==='approved' && Number.isFinite(records[c.id]?.grade)).map(c=>records[c.id].grade);
  return {approved,total:required.length,percent:Math.round(approved/required.length*100),
    regular:required.filter(c=>statusOf(records,c.id)==='regular').length,
    studying:required.filter(c=>statusOf(records,c.id)==='studying').length,
    available:courses.filter(c=>statusOf(records,c.id)==='pending' && eligibility(c,records).canStudy),
    exams:courses.filter(c=>statusOf(records,c.id)==='regular' && eligibility(c,records).canExam),
    credits:courses.filter(c=>statusOf(records,c.id)==='approved').reduce((n,c)=>n+c.credits,0),
    average:grades.length ? (grades.reduce((a,b)=>a+b,0)/grades.length).toFixed(2) : null};
}
export function cleanRecord(value) {
  if(!value || typeof value!=='object' || !Object.hasOwn(statusLabels,value.status)) throw new Error('Estado de materia inválido.');
  const grade=value.grade==null || value.grade==='' ? null : Number(value.grade);
  if(grade!==null && (!Number.isFinite(grade) || grade<1 || grade>10)) throw new Error('La nota debe estar entre 1 y 10.');
  const date=value.date || '';
  if(typeof date!=='string' || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date))) throw new Error('La fecha no es válida.');
  return {status:value.status,grade,date,updatedAt:Number.isFinite(value.updatedAt)&&value.updatedAt>=0?value.updatedAt:Date.now()};
}
export function cleanMilestones(value={}) {
  return {ppsHours:Math.min(10000,Math.max(0,Math.floor(Number(value.ppsHours)||0))),industrialManagement:value.industrialManagement===true};
}
export function parseBackup(value) {
  if(!value || value.plan!==planId || value.version!==1 || !value.records || typeof value.records!=='object' || Array.isArray(value.records)) throw new Error('Elegí un respaldo de Correlativas · Industrial 2023.');
  const records={};
  for(const [id,record] of Object.entries(value.records)) {
    if(!Object.hasOwn(byId,id)) throw new Error('El respaldo contiene una materia que no pertenece a este plan.');
    records[id]=cleanRecord(record);
  }
  return {records,milestones:cleanMilestones(value.milestones)};
}

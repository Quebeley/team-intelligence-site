'use strict';
(() => {
 const {data,names,esc,anchor,card,empty,priority,ranked,route,renderLibrary,$}=window.researchSite;
 const records=new Map(data.records.map(record=>[record.id,record]));
 const selected=new Set();
 const weeklyTracks=data.topics.filter(topic=>topic.cadence!=='monthly');
 const visitKey='interconnect-insights:last-visit:v1';
 let previousVisit='';
 try {
  previousVisit=localStorage.getItem(visitKey)||'';
  localStorage.setItem(visitKey,new Date().toISOString());
 } catch { /* The weekly view still works when browser storage is disabled. */ }
 const capturedAt=record=>{
  const value=record.first_seen||record.fetched_date||'';
  return Date.parse(value.includes(' ') ? value.replace(' ','T')+'Z' : value);
 };
 const ids=value=>{
  if(Array.isArray(value))return value;
  try {const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed:[];}
  catch {return [];}
 };
 const weeks=data.weeks||[];
 const latest=weeks[0], preceding=weeks[1];
 const earlier=new Set(ids(preceding?.item_ids));
 const newInBrief=ids(latest?.item_ids).filter(id=>!earlier.has(id)).map(id=>records.get(id))
  .filter(record=>record?.status==='included' && record.topics.some(topic=>weeklyTracks.some(t=>t.id===topic)));
 const months=data.industry_months||[];
 const latestMonth=months[0], precedingMonth=months[1];
 const earlierMonth=new Set(ids(precedingMonth?.item_ids));
 const newInMonth=ids(latestMonth?.item_ids).filter(id=>!earlierMonth.has(id)).map(id=>records.get(id))
  .filter(record=>record?.status==='included' && record.topics.includes('industry'));
 const since=Number.isFinite(Date.parse(previousVisit))?Date.parse(previousVisit):Date.parse(data.built_at)-7*86400000;
 const sinceVisit=data.records.filter(record=>record.status==='included' && capturedAt(record)>since);
 let changeScope='brief', changeTrack='', changeLimit=15;

 function changeRows(){
  const rows=changeScope==='visit'?sinceVisit:changeScope==='industry'?newInMonth:newInBrief;
  return ranked(rows.filter(record=>!changeTrack||record.topics.includes(changeTrack)));
 }
 function renderChanges(){
  $('changes-summary').innerHTML=latest?
   `<div><b>${esc(latest.week_start)} – ${esc(latest.week_end)}</b><span>Latest published weekly brief</span></div>
    <div><b>${newInBrief.length}</b><span>Selected records absent from the preceding brief</span></div>
    <div><b>${newInMonth.length}</b><span>New company records in the ${esc(latestMonth?.month_start?.slice(0,7)||'latest')} monthly brief</span></div>
    <div><b>${sinceVisit.length}</b><span>${previousVisit?'Selected records first captured since your last visit':'Selected records first captured in the last 7 days'}</span></div>`:
   '<div><b>Awaiting brief</b><span>Weekly changes appear after a completed collection.</span></div>';
  $('change-scope').innerHTML=[['brief','Weekly technology'],['industry','Monthly companies'],['visit',previousVisit?'Captured since last visit':'Captured in last 7 days']]
   .map(([id,label])=>`<button type="button" data-scope="${id}" class="${changeScope===id?'selected':''}" aria-pressed="${changeScope===id}">${esc(label)}</button>`).join('');
  $('change-scope').querySelectorAll('button').forEach(button=>button.onclick=()=>{changeScope=button.dataset.scope;changeTrack='';changeLimit=15;renderChanges();});
  $('change-topics').hidden=changeScope==='industry';
  $('change-topics').innerHTML=[['','All tracks'],...(changeScope==='visit'?data.topics:weeklyTracks).map(topic=>[topic.id,topic.name])]
   .map(([id,label])=>`<button type="button" data-track="${esc(id)}" class="${changeTrack===id?'selected':''}" aria-pressed="${changeTrack===id}">${esc(label)}</button>`).join('');
  $('change-topics').querySelectorAll('button').forEach(button=>button.onclick=()=>{changeTrack=button.dataset.track;changeLimit=15;renderChanges();});
  const rows=changeRows();
  $('change-results').innerHTML=rows.length?rows.slice(0,changeLimit).map(record=>
   `<article class="change-card"><div><span class="type-label">${esc(record.document_type)}</span><span class="change-score">${Math.round(priority(record))} / 100</span></div>
    <h3>${anchor(record.url,record.title)}</h3><p class="meta">${record.evidence_meta?.company?esc(record.evidence_meta.company)+' · ':''}${esc(record.source_name)} · Published ${esc(record.published_date||'date unknown')} · Captured ${esc((record.first_seen||record.fetched_date||'').slice(0,10))}</p>
    <p>${esc((record.why_it_matters||record.summary||record.abstract||'').slice(0,360))}</p>
    <div class="tags">${record.topics.map(topic=>`<span class="tag">${esc(names[topic]||topic)}</span>`).join('')}</div></article>`).join(''):
   empty(changeScope==='visit'?'No newly captured selected records for this view.':'No new selected records for this view.',
    changeScope==='visit'?'Try another track or check after the next collection.':'The latest published brief has no additions beyond its preceding brief, or has not been published.');
  $('change-more').hidden=rows.length<=changeLimit;
 }
 $('change-more').onclick=()=>{changeLimit+=15;renderChanges();};

 const comparable=record=>record?.status==='included' && ['paper','patent'].includes(record.document_type);
 const chosen=()=>[...selected].map(id=>records.get(id)).filter(comparable);
 function updateSelectionControls(){
  const count=chosen().length;
  $('compare-bar').hidden=count===0;
  $('compare-count').textContent=`${count} of 4 publications selected`;
  $('compare-open').disabled=count<2;
  $('compare-error').hidden=true;
 }
 function choose(event){
  const input=event.target.closest('input[data-compare-id]');
  if(!input)return;
  const id=input.dataset.compareId;
  if(!comparable(records.get(id))){input.checked=false;return;}
  if(input.checked && selected.size>=4){
   input.checked=false;$('compare-error').textContent='Choose no more than four publications.';$('compare-error').hidden=false;
   return;
  }
  if(input.checked)selected.add(id);else selected.delete(id);
  updateSelectionControls();
 }
 $('results').addEventListener('change',choose);
 function clearComparison(){selected.clear();renderLibrary();renderCompare();}
 $('compare-clear').onclick=clearComparison;
 $('compare-reset').onclick=clearComparison;
 $('compare-open').onclick=()=>{if(chosen().length>=2)location.hash='#compare';};
 $('compare-chat').onclick=()=>{
  const rows=chosen();if(rows.length<2)return;
  window.dispatchEvent(new CustomEvent('research:compare',{detail:{ids:rows.map(record=>record.id),
   titles:rows.map(record=>record.title)}}));
  location.hash='#chat';
 };
 function renderCompare(){
  const rows=chosen();
  $('compare-summary').innerHTML=`<div><b>${rows.length} / 4</b><span>Selected publications</span></div>`;
  if(rows.length<2){
   $('compare-table').innerHTML=empty('Choose at least two publications.','Open the research library and select two to four papers or patents.','<a href="#archive">Open research library ↗</a>');
   $('compare-reset').hidden=!rows.length;
   $('compare-chat').hidden=true;
   return;
  }
  $('compare-reset').hidden=false;
  $('compare-chat').hidden=false;
  const value=(record,key)=>{
   const details=record.score_details||{};
   const summary=record.summary_details||{};
   switch(key){
    case 'source':return `${esc(record.source_name)}<br>${anchor(record.url,'Open original source ↗')}`;
    case 'type':return esc(record.document_type+' · '+(record.publication_number||record.published_date||'Date unknown'));
    case 'tracks':return esc(record.topics.map(topic=>names[topic]||topic).join(', '));
    case 'priority':return esc(`${Math.round(priority(record))} / 100 · ${record.score_reason||'Assessment unavailable'}`);
    case 'method':return esc((summary.technical_points||[]).join('\n')||record.summary||record.abstract||'No technical description stored.').replaceAll('\n','<br>');
    case 'evidence':return esc((details.evidence||[]).join('\n')||record.abstract||'No supporting excerpt stored.').replaceAll('\n','<br>');
    case 'limits':return esc([...(details.limitations||[]),...(summary.limitations||[])].join('\n')||'No limitations recorded in the stored assessment.').replaceAll('\n','<br>');
    case 'impact':return esc(record.why_it_matters||'No engineering implication recorded.');
   }
  };
  const fields=[['source','Source'],['type','Type / date'],['tracks','Research tracks'],['priority','Engineering priority'],
   ['method','Method / technical points'],['evidence','Stored supporting evidence'],['limits','Recorded limitations'],['impact','Engineering implication']];
  $('compare-table').innerHTML=`<div class="compare-scroll" role="region" aria-label="Publication comparison" tabindex="0"><table class="compare-table"><thead><tr><th scope="col">Evidence</th>${rows.map(record=>`<th scope="col">${esc(record.title)}</th>`).join('')}</tr></thead><tbody>${fields.map(([key,label])=>`<tr><th scope="row">${label}</th>${rows.map(record=>`<td>${value(record,key)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 }
 $('suggest-related').innerHTML+=data.topics.map(topic=>
  `<option value="${esc(topic.id)}">${esc(topic.name)}</option>`).join('');
 $('suggest-instructions').textContent='Continue to a public GitHub Issue to review and submit this suggestion. A GitHub sign-in is required. Do not include confidential information. Suggestions are reviewed before any search rule or schedule changes.';
 $('suggest-submit').disabled=false;
 $('suggest-submit').textContent='Review topic suggestion on GitHub ↗';
 $('suggest-form').addEventListener('submit',event=>{
  event.preventDefault();
  if(!$('suggest-form').reportValidity())return;
  const name=$('suggest-name').value.trim();
  const goal=$('suggest-goal').value.trim();
  if(!name||!goal)return;
  const related=data.topics.find(topic=>topic.id===$('suggest-related').value);
  const section=(label,text)=>`## ${label}\n${text||'Not supplied'}\n`;
  const body=[section('Technical question',goal),
   section('Closest current track',related?.name||'New area / not sure'),
   section('Search terms and synonyms',$('suggest-terms').value.trim()),
   section('Trusted sources and examples',$('suggest-sources').value.trim()),
   section('Suggested update frequency',$('suggest-cadence').value),
   section('Content to exclude',$('suggest-exclusions').value.trim()),
   'This is a proposal for review. It does not change the collection or publication workflow.'].join('\n');
  const url=new URL('https://github.com/Quebeley/team-intelligence-site/issues/new');
  url.searchParams.set('title',`[Topic suggestion] ${name}`);
  url.searchParams.set('body',body);
  if(url.href.length>7500){$('suggest-error').textContent='The suggestion is too long for a link. Shorten the text and try again.';$('suggest-error').hidden=false;return;}
  $('suggest-error').hidden=true;
  location.assign(url.href);
 });
 window.researchWorkspace={isSelected:id=>selected.has(id),updateSelectionControls,onRoute:name=>{
  if(name==='changes')renderChanges();
  if(name==='compare')renderCompare();
 }};
 updateSelectionControls();
 route();
})();

'use strict';
const data = JSON.parse(document.getElementById('team-data').textContent);
const $ = id => document.getElementById(id);
const names = Object.fromEntries(data.topics.map(t => [t.id,t.name]));
document.getElementById('track-count').textContent=`${data.topics.length} RESEARCH TRACKS`;
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => {try {const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:'#';}catch{return '#';}};
const readableSource = value => String(value||'').replace(/\\([^\p{L}\p{N}\s])/gu,'$1');
const anchor = (url,title) => `<a href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`;
const priority = r => Number(r.score_details?.priority ?? r.relevance_score ?? -1);
const recordDate = r => r.published_date||r.fetched_date||'';
const freshness = r => {const age=(Date.parse(data.built_at)-Date.parse(recordDate(r)))/86400000;return Number.isFinite(age)?Math.max(0,1-Math.max(0,age)/90):0;};
const balancedScore = r => .8*priority(r)+20*freshness(r);
const ranked = rows => [...rows].sort((a,b)=>balancedScore(b)-balancedScore(a) || priority(b)-priority(a) || recordDate(b).localeCompare(recordDate(a)));
const reviewed = data.records.filter(r=>r.status==='included');
const pending = data.records.filter(r=>r.status==='candidate');
const historicalPatent = r => r.document_type==='patent' && r.published_date && (Date.parse(data.built_at)-Date.parse(r.published_date))>60*86400000;
let track='', briefTrack='', filtered=[], pageSize=30;

function card(r){
 const details=r.score_details||{};
 const sourceText=r.summary||r.abstract||'No source abstract available.';
 const preview=sourceText.length>420?sourceText.slice(0,420)+'…':sourceText;
 const score=r.status==='candidate'?'<span class="pending">PENDING REVIEW</span>':`<span class="score" title="Engineering priority">${Math.round(priority(r))}<small> / 100</small></span>`;
 const evidence=(details.evidence||[]).map(q=>`<p>“${esc(q)}”</p>`).join('');
 const meta=r.evidence_meta||{};
 const coverage=meta.status==='abstract_and_claims'?`Abstract + ${r.claims.length} claims`:meta.status==='article_excerpt'?`Accessible excerpt - ${Number(meta.body_characters).toLocaleString()} characters`:meta.status==='article_text'?`Article text · ${Number(meta.body_characters).toLocaleString()} characters`:meta.status==='unavailable'?'Limited evidence · source unavailable':meta.status==='partial'?'Partial source evidence':r.content_kind.replaceAll('_',' ');
 return `<article class="card"><div class="card-top"><span class="type-label">${esc(r.document_type)} · ${esc(coverage)}</span>${score}</div>
 <h3>${anchor(r.url,r.title)}</h3><div class="meta">${esc(r.source_name)} · ${r.source_aliases?.length>1?`<details><summary>${r.source_aliases.length} source records merged</summary>${r.source_aliases.map(a=>`<p>${anchor(a.url,a.source_name)}</p>`).join('')}</details>`:''}
 ${meta.discovery?.date_basis&&r.published_date?'Index date (unverified): ':''}${esc(r.published_date||'Publication date unknown')} ${r.publication_number?' · '+esc(r.publication_number):''}${historicalPatent(r)?' · HISTORICAL PATENT':''}</div>
 ${r.assignees.length?`<p class="meta">ASSIGNEE · ${esc(r.assignees.join('; '))}</p>`:''}
 <p>${esc(preview)}</p>
 ${(r.summary_details?.technical_points||[]).length?`<ul class="technical-points">${r.summary_details.technical_points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:''}
 ${r.why_it_matters?`<div class="why"><b>ENGINEERING IMPLICATION</b>${esc(r.why_it_matters)}</div>`:''}
 <div class="tags">${r.topics.map(t=>`<span class="tag">${esc(names[t]||t)}</span>`).join('')}</div>
 <details><summary>Evidence & assessment</summary><p>${esc(r.score_reason||'Captured from source; awaiting model assessment.')}</p>
 ${r.summary && sourceText.length>420?`<p><b>Detailed summary</b><br>${esc(r.summary)}</p>`:''}
 <div class="score-grid">${['priority','novelty','engineering_value','quality','confidence'].filter(k=>details[k]!=null).map(k=>`<span>${esc(k.replaceAll('_',' '))}: ${esc(details[k])}</span>`).join('')}</div>
 ${r.previous_assessment?`<p class="meta">Previous assessment → current: ${['relevance','quality','confidence'].map(k=>`${esc(k)} ${esc(r.previous_assessment[k])} → ${esc(details[k])}`).join(' · ')}</p>`:''}
 ${r.status==='dropped_lowscore'?'<p>Below the selection threshold (relevance 65). Retained for review and comparison.</p>':''}
 ${evidence}${(details.limitations||[]).map(l=>`<p>Limit: ${esc(l)}</p>`).join('')}
 ${(r.summary_details?.limitations||[]).map(l=>`<p>Source limitation: ${esc(l)}</p>`).join('')}
 ${r.abstract?`<p><b>${meta.abstract_retrieved?'Publication abstract':'Original abstract / excerpt'}</b><br>${esc(r.abstract)}</p>`:''}
 ${r.claims?.length?`<details class="source-detail"><summary>Read ${r.claims.length} patent claims</summary><div class="source-scroll">${r.claims.map(c=>`<p>${esc(c)}</p>`).join('')}</div></details>`:''}
 ${r.body_text?`<details class="source-detail"><summary>Read cleaned article text (${r.body_text.length.toLocaleString()} characters)</summary><div class="source-scroll article-text">${esc(readableSource(r.body_text))}</div></details>`:''}
 ${r.original_evidence?`<details class="source-detail"><summary>View original stored evidence — unchanged</summary><p class="meta">The database retains the original captured text. Readability formatting and source grouping do not delete records.</p><div class="source-scroll article-text">${esc([r.original_evidence.abstract,...(r.original_evidence.claims||[]),r.original_evidence.body_text].filter(Boolean).join('\n\n'))}</div></details>`:''}
 ${r.source_aliases?.length>1?`<details><summary>${r.source_aliases.length} source records merged</summary>${r.source_aliases.map(a=>`<p>${anchor(a.url,a.source_name)}</p>`).join('')}</details>`:''}
 ${meta.discovery?`<p class="meta">Discovered via ${esc(meta.discovery.provider)} - ${esc(meta.discovery.date_basis||'')}</p>`:''}
 ${meta.status?`<p class="meta">${esc(meta.method)} · ${esc(meta.checked_at?.slice(0,10))}<br>${esc(meta.coverage)}<br>${anchor(meta.source_url,'Open evidence source ↗')}</p>`:''}
 <p>Captured ${esc(r.fetched_date)}${r.filing_date?' · Filed '+esc(r.filing_date):''}${r.priority_date?' · Priority '+esc(r.priority_date):''}. ${details.verified?'High-score assessment checked in a second model pass.':''}</p></details></article>`;
}
function empty(title,body,link=''){return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(body)}</p>${link}</div>`;}
function showOverview(){
 $('overview-topics').innerHTML=[['','All tracks'],...Object.entries(names)].map(([id,name])=>`<button data-track="${esc(id)}" class="${track===id?'selected':''}" aria-pressed="${track===id}">${esc(name)}</button>`).join('');
 $('overview-topics').querySelectorAll('button').forEach(b=>b.onclick=()=>{track=b.dataset.track;showOverview();});
 const rows=ranked(reviewed.filter(r=>!track||r.topics.includes(track))).slice(0,10);
 $('featured').innerHTML=rows.length?rows.map(card).join(''):empty('Your next signal is on its way.',pending.length?`${pending.length} relevant records have been captured and are awaiting review. Approved results will appear here after scoring.`:'The first collection is ready to run. Once sources are connected, reviewed developments will appear here.','<a href="#archive" id="pending-link">Browse pending records ↗</a>');
 const link=$('pending-link'); if(link)link.onclick=()=>{$('status').value='candidate';renderLibrary();};
}
function renderLibrary(reset=true){
 if(reset)pageSize=30;
 const terms=$('search').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
 filtered=data.records.filter(r=>{
 const hay=[r.title,r.abstract,r.summary,r.body_text,...(r.claims||[]),r.publication_number,...r.assignees,...r.authors,...r.topics.map(t=>names[t])].join(' ').toLowerCase();
 return terms.every(t=>hay.includes(t)) && (!$('topic').value||r.topics.includes($('topic').value)) && (!$('type').value||r.document_type===$('type').value) && (!$('status').value||r.status===$('status').value) && (!$('from').value||(r.published_date&&r.published_date>=$('from').value));
 });
 const sort=$('sort').value;
 filtered.sort((a,b)=>sort==='newest'?recordDate(b).localeCompare(recordDate(a)):sort==='relevance'?(b.relevance_score||0)-(a.relevance_score||0):sort==='priority'?priority(b)-priority(a):balancedScore(b)-balancedScore(a) || priority(b)-priority(a) || recordDate(b).localeCompare(recordDate(a)));
 $('result-count').textContent=`${filtered.length} records · ${$('status').value==='candidate'?'Source material awaiting assessment':'Searches the stored collection'}`;
 $('results').innerHTML=filtered.length?filtered.slice(0,pageSize).map(card).join(''):empty('No matching records.','Try another track, remove a filter, or switch to Pending review to inspect newly captured material.');
 $('more').hidden=pageSize>=filtered.length;
}
function route(){
 const name=['overview','archive','briefs','sources','chat'].includes(location.hash.slice(1))?location.hash.slice(1):'overview';
 document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==name);
 document.querySelectorAll('nav a').forEach(a=>{a.classList.toggle('active',a.dataset.view===name);if(a.dataset.view===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 document.querySelector('.hero').hidden=name!=='overview';document.querySelector('.metrics').hidden=name!=='overview';
 if(name==='archive')renderLibrary();
}
const latest=data.runs.find(r=>!['score_pending','briefs_only'].includes(r.counts.mode));
$('updated').textContent=latest?`Last update · ${latest.started_at} UTC`:'No collection has run yet';
const patentCount=reviewed.filter(r=>r.document_type==='patent').length;
$('metrics').innerHTML=[
 ['Selected records',reviewed.length,'Passed automated screening'],
 ['Selected patents',patentCount,'Included in selected records'],
 ['Pending assessment',pending.length,'Captured; not selected yet'],
 ['Research tracks',data.topics.length,'Topics monitored, not records']
].map(([label,n,note])=>`<div class="metric"><span>${esc(label)}</span><b>${n}</b><small>${esc(note)}</small></div>`).join('')+
 '<p class="metrics-note">Current library totals across all dates. Duplicate source records are grouped; patents are part of the selected total, while pending records are separate.</p>';
const errors=latest?.errors||[];
const runLabel=r=>r.counts.mode==='briefs_only'?'Weekly brief refresh · stored research':r.counts.mode==='evidence_retry'?'Source retrieval retry · changed evidence only':r.counts.mode==='evidence_refresh'?'Source evidence refresh · stored collection':r.counts.mode==='patent_sample'?`Historical patent sample · ${r.counts.lookback_days} days · one query per track`:r.counts.mode==='score_pending'?'Stored-record assessment':'Incremental collection';
$('health').innerHTML=latest?`<div class="health-line">${latest.counts.fetched||0} records fetched in the last run</div><div class="health-line">${latest.counts.scored||0} assessed · ${latest.counts.cached||0} cached</div>${errors.length?`<div class="health-line warning">${errors.length} source / processing notices. Review Sources for details.</div>`:'<div class="health-line">Last run completed without reported errors.</div>'}`:'<div class="health-line warning">Awaiting first collection. Source availability is not yet verified.</div>';
if(latest?.counts.fetched_by_provider) $('health').insertAdjacentHTML('beforeend',`<div class="health-line">${Object.entries(latest.counts.fetched_by_provider).map(([k,v])=>`${esc(k.replaceAll('_',' '))}: ${Number(v)}`).join(' / ')}</div>`);
if(latest) $('health').insertAdjacentHTML('afterbegin',`<div class="health-line">${esc(runLabel(latest))}</div>`);
 const coverageTotals=data.records.reduce((acc,r)=>{const key=r.evidence_meta?.status;if(key)acc[key]=(acc[key]||0)+1;return acc;},{});
 if(coverageTotals.abstract_and_claims || coverageTotals.article_text) $('health').insertAdjacentHTML('beforeend',`<div class="health-line">Collection coverage: ${coverageTotals.abstract_and_claims||0} abstracts + claims · ${coverageTotals.article_text||0} article bodies · ${coverageTotals.article_excerpt||0} accessible excerpts</div>`);
 if(coverageTotals.unavailable || coverageTotals.partial) $('health').insertAdjacentHTML('beforeend',`<div class="health-line warning">${coverageTotals.unavailable||0} sources unavailable for deeper retrieval · ${coverageTotals.partial||0} partial patent records. Existing evidence retained.</div>`);
$('track-summary').innerHTML=data.topics.map(t=>`<div class="track-line"><span>${esc(t.name)}</span><b>${reviewed.filter(r=>r.topics.includes(t.id)).length}</b></div>`).join('');
$('topic').innerHTML+='<option disabled>────────</option>'+data.topics.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
$('source-list').innerHTML=data.sources.map(s=>`<article class="source-card"><h3>${anchor(s.url,s.name+' ↗')}</h3><p>${esc(s.access)}</p></article>`).join('');
$('run-list').innerHTML=data.runs.length?data.runs.map(r=>`<div class="run"><b>${esc(r.started_at)} UTC</b><p>${r.counts.mode==='briefs_only'?`${r.counts.briefs_generated||0} weekly briefs generated from stored research`:`Fetched ${r.counts.fetched||0} · Scored ${r.counts.scored||0} · Included ${r.counts.included||0} · Cached ${r.counts.cached||0}`}</p>${r.errors.length?'<ul>'+r.errors.map(e=>`<li>${esc(e)}</li>`).join('')+'</ul>':'No reported errors.'}</div>`).join(''):empty('No collection history yet.','Run the collector to record source availability and processing results.');
document.querySelectorAll('#run-list .run').forEach((el,i)=>el.insertAdjacentHTML('afterbegin',`<p>${esc(runLabel(data.runs[i]))}</p>`));
function briefHTML(text){
 const inline=value=>esc(value).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,title,url)=>anchor(url.replaceAll('&amp;','&'),title.replaceAll('&amp;','&'))).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
 const output=[];let list='';
 const close=()=>{if(list){output.push(`</${list}>`);list='';}};
 for(const raw of String(text||'').split(/\r?\n/)){
  const line=raw.trim();if(!line){close();continue;}
  const heading=line.match(/^#{2,3}\s+(.+)$/);
  if(heading){close();output.push(`<h3>${inline(heading[1])}</h3>`);continue;}
  const bullet=line.match(/^[-*]\s+(.+)$/),number=line.match(/^\d+\.\s+(.+)$/);
  if(bullet||number){const kind=bullet?'ul':'ol';if(list!==kind){close();output.push(`<${kind}>`);list=kind;}output.push(`<li>${inline((bullet||number)[1])}</li>`);continue;}
  close();output.push(`<p>${inline(line)}</p>`);
 }
 close();return output.join('');
}
function renderBriefs(){
 $('brief-topics').innerHTML=[['','All tracks'],...Object.entries(names)].map(([id,name])=>`<button data-track="${esc(id)}" class="${briefTrack===id?'selected':''}" aria-pressed="${briefTrack===id}">${esc(name)}</button>`).join('');
 $('brief-topics').querySelectorAll('button').forEach(b=>b.onclick=()=>{briefTrack=b.dataset.track;renderBriefs();});
 const weeks=briefTrack?(data.topic_weeks||[]).filter(w=>w.topic_id===briefTrack):data.weeks;
 $('brief-list').innerHTML=weeks.length?weeks.map(w=>`<article class="brief"><p class="eyebrow">${esc(w.week_start)} — ${esc(w.week_end)}${w.topic_id?' · '+esc(names[w.topic_id]||w.topic_id):' · All tracks'}</p><div class="brief-body">${briefHTML(w.synthesis_md)}</div></article>`).join(''):empty('No brief for this track yet.','Topic briefs are generated after the next completed weekly collection.');
}
renderBriefs();
['search','topic','type','status','from','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>renderLibrary()));
$('more').onclick=()=>{pageSize+=30;renderLibrary(false);};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(filtered,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='research-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('hashchange',route);showOverview();renderLibrary();route();

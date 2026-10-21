'use strict';
(() => {
 const el=id=>document.getElementById(id);
 let token='',ready=false,busy=false,history=[];
 const api=JSON.parse(el('team-data').textContent).chat_api_url || '';
 const remote=!!api && api!==location.origin;
 let authorization='';
 const headers=()=>({...remote?{'Authorization':authorization,'ngrok-skip-browser-warning':'true'}:{}});
 const welcome=el('chat-messages').innerHTML;
 const node=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
 const safeLink=(url,text)=>{const a=node('a',text);try{const u=new URL(url);if(['http:','https:'].includes(u.protocol))a.href=u.href;}catch{}a.target='_blank';a.rel='noopener noreferrer';return a;};
 function error(message){el('chat-error').textContent=message;el('chat-error').hidden=!message;}
 function controls(){el('chat-send').disabled=!ready||busy;el('chat-reset').disabled=busy;el('chat-question').disabled=busy;el('chat-type').disabled=busy;}
 async function request(path,payload){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),300000);
  try{const r=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json','X-Chat-Token':token,...headers()},body:JSON.stringify(payload),signal:controller.signal});
   const body=await r.json();if(!r.ok)throw new Error(body.error||'Request failed.');return body;
  }finally{clearTimeout(timer);}
 }
 async function status(){
  if(!api && location.hostname!=='127.0.0.1' && location.hostname!=='localhost'){
   el('chat-status').textContent='Remote chat is awaiting its HTTPS connection.';el('chat-login').hidden=true;return;
  }
  if(remote && !authorization){el('chat-status').textContent='Sign in to use research chat.';el('chat-login').hidden=false;controls();return;}
  try{const r=await fetch(api+'/api/status',{headers:headers()});if(!r.ok)throw new Error(r.status===401?'Incorrect username or password.':'Chat service unavailable.');
   const state=await r.json();token=state.csrf;ready=state.ready;
   el('chat-status').textContent=ready?'Connected · ready to answer':'Chat is temporarily unavailable. Contact the administrator.';
   el('chat-login').hidden=true;el('chat-logout').hidden=!remote;
  }catch(e){ready=false;token='';el('chat-status').textContent=e.message||'Chat service unavailable.';
   el('chat-login').hidden=!remote;el('chat-logout').hidden=true;}
  controls();
 }
 el('chat-login').addEventListener('submit',async e=>{e.preventDefault();
  const bytes=new TextEncoder().encode(el('chat-username').value+':'+el('chat-password').value);
  authorization='Basic '+btoa(String.fromCharCode(...bytes));el('chat-password').value='';await status();
 });
 el('chat-logout').onclick=()=>{authorization='';token='';ready=false;history=[];el('chat-messages').innerHTML=welcome;examples();status();};
 function examples(){document.querySelectorAll('#chat-examples button').forEach(b=>b.onclick=()=>{el('chat-question').value=b.dataset.question;el('chat-question').focus();});}
 function renderAnswer(result){
  const box=node('article',null,'chat-answer');box.append(node('p','RESEARCH ASSISTANT','eyebrow'));
  const sources=new Map((result.sources||[]).map(s=>[s.citation,s]));
  for(const claim of result.claims||[]){
   box.append(node('p',claim.text));
   const refs=node('div',null,'chat-citations');
   for(const citation of claim.citations){
    const source=sources.get(citation.source);if(!source)continue;
    const detail=node('details');detail.append(node('summary',`${citation.source} · ${source.title}`));
    detail.append(node('blockquote',citation.quote));
    detail.append(safeLink(source.evidence_url,'Open original source ↗'));
    detail.append(node('p',`${source.document_type} · ${source.content_kind.replaceAll('_',' ')} · ${source.aliases.length} stored source record(s)`,'meta'));
    if(source.evidence_meta.coverage)detail.append(node('p',source.evidence_meta.coverage,'meta'));
    refs.append(detail);
   }
   box.append(refs);
  }
  if(result.limitations?.length){box.append(node('h4','Evidence limits'));const list=node('ul');result.limitations.forEach(x=>list.append(node('li',x)));box.append(list);}
  el('chat-messages').append(box);
  return (result.claims||[]).map(c=>c.text).join('\n')+'\n'+(result.limitations||[]).join('\n');
 }
 el('chat-form').addEventListener('submit',async e=>{e.preventDefault();const question=el('chat-question').value.trim();if(!question||busy||!ready)return;
  error('');busy=true;controls();document.querySelector('.chat-welcome')?.remove();
  const questionBox=node('article',null,'chat-question');questionBox.append(node('p','YOU','eyebrow'),node('p',question));el('chat-messages').append(questionBox);
  el('chat-progress').textContent='Searching stored evidence and checking source quotations…';
  try{const result=await request('/api/chat',{question,history:history.slice(-8),document_type:el('chat-type').value});
   const text=renderAnswer(result);history.push({role:'user',content:question},{role:'assistant',content:text.slice(0,1500)});el('chat-question').value='';
  }catch(e){error(e.name==='AbortError'?'The answer timed out. Please retry your question.':e.message);questionBox.remove();}
  finally{busy=false;el('chat-progress').textContent='';controls();el('chat-question').focus();}
 });
 el('chat-question').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(ready&&!busy)el('chat-form').requestSubmit();}});
 el('chat-reset').onclick=()=>{history=[];el('chat-messages').innerHTML=welcome;el('chat-question').value='';error('');examples();};
 examples();status();
})();

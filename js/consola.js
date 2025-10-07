/* ================= Tema ================= */
  (function theme(){
    const root = document.documentElement;
    const btn = document.getElementById('themeBtn');
    const KEY='theme';
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const apply = (m)=>{ root.setAttribute('data-theme', m==='auto' ? (prefersDark?'dark':'light') : m); localStorage.setItem(KEY,m); };
    apply(localStorage.getItem(KEY)||'auto');
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{ if((localStorage.getItem(KEY)||'auto')==='auto') apply('auto'); });
    }
    btn.addEventListener('click',()=>{
      const order=['light','dark','auto'];
      const curr=localStorage.getItem(KEY)||'auto';
      const next=order[(order.indexOf(curr)+1)%order.length];
      apply(next);
    });
  })();

  /* ================= Utilidades UI ================= */
  const screenEl = document.getElementById('screen');
  const inputEl = document.getElementById('input');
  const copyBtn = document.getElementById('copyBtn');
  const resetBtn = document.getElementById('resetBtn');
  const toast = document.getElementById('toast');

  const showToast=(msg)=>{ toast.textContent=msg; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'), 1200); };
  copyBtn.addEventListener('click', async ()=>{
    const text = Array.from(screenEl.querySelectorAll('.line')).map(l=>l.textContent).join('\n');
    try { await navigator.clipboard.writeText(text); showToast('Salida copiada'); } catch { showToast('No se pudo copiar'); }
  });

  /* ================= Estado del sistema de archivos y Git ================= */
  const initialFS = {
    '/': { type:'dir', children: { 'app': {type:'dir', children:{}}, 'README.md': {type:'file', content:'# Proyecto Sandbox\n'} } }
  };

  // cloneFS robusto: acepta nodo o FS completo
  function cloneFS(src){
    if (!src) return null;
    // Si nos pasan el FS completo { '/': {...} }
    if (src['/']) {
      return { '/': cloneFS(src['/']) };
    }
    if (src.type === 'file') {
      return { type:'file', content: src.content };
    }
    // dir
    const out = { type:'dir', children:{} };
    const entries = Object.entries(src.children || {});
    for (const [k, v] of entries) out.children[k] = cloneFS(v);
    return out;
  }

  const initialRepo = {
    isRepo:false,
    head: 'master',
    branches: {},
    index: {},
    working: {},
    commits: {},
    logs: [],
    reflog: [],
    stashes: []
  };

  let FS = cloneFS(initialFS);
  let REPO = JSON.parse(JSON.stringify(initialRepo));
  let CWD = '/';

  const save = ()=> localStorage.setItem('git-sandbox', JSON.stringify({FS,REPO,CWD}));
  const load = ()=> {
    const raw=localStorage.getItem('git-sandbox');
    if(!raw) return;
    try{
      const s=JSON.parse(raw);
      FS   = (s.FS && s.FS['/']) ? s.FS : cloneFS(initialFS);
      REPO = s.REPO ? s.REPO : JSON.parse(JSON.stringify(initialRepo));
      CWD  = s.CWD || '/';
    }catch{
      FS = cloneFS(initialFS);
      REPO = JSON.parse(JSON.stringify(initialRepo));
      CWD = '/';
    }
  };
  load();

  const pathJoin=(a,b)=> (a==='/'?'/':a.replace(/\/$/, '/')) + (b||'');
  const resolve=(p)=>{ if(!p||p==='.') return CWD; if(p==='..') return CWD==='/'?'/':CWD.replace(/\/?[^/]+$/, ''); if(p.startsWith('/')) return p; return pathJoin(CWD.endsWith('/')?CWD:CWD+'/', p); };
  function getNode(path){ const parts=path.split('/').filter(Boolean); let node=FS['/']; for(const part of parts){ if(!node.children[part]) return null; node=node.children[part]; } return node; }
  function ensureParent(path){ const parts=path.split('/').filter(Boolean); parts.pop(); let cur=FS['/']; for(const part of parts){ cur.children[part]=cur.children[part]||{type:'dir', children:{}}; cur=cur.children[part]; } return cur; }

  const snapshotWorking = ()=>{ const map={}; function walk(node, base){ for(const [name,child] of Object.entries(node.children||{})){ const p = base+name; if(child.type==='file') map[p]=child.content; else walk(child, p+'/'); } } walk(FS['/'], '/'); return map; };

  const updateWorkingFromTree = (tree)=>{
    FS = cloneFS(initialFS); // reset base
    for(const [p,content] of Object.entries(tree||{})){
      const parent=ensureParent(p);
      parent.children[p.split('/').pop()]={type:'file', content};
    }
  };

  const newCommitId = ()=> Math.random().toString(16).slice(2,8);

  function writeCommit(msg){
    const parentId = REPO.branches[REPO.head] || null;
    const tree = {...snapshotWorking()};
    for(const [p,c] of Object.entries(REPO.index)) tree[p]=c;
    const id=newCommitId();
    REPO.commits[id]={ msg, parent: parentId, tree };
    REPO.branches[REPO.head]=id;
    REPO.logs.push(id);
    REPO.reflog.push(`commit: ${id} ${msg}`);
    REPO.index={};
    return id;
  }

  const repoStatus = ()=>{
    const work = snapshotWorking();
    const headId = REPO.branches[REPO.head];
    const headTree = headId ? REPO.commits[headId].tree : {};
    const changes = { untracked:[], modified:[], staged:Object.keys(REPO.index) };
    for(const p of Object.keys(work)){
      if(!(p in headTree)) changes.untracked.push(p);
      else if(work[p]!==headTree[p] && !(p in REPO.index)) changes.modified.push(p);
    }
    return changes;
  };

  const fastForwardMerge = (from)=>{
    const their = REPO.branches[from];
    if(their === undefined) return {ok:false, msg:`fatal: la rama ${from} no existe`};
    REPO.branches[REPO.head]=their;
    REPO.reflog.push(`merge (ff): ${from} -> ${REPO.head}`);
    updateWorkingFromTree(their?REPO.commits[their].tree:{});
    return {ok:true};
  };

  /* ================= Comandos ================= */
  const commands = {
    help(){
      return (
`Comandos soportados:
  pwd, ls, cd, cat, touch <file>, rm <file>, mkdir <dir>, clear
  git init
  git status
  git add <file>
  git commit -m "mensaje"
  git log --oneline
  git branch [nombre] | git checkout [-b] <rama>
  git merge <rama>
  git reset [--soft|--hard] HEAD~1
  git revert <hash>
  git diff [file]
  git stash save "msg" | git stash list | git stash pop`
      );
    },
    clear(){ screenEl.innerHTML=''; return ''; },
    pwd(){ return CWD; },
    ls(){ const node=getNode(CWD); if(!node||node.type!=='dir') return 'error'; return Object.keys(node.children).sort().join('  '); },
    mkdir(arg){ if(!arg) return 'uso: mkdir <dir>'; const p=resolve(arg); const parent=ensureParent(p); const name=p.split('/').filter(Boolean).pop(); parent.children[name]=parent.children[name]||{type:'dir', children:{}}; return ''; },
    cd(arg){ if(!arg) return 'uso: cd <dir>'; const p=resolve(arg); const n=getNode(p); if(!n||n.type!=='dir') return `cd: no existe directorio: ${arg}`; CWD=p; return ''; },
    cat(arg){ if(!arg) return 'uso: cat <archivo>'; const n=getNode(resolve(arg)); if(!n||n.type!=='file') return `cat: no existe archivo: ${arg}`; return n.content; },
    touch(arg){ if(!arg) return 'uso: touch <archivo>'; const p=resolve(arg); const parent=ensureParent(p); parent.children[p.split('/').pop()]={type:'file', content:''}; return ''; },
    rm(arg){ if(!arg) return 'uso: rm <archivo>'; const p=resolve(arg); const parts=p.split('/').filter(Boolean); const name=parts.pop(); let dir=FS['/']; for(const part of parts){ if(!dir.children[part]) return `rm: no existe: ${arg}`; dir=dir.children[part]; } if(!dir.children[name]) return `rm: no existe: ${arg}`; delete dir.children[name]; return ''; },

    'git init'(){ if(REPO.isRepo) return 'Ya es un repositorio Git.'; REPO.isRepo=true; REPO.head='main'; REPO.branches={ main:null }; REPO.index={}; REPO.working=snapshotWorking(); REPO.logs=[]; REPO.reflog=['init']; return 'Initialized empty Git repository in ./'; },
    'git status'(){ if(!REPO.isRepo) return 'fatal: no es un repositorio Git (ejecuta `git init`)'; const st=repoStatus(); const staged = REPO.index; let out = `En la rama ${REPO.head}\n`;
      const any = st.untracked.length||st.modified.length||Object.keys(staged).length;
      if(!REPO.branches[REPO.head] && !any) out += '\nNo hay commits aún\n';
      if(Object.keys(staged).length){ out += '\nCambios a ser confirmados:\n'; for(const p of Object.keys(staged)) out += `\tnew file:   ${p}\n`; }
      if(st.modified.length){ out += '\nCambios no preparados para commit:\n'; for(const p of st.modified) out += `\tmodificado: ${p}\n`; }
      if(st.untracked.length){ out += '\nArchivos sin seguimiento:\n'; for(const p of st.untracked) out += `\t${p}\n`; }
      return out.trim(); },
    'git add'(arg){ if(!REPO.isRepo) return 'fatal: no es un repositorio Git'; if(!arg) return 'uso: git add <archivo>'; const p=resolve(arg); const n=getNode(p); if(!n||n.type!=='file') return `fatal: ruta no coincide con ningún archivo: ${arg}`; REPO.index[p]=n.content; return ''; },
    'git commit'(flag, message){ if(!REPO.isRepo) return 'fatal: no es un repositorio Git'; if(flag!== '-m' || !message) return 'uso: git commit -m "mensaje"'; if(Object.keys(REPO.index).length===0) return 'nada para commitear'; const id=writeCommit(message); return `[${REPO.head} ${id}] ${message}`; },
    'git log'(opt){ if(!REPO.isRepo) return 'fatal: no es un repositorio Git'; const head=REPO.branches[REPO.head]; if(!head) return 'No hay commits aún.'; let list=[]; let cur=head; while(cur){ list.push(cur); cur=REPO.commits[cur].parent; } if(opt==='--oneline') return list.map(id=> id+ ' ' + REPO.commits[id].msg).join('\n'); return list.map(id=>`commit ${id}\n\n    ${REPO.commits[id].msg}\n`).join('\n'); },
    'git branch'(name){ if(!REPO.isRepo) return 'fatal: no es un repositorio Git'; if(!name) return Object.keys(REPO.branches).map(b=> (b===REPO.head?`* ${b}`:`  ${b}`)).join('\n'); if(REPO.branches[name]!==undefined) return `fatal: la rama '${name}' ya existe`; REPO.branches[name]=REPO.branches[REPO.head]||null; REPO.reflog.push(`branch: ${name}`); return ''; },
    'git checkout'(flag, name){ if(!REPO.isRepo) return 'fatal: no es un repositorio Git'; let target=name, create=false; if(flag==='-b'){ create=true; } else { target=flag; }
      if(create){ if(REPO.branches[target]!==undefined) return `fatal: la rama '${target}' ya existe`; REPO.branches[target]=REPO.branches[REPO.head]||null; }
      if(!(target in REPO.branches)) return `error: rama '${target}' no existe`;
      REPO.head=target; const id=REPO.branches[target]; updateWorkingFromTree(id?REPO.commits[id].tree:{}); REPO.index={}; return `Cambiado a rama '${target}'`; },
    'git merge'(from){ if(!REPO.isRepo) return 'fatal: no es un repositorio Git'; if(!from) return 'uso: git merge <rama>'; const res=fastForwardMerge(from); return res.ok?`Merge hecho (fast-forward) desde ${from}`:res.msg; },
    'git reset'(mode, spec){ if(!REPO.isRepo) return 'fatal: no es un repositorio Git'; if(spec!== 'HEAD~1') return 'solo soportado: git reset [--soft|--hard] HEAD~1'; const head=REPO.branches[REPO.head]; if(!head) return 'no hay commits para reset'; const parent=REPO.commits[head].parent || null; if(mode==='--soft'){ REPO.branches[REPO.head]=parent; REPO.reflog.push('reset --soft'); return 'HEAD movido (soft)'; } if(mode==='--hard'){ REPO.branches[REPO.head]=parent; updateWorkingFromTree(parent?REPO.commits[parent].tree:{}); REPO.index={}; REPO.reflog.push('reset --hard'); return 'HEAD movido (hard)'; } return 'uso: git reset [--soft|--hard] HEAD~1'; },
    'git revert'(hash){ if(!REPO.isRepo) return 'fatal: no es un repositorio Git'; if(!hash || !REPO.commits[hash]) return 'fatal: commit no encontrado'; const msg=`Revert "${REPO.commits[hash].msg}"`; const id=writeCommit(msg); return `[${REPO.head} ${id}] ${msg}`; },
    'git diff'(file){ if(!REPO.isRepo) return 'fatal: no es un repositorio Git'; const head=REPO.branches[REPO.head]; const headTree=head?REPO.commits[head].tree:{}; const work=snapshotWorking(); const paths = file? [resolve(file)] : Array.from(new Set([...Object.keys(work), ...Object.keys(headTree)])); let out=''; for(const p of paths){ const a=headTree[p]||''; const b=work[p]||''; if(a!==b){ out+=`diff -- ${p}\n- ${a.replace(/\n/g,'\n- ')}\n+ ${b.replace(/\n/g,'\n+ ')}\n`; } } return out||'sin diferencias'; },
    'git stash'(sub, msg){ if(!REPO.isRepo) return 'fatal: no es un repositorio Git'; if(sub==='save'){ const work=snapshotWorking(); REPO.stashes.push({work, msg: msg||'WIP'}); updateWorkingFromTree(REPO.branches[REPO.head]?REPO.commits[REPO.branches[REPO.head]].tree:{}); return `Guardado en stash@{${REPO.stashes.length-1}}: ${msg||'WIP'}`; } if(sub==='list'){ return REPO.stashes.map((s,i)=>`stash@{${i}}: ${s.msg}`).join('\n')||'(vacío)'; } if(sub==='pop'){ const s=REPO.stashes.pop(); if(!s) return 'no hay stashes'; updateWorkingFromTree(s.work); return 'stash aplicado y eliminado'; } return 'uso: git stash save "msg" | git stash list | git stash pop'; }
  };

  /* ================= Parser ================= */
  function runCommand(raw){
    const line = raw.trim();
    if(!line) return '';
    if(line==='help') return commands.help();

    // git commit -m "..."
    if(line.startsWith('git commit')){
      const m = line.match(/^git\s+commit\s+-m\s+\"([^\"]+)\"$/);
      return m? commands['git commit']('-m', m[1]) : 'uso: git commit -m "mensaje"';
    }
    // variantes con opciones
    if(line.startsWith('git log')){
      return commands['git log'](line.includes('--oneline')?'--oneline':undefined);
    }
    if(line.startsWith('git branch')){
      const name = line.split(/\s+/)[2];
      return commands['git branch'](name);
    }
    if(line.startsWith('git checkout')){
      const parts=line.split(/\s+/);
      if(parts[2]==='-b') return commands['git checkout']('-b', parts[3]);
      return commands['git checkout'](parts[2]);
    }
    if(line.startsWith('git merge ')){
      return commands['git merge'](line.split(/\s+/)[2]);
    }
    if(line.startsWith('git reset')){
      const parts=line.split(/\s+/);
      return commands['git reset'](parts[2], parts[3]);
    }
    if(line.startsWith('git revert')){
      return commands['git revert'](line.split(/\s+/)[2]);
    }
    if(line.startsWith('git diff')){
      const parts=line.split(/\s+/);
      return commands['git diff'](parts[2]);
    }
    if(line.startsWith('git stash')){
      const parts=line.match(/^git\s+stash(?:\s+(save|list|pop))(?:\s+\"([^\"]+)\")?$/);
      if(!parts) return 'uso: git stash save "msg" | git stash list | git stash pop';
      return commands['git stash'](parts[1], parts[2]);
    }
    if(line.startsWith('git add ')){
      return commands['git add'](line.slice(8));
    }
    if(line==='git init' || line==='git status'){
      return commands[line]();
    }

    // Shell
    const [cmd, ...rest] = line.split(/\s+/);
    const arg = rest.join(' ');
    if(commands[cmd]) return commands[cmd](arg);
    return `comando no reconocido: ${line}`;
  }

  function print(text, cls){
    if(text===undefined || text===null) return;
    const lines = String(text).split('\n');
    for(const l of lines){
      const div=document.createElement('div');
      div.className='line ' + (cls||'');
      div.textContent=l;
      screenEl.appendChild(div);
    }
    screenEl.scrollTop = screenEl.scrollHeight;
  }

  function promptEcho(cmd){ print(`$ ${cmd}`, 'cmd'); }

  /* ================= Retos ================= */
  const CHALLENGES = [
    { id:'c1', title:'Inicializa el repositorio', text:'Crea un repo e inspecciona su estado.', steps:[
      { hint:'Ejecuta git init', done:()=> REPO.isRepo===true },
      { hint:'Mira el estado con git status', done:()=> true }
    ]},
    { id:'c2', title:'Crea y confirma tu primer archivo', text:'Crea README.md, agréguelo al staging y haz commit.', steps:[
      { hint:'Crea un archivo: touch README.md', done:()=> !!getNode('/README.md') },
      { hint:'Añádelo: git add README.md', done:()=> '/README.md' in REPO.index },
      { hint:'Confirma: git commit -m "primer commit"', done:()=> REPO.logs.length>=1 }
    ]},
    { id:'c3', title:'Ramas básicas', text:'Crea una rama feature/login y cámbiate a ella.', steps:[
      { hint:'git branch feature/login', done:()=> 'feature/login' in REPO.branches },
      { hint:'git checkout feature/login', done:()=> REPO.head==='feature/login' }
    ]},
    { id:'c4', title:'Merge fast-forward', text:'Desde feature/login, crea un archivo app/auth.js y haz merge a main.', steps:[
      { hint:'touch app/auth.js', done:()=> !!getNode('/app/auth.js') },
      { hint:'git add app/auth.js', done:()=> '/app/auth.js' in REPO.index },
      { hint:'git commit -m "feat: auth"', done:()=> REPO.logs.length>=2 },
      { hint:'git checkout main', done:()=> REPO.head==='main' },
      { hint:'git merge feature/login', done:()=> { const t=REPO.branches.main; const c=t?REPO.commits[t].tree:{}; return '/app/auth.js' in (c||{}); } }
    ]}
  ];

  function renderChallenges(){
    const root=document.getElementById('challenges');
    root.innerHTML='';
    CHALLENGES.forEach((c,i)=>{
      const div=document.createElement('div');
      div.className='challenge';
      const doneAll = c.steps.every(s=>s.done());
      div.innerHTML=`<div class="badge-small">Reto ${i+1}</div>
        <h3>${c.title}</h3>
        <p>${c.text}</p>
        <ul style="margin:.25rem 0 .5rem 1rem; color:var(--text-dim)">
          ${c.steps.map(s=>`<li class="status">${s.done()? '✅':'⬜️'} ${s.hint}</li>`).join('')}
        </ul>
        <div>${doneAll? '✔ Completado':'Progreso: ' + c.steps.filter(s=>s.done()).length + '/' + c.steps.length}</div>`;
      root.appendChild(div);
    });
  }

  /* ================= Entrada y reinicio ================= */
  const history=[]; let hIndex=-1;

  function handle(line){
    if(!line.trim()) return;
    history.push(line);
    hIndex=-1;
    promptEcho(line);
    const out = runCommand(line);
    if(out) print(out);
    save();
    renderChallenges();
  }

  inputEl.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){
      const v=inputEl.value;
      inputEl.value='';
      handle(v);
    } else if(e.key==='ArrowUp'){
      if(history.length){
        hIndex = (hIndex===-1?history.length-1:Math.max(0,hIndex-1));
        inputEl.value = history[hIndex];
        inputEl.setSelectionRange(inputEl.value.length,inputEl.value.length);
        e.preventDefault();
      }
    } else if(e.key==='ArrowDown'){
      if(history.length){
        if(hIndex===-1) return; 
        hIndex = hIndex+1>=history.length? -1 : hIndex+1; 
        inputEl.value= hIndex===-1? '' : history[hIndex];
        e.preventDefault();
      }
    }
  });

  function initializeFresh(){
    FS = cloneFS(initialFS);
    REPO = JSON.parse(JSON.stringify(initialRepo));
    CWD = '/';
    save();
  }

  // Mensaje de bienvenida / recuperación
  if(!localStorage.getItem('git-sandbox')){
    initializeFresh();
    print('Bienvenido/a al simulador de Git.','ok');
    print('Escribe `help` para ver los comandos disponibles.','hint');
  } else if (!FS || !FS['/']) {
    // Estado previo inválido
    initializeFresh();
    print('Se detectó un estado previo inválido. Entorno reiniciado.','warn');
  } else {
    print('Sesión restaurada. Usa "Reiniciar" para empezar de cero.', 'hint');
  }

  // Botón Reiniciar: limpia almacenamiento y vuelve a estado base
  resetBtn.addEventListener('click', ()=>{
    localStorage.removeItem('git-sandbox');
    initializeFresh();
    screenEl.innerHTML='';
    print('Entorno reiniciado.','warn');
    renderChallenges();
    inputEl.focus();
  });

  renderChallenges();
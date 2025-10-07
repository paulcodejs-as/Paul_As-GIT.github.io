 // ===== Tema (claro/oscuro/auto) =====
  (function initTheme(){
    const root = document.documentElement;
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    function applyTheme(mode){ root.setAttribute('data-theme', mode === 'auto' ? (prefersDark ? 'dark':'light') : mode); localStorage.setItem('theme', mode); updateLabel(); }
    function currentMode(){ return localStorage.getItem('theme') || 'auto'; }
    function updateLabel(){ const label = document.getElementById('themeLabel'); const isDark = root.getAttribute('data-theme')==='dark'; const mode = currentMode(); label.textContent = mode==='auto' ? (isDark?'Auto • Oscuro':'Auto • Claro') : (isDark?'Oscuro':'Claro'); }
    applyTheme(saved || 'auto');
    if (window.matchMedia){ window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{ if ((localStorage.getItem('theme')||'auto')==='auto') applyTheme('auto');}); }
    document.getElementById('themeBtn').addEventListener('click',()=>{ const order=['light','dark','auto']; const curr=localStorage.getItem('theme')||'auto'; const next=order[(order.indexOf(curr)+1)%order.length]; applyTheme(next);});
  })();

  // ===== Terminal interactiva =====
  (function terminal(){
    const out = document.getElementById('termOutput');
    const input = document.getElementById('termInput');
    const run = document.getElementById('termRun');
    const resetBtn = document.getElementById('termReset');

    const repo = {
      inited:false,
      branch:'main',
      branches:['main'],
      staged:new Set(),
      files:new Set(),
      log:[]
    };

    function print(txt){ out.textContent += (out.textContent.endsWith('\n')?'':'\n') + txt; out.scrollTop = out.scrollHeight; }
    function status(){
      if (!repo.inited) return print('fatal: not a git repository (or any of the parent directories): .git');
      const staged=[...repo.staged];
      print(`# On branch ${repo.branch}`);
      if (staged.length){ print('Changes to be committed:'); staged.forEach(f=>print('  new file:   '+f)); }
      else { print('nothing to commit, working tree clean'); }
    }

    function exec(cmd){
      const parts = cmd.trim().split(/\s+/);
      if (!parts[0]) return;
      if (parts[0]==='help') return print(`Comandos: git init | git status | git add <archivo> | git commit -m "msg" | git branch | git checkout -b <rama> | git checkout <rama> | git log | reset`);
      if (parts[0]==='reset') { Object.assign(repo,{inited:false,branch:'main',branches:['main'],staged:new Set(),files:new Set(),log:[]}); out.textContent='Repositorio reiniciado.'; return; }
      if (parts[0]!== 'git') return print('Comando no soportado. Escribe "help".');

      const [,sub,...rest] = parts;
      switch(sub){
        case 'init':
          if (repo.inited) print('Reinitialized existing Git repository');
          else { repo.inited=true; print('Initialized empty Git repository in /project/.git/'); }
          break;
        case 'status': status(); break;
        case 'add':
          if (!repo.inited) return print('fatal: not a git repository');
          if (!rest[0]) return print('Nothing specified, nothing added.');
          repo.files.add(rest[0]); repo.staged.add(rest[0]); print(''); status();
          break;
        case 'commit':
          if (!repo.inited) return print('fatal: not a git repository');
          const mIndex = cmd.indexOf('-m');
          if (mIndex===-1) return print('error: need -m "mensaje"');
          const match = cmd.match(/-m\s+"([\s\S]+)"/);
          const message = match? match[1] : 'commit';
          const hash = Math.random().toString(16).slice(2,9);
          repo.log.unshift({hash,msg:message});
          repo.staged.clear();
          print(`[${repo.branch} ${hash}] ${message}`);
          break;
        case 'branch':
          if (!repo.inited) return print('fatal: not a git repository');
          repo.branches.forEach(b=> print((b===repo.branch?'* ':'  ')+b));
          break;
        case 'checkout':
          if (!repo.inited) return print('fatal: not a git repository');
          if (rest[0]==='-b'){ const name = rest[1]; if(!name) return print('usage: git checkout -b <branch>'); if(!repo.branches.includes(name)) repo.branches.push(name); repo.branch=name; print(`Switched to a new branch '${name}'`); }
          else { const name = rest[0]; if(!name) return print('usage: git checkout <branch>'); if(!repo.branches.includes(name)) return print(`error: pathspec '${name}' did not match any file(s) known to git`); repo.branch=name; print(`Switched to branch '${name}'`); }
          break;
        case 'log':
          if (!repo.inited) return print('fatal: not a git repository');
          if (!repo.log.length) return print('');
          repo.log.forEach(c=> print(`${c.hash} ${c.msg}`));
          break;
        default:
          print('Subcomando no soportado. Escribe "help".');
      }
    }

    function runCmd(){ const val = input.value; if(!val) return; print(`$ ${val}`); exec(val); input.value=''; }
    run.addEventListener('click', runCmd);
    input.addEventListener('keydown', e=>{ if(e.key==='Enter') runCmd(); });
    resetBtn.addEventListener('click', ()=>exec('reset'));
  })();

  // ===== Generador de commits =====
  (function cc(){
    const type = document.getElementById('ccType');
    const scope = document.getElementById('ccScope');
    const subject = document.getElementById('ccSubject');
    const body = document.getElementById('ccBody');
    const preview = document.getElementById('ccPreview');

    function build(){
      const t = type.value.trim();
      const s = scope.value.trim();
      const subj = subject.value.trim() || 'mensaje';
      const head = s? `${t}(${s}): ${subj}` : `${t}: ${subj}`;
      const msg = body.value.trim();
      const full = msg? `git commit -m "${head}" -m "${msg.replace(/"/g,'\"')}"` : `git commit -m "${head}"`;
      preview.textContent = full;
    }

    document.getElementById('ccBuild').addEventListener('click', build);
    document.getElementById('ccCopy').addEventListener('click', async ()=>{
      try { await navigator.clipboard.writeText(preview.textContent); const old = preview.textContent; preview.textContent = '✔ Copiado'; setTimeout(()=> preview.textContent = old, 900); } catch {}
    });
  })();

  // ===== Quiz =====
  (function quiz(){
    const questions = [
      {q:'¿Qué hace "git init"?', a:['Inicializa un repo en el directorio actual','Clona un repo remoto','Muestra el historial de commits'], i:0},
      {q:'¿Qué opción crea una nueva rama y cambia a ella?', a:['git branch nueva','git checkout -b nueva','git switch'], i:1},
      {q:'Comando seguro para deshacer un commit ya publicado:', a:['git reset --hard','git revert <hash>','git checkout <hash>'], i:1},
      {q:'¿Qué muestra "git status"?', a:['Ramas locales','Cambios staged / no staged y rama actual','Historial de merges'], i:1},
      {q:'¿Para combinar varios commits en uno durante rebase interactivo se usa:', a:['pick','drop','squash'], i:2}
    ];

    const box = document.getElementById('quizBox');
    const result = document.getElementById('quizResult');

    function render(){
      box.innerHTML = '';
      questions.forEach((it,idx)=>{
        const card = document.createElement('div'); card.className='card';
        const h3 = document.createElement('h3'); h3.textContent = `Q${idx+1}. ${it.q}`; card.appendChild(h3);
        it.a.forEach((opt,j)=>{
          const id = `q${idx}_${j}`;
          const row = document.createElement('div'); row.style.marginTop='.35rem';
          row.innerHTML = `<label class="muted"><input type="radio" name="q${idx}" value="${j}"> ${opt}</label>`;
          card.appendChild(row);
        });
        box.appendChild(card);
      });
      result.textContent='';
    }

    function check(){
      let ok=0; questions.forEach((it,idx)=>{ const sel = box.querySelector(`input[name="q${idx}"]:checked`); if (sel && Number(sel.value)===it.i) ok++; });
      result.textContent = `Puntaje: ${ok} / ${questions.length}`;
    }

    document.getElementById('quizCheck').addEventListener('click', check);
    document.getElementById('quizReset').addEventListener('click', render);
    render();
  })();

  // ===== Buscador de comandos =====
  (function search(){
    const cmds = [
      {cmd:'git init', desc:'Inicializa un nuevo repositorio en el directorio actual.'},
      {cmd:'git clone <url>', desc:'Clona un repositorio remoto.'},
      {cmd:'git status', desc:'Muestra estado del árbol de trabajo y staging.'},
      {cmd:'git add <file>', desc:'Agrega cambios al área de staging.'},
      {cmd:'git commit -m "mensaje"', desc:'Crea un commit con el mensaje indicado.'},
      {cmd:'git log --oneline --graph', desc:'Historial compacto con grafo de ramas.'},
      {cmd:'git branch -a', desc:'Lista ramas locales y remotas.'},
      {cmd:'git checkout -b <rama>', desc:'Crea una rama y cambia a ella.'},
      {cmd:'git merge <rama>', desc:'Fusiona la rama dada en la actual.'},
      {cmd:'git rebase <rama>', desc:'Reaplica commits sobre otra base.'},
      {cmd:'git stash', desc:'Guarda temporalmente cambios sin commit.'},
      {cmd:'git revert <hash>', desc:'Crea un commit que revierte otro (seguro).'}
    ];

    const ul = document.getElementById('cmdList');
    const input = document.getElementById('filter');

    function render(items){
      ul.innerHTML='';
      items.forEach(it=>{
        const li = document.createElement('li');
        li.className='card';
        li.innerHTML = `<div style="display:flex;justify-content:space-between;gap:1rem;align-items:center"><code>${it.cmd}</code><span class="muted">${it.desc}</span></div>`;
        ul.appendChild(li);
      });
    }

    input.addEventListener('input',()=>{
      const q = input.value.toLowerCase();
      const filtered = cmds.filter(it => it.cmd.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q));
      render(filtered);
    });

    render(cmds);
  })();
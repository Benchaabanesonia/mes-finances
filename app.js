
const KEY='mes-finances-zero-v4';const defaults={income:['Chômage','Remplacement','Indépendant','Autres','Maman (cash)'],expense:['Loyer + parking','Alimentation','Café (job)','Goûter','Vêtements','Sport','Loisirs','Santé']};let data=load(),editing=null;
function load(){try{let d=JSON.parse(localStorage.getItem(KEY));if(d&&Array.isArray(d.entries)&&d.categories)return d}catch(e){}return {entries:[],categories:structuredClone(defaults)}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){alert('Stockage indisponible. Exporte tes données.');throw e}}
const $=id=>document.getElementById(id);const today=()=>{let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};const fmt=n=>new Intl.NumberFormat('fr-CH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' CHF';
function show(id){for(let s of document.querySelectorAll('main section'))s.hidden=s.id!==id;if(id==='home'||id==='history')render();if(id==='settings')renderCategories();if(id==='analysis'){renderAnalysis();initCategoryAnalysis()}}
function sum(a){return Math.round(a.reduce((s,e)=>s+e.amount,0)*100)/100}
function paymentOf(e){if(e.type==='cash_in'||(e.type==='income'&&e.category==='Maman (cash)'&&e.payment===undefined))return 'cash';return e.payment==='cash'?'cash':'bank'}
function render(){const month=$('month').value||today().slice(0,7);let all=data.entries,items=all.filter(e=>e.date.slice(0,7)===month).sort((a,b)=>b.date.localeCompare(a.date));let inc=sum(items.filter(e=>e.type==='income'&&paymentOf(e)==='bank')),exp=sum(items.filter(e=>e.type==='expense'&&paymentOf(e)==='bank')),cashExp=sum(items.filter(e=>e.type==='expense'&&paymentOf(e)==='cash'));let cashAvailable=sum(all.filter(e=>(e.type==='cash_in'||e.type==='income')&&paymentOf(e)==='cash'&&e.date.slice(0,7)<=month))-sum(all.filter(e=>e.type==='expense'&&paymentOf(e)==='cash'&&e.date.slice(0,7)<=month));$('income').textContent=fmt(inc);$('expense').textContent=fmt(exp);$('cashExpense').textContent=fmt(cashExp);$('cashAvailable').textContent=fmt(cashAvailable);$('totalExpense').textContent=fmt(exp+cashExp);let bal=inc-exp;$('balance').textContent=(bal>0?'+':'')+fmt(bal);$('balance').className='big '+(bal<0?'balance-negative':bal>0?'balance-positive':'');list('recent',items.slice(0,5));list('historyList',items);renderAnalysis();initCategoryAnalysis()}
function renderAnalysis(){
  // Le besoin d'épargne est calculé mois par mois sur le compte bancaire uniquement.
  // Les espèces et les opérations de prélèvement d'épargne ne sont pas des revenus bancaires.
  const months=[...new Set(data.entries.filter(e=>e.type==='income'||e.type==='expense').map(e=>e.date.slice(0,7)))].sort().reverse();
  const ul=$('savingsMonths');ul.replaceChildren();
  let total=0;
  const results=months.map(m=>{
    const entries=data.entries.filter(e=>e.date.slice(0,7)===m);
    const income=sum(entries.filter(e=>e.type==='income'&&paymentOf(e)==='bank'));
    const expenses=sum(entries.filter(e=>e.type==='expense'&&paymentOf(e)==='bank'));
    const shortfall=Math.round(Math.max(0,expenses-income)*100)/100;
    total+=shortfall;
    return {month:m,shortfall};
  });
  $('savingsTotal').textContent=fmt(total);
  if(!results.length){let li=document.createElement('li');li.className='note';li.textContent='Aucune opération bancaire enregistrée';ul.append(li)}
  for(const r of results){let li=document.createElement('li');li.className='item';let label=document.createElement('span');label.textContent=r.month;let val=document.createElement('strong');val.textContent=fmt(r.shortfall);li.append(label,val);ul.append(li)}
}


// Analyse indépendante : les listes ne sont pas reconstruites lors du changement de filtre.
const pieColors=['#209d94','#e8a56c','#7e8ed1','#ce7ca6','#8baf63','#c28d69','#55a9c5','#b8a061','#a08bb7','#e1847d'];
function initCategoryAnalysis(){
  const ms=$('analysisMonth'),cs=$('analysisCategory');if(!ms||!cs)return;
  const expenses=data.entries.filter(e=>e.type==='expense'&&typeof e.date==='string');
  const months=[...new Set(expenses.map(e=>e.date.slice(0,7)))].sort().reverse();
  const fallback=$('month').value||today().slice(0,7);
  const oldMonth=ms.value,oldCat=cs.value;
  ms.replaceChildren();
  for(const m of months.length?months:[fallback]){
    const o=document.createElement('option');o.value=m;
    const [year,mon]=m.split('-').map(Number);
    o.textContent=new Intl.DateTimeFormat('fr-CH',{month:'long',year:'numeric'}).format(new Date(year,mon-1,1));ms.append(o);
  }
  ms.value=months.includes(oldMonth)?oldMonth:(months.includes(fallback)?fallback:(months[0]||fallback));
  cs.replaceChildren();cs.add(new Option('Toutes les catégories',''));
  const categories=[...new Set([...(data.categories.expense||[]),...expenses.map(e=>e.category)])].sort((a,b)=>a.localeCompare(b,'fr'));
  for(const c of categories)cs.add(new Option(c,c));
  cs.value=categories.includes(oldCat)?oldCat:'';
  renderCategoryAnalysis();
}
function renderCategoryAnalysis(){
  const ms=$('analysisMonth'),cs=$('analysisCategory');if(!ms||!cs)return;
  const month=ms.value,category=cs.value;
  const monthly=data.entries.filter(e=>e.type==='expense'&&e.date.slice(0,7)===month);
  const selected=monthly.filter(e=>!category||e.category===category);
  $('categoryAnalysisTotal').textContent=fmt(sum(selected));
  const grouped=new Map();for(const e of selected)grouped.set(e.category,(grouped.get(e.category)||0)+e.amount);
  const sorted=[...grouped].sort((a,b)=>b[1]-a[1]);
  const breakdown=$('categoryAnalysisBreakdown');breakdown.replaceChildren();
  const pie=$('categoryPie'),empty=$('categoryPieEmpty');
  const total=sum(selected);pie.replaceChildren();
  if(total>0){
    let position=0;const slices=[];
    for(let i=0;i<sorted.length;i++){
      const [name,amount]=sorted[i];const next=position+amount/total*100;
      slices.push(`${pieColors[i%pieColors.length]} ${position.toFixed(4)}% ${next.toFixed(4)}%`);position=next;
      const li=document.createElement('li');li.className='pie-legend-item';
      const label=document.createElement('span');label.className='pie-label';
      const dot=document.createElement('i');dot.className='pie-dot';dot.style.backgroundColor=pieColors[i%pieColors.length];
      const nameNode=document.createElement('span');nameNode.textContent=name;label.append(dot,nameNode);
      const val=document.createElement('strong');val.textContent=fmt(amount);li.append(label,val);breakdown.append(li);
    }
    pie.style.background=`conic-gradient(${slices.join(',')})`;
    pie.hidden=false;empty.hidden=true;
  }else{pie.hidden=true;empty.hidden=false;empty.textContent='Aucune dépense pour cette sélection'}
  const detail=$('categoryAnalysisEntries');detail.replaceChildren();
  for(const e of [...selected].sort((a,b)=>b.date.localeCompare(a.date))){
    const li=document.createElement('li');li.className='item';const info=document.createElement('span');const name=document.createElement('strong');name.textContent=e.category;
    const sub=document.createElement('small');sub.textContent=e.date+' · '+(paymentOf(e)==='cash'?'Espèces':'Compte')+(e.note?' · '+e.note:'');
    info.append(name,sub);const amount=document.createElement('strong');amount.textContent=fmt(e.amount);li.append(info,amount);detail.append(li);
  }
  if(!selected.length){const li=document.createElement('li');li.className='note';li.textContent='Aucune opération';detail.append(li)}
}

function list(id,items){let ul=$(id);ul.replaceChildren();if(!items.length){let li=document.createElement('li');li.className='note';li.textContent='Aucune opération';ul.append(li)}for(let e of items){let li=document.createElement('li');li.className='item';let info=document.createElement('div'),title=document.createElement('strong'),small=document.createElement('small');title.textContent=e.category;small.textContent=e.date+' · '+(paymentOf(e)==='cash'?'Espèces':e.type==='savings'?'Épargne':'Compte')+(e.note?' · '+e.note:'');info.append(title,small);let right=document.createElement('div');let value=document.createElement('b');value.textContent=(e.type==='expense'?'−':'+')+fmt(e.amount);let actions=document.createElement('div');actions.className='actions';let edit=document.createElement('button');edit.textContent='Modifier';edit.onclick=()=>editEntry(e.id);let del=document.createElement('button');del.textContent='×';del.className='danger';del.title='Supprimer';del.onclick=()=>{if(confirm('Supprimer cette opération ?')){data.entries=data.entries.filter(x=>x.id!==e.id);save();render()}};actions.append(edit,del);right.append(value,actions);li.append(info,right);ul.append(li)}}
function updateCategories(selected){let type=$('type').value,payment=$('payment').value;let showPayment=type==='income'||type==='expense';$('paymentGroup').hidden=!showPayment;$('quickCatButton').hidden=!showPayment;let cats=type==='savings'?['Épargne']:type==='cash_in'?['Espèces reçues']:data.categories[type]||[];let s=$('category');s.replaceChildren();for(let c of cats){let o=document.createElement('option');o.value=c;o.textContent=c;s.append(o)}if(selected&&cats.includes(selected))s.value=selected}
function quickAddCategory(){let type=$('type').value;if(type!=='income'&&type!=='expense')return;let c=prompt('Nom de la nouvelle catégorie :');if(!c)return;c=c.trim();if(!c)return;let found=data.categories[type].find(x=>x.toLocaleLowerCase()===c.toLocaleLowerCase());if(!found){data.categories[type].push(c);save()}updateCategories(found||c)}
function newEntry(){editing=null;$('entryTitle').textContent='Nouvelle opération';$('entryForm').reset();$('date').value=today();updateCategories();show('entry')}
function editEntry(id){let e=data.entries.find(x=>x.id===id);if(!e)return;editing=id;$('entryTitle').textContent='Modifier l’opération';$('date').value=e.date;$('type').value=e.type;$('payment').value=paymentOf(e);updateCategories(e.category);$('amount').value=e.amount;$('note').value=e.note||'';show('entry')}
$('entryForm').onsubmit=ev=>{ev.preventDefault();let amount=Number($('amount').value);if(!Number.isFinite(amount)||amount<=0)return;let e={id:editing||crypto.randomUUID(),date:$('date').value,type:$('type').value,category:$('category').value,amount:Math.round(amount*100)/100,note:$('note').value.trim(),payment:['income','expense'].includes($('type').value)?$('payment').value:($('type').value==='cash_in'?'cash':'bank')};if(editing)data.entries=data.entries.map(x=>x.id===editing?e:x);else data.entries.push(e);save();$('month').value=e.date.slice(0,7);show('home')};

function renameCategory(type,oldName){
  const proposed=prompt('Nouveau nom pour « '+oldName+' » :',oldName);
  if(proposed===null)return;
  const newName=proposed.trim();
  if(!newName){alert('Le nom ne peut pas être vide.');return}
  if(newName===oldName)return;
  if(data.categories[type].some(c=>c.toLocaleLowerCase('fr')===newName.toLocaleLowerCase('fr'))){alert('Cette catégorie existe déjà.');return}
  const index=data.categories[type].indexOf(oldName);
  if(index<0){alert('Catégorie introuvable.');return}
  data.categories[type][index]=newName;
  for(const entry of data.entries){if(entry.type===type&&entry.category===oldName)entry.category=newName}
  save();renderCategories();updateCategories();render();
}

function renderCategories(){let t=$('catType').value;let ul=$('categoryList');ul.replaceChildren();for(let c of data.categories[t]){let li=document.createElement('li');li.className='item';let name=document.createElement('span');name.textContent=c;let rename=document.createElement('button');rename.textContent='Renommer';rename.onclick=()=>renameCategory(t,c);li.append(name,rename);let btn=document.createElement('button');btn.textContent='Supprimer';btn.onclick=()=>{if(confirm('Supprimer cette catégorie ? Les opérations existantes la conserveront.')){data.categories[t]=data.categories[t].filter(x=>x!==c);save();renderCategories()}};li.append(name,btn);ul.append(li)}}
function addCategory(){let t=$('catType').value,c=$('newCategory').value.trim();if(c&&!data.categories[t].includes(c)){data.categories[t].push(c);save();renderCategories();$('newCategory').value=''}}
function download(name,content,type){let url=URL.createObjectURL(new Blob([content],{type}));let a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function exportCSV(){let q=x=>'"'+String(x??'').replaceAll('"','""')+'"';let rows=[['Date','Type','Catégorie','Montant CHF','Commentaire','Mode de paiement'],...[...data.entries].sort((a,b)=>a.date.localeCompare(b.date)).map(e=>[e.date,e.type==='expense'?'Dépense':e.type==='income'?'Revenu':e.type==='cash_in'?'Entrée espèces':'Épargne',e.category,e.amount.toFixed(2).replace('.',','),e.note,paymentOf(e)==='cash'?'Espèces':'Compte'])];download('mes-finances.csv','\ufeff'+rows.map(r=>r.map(q).join(';')).join('\r\n'),'text/csv;charset=utf-8')}
function backup(){download('mes-finances-sauvegarde.json',JSON.stringify(data,null,2),'application/json')}
async function restoreFile(ev){let f=ev.target.files[0];if(!f)return;try{let d=JSON.parse(await f.text());if(!Array.isArray(d.entries)||!d.categories||!Array.isArray(d.categories.income)||!Array.isArray(d.categories.expense)||!d.entries.every(e=>['income','expense','savings','cash_in'].includes(e.type)&&typeof e.amount==='number'&&Number.isFinite(e.amount)&&e.amount>0&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&typeof e.category==='string'))throw Error('Format invalide');if(confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')){data=d;save();render();renderCategories();alert('Sauvegarde restaurée')}}catch(e){alert('Impossible de restaurer : '+e.message)}ev.target.value=''}
$('month').value=today().slice(0,7);render();if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});

function resetAll(){if(confirm('Effacer toutes les opérations et catégories personnalisées de cette version ? Cette action est irréversible.')){data={entries:[],categories:structuredClone(defaults)};save();$('month').value=today().slice(0,7);render();renderCategories();alert('Suivi remis à zéro.')}}

/* ---------------- 棋盤車庫、獎勵與拖曳合成系統 ---------------- */
const CAR_COLORS = [
  {id:'red',name:'紅',hex:'#E53935'}, {id:'orange',name:'橙',hex:'#FB8C00'},
  {id:'yellow',name:'黃',hex:'#FDD835'}, {id:'green',name:'綠',hex:'#43A047'},
  {id:'blue',name:'藍',hex:'#1E88E5'}, {id:'purple',name:'紫',hex:'#8E24AA'},
  {id:'black',name:'黑',hex:'#263238'}, {id:'white',name:'白',hex:'#FAFAFA'},
  {id:'brown',name:'咖',hex:'#795548'}, {id:'gray',name:'灰',hex:'#90A4AE'}
];
const CAR_SIZES = [
  {id:'small',name:'汽車',detail:''}, {id:'medium',name:'箱型車',detail:''},
  {id:'large',name:'小巴士',detail:''}, {id:'xl',name:'雙層巴士',detail:''}
];
const BOARD_CAPACITY=30;
const BOARD_MIN_CELLS=BOARD_CAPACITY;
let boardCars=[];
let pendingCars=[];
let storedCars={};
let hintTickets=0;
let rewardReturnMode='garage';
let correctStreak=0;
let knownChars=new Set();
let unlockedColors=[];
let selectedCarId=null;
let selectedCollectionColorId=null;
function saveGarage(){ if(cloudReady && window.queueCloudSave) window.queueCloudSave(); }
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function normalizeBoardCars(cars,oldGarage){
  if(Array.isArray(cars)) return cars.filter(x=>x&&CAR_COLORS.some(c=>c.id===x.colorId)&&CAR_SIZES.some(z=>z.id===x.sizeId)).map((x,i)=>({id:x.id||uid(),colorId:x.colorId,sizeId:x.sizeId,pos:Number.isFinite(Number(x.pos))?Number(x.pos):i}));
  const out=[];
  if(oldGarage&&typeof oldGarage==='object'){
    Object.entries(oldGarage).forEach(([key,count])=>{
      const [colorId,sizeId]=key.split('_');
      for(let i=0;i<Number(count||0);i++) out.push({id:uid(),colorId,sizeId,pos:nextOpenPos(out)});
    });
  }
  return out;
}
function normalizeLooseCars(cars){return Array.isArray(cars)?cars.filter(x=>x&&CAR_COLORS.some(c=>c.id===x.colorId)&&CAR_SIZES.some(z=>z.id===x.sizeId)).map(x=>({id:x.id||uid(),colorId:x.colorId,sizeId:x.sizeId})):[]}
function nextOpenPos(cars=boardCars){let p=0;const used=new Set(cars.map(c=>c.pos));while(used.has(p)&&p<BOARD_CAPACITY)p++;return p<BOARD_CAPACITY?p:-1}
function freeBoardSlots(){return Math.max(0,BOARD_CAPACITY-boardCars.length)}
function flushPendingCars(){let moved=0;while(pendingCars.length&&freeBoardSlots()>0){const car=pendingCars.shift();car.pos=nextOpenPos();boardCars.push(car);moved++}return moved}
function carImage(sizeId,colorId){
  const folder={small:'car',medium:'van',large:'minibus',xl:'double-decker'}[sizeId]||'car';
  const size=CAR_SIZES.find(s=>s.id===sizeId);
  const color=CAR_COLORS.find(c=>c.id===colorId);
  const label=`${color?.name||''}色${size?.name||'汽車'}`;
  return `<img class="car-svg" src="./assets/cars/${folder}/${colorId}.webp" alt="${label}" draggable="false">`;
}
function ensureInitialColors(){if(unlockedColors.length<3) unlockedColors=shuffle(CAR_COLORS.map(c=>c.id).filter(id=>!unlockedColors.includes(id))).slice(0,3-unlockedColors.length).concat(unlockedColors)}
function ensureColorUnlocks(show=true){
  ensureInitialColors();
  const target=Math.min(10,3+Math.floor(knownChars.size/100));
  let newly=[];
  while(unlockedColors.length<target){const pool=CAR_COLORS.map(c=>c.id).filter(id=>!unlockedColors.includes(id));if(!pool.length)break;const id=pool[Math.floor(Math.random()*pool.length)];unlockedColors.push(id);newly.push(id)}
  if(newly.length&&show) showUnlockToast(newly);
  return newly;
}
function showUnlockToast(ids){
  const names=ids.map(id=>CAR_COLORS.find(c=>c.id===id)?.name+'色').join('、');
  const d=document.createElement('div');d.className='unlock-toast';d.innerHTML=`🎨 新顏色解鎖！<br><span style="font-size:24px;color:var(--purple-deep)">${names}</span>`;document.body.appendChild(d);setTimeout(()=>d.remove(),2600)
}
function markKnownChar(char){const before=knownChars.size;knownChars.add(char);if(knownChars.size!==before){ensureColorUnlocks(true);saveGarage()}}
function randomCar(){
  ensureInitialColors();
  const colorId=unlockedColors[Math.floor(Math.random()*unlockedColors.length)];
  const r=Math.random();const size=r<.48?CAR_SIZES[0]:r<.76?CAR_SIZES[1]:r<.94?CAR_SIZES[2]:CAR_SIZES[3];
  return {id:uid(),colorId,sizeId:size.id};
}
function awardCars(count=10,mode='garage'){
  rewardReturnMode=mode;
  const rewards=[];for(let i=0;i<count;i++) rewards.push(randomCar());
  rewards.forEach(car=>pendingCars.push(car));flushPendingCars();saveGarage();showRewardModal(rewards)
}
function registerCorrectAnswer(char,mode='garage'){correctStreak++;if(char)markKnownChar(char);saveGarage();awardCars(10,mode)}
function registerWrongAnswer(){correctStreak=0;saveGarage()}
function showRewardModal(rewards){
  const wrap=document.getElementById('reward-cars');wrap.innerHTML='';
  rewards.forEach(car=>{const color=CAR_COLORS.find(c=>c.id===car.colorId),size=CAR_SIZES.find(z=>z.id===car.sizeId);const d=document.createElement('div');d.className='reward-car';d.innerHTML=`${carImage(size.id,color.id)}<small>${color.name}${size.name}</small>`;wrap.appendChild(d)});
  document.getElementById('reward-streak').textContent='連續答對 '+correctStreak+' 題 🔥';
  const sub=document.querySelector('.reward-sub');sub.textContent=pendingCars.length?`獲得 10 台車！棋盤空位不足，還有 ${pendingCars.length} 台在待領區。`:'隨機獲得 10 台車，已放到棋盤上！';
  const cont=document.getElementById('continue-reward-btn');cont.disabled=pendingCars.length>0;cont.textContent=pendingCars.length>0?'先整理棋盤':'繼續答題';
  document.getElementById('reward-modal').classList.remove('hidden')
}
function closeRewardModal(){document.getElementById('reward-modal').classList.add('hidden');showScreen('garage')}
function continueAfterReward(){
  if(pendingCars.length){closeRewardModal();return}
  document.getElementById('reward-modal').classList.add('hidden');
  if(rewardReturnMode==='quiz') nextQuiz();
  else showScreen('garage');
}
function totalCars(){return boardCars.length+pendingCars.length}
function carAt(pos){return boardCars.find(c=>c.pos===pos)}
function moveOrMerge(sourceId,targetPos){
  const source=boardCars.find(c=>c.id===sourceId);if(!source)return;
  const target=carAt(targetPos);
  if(!target){source.pos=targetPos;selectedCarId=null;saveGarage();renderGarage();return}
  if(target.id===source.id){selectedCarId=null;renderGarage();return}
  const sourceIdx=CAR_SIZES.findIndex(z=>z.id===source.sizeId);
  if(source.colorId===target.colorId&&source.sizeId===target.sizeId&&sourceIdx<CAR_SIZES.length-1){
    const keepPos=target.pos;boardCars=boardCars.filter(c=>c.id!==source.id&&c.id!==target.id);boardCars.push({id:uid(),colorId:source.colorId,sizeId:CAR_SIZES[sourceIdx+1].id,pos:keepPos});selectedCarId=null;flushPendingCars();saveGarage();renderGarage();requestAnimationFrame(()=>showMergeStars(keepPos));return
  }
  const old=source.pos;source.pos=target.pos;target.pos=old;selectedCarId=null;saveGarage();renderGarage()
}

function showMergeStars(pos){
  const cell=document.querySelector(`.board-cell[data-pos="${pos}"]`);
  if(!cell)return;
  const burst=document.createElement('div');
  burst.className='merge-stars';
  burst.innerHTML='<span>⭐</span><span>✨</span><span>⭐</span><span>✨</span><span>⭐</span><span>✨</span><span>⭐</span>';
  cell.appendChild(burst);
  setTimeout(()=>burst.remove(),1150);
}

function boardCellClick(pos){const target=carAt(pos);if(!selectedCarId){if(target){selectedCarId=target.id;renderGarage()}return}moveOrMerge(selectedCarId,pos)}
function selectedBoardCar(){return boardCars.find(c=>c.id===selectedCarId)}
function storeSelectedCar(){
  const car=selectedBoardCar();if(!car||car.sizeId!=='xl')return;
  storedCars[car.colorId]=Math.max(0,Number(storedCars[car.colorId]||0))+1;
  boardCars=boardCars.filter(c=>c.id!==car.id);selectedCarId=null;flushPendingCars();speak('收藏成功');saveGarage();renderGarage();
}
function sellSelectedCar(){
  const car=selectedBoardCar();if(!car||car.sizeId!=='xl')return;
  if(!confirm('要把這台雙層巴士賣給系統，換 1 張提示券嗎？'))return;
  boardCars=boardCars.filter(c=>c.id!==car.id);selectedCarId=null;hintTickets++;flushPendingCars();speak('獲得提示券');saveGarage();renderGarage();updateHintUI();
}
function updateHintUI(){
  const h=document.getElementById('header-hint-tickets');if(h)h.textContent=hintTickets;
  const g=document.getElementById('hint-ticket-count');if(g)g.textContent=hintTickets;
  const b=document.getElementById('quiz-hint-btn');if(b){b.textContent=`💡 使用提示券（${hintTickets}）`;b.disabled=quizState?.answered}
}

function openCollectionView(colorId){
  const count=Number(storedCars[colorId]||0);
  if(count<=0)return;
  selectedCollectionColorId=colorId;
  const color=CAR_COLORS.find(c=>c.id===colorId);
  document.getElementById('collection-view-image').innerHTML=carImage('xl',colorId);
  document.getElementById('collection-view-title').textContent=`${color.name}色雙層巴士`;
  document.getElementById('collection-view-count').textContent=`目前收藏 ${count} 台`;
  document.getElementById('collection-exchange-btn').disabled=count<=0;
  document.getElementById('collection-view-modal').classList.remove('hidden');
}
function closeCollectionView(){
  selectedCollectionColorId=null;
  document.getElementById('collection-view-modal').classList.add('hidden');
}
function exchangeCollectedBus(){
  const colorId=selectedCollectionColorId;
  if(!colorId||Number(storedCars[colorId]||0)<=0)return;
  if(!confirm('要把收藏中的這台雙層巴士換成 1 張提示券嗎？'))return;
  storedCars[colorId]=Math.max(0,Number(storedCars[colorId]||0)-1);
  hintTickets++;
  saveGarage();
  updateHintUI();
  renderGarage();
  if(storedCars[colorId]>0)openCollectionView(colorId);
  else closeCollectionView();
}

function renderGarage(){
  ensureInitialColors();
  document.getElementById('garage-total-pill').textContent='棋盤 '+boardCars.length+' / '+BOARD_CAPACITY+' 台';
  document.getElementById('known-char-count').textContent=knownChars.size;document.getElementById('unlocked-color-count').textContent=unlockedColors.length;document.getElementById('hint-ticket-count').textContent=hintTickets;document.getElementById('stored-car-count').textContent=Object.values(storedCars).reduce((a,b)=>a+Number(b||0),0);updateHintUI();
  const locks=document.getElementById('color-locks');locks.innerHTML='';CAR_COLORS.forEach(c=>{const unlocked=unlockedColors.includes(c.id);const d=document.createElement('div');d.className='color-lock '+(unlocked?'':'locked');d.innerHTML=`<div class="lock-dot" style="background:${unlocked?c.hex:'#CBD2D5'}"></div>${unlocked?c.name+'色':'未解鎖'}`;locks.appendChild(d)});
  const pendingWarn=document.getElementById('pending-warning');pendingWarn.classList.toggle('hidden',pendingCars.length===0);pendingWarn.textContent=pendingCars.length?`🚚 還有 ${pendingCars.length} 台答題獎勵等待空位，合成、收藏或賣車後會自動放入。`:'';
  const action=document.getElementById('board-action-panel'),chosen=selectedBoardCar();
  if(chosen&&chosen.sizeId==='xl'){const color=CAR_COLORS.find(c=>c.id===chosen.colorId);action.classList.remove('hidden');action.innerHTML=`已選擇 <b>${color.name}色雙層巴士</b><div class="actions"><button class="collect-btn" onclick="storeSelectedCar()">🏠 收藏到車庫</button><button class="sell-btn" onclick="sellSelectedCar()">💡 賣掉換提示券</button></div>`}else{action.classList.add('hidden');action.innerHTML=''}
  const board=document.getElementById('car-board');board.innerHTML='';const cells=BOARD_CAPACITY;
  if(!boardCars.length){board.innerHTML='<div class="board-empty">🚗 棋盤還是空的<br>答對一題就會得到 10 台車！</div>'}
  else for(let pos=0;pos<cells;pos++){
    const car=carAt(pos),cell=document.createElement('div');cell.className='board-cell'+(car&&car.id===selectedCarId?' selected':'');cell.dataset.pos=pos;cell.onclick=()=>boardCellClick(pos);cell.ondragover=e=>e.preventDefault();cell.ondrop=e=>{e.preventDefault();moveOrMerge(e.dataTransfer.getData('text/plain'),pos)};
    if(car){const color=CAR_COLORS.find(c=>c.id===car.colorId),size=CAR_SIZES.find(z=>z.id===car.sizeId);cell.draggable=true;cell.ondragstart=e=>e.dataTransfer.setData('text/plain',car.id);cell.innerHTML=carImage(size.id,color.id)+`<span class="size-badge">${size.name}</span>`}
    board.appendChild(cell)
  }
  const collection=document.getElementById('garage-collection');collection.innerHTML='';
  CAR_COLORS.forEach(color=>{const unlocked=unlockedColors.includes(color.id),n=Number(storedCars[color.id]||0);const d=document.createElement('div');d.className='collection-card '+(unlocked?'':'locked');d.innerHTML=unlocked?`${carImage('xl',color.id)}<b>${color.name}色雙層巴士</b><div class="collection-count">收藏 ${n} 台</div><small>${n>0?'點開查看或換提示券':'尚未收藏'}</small>`:`<div style="font-size:30px">🔒</div><b>未解鎖</b><small>雙層巴士</small>`;if(unlocked&&n>0)d.onclick=()=>openCollectionView(color.id);collection.appendChild(d)})
}


window.openCollectionView=openCollectionView;window.closeCollectionView=closeCollectionView;window.exchangeCollectedBus=exchangeCollectedBus;window.storeSelectedCar=storeSelectedCar;window.sellSelectedCar=sellSelectedCar;window.useHintTicket=useHintTicket;window.continueAfterReward=continueAfterReward;window.renderGarage=renderGarage;window.saveGarage=saveGarage;

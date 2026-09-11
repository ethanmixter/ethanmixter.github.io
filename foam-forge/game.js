const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),$=id=>document.getElementById(id);
let W=1000,H=650,mode='forge',brand='Nerf',coins=0,levels={spring:0,capacity:0,prime:0},ammo=2,reloading=0,hits=0,shots=0,health=5,kills=0,targets=[],particles=[],tracers=[],aim={x:.5,y:.5},last=0,clock=0,recoil=0,toastUntil=4,active=true;
const capacityFor=(main,parts,gear,combo=false,blasterBrand=brand)=>Math.max((blasterBrand==='X-Shot'&&main===1?20:blasterBrand==='X-Shot'&&main===2?72:[2,6,18,40,6,12,16,24,500][main])+(combo?20:0),[0,25,50,100][gear.holder])+parts.capacity*2;
const cap=()=>capacityFor(equipped,levels,attachments,combined),damage=()=>1+levels.spring,ultimate=()=>Object.values(levels).every(v=>v>=3),price=k=>levels[k]<3?[50,100,200][levels[k]]:200+(levels[k]-2)*100;
const reloadSeconds=(prime=levels.prime)=>.18+1.62/(1+prime*.55);
const dartsPerShot=()=>combined?3:equipped===7?4:1;
let questStarted=0,questSeconds=0,earnedTimeBonus=0;
const timeBonus=seconds=>Math.max(0,Math.floor(questConfig().bonus*2*(1-seconds/(questConfig().bots*12))));
let equipped=0,combined=false,triggerHeld=false,nextShot=0,autoFireLatched=false;
const roster={'X-Shot':['Pocket 2','Insanity Manic','Mad Mega Barrel','Rage Fire','Hawkeye','Storm Scout · custom','Cyclone · custom','Thunderbolt · custom'],'Nerf':['Pocket 2','Elite 2.0 Echo','Rival Kronos','Rival Prometheus','Elite 2.0 Turbine','Thunder Scout · custom','Volt Runner · custom','Dome Defender · custom','Ultra Nerf MOAB']};
let turretEnabled=false,turretNext=0,turretAmmo=20,turretReloadUntil=0,turretBeam=null;
let questLevel=1,questUnlocked=1,questWon=false;
let abilityShots=0,laserUntil=0,specialFx=[];
const questConfig=()=>({bots:8+(questLevel-1)*5,hp:questLevel+1,reward:questLevel*10,bonus:questLevel<=5?[80,120,180,240,320][questLevel-1]:320+(questLevel-5)*80,speed:1+Math.min(questLevel-1,4)*.15});
const mainCosts=[0,100,300,600,125,200,275,400,10000],mainTier=[0,1,2,3,0,1,1,2,10],owned={'Nerf':[0],'X-Shot':[0]};
let attachments={barrel:0,sight:0,holder:0,vest:0},purchased={barrel:[0],sight:[0],holder:[0],vest:[0]};
const freshProfile=()=>({levels:{spring:0,capacity:0,prime:0},attachments:{barrel:0,sight:0,holder:0,vest:0},purchased:{barrel:[0],sight:[0],holder:[0],vest:[0]},equipped:0,combined:false});
const profiles={'Nerf':freshProfile(),'X-Shot':freshProfile()};
const maxHealth=()=>[5,6,8,15,20,30][attachments.vest];
const accessories={vest:[['No vest',0,'5 lives'],['Scout vest',150,'6 lives'],['Guardian vest',350,'8 lives'],['Thunderdome elite vest',700,'15 lives'],['Thunderdome Champion vest',900,'20 hearts'],['Thunderdome Legend vest',1500,'30 hearts']],barrel:[['No barrel',0,'Sideways spread every 3rd shot'],['Short barrel',100,'Spread every 6th shot'],['Long barrel',150,'Spread every 10th shot'],['Precision barrel',250,'Spread every 20th shot'],['Pro Skins AEB Roller SCAR',500,'No sideways spread']],sight:[['Iron sights',0,'Standard view'],['Reflex sight',75,'1.15× clear aiming view'],['Precision scope',175,'1.35× magnification'],['Target scope',300,'1.65× magnification']],holder:[['Standard holder',0,'Use magazine capacity'],['Dart rack',100,'At least 25 darts'],['Double rack',200,'At least 50 darts'],['Insanity mega rack',400,'100 darts before reloading']]};
const zoom=()=>[1,1.15,1.35,1.65][attachments.sight]*(mode==='quest'?1.3:1);
const fullSet=()=>[1,2,3].every(n=>owned['X-Shot'].includes(n));
const unlocked=()=>Math.min(3,...Object.values(levels));
const isMoab=()=>brand==='Nerf'&&equipped===8;
const buildTier=()=>Math.min(...Object.values(levels));
const automatic=()=>combined||equipped===3||isMoab();
const fireInterval=()=>isMoab()?.02:brand==='X-Shot'&&equipped===3&&!combined?.15:.12;
function equip(n){if(mode!=='forge'||!owned[brand].includes(n))return;equipped=n;combined=false;triggerHeld=false;reloading=0;abilityShots=0;laserUntil=0;specialFx=[];ammo=cap();update();}
function toast(t){$('toast').textContent=t;toastUntil=clock+3;$('toast').style.opacity=1;}
function specialKind(){if((brand==='Nerf'&&equipped===6)||(brand==='X-Shot'&&equipped===6))return 'laser';if((brand==='Nerf'&&equipped===5)||(brand==='X-Shot'&&equipped===5))return 'thunder';if(brand==='Nerf'&&equipped===2)return 'ricochet';if(brand==='X-Shot'&&equipped===4)return 'hawkeye';if(brand==='X-Shot'&&equipped===2)return 'mega';if(brand==='X-Shot'&&equipped===1)return 'manic';return 'standard';}
function specialInfo(){const kind=specialKind(),remaining=Math.max(0,laserUntil-clock);if(kind==='laser')return ['VOLT LASER',remaining?remaining.toFixed(1)+'s active · one-hit shots':(10-abilityShots%10)+' shots until 5-second laser'];if(kind==='thunder')return ['THUNDER STRIKE',(7-abilityShots%7)+' shots until all exposed targets are struck'];if(kind==='ricochet')return ['RICOCHET','35% chance for a hit to bounce to another target'];if(kind==='hawkeye')return ['HAWKEYE','Equipped barrel performs one tier higher'];if(kind==='mega')return ['MEGA CAPACITY','72 base darts plus capacity upgrades'];if(kind==='manic')return ['MANIC CAPACITY','20 base darts plus capacity upgrades'];return ['STANDARD BLASTER','No unique ability equipped'];}
function visibleTargets(){return targets.filter(t=>mode!=='quest'||(t.exposure>.4&&t.y<t.coverY));}
function triggerSpecialShot(){const kind=specialKind();if(kind!=='laser'&&kind!=='thunder')return;abilityShots++;if(kind==='laser'&&abilityShots%10===0){laserUntil=clock+5;toast('VOLT LASER ACTIVE · one-hit shots for 5 seconds!');}if(kind==='thunder'&&abilityShots%7===0){const struck=visibleTargets().slice();specialFx.push({type:'thunder',points:struck.map(t=>({x:t.x,y:t.y})),until:clock+.55});toast('THUNDER STRIKE · '+struck.length+' exposed target'+(struck.length===1?'':'s')+' hit!');for(const target of struck){if(!active)break;if(targets.includes(target))damageBot(target,damage(),true);}}}
function ricochetFrom(target){if(specialKind()!=='ricochet'||Math.random()>=.35||!active)return;const next=visibleTargets().find(t=>t!==target&&Math.hypot(t.x-target.x,t.y-target.y)>.04);if(!next)return;specialFx.push({type:'ricochet',from:{x:target.x,y:target.y},points:[{x:next.x,y:next.y}],until:clock+.3});toast('RICOCHET! Another target was hit.');damageBot(next,damage(),true);}
function drawAbilityHUD(){
 specialFx=specialFx.filter(f=>f.until>clock);
 for(const fx of specialFx){
  ctx.save();ctx.lineWidth=fx.type==='thunder'?5:3;ctx.strokeStyle=fx.type==='thunder'?'#d9f6ff':'#ff665d';ctx.shadowBlur=15;ctx.shadowColor=ctx.strokeStyle;
  for(const p of fx.points){const to=worldToScreen(p),from=fx.type==='thunder'?{x:to.x*W,y:0}:worldToScreen(fx.from);ctx.beginPath();ctx.moveTo(fx.type==='thunder'?from.x:from.x*W,fx.type==='thunder'?from.y:from.y*H);if(fx.type==='thunder'){ctx.lineTo(to.x*W-12,to.y*H*.45);ctx.lineTo(to.x*W+10,to.y*H*.7);}ctx.lineTo(to.x*W,to.y*H);ctx.stroke();}
  ctx.restore();
 }
 const info=specialInfo();
 $('specialName').textContent=info[0];$('specialDescription').textContent=info[1];
 $('specialCard').style.borderColor=laserUntil>clock?'#ff665d':'#456057';
}
const specialCard=document.createElement('section');
specialCard.id='specialCard';specialCard.className='quest-card';
specialCard.innerHTML='<span class="eyebrow">BLASTER SPECIAL</span><h3 id="specialName">STANDARD BLASTER</h3><p id="specialDescription">No unique ability equipped</p>';
document.querySelector('.blaster-roster').after(specialCard);
function update(){updateTurretUI();updateQuestPicker();saveProgress();updateAccessories(); $('coins').textContent=coins;$('ammo').textContent=`${ammo} / ${cap()}`;$('reloadLabel').textContent=reloading>0?'RELOADING…':'RELOAD [R]';$('health').textContent=mode==='quest'?'♥ '+health+' / '+maxHealth()+' lives':'FREE PLAY';$('stats').textContent=`${hits} hits · ${shots} shots`;$('blasterName').textContent=brand+' · '+(combined?'Full Insanity':roster[brand][equipped]);$('fireHint').textContent=combined?'HOLD TO AUTO FIRE · 3-DART MULTI-SHOT':automatic()?'HOLD CLICK / TOUCH TO AUTO FIRE':equipped===7?'CLICK / TAP · 4-DART MULTI-SHOT':'CLICK / TAP TO SHOOT';for(let i=1;i<=8;i++){const button=$('blaster'+i),have=owned[brand].includes(i);button.hidden=i>=roster[brand].length;if(button.hidden)continue;button.textContent=roster[brand][i]+(have?' · Equip':' · ◈ '+mainCosts[i]+(buildTier()<mainTier[i]?' · Tier '+mainTier[i]:''));button.disabled=!have&&(buildTier()<mainTier[i]||coins<mainCosts[i]);button.classList.toggle('selected',equipped===i&&!combined);} $('combine').hidden=brand!=='X-Shot';$('combine').disabled=turretEnabled||!ultimate()||!fullSet()||combined;$('combine').textContent=turretEnabled?'Turn off turret to combine':combined?'FULL INSANITY EQUIPPED':'Combine all three → Full Insanity';$('unlockHint').textContent=unlocked()===3?(brand==='Nerf'?'Core mains unlocked. MOAB needs 10 upgrades in every part.':'All core mains unlocked. Keep upgrading!'):'Upgrade all three parts to '+['II','III','IV'][unlocked()]+' to open tier '+(unlocked()+1)+' mains'+'.';$('dream').textContent=brand==='Nerf'?'Ultra Nerf MOAB · Tier 10':'X-Shot · Full Insanity';$('progress').style.width=Math.min(9,Object.values(levels).reduce((a,b)=>a+Math.min(b,3),0))/9*100+'%';for(const k of Object.keys(levels)){ $(k+'Level').textContent='Lv '+(levels[k]+1);$(k+'Buy').textContent='◈ '+price(k);$(k+'Buy').disabled=coins<price(k);} }
function spawn(i){return {slot:i,coverY:.44+Math.floor(i/4)*.16,exposure:0,fired:false,cycle:Math.random()*2,x:.14+(i%4)*.23,y:.34+Math.floor(i/4)*.19,base:.14+(i%4)*.23,r:.035+Math.random()*.01,hp:mode==='quest'?questConfig().hp:1,max:mode==='quest'?questConfig().hp:1,phase:Math.random()*6,age:0,deadline:7+Math.random()*4};}
function practiceRespawn(oldTarget){const used=new Set(targets.filter(t=>t!==oldTarget).map(t=>t.slot)),open=[];for(let i=0;i<8;i++)if(!used.has(i))open.push(i);return spawn(open[Math.floor(Math.random()*open.length)]??oldTarget.slot??0);}
function start(m){turretAmmo=turretStats().capacity;turretReloadUntil=0;turretNext=clock+.6;turretBeam=null;stopHandsFree();questStarted=Date.now();questSeconds=0;earnedTimeBonus=0;questWon=false;$('defeatScreen').hidden=true;if(typeof music!=='undefined')changeMusic(m);keys.clear();player.x=0;player.y=0;enemyDarts=[];triggerHeld=false;mode=m;document.body.classList.toggle('in-quest',m==='quest');document.body.classList.toggle('in-forge',m==='forge');health=maxHealth();kills=0;reloading=0;ammo=cap();active=true;targets=Array.from({length:m==='forge'?0:m==='practice'?6:4},(_,i)=>spawn(i));$('modeTitle').textContent=m==='forge'?'The Thunderdome':m==='practice'?'Target practice':'Bot Quest · Level '+questLevel;$('practice').classList.toggle('active',m==='practice');$('quest').classList.toggle('active',m==='quest');$('objective').textContent=m==='practice'?'Hit targets · earn 5 coins each':'Tag '+questConfig().bots+' bots · 0 / '+questConfig().bots;toast(m==='forge'?'Welcome to the Thunderdome. Make your blaster yours.':m==='practice'?'Pick a target. Every hit earns coins.':'Bots pop out of cover! WASD / arrows to dodge their darts.');update();}
function reload(){if(mode==='forge'||reloading||ammo===cap())return;reloadDuration=reloadSeconds();reloading=reloadDuration;update();}
function buy(k){if(mode!=='forge'||coins<price(k))return;coins-=price(k);const previous=unlocked();levels[k]++;ammo=cap();toast(unlocked()>previous?'New main-blaster tier available!' :({spring:'Power spring',capacity:'Dart capacity',prime:'Quick prime'}[k])+' upgraded!');update();}
for(const k of Object.keys(levels))$(k+'Buy').onclick=()=>buy(k);
$('forgeBack').onclick=()=>start('forge');$('reload').onclick=reload;$('practice').onclick=()=>start('practice');$('quest').onclick=$('startQuest').onclick=()=>start('quest');for(const [id,b] of [['nerf','Nerf'],['xshot','X-Shot']])$(id).onclick=()=>switchBrand(b);
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r'){e.preventDefault();reload();}});
const look={x:.5,y:.5};
const player={x:0,y:0},keys=new Set();let enemyDarts=[],reloadDuration=1.8,hitFlash=0;
const movementKeys=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'];
window.addEventListener('keydown',e=>{if(mode==='quest'&&movementKeys.includes(e.key.toLowerCase())){e.preventDefault();keys.add(e.key.toLowerCase());}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{if(document.hidden)keys.clear();});
function viewCenter(){
 const halfView=.5/zoom(),travel=1-1/zoom();
 const clampCenter=value=>Math.max(halfView,Math.min(1-halfView,value));
 return {x:clampCenter(.5+(look.x-.5)*travel+(mode==='quest'?player.x:0)),y:clampCenter(.5+(look.y-.5)*travel+(mode==='quest'?player.y:0))};
}
function worldToScreen(p){const c=viewCenter();return {x:.5+(p.x-c.x)*zoom(),y:.5+(p.y-c.y)*zoom()};}
function screenToWorld(p){const c=viewCenter();return {x:c.x+(p.x-.5)/zoom(),y:c.y+(p.y-.5)/zoom()};}
function pointer(e){let r=canvas.getBoundingClientRect();aim={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(autoFireLatched){stopHandsFree();return;}pointer(e);triggerHeld=true;canvas.setPointerCapture?.(e.pointerId);shoot();nextShot=clock+fireInterval();});
function releaseTrigger(){triggerHeld=false;}
canvas.addEventListener('pointerup',releaseTrigger);canvas.addEventListener('pointercancel',releaseTrigger);canvas.addEventListener('lostpointercapture',releaseTrigger);window.addEventListener('pointerup',releaseTrigger);window.addEventListener('blur',releaseTrigger);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseTrigger();});
for(let i=1;i<=8;i++)$('blaster'+i).onclick=()=>buyMain(i);$('combine').onclick=()=>{if(turretEnabled||mode!=='forge'||brand!=='X-Shot'||!ultimate()||!fullSet())return;combined=true;equipped=3;ammo=cap();reloading=0;update();};
function shoot(){
 if(mode==='forge')return;
 if(!active){toast('Choose Range or Bot quest to play again.');return;}
 if(reloading)return;
 if(!ammo){reload();return;}
 playShotPop();recoil=1;triggerSpecialShot();
 const volley=Math.min(ammo,dartsPerShot());
 for(let dart=0;dart<volley&&active;dart++){
  ammo--;shots++;
  const point=shotPoint();
  if(dartsPerShot()>1)point.x+=[0,-.022,.022,.044][dart]/zoom();
  tracers.push({...point,t:.14});
  const target=targets.find(t=>(mode!=='quest'||(t.exposure>.4&&point.y<t.coverY))&&Math.hypot((t.x-point.x)*W,(t.y-point.y)*H)<t.r*W*1.25);
  if(target){
   const laser=laserUntil>clock&&specialKind()==='laser';
   if(laser)specialFx.push({type:'laser',from:screenToWorld({x:.59,y:.69}),points:[{x:target.x,y:target.y}],until:clock+.16});
   damageBot(target,isMoab()||laser?target.hp:damage(),true);
   ricochetFrom(target);
  }
 }
 update();if(!ammo&&active)reload();
}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();}function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function scene(){if(mode==='forge'){forgeScene();return;}let sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#8ccdd0');sky.addColorStop(.5,'#c0ddd3');sky.addColorStop(.501,'#547b70');sky.addColorStop(1,'#233f3b');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
// Geometric 3D arena geometry, target hitboxes, and the equipped blaster are rendered by the game engine.
poly([[0,H*.28],[W*.2,H*.36],[W*.2,H*.56],[0,H*.68]],'#427371');poly([[W,H*.2],[W*.82,H*.35],[W*.82,H*.57],[W,H*.69]],'#386562');rect(W*.2,H*.36,W*.62,H*.2,'#63968a');rect(W*.2,H*.36,W*.62,7,'#dcdea5');for(let i=0;i<14;i++)rect(W*(.205+i*.045),H*.38,2,H*.14,'#82afa1');
ctx.strokeStyle='#93b4a24a';ctx.lineWidth=1;for(let i=-5;i<8;i++){ctx.beginPath();ctx.moveTo(W*.5,H*.5);ctx.lineTo(i*W*.25,H);ctx.stroke();}for(let i=0;i<7;i++){let y=H*(.52+i*i*.012);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
function crate(x,y,s){poly([[x,y],[x+s,y],[x+s,y+s],[x,y+s]],'#c29c60');poly([[x,y],[x+s*.2,y-s*.17],[x+s*1.2,y-s*.17],[x+s,y]],'#edc778');poly([[x+s,y],[x+s*1.2,y-s*.17],[x+s*1.2,y+s*.83],[x+s,y+s]],'#806e45');rect(x+8,y+8,s-16,5,'#e4c47e');rect(x+8,y+s-14,s-16,5,'#846f45');}crate(W*.025,H*.54,W*.12);crate(W*.81,H*.55,W*.12);crate(W*.72,H*.44,W*.055);
ctx.save();ctx.translate(W*.5,H*.285);ctx.fillStyle='#224a48';ctx.font=`800 ${W*.037}px sans-serif`;ctx.textAlign='center';ctx.fillText('FOAM  //  FORGE',0,0);ctx.font=`bold ${W*.011}px sans-serif`;ctx.fillText('PLAYGROUND TRAINING FACILITY',0,22);ctx.restore();
for(const t of targets){let x=t.x*W,y=t.y*H,r=t.r*W;ctx.save();ctx.globalAlpha=.25;ctx.fillStyle='#0b2725';ctx.beginPath();ctx.ellipse(x,H*.63,r*1.2,r*.25,0,0,7);ctx.fill();ctx.restore();if(mode==='practice'){rect(x-3,y,6,H*.62-y,'#284847');circle(x,y,r+4,'#253f42');circle(x,y,r,'#ecedc4');circle(x,y,r*.73,'#ed7050');circle(x,y,r*.47,'#f5eeca');circle(x,y,r*.2,'#e9784b');}else{y=t.y*H;rect(x-r*.75,y-r*.35,r*1.5,r*1.4,'#df795f');rect(x-r*.9,y-r,r*1.8,r*1.15,'#f5a782');rect(x-r*.68,y-r*.73,r*1.36,r*.47,'#294a4c');circle(x-r*.35,y-r*.5,r*.1,'#dffa86');circle(x+r*.35,y-r*.5,r*.1,'#dffa86');rect(x-r*.5,y+r,r*.35,r*.5,'#294a4c');rect(x+r*.2,y+r,r*.35,r*.5,'#294a4c');ctx.strokeStyle=t.cycle>3?'#ff7861':'#e5ff96';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,r*1.5,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,(4-t.cycle)/2));ctx.stroke();if(t.exposure>.4){rect(x-r,y-r*1.75,r*2,4,'#304b44');rect(x-r,y-r*1.75,r*2*t.hp/t.max,4,'#effcba');ctx.fillStyle='#f4ffdf';ctx.font='12px sans-serif';ctx.fillText(t.hp+' HP',x-r,y-r*1.9);}drawBotBlaster(t,x,y,r);drawCover(t);}}
}
function blaster(){ctx.save();if(mode==='forge'){ctx.translate(W*.14,-H*.08);ctx.translate(W*.57,H*.8);ctx.scale(1.45,1.45);ctx.rotate(.55);ctx.translate(-W*.57,-H);}let kick=recoil*16;ctx.translate(W*.57+ (look.x-.5)*50,H+(look.y-.5)*22+kick+(reloading?Math.sin(Math.PI*(1-reloading/reloadDuration))*65:0));let s=Math.min(W/850,H/570);ctx.scale(s,s);ctx.rotate(-.13+(reloading?Math.sin(Math.PI*(1-reloading/reloadDuration))*.18:0));let color=brand==='Nerf'?(equipped===2?'#df4944':equipped===3?'#d9dfe0':'#36a1c4'):'#35b9d4';poly([[-40,30],[-24,-100],[36,-90],[58,30]],'#283c45');poly([[-75,-90],[-90,-168],[-35,-228],[74,-224],[112,-150],[74,-72]],color);poly([[-35,-228],[-31,-273],[54,-273],[74,-224]],'#d9e3da');rect(-24,-273,69,39,'#ed7952');rect(-14,-263,47,19,'#2a4448');poly([[75,-224],[112,-150],[74,-72],[59,-163]],'#a47b2c');rect(-55,-165,102,48,'#31494f');rect(-40,-151,70,9,'#c7e2cf');rect(-68,-93,127,15,'#ed7d4c');for(let i=0;i<3+Math.min(levels.spring,6);i++)rect(-70+i*19,-196,9,19,'#425447');if(levels.capacity>0){rect(-85,-129,32,80,'#b4cac2');}drawModelDetails();drawUpgradeTrim();drawAttachments();drawReloadHand();ctx.restore();}
function frame(ms){let dt=Math.min((ms-last)/1000,.05);last=ms;clock+=dt;const follow=1-Math.exp(-dt*10);look.x+=(aim.x-look.x)*follow;look.y+=(aim.y-look.y)*follow;if((autoFireLatched||(triggerHeld&&automatic()))&&active&&mode!=='forge'&&clock>=nextShot){shoot();nextShot=clock+(automatic()?fireInterval():.3);}recoil=Math.max(0,recoil-dt*7);if(reloading){reloading-=dt;if(reloading<=0){reloading=0;ammo=cap();update();}}updateCombat(dt);updateTurret();if(mode==='quest'&&active){questSeconds=(Date.now()-questStarted)/1000;$('questTimer').textContent=questSeconds.toFixed(1)+'s · speed bonus +'+timeBonus(questSeconds);}ctx.save();if(mode!=='forge'){ctx.translate(W/2,H/2);ctx.scale(zoom(),zoom());const center=viewCenter();ctx.translate(-center.x*W,-center.y*H);}scene();ctx.restore();drawEnemyDarts();drawTurret();for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;p.life-=dt;const screen=worldToScreen({x:p.x/W,y:p.y/H});rect(screen.x*W,screen.y*H,5,5,p.color);}particles=particles.filter(p=>p.life>0);blaster();for(const t of tracers){const screen=worldToScreen(t);ctx.strokeStyle='#fbf5a9';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(W*.59,H*.69);ctx.lineTo(screen.x*W,screen.y*H);ctx.stroke();circle(screen.x*W,screen.y*H,5,'#fff3b4');t.t-=dt;}tracers=tracers.filter(t=>t.t>0);let ax=mode==='forge'?-100:aim.x*W,ay=aim.y*H;ctx.strokeStyle='#ffffffd9';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(ax,ay,9,0,7);ctx.moveTo(ax-16,ay);ctx.lineTo(ax-5,ay);ctx.moveTo(ax+5,ay);ctx.lineTo(ax+16,ay);ctx.moveTo(ax,ay-16);ctx.lineTo(ax,ay-5);ctx.moveTo(ax,ay+5);ctx.lineTo(ax,ay+16);ctx.stroke();drawSight(ax,ay);if(clock>toastUntil)$('toast').style.opacity=0;requestAnimationFrame(frame);}
var music;
const SAVE_KEY='foam-forge-progress-v1';
loadProgress();
coins=300000;
initMovement();
initAccessories();
for(const kind of Object.keys(attachments))$(kind+'Select').value=String(attachments[kind]);
$('nerf').classList.toggle('active',brand==='Nerf');
$('xshot').classList.toggle('active',brand==='X-Shot');
new ResizeObserver(()=>{let r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);W=r.width;H=r.height;canvas.width=W*d;canvas.height=H*d;ctx.setTransform(d,0,0,d,0,0);}).observe(canvas);start('forge');requestAnimationFrame(frame);
if(document.modelContext?.registerTool){const lifecycle=new AbortController();try{Promise.resolve(document.modelContext.registerTool({name:'start_foam_session',description:'Start a fresh target practice session or bot quest. Keeps earned coins and upgrades.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['forge','practice','quest']}},required:['mode'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||!['forge','practice','quest'].includes(input.mode))throw new Error('Choose forge, practice or quest');start(input.mode);return {mode,coins,ammo};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}

function forgeScene(){let bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#172e33');bg.addColorStop(1,'#42625a');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);ctx.strokeStyle='#8eb6a51c';ctx.lineWidth=1;for(let x=0;x<W;x+=35){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=35){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.save();ctx.translate(W*.66,H*.46);ctx.rotate(-.2);ctx.strokeStyle='#bde58c30';ctx.lineWidth=2;for(let r of [W*.19,W*.23]){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();}ctx.restore();poly([[0,H*.79],[W,H*.79],[W,H],[0,H]],'#12292b');rect(0,H*.79,W,5,'#93ab67');for(let i=0;i<W/30;i++)poly([[i*30,H*.79],[i*30+12,H*.79],[i*30,H*.79+5],[i*30-12,H*.79+5]],'#263c33');ctx.fillStyle='#c8e6b5';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('BLASTER WORKBENCH',W*.66,H*.72);ctx.textAlign='left';}

function drawModelDetails(){
 if(equipped===0)return;
 if(isMoab()){drawMoab();return;}if(equipped>3){rect(-90,-227,180,24,'#e47d39');rect(-85,-135,34,75,'#607d86');for(let i=0;i<equipped-2;i++)rect(-66+i*23,-181,11,21,'#e7e7ba');ctx.fillStyle='#fff4d3';ctx.font='bold 12px sans-serif';ctx.fillText(roster[brand][equipped].split(' · ')[0],-65,-155);return;}
 const orange='#f58035',dark='#233942',blue='#37b9d1';
 if(brand==='X-Shot'){
  if(equipped===1){rect(-80,-231,151,13,orange);rect(-56,-120,100,17,orange);for(let i=0;i<4;i++){rect(79,-199+i*18,27,12,orange);circle(102,-193+i*18,4,dark);}}
  if(equipped===2||combined){circle(-65,-160,76,orange);circle(-65,-160,50,dark);circle(-65,-160,27,blue);for(let i=0;i<18;i++){let a=i*Math.PI/9;circle(-65+61*Math.cos(a),-160+61*Math.sin(a),7,'#243e47');}rect(-85,-257,139,22,blue);}
  if(equipped===3){rect(-70,-226,150,124,blue);rect(-88,-220,184,22,orange);circle(0,-264,54,dark);for(let i=0;i<6;i++){let a=i*Math.PI/3+(triggerHeld?clock*10:0);circle(Math.cos(a)*31,-264+Math.sin(a)*31,16,orange);circle(Math.cos(a)*31,-264+Math.sin(a)*31,9,dark);}for(let i=0;i<8;i++){rect(82+i*4,-179+i*15,31,12,orange);rect(105+i*4,-177+i*15,11,8,blue);}rect(-48,-92,27,57,dark);rect(43,-92,27,57,dark);}
  if(combined){rect(-137,-281,48,125,blue);rect(-137,-290,48,18,orange);rect(105,-268,45,137,blue);rect(105,-282,45,25,orange);rect(-155,-118,306,18,dark);}
 }else if(equipped===1){rect(-101,-208,195,30,'#36a1c4');rect(-111,-208,29,30,orange);rect(-90,-246,142,11,orange);rect(-82,-120,33,83,'#d5e7e3');rect(-72,-107,13,54,orange);}
 else if(equipped===2){rect(-75,-233,149,52,'#df4944');rect(-70,-245,135,15,dark);rect(-78,-183,30,36,'#ededdd');rect(-41,-182,82,20,'#ededdd');}
 else{rect(-111,-219,205,135,'#e8ebe3');rect(-95,-215,173,46,'#4e6570');rect(-82,-163,135,31,orange);rect(-124,-165,25,100,dark);rect(94,-165,25,100,dark);rect(-40,-264,84,45,orange);rect(-31,-263,66,18,dark);for(let i=0;i<7;i++)circle(-73+i*22,-194,7,'#d8f66f');}
}

function buyMain(n){if(mode!=='forge'||!Number.isInteger(n)||n<1||n>=roster[brand].length)return;if(!owned[brand].includes(n)){if(buildTier()<mainTier[n]||coins<mainCosts[n])return;coins-=mainCosts[n];owned[brand].push(n);}equip(n);}
const effectiveBarrel=()=>Math.min(4,attachments.barrel+(brand==='X-Shot'&&equipped===4?1:0));
function shotPoint(){let {x,y}=screenToWorld(aim),barrel=effectiveBarrel();const period=[3,6,10,20,Infinity][barrel];if(shots%period===0)x+=(Math.floor(shots/period)%2?1:-1)*[.075,.05,.035,.02,0][barrel];return {x,y};}
function initAccessories(){for(const kind of Object.keys(accessories)){const select=$(kind+'Select');select.innerHTML=accessories[kind].map((a,i)=>`<option value="${i}">${a[0]} — ${a[1]?a[1]+' coins':'Free'}</option>`).join('');select.onchange=updateAccessories;$(kind+'Attach').onclick=()=>{const i=Number(select.value);if(mode!=='forge'||!Number.isInteger(i)||!accessories[kind][i])return;if(!purchased[kind].includes(i)){const cost=accessories[kind][i][1];if(coins<cost)return;coins-=cost;purchased[kind].push(i);}attachments[kind]=i;ammo=cap();update();};}}
function updateAccessories(){for(const kind of Object.keys(accessories)){const i=Number($(kind+'Select').value)||0,a=accessories[kind][i],have=purchased[kind].includes(i);$(kind+'Attach').textContent=attachments[kind]===i?'Equipped':have?'Equip':'Buy · '+a[1];$(kind+'Attach').disabled=attachments[kind]===i||(!have&&coins<a[1]);$(kind+'Info').textContent=a[2]+' · Equipped: '+accessories[kind][attachments[kind]][0];}}
function drawAttachments(){hideHeavyReceiver();if(attachments.barrel){
 const length=attachments.barrel*17;
 // Start at the forward rim of the selected barrel cluster, never its center.
 const heavy=isMoab()||(brand==='X-Shot'&&equipped===3);
 const front=isMoab()?-352:heavy?-318:-273,center=heavy?0:10;
 // Barrel attachments affect shot spread, but stay hidden in first-person view.
 }if(attachments.holder){for(let i=0;i<attachments.holder*3;i++){rect(111,-121+i*9,27,6,'#e5c768');circle(138,-118+i*9,3,'#f88845');}}if(attachments.sight){
 // Raised offset rail keeps the optic clear of every muzzle and barrel attachment.
 const heavy=isMoab()||(brand==='X-Shot'&&equipped===3);
 const mountX=isMoab()?-171:heavy?-158:-101,mountY=heavy?-285:-247;
 rect(mountX,-216,heavy?95:51,8,'#607882');
 rect(mountX+14,mountY+15,9,-208-(mountY+15),'#374e59');
 const wide=attachments.sight>=2?48:38;
 rect(mountX-7,mountY-27,wide,39,'#192f3d');
 rect(mountX-3,mountY-23,wide-8,31,'#c7dee0');
 rect(mountX+1,mountY-19,wide-16,23,'#69bfb7');
 rect(mountX+5,mountY-17,wide-24,4,'#baf3e4');
 circle(mountX+wide/2-7,mountY-7,2,'#e8ff83');
 if(attachments.sight>=2){rect(mountX+wide-7,mountY-17,9,13,'#405d69');rect(mountX+8,mountY-34,15,7,'#405d69');}
 }}
function drawSight(x,y){drawAbilityHUD();if(mode==='forge')return;ctx.save();ctx.strokeStyle=attachments.sight?'#d8ff89':'#cbd9cb';ctx.lineWidth=2;const r=[23,32,48,65][attachments.sight];ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();if(attachments.sight>=2){ctx.fillStyle='#d8ff89';ctx.font='12px sans-serif';ctx.fillText(zoom()+'×',x+r+6,y);for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(x+i*12,y+14);ctx.lineTo(x+i*12,y+20);ctx.stroke();}}ctx.restore();}

function rememberBrand(){profiles[brand]={levels,attachments,purchased,equipped,combined};}
function useBrand(b){brand=b;const profile=profiles[b];levels=profile.levels;attachments=profile.attachments;purchased=profile.purchased;equipped=profile.equipped;combined=profile.combined;}
function switchBrand(b){
 if(mode!=='forge'||!Object.hasOwn(profiles,b))return;
 rememberBrand();useBrand(b);triggerHeld=false;reloading=0;abilityShots=0;laserUntil=0;specialFx=[];ammo=cap();
 for(const k of Object.keys(attachments))$(k+'Select').value=String(attachments[k]);
 $('nerf').classList.toggle('active',b==='Nerf');$('xshot').classList.toggle('active',b==='X-Shot');update();
}
function saveProgress(){
 try{
  rememberBrand();
  localStorage.setItem(SAVE_KEY,JSON.stringify({version:2,coins,brand,owned,profiles,questUnlocked,questLevel,turretEnabled}));
  $('saveStatus').textContent='Progress saved in this browser.';
 }catch{ $('saveStatus').textContent='Saving is unavailable in this browser. Keep this page open to retain your progress.'; }
}
function loadProgress(){
 try{
  const data=JSON.parse(localStorage.getItem(SAVE_KEY));
  if(!data||![1,2].includes(data.version))return;
  const integer=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
  const validList=(list,max)=>[...new Set([0,...(Array.isArray(list)?list.filter(n=>integer(n,max)):[])])];
  if(integer(data.coins,Number.MAX_SAFE_INTEGER))coins=data.coins;
  if(integer(data.questUnlocked,Number.MAX_SAFE_INTEGER)&&data.questUnlocked>=1)questUnlocked=data.questUnlocked;
  if(integer(data.questLevel,questUnlocked)&&data.questLevel>=1)questLevel=data.questLevel;
  if(Object.hasOwn(roster,data.brand))brand=data.brand;
  for(const b of Object.keys(profiles)){
   owned[b]=validList(data.owned?.[b],roster[b].length-1);
   // Older saves have no purchase history by brand. Keep shared upgrades on the last selected brand.
   const source=data.version===1?(b===brand?data:{}):(data.profiles?.[b]||{}),profile=freshProfile();
   for(const k of Object.keys(profile.levels))if(integer(source.levels?.[k],Number.MAX_SAFE_INTEGER))profile.levels[k]=source.levels[k];
   profile.equipped=owned[b].includes(source.equipped)?source.equipped:0;
   profile.combined=source.combined===true&&b==='X-Shot'&&profile.equipped===3&&Object.values(profile.levels).every(n=>n>=3)&&[1,2,3].every(n=>owned[b].includes(n));
   for(const k of Object.keys(profile.attachments)){
    profile.purchased[k]=validList(source.purchased?.[k],accessories[k].length-1);
    profile.attachments[k]=profile.purchased[k].includes(source.attachments?.[k])?source.attachments[k]:0;
   }
   profiles[b]=profile;
  }
  turretEnabled=data.turretEnabled===true&&owned['X-Shot'].includes(3);
  if(turretEnabled)profiles['X-Shot'].combined=false;
  useBrand(brand);
 }catch{ /* Unavailable storage or an invalid save must not stop the game. */ }
}

function initMovement(){for(const [id,key] of [['moveLeft','a'],['moveRight','d'],['moveForward','w'],['moveBack','s']]){const button=$(id);button.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(key);button.setPointerCapture?.(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(key));}}
function updateCombat(dt){
 hitFlash=Math.max(0,hitFlash-dt);
 if(mode!=='quest'||!active)return;
 let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);const length=Math.hypot(dx,dy)||1;
 player.x=Math.max(-.07,Math.min(.07,player.x+dx/length*dt*.15));player.y=Math.max(-.055,Math.min(.055,player.y+dy/length*dt*.12));
 for(const t of targets){t.cycle+=dt*questConfig().speed;if(t.cycle>=5.4){t.cycle=0;t.fired=false;}t.exposure=Math.max(0,Math.min(1,(t.cycle-1.8)/.35,(4.9-t.cycle)/.35));t.y=t.coverY-t.r*1.6*t.exposure;t.x=t.base;
 if(t.cycle>=4&&!t.fired){t.fired=true;enemyDarts.push({x:t.x+t.r*1.45,y:t.y+t.r*.05*W/H,age:0,flight:.65/Math.sqrt(questConfig().speed),px:player.x,py:player.y});}}
 for(const dart of enemyDarts){dart.age+=dt;if(dart.age>=(dart.flight||.65)&&!dart.done){dart.done=true;if(Math.hypot(player.x-dart.px,player.y-dart.py)<.033){health--;hitFlash=.25;update();if(health<=0){health=0;active=false;triggerHeld=false;enemyDarts=[];showDefeat();update();break;}}}}
 enemyDarts=enemyDarts.filter(d=>!d.done);
}
function drawCover(t){const x=t.x*W,r=t.r*W,y=t.coverY*H,w=r*3.3,h=r*2.6;rect(x-w/2,y,w,h,'#bd9255');rect(x-w/2+5,y+5,w-10,7,'#e6bd76');rect(x-w/2+5,y+h-12,w-10,7,'#866837');rect(x-w/2+6,y+10,7,h-20,'#e0b371');rect(x+w/2-13,y+10,7,h-20,'#e0b371');ctx.strokeStyle='#856734';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x-w/2+14,y+h-16);ctx.lineTo(x+w/2-14,y+16);ctx.stroke();}
function drawEnemyDarts(){if(mode!=='quest')return;for(const dart of enemyDarts){const from=worldToScreen(dart),p=Math.min(1,dart.age/(dart.flight||.65)),x=from.x+( .5+(dart.px-player.x)*3-from.x)*p,y=from.y+(.65+(dart.py-player.y)*3-from.y)*p;circle(x*W,y*H,4+p*9,'#ff986a');}if(hitFlash){ctx.fillStyle='rgba(255,85,60,'+hitFlash+')';ctx.fillRect(0,0,W,H);}}
function drawReloadHand(){if(!reloading)return;const p=1-reloading/reloadDuration,reach=Math.sin(Math.PI*Math.min(1,p/.85)),x=-240+reach*207,y=15-reach*166;poly([[x-70,y+110],[x-95,y+63],[x-25,y-2],[x+14,y+30]],'#355c68');poly([[x-25,y-2],[x-22,y-28],[x+7,y-35],[x+30,y-16],[x+29,y+18],[x+14,y+30]],'#d5a27e');for(let i=0;i<3;i++){rect(x-13+i*10,y-37,8,24,'#eac454');rect(x-13+i*10,y-42,8,7,'#f07e40');}if(p>.7){rect(-42,-218+(p-.7)*65,90,12,'#c8ded2');} }

// A short synthesized toy pop, with no recorded firearm audio.
let shotAudio;
function playShotPop(){
 try{
  const AudioEngine=window.AudioContext||window.webkitAudioContext;
  if(!AudioEngine)return;
  if(!shotAudio)shotAudio=new AudioEngine();
  if(shotAudio.state==='suspended'){shotAudio.resume().then(()=>{if(shotAudio.state==='running')soundPop();}).catch(()=>{});return;}
  if(shotAudio.state==='running')soundPop();
 }catch{ /* Audio support must never interrupt gameplay. */ }
}
function soundPop(){
 const now=shotAudio.currentTime,osc=shotAudio.createOscillator(),gain=shotAudio.createGain();
 osc.type='sine';osc.frequency.setValueAtTime(460,now);osc.frequency.exponentialRampToValueAtTime(115,now+.075);
 gain.gain.setValueAtTime(.001,now);gain.gain.exponentialRampToValueAtTime(.16,now+.004);gain.gain.exponentialRampToValueAtTime(.001,now+.085);
 osc.connect(gain);gain.connect(shotAudio.destination);osc.start(now);osc.stop(now+.09);
 osc.onended=()=>{osc.disconnect();gain.disconnect();};
}

music={context:null,bus:null,timer:null,mode,step:0,next:0,enabled:true,voices:new Set()};
try{music.enabled=localStorage.getItem('foam-forge-music')!=='off';}catch{}
function musicLabel(){const button=$('musicToggle');button.textContent=music.enabled?'♫ Music on':'♫ Music off';button.setAttribute('aria-pressed',String(music.enabled));}
function stopMusic(){clearInterval(music.timer);music.timer=null;for(const node of music.voices){try{node.stop();}catch{}}music.voices.clear();}
function changeMusic(nextMode){music.mode=nextMode;music.step=0;if(!music.context)return;stopMusic();music.next=music.context.currentTime+.05;if(music.enabled&&music.context.state==='running')music.timer=setInterval(scheduleMusic,40);}
function musicTone(hz,time,duration,volume,type='sine'){
 const c=music.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(hz,time);g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(volume,time+.018);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g);g.connect(music.bus);music.voices.add(o);o.onended=()=>{music.voices.delete(o);o.disconnect();g.disconnect();};o.start(time);o.stop(time+duration+.02);
}
function scheduleMusic(){
 if(!music.enabled||music.context.state!=='running')return;
 const c=music.context;if(music.next<c.currentTime)music.next=c.currentTime+.02;
 const battle=music.mode==='quest',range=music.mode==='practice',bpm=battle?156:range?108:66,beat=60/bpm,unit=beat/2;
 while(music.next<c.currentTime+.12){const t=music.next,s=music.step,root=[130.81,110,174.61,146.83][Math.floor(s/16)%4];
 if(!battle&&!range){if(s%8===0){for(const ratio of [1,1.25,1.5])musicTone(root*ratio,t,beat*3.5,.055);}
 if(s%2===0)musicTone(root*[2,2.5,3,2.5,2.25,2,1.5,2][(s/2)%8],t,beat*1.4,.065);
 }else{
 const notes=battle?[2,2,3,2.5,2,3,4,3]:[2,2.5,3,2.5,2.25,2.5,1.5,2];
 musicTone(root*notes[s%8],t,unit*.8,battle?.065:.06,'triangle');
 if(s%2===0)musicTone(root/2,t,beat*.7,.12,'triangle');
 if(s%(battle?2:4)===0)musicTone(65,t,.10,.24);
 if(s%4===2){musicTone(185,t,.07,.10,'triangle');musicTone(390,t,.045,.045);}
 if(battle||s%2===1)musicTone(2600+(s%3)*500,t,.025,.018,'triangle');
 }
 music.step++;music.next+=unit;
 }
}
async function enableMusic(){
 if(!music.enabled||document.hidden)return;
 try{const Engine=window.AudioContext||window.webkitAudioContext;if(!Engine)return;
 if(!music.context){music.context=new Engine();music.bus=music.context.createGain();music.bus.gain.value=.38;music.bus.connect(music.context.destination);}
 if(music.context.state==='suspended')await music.context.resume();
 if(music.enabled&&!music.timer)changeMusic(mode);
 }catch{}
}
$('musicToggle').onclick=()=>{music.enabled=!music.enabled;try{localStorage.setItem('foam-forge-music',music.enabled?'on':'off');}catch{}musicLabel();if(music.enabled)enableMusic();else stopMusic();};
document.addEventListener('pointerdown',enableMusic);document.addEventListener('keydown',enableMusic);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMusic();else enableMusic();});
window.addEventListener('pagehide',stopMusic);musicLabel();

function showDefeat(){stopHandsFree();
 questWon=false;$('defeatTitle').textContent='You lost';$('questResultText').textContent='You used all '+maxHealth()+' lives. Your coins and blasters are safe.';$('defeatRetry').textContent='Play again';
 keys.clear();triggerHeld=false;reloading=0;enemyDarts=[];particles=[];tracers=[];
 $('toast').style.opacity=0;toastUntil=0;
 $('defeatScreen').hidden=false;
 if(music)changeMusic('forge');
 $('defeatReturn').focus();
}
function leaveDefeat(destination){if($('defeatScreen').hidden)return;start(destination);if(destination==='forge')$('practice').focus();else canvas.focus();}
$('defeatReturn').onclick=()=>leaveDefeat('forge');
$('defeatRetry').onclick=()=>{if(questWon)questLevel++;leaveDefeat('quest');};
window.addEventListener('keydown',e=>{
 if($('defeatScreen').hidden)return;
 if(e.key==='Enter'&&document.activeElement!==$('defeatRetry')){e.preventDefault();leaveDefeat('forge');}
 if(e.key==='Escape'){e.preventDefault();leaveDefeat('forge');}
 if(e.key==='Tab'){e.preventDefault();(document.activeElement===$('defeatReturn')?$('defeatRetry'):$('defeatReturn')).focus();}
});

function updateQuestPicker(){const select=$('questLevel');const choices=new Set([1,questUnlocked,questUnlocked+1]);for(let n=Math.max(1,questLevel-5);n<=Math.min(questUnlocked,questLevel+5);n++)choices.add(n);select.innerHTML=[...choices].sort((a,b)=>a-b).map(n=>'<option value="'+n+'"'+(n>questUnlocked?' disabled':'')+'>Level '+n+(n>questUnlocked?' · Locked':'')+'</option>').join('');select.value=String(questLevel);const q=questConfig();$('questDetails').textContent=q.bots+' bots · '+q.hp+' health each · '+q.reward+' coins per bot · '+q.bonus+' completion bonus · up to '+(q.bonus*2)+' speed bonus';}
$('questLevel').onchange=()=>{const n=Number($('questLevel').value);if(mode==='forge'&&Number.isInteger(n)&&n>=1&&n<=questUnlocked){questLevel=n;update();}};
function showVictory(){stopHandsFree();
 questWon=true;keys.clear();triggerHeld=false;reloading=0;enemyDarts=[];particles=[];tracers=[];
 $('toast').style.opacity=0;toastUntil=0;$('defeatTitle').textContent='Level '+questLevel+' complete!';
 const q=questConfig();$('questResultText').textContent='Time: '+questSeconds.toFixed(1)+'s. Earned '+(q.bots*q.reward+q.bonus+earnedTimeBonus)+' coins: '+(q.bots*q.reward)+' bot rewards + '+q.bonus+' completion + '+earnedTimeBonus+' speed bonus. '+('Level '+(questLevel+1)+' is unlocked.');
 $('defeatRetry').textContent='Play level '+(questLevel+1);$('defeatScreen').hidden=false;if(music)changeMusic('forge');$('defeatRetry').focus();
}

function drawUpgradeTrim(){const total=levels.spring+levels.capacity+levels.prime;if(equipped===7){for(let i=0;i<4;i++){rect(-36+i*23,-283,19,29,'#e98a4d');rect(-31+i*23,-283,9,10,'#233e42');}}if(total<=9)return;const hue=(total*23)%360;rect(-67,-107,122,6,'hsl('+hue+',70%,65%)');ctx.fillStyle='#effad9';ctx.font='bold 11px sans-serif';ctx.fillText('S'+levels.spring+' / M'+levels.capacity+' / P'+levels.prime,-62,-121);if(equipped===7){for(let i=0;i<4;i++){rect(-36+i*23,-283,19,29,'#e98a4d');rect(-31+i*23,-283,9,10,'#233e42');}}}

function stopHandsFree(){autoFireLatched=false;triggerHeld=false;const button=$('autoFireToggle');button.textContent='Hands-free fire: off';button.setAttribute('aria-pressed','false');}
function toggleHandsFree(){if(mode==='forge'||!active)return;autoFireLatched=!autoFireLatched;triggerHeld=false;nextShot=clock;const button=$('autoFireToggle');button.textContent=autoFireLatched?'Stop hands-free fire':'Hands-free fire: off';button.setAttribute('aria-pressed',String(autoFireLatched));}
canvas.addEventListener('contextmenu',e=>{e.preventDefault();pointer(e);toggleHandsFree();});
$('autoFireToggle').onclick=toggleHandsFree;
window.addEventListener('blur',stopHandsFree);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopHandsFree();});
window.addEventListener('keydown',e=>{if(e.key==='Escape')stopHandsFree();});

function drawBotBlaster(t,x,y,r){
 // Compact single-dart toy with an orange body, short muzzle and T-prime handle.
 const kick=t.fired?Math.max(0,1-(t.cycle-4)/.22):0;
 ctx.save();ctx.translate(x+r*.8-kick*r*.12,y+r*.22);ctx.rotate(-.12-kick*.12);
 rect(-r*.55,0,r*.65,r*.24,'#315661');
 circle(-r*.03,r*.1,r*.19,'#f4b38b');
 poly([[r*.02,-r*.2],[r*.46,-r*.2],[r*.46,r*.04],[r*.22,r*.04],[r*.18,r*.5],[r*.02,r*.5]],'#fb972e');
 rect(-r*.04,-r*.3,r*.66,r*.26,'#f67d29');
 rect(r*.46,-r*.29,r*.2,r*.25,'#f4c946');
 rect(r*.6,-r*.24,r*.08,r*.13,'#29434b');
 rect(r*.08,r*.48,r*.06,r*.18,'#759aa1');
 rect(-r*.01,r*.62,r*.24,r*.07,'#29434b');
 rect(r*.09,r*.17,r*.13,r*.08,'#324d54');
 if(kick>0){circle(r*.79,-r*.17,r*(.12+.1*kick),'#ffe5a0');}
 ctx.restore();
}

function damageBot(target,power,fromPlayer=false){if(fromPlayer)hits++;target.hp-=power;for(let i=0;i<12;i++)particles.push({x:target.x*W,y:target.y*H,vx:(Math.random()-.5)*250,vy:(Math.random()-.5)*250,life:.5,color:mode==='practice'?'#e8fc7c':'#ffa68d'});if(mode==='practice'){coins+=5;targets[targets.indexOf(target)]=practiceRespawn(target);}else if(target.hp<=0){coins+=questConfig().reward;kills++;$('objective').textContent=`Tag ${questConfig().bots} bots · ${kills} / ${questConfig().bots}`;if(kills===questConfig().bots){questSeconds=(Date.now()-questStarted)/1000;earnedTimeBonus=timeBonus(questSeconds);coins+=questConfig().bonus+earnedTimeBonus;active=false;targets=[];questUnlocked=Math.max(questUnlocked,questLevel+1);showVictory();}else{targets.splice(targets.indexOf(target),1);if(kills+targets.length<questConfig().bots)targets.push(spawn(Math.floor(Math.random()*8)));}}}

function turretStats(){const profile=brand==='X-Shot'?{levels,attachments}:profiles['X-Shot'];return {damage:1+profile.levels.spring,capacity:capacityFor(3,profile.levels,profile.attachments),reload:reloadSeconds(profile.levels.prime)};}
function updateTurretUI(){const stats=turretStats();$('turretStats').textContent=stats.damage+' damage · '+stats.capacity+' darts · '+stats.reload.toFixed(2)+'s reload · uses X-Shot upgrades';const available=owned['X-Shot'].includes(3);$('turretToggle').disabled=!available;$('turretToggle').textContent=turretEnabled?'Disable Rage Fire turret':available?'Enable Rage Fire turret':'Unlock Rage Fire to use turret';$('turretToggle').setAttribute('aria-pressed',String(turretEnabled));}
$('turretToggle').onclick=()=>{if(mode!=='forge'||!owned['X-Shot'].includes(3))return;turretEnabled=!turretEnabled;if(turretEnabled){combined=false;profiles['X-Shot'].combined=false;}turretBeam=null;update();};
function updateTurret(){
 if(!turretEnabled||!['practice','quest'].includes(mode)||!active)return;
 if(turretReloadUntil){if(clock<turretReloadUntil)return;turretReloadUntil=0;turretAmmo=turretStats().capacity;}
 if(clock<turretNext)return;
 const target=targets.find(t=>(mode==='practice'||t.exposure>.65)&&t.hp>0);if(!target)return;
 turretNext=clock+.6;turretAmmo--;turretBeam={x:target.x,y:target.y,until:clock+.15};
 damageBot(target,turretStats().damage);if(!turretAmmo)turretReloadUntil=clock+turretStats().reload;update();
}
function drawTurret(){
 if(!turretEnabled||mode==='forge')return;
 const x=W*.10,y=H*.76,s=Math.min(W/1000,H/650);
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 poly([[-15,0],[-48,91],[-38,91],[0,20],[38,91],[48,91],[15,0]],'#304d50');
 rect(-47,-65,94,57,'#3eaabe');rect(-53,-58,106,10,'#ff922e');
 circle(0,-77,31,'#273e47');for(let i=0;i<6;i++){const a=i*Math.PI/3+(turretBeam&&clock<turretBeam.until?clock*8:0);circle(Math.cos(a)*18,-77+Math.sin(a)*18,8,'#f48b36');circle(Math.cos(a)*18,-77+Math.sin(a)*18,4,'#22373e');}
 for(let i=0;i<5;i++)rect(44+i*4,-43+i*13,20,8,'#ecab44');
 ctx.fillStyle='#dafa9e';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText(turretReloadUntil?'RELOADING':'RAGE FIRE · '+turretAmmo,0,112);ctx.restore();
 if(turretBeam&&clock<turretBeam.until){const point=worldToScreen(turretBeam);ctx.strokeStyle='#ffa850';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y-77*s);ctx.lineTo(point.x*W,point.y*H);ctx.stroke();}
}

function drawMoab(){
 rect(-110,-230,214,151,'#e9eef1');rect(-96,-225,189,40,'#368de0');rect(-113,-160,220,29,'#2670bb');
 rect(-123,-138,25,115,'#2b3f51');rect(98,-138,25,115,'#2b3f51');rect(-90,-122,160,16,'#f69840');
 const spin=(triggerHeld||autoFireLatched)?clock*24:clock*.4;
 circle(0,-275,77,'#294a65');circle(0,-275,67,'#e3eaf0');
 for(let i=0;i<6;i++){const a=i*Math.PI/3+spin,x=Math.cos(a)*43,y=-275+Math.sin(a)*43;circle(x,y,21,'#247dcc');circle(x,y,15,'#f59d38');circle(x,y,9,'#192e41');}
 circle(0,-275,16,'#36c9ed');
 for(let i=0;i<10;i++){rect(104+i*5,-179+i*14,37,11,'#efb449');rect(135+i*5,-177+i*14,12,7,'#368de0');}
 rect(-68,-175,110,31,'#173848');ctx.fillStyle='#7cffe3';ctx.font='bold 19px sans-serif';ctx.fillText('M.O.A.B.',-61,-153);
 ctx.fillStyle='#203c54';ctx.font='bold 11px sans-serif';ctx.fillText('ULTRA / 500-DART FEED',-77,-96);
}
function hideHeavyReceiver(){if(isMoab()||(brand==='X-Shot'&&equipped===3))rect(-64,-174,120,61,'#294955');}

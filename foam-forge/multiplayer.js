(()=>{
 const WIN_SCORE=20,ROOM_PREFIX='foam-forge-room-',MATCH_ID='foam-forge-matchmaking-v1';
 const state={peer:null,connection:null,connected:false,score:0,opponentScore:0,side:'left',localFlash:0,rivalFlash:0};

 const lobby=document.createElement('div');
 lobby.id='multiplayerLobby';lobby.className='multiplayer-overlay';lobby.hidden=true;
 lobby.innerHTML='<section class="multiplayer-dialog" role="dialog" aria-modal="true" aria-labelledby="multiplayerTitle"><button id="multiplayerClose" class="settings-close" aria-label="Close multiplayer">×</button><span class="eyebrow">ONLINE BETA</span><h2 id="multiplayerTitle">Multiplayer</h2><p id="multiplayerMessage">Race another player to hit 20 targets first.</p><div id="multiplayerChoices"><button id="createRoom">Create private room</button><div class="join-room"><input id="roomCode" maxlength="6" autocomplete="off" placeholder="ROOM CODE" aria-label="Six-character room code"><button id="joinRoom">Join room</button></div><button id="findMatch">Find players</button></div><div id="multiplayerWaiting" hidden><div class="matchmaking-spinner" aria-hidden="true"></div><strong id="waitingTitle">MATCHMAKING</strong><p id="waitingMessage">Looking for another player…</p><button id="cancelMatch">Cancel</button></div></section>';
 document.body.append(lobby);

 const hud=document.createElement('div');hud.id='multiplayerHud';hud.className='multiplayer-hud';hud.hidden=true;hud.innerHTML='<span>YOU <b id="yourScore">0</b></span><strong>FIRST TO 20</strong><span>RIVAL <b id="rivalScore">0</b></span>';document.querySelector('.arena').append(hud);
 const multiplayerButton=document.createElement('button');multiplayerButton.id='multiplayer';multiplayerButton.textContent='⇄ Multiplayer →';document.querySelector('.destinations .modes').append(multiplayerButton);

 function setWaiting(title,message){$('multiplayerChoices').hidden=true;$('multiplayerWaiting').hidden=false;$('multiplayerTitle').textContent=title;$('waitingTitle').textContent=title;$('waitingMessage').textContent=message;}
 function resetLobby(){$('multiplayerChoices').hidden=false;$('multiplayerWaiting').hidden=true;$('multiplayerTitle').textContent='Multiplayer';$('multiplayerMessage').textContent='Race another player to hit 20 targets first.';}
 function showError(message){resetNetwork();resetLobby();$('multiplayerMessage').textContent=message;lobby.hidden=false;}
 function loadPeerJS(){return new Promise((resolve,reject)=>{if(window.Peer){resolve();return;}const existing=document.querySelector('script[data-peerjs]');if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}const script=document.createElement('script');script.dataset.peerjs='true';script.src='https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});}
 function resetNetwork(){multiplayerHit=null;multiplayerDraw=null;state.connected=false;state.connection?.close();state.peer?.destroy();state.connection=null;state.peer=null;hud.hidden=true;document.body.classList.remove('in-multiplayer');}
 function send(data){if(state.connection?.open)state.connection.send(data);}
 function updateScores(){$('yourScore').textContent=state.score;$('rivalScore').textContent=state.opponentScore;}
 function finish(won){active=false;multiplayerHit=null;send({type:'finished',won});$('multiplayerHud').classList.add(won?'won':'lost');toast(won?'YOU WIN · multiplayer target race complete!':'RIVAL WINS · good game!');}
 function drawAvatar(x,label,color,facing,flash){
  const scale=Math.min(W/1000,H/650),y=H*.77;
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=.96;
  ctx.fillStyle='#10282b99';ctx.beginPath();ctx.ellipse(0,76,64,14,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=color;ctx.fillRect(-25,-8,50,67);ctx.fillStyle='#233f47';ctx.fillRect(-23,52,18,43);ctx.fillRect(5,52,18,43);
  ctx.fillStyle='#efb488';ctx.beginPath();ctx.arc(0,-28,22,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#253f48';ctx.fillRect(-23,-48,46,15);ctx.fillRect(facing*14,-35,facing*14,6);
  ctx.save();ctx.scale(facing,1);ctx.fillStyle='#35a8c3';ctx.fillRect(17,1,66,17);ctx.fillStyle='#f28a3e';ctx.fillRect(69,5,24,9);ctx.fillStyle='#263f47';ctx.fillRect(29,18,17,24);ctx.restore();
  if(flash>clock){ctx.fillStyle='#fff0a0';ctx.beginPath();ctx.arc(facing*101,9,13+(flash-clock)*40,0,Math.PI*2);ctx.fill();}
  ctx.font='800 13px sans-serif';ctx.textAlign='center';ctx.fillStyle='#10282b';ctx.fillRect(-43,-75,86,21);ctx.fillStyle='#efffd0';ctx.fillText(label,0,-60);ctx.restore();
 }
 function drawPlayers(){if(!state.connected)return;const localLeft=state.side==='left';drawAvatar(W*(localLeft ? .09 : .91),'YOU','#d6f76c',localLeft?1:-1,state.localFlash);drawAvatar(W*(localLeft ? .91 : .09),'RIVAL','#ef765f',localLeft?-1:1,state.rivalFlash);}
 function beginRace(){state.connected=true;state.score=0;state.opponentScore=0;state.localFlash=0;state.rivalFlash=0;lobby.hidden=true;hud.hidden=false;hud.classList.remove('won','lost');document.body.classList.add('in-multiplayer');start('practice');$('modeTitle').textContent='Multiplayer Target Race';$('objective').textContent='First player to hit '+WIN_SCORE+' targets · players left and right';updateScores();multiplayerDraw=drawPlayers;multiplayerHit=()=>{if(!state.connected||!active)return;state.score++;state.localFlash=clock+.15;updateScores();send({type:'score',score:state.score});if(state.score>=WIN_SCORE)finish(true);};toast('MULTIPLAYER START · first to 20 hits wins!');}
 function bindConnection(connection){state.connection=connection;connection.on('open',()=>{state.peer?.disconnect();beginRace();});connection.on('data',data=>{if(!data||typeof data!=='object')return;if(data.type==='score'&&Number.isInteger(data.score)){state.opponentScore=Math.max(0,Math.min(WIN_SCORE,data.score));state.rivalFlash=clock+.15;updateScores();if(state.opponentScore>=WIN_SCORE&&active)finish(false);}if(data.type==='finished'&&data.won&&active)finish(false);});connection.on('close',()=>{if(state.connected&&active){active=false;multiplayerHit=null;toast('The other player disconnected.');}});connection.on('error',()=>showError('The player connection failed. Try matchmaking again.'));}
 function host(id,waitingTitle,waitingMessage){resetNetwork();state.side='left';setWaiting(waitingTitle,waitingMessage);const peer=new Peer(id,{debug:0});state.peer=peer;peer.on('open',()=>{});peer.on('connection',connection=>{if(state.connection)return;bindConnection(connection);});peer.on('error',error=>{if(error?.type==='unavailable-id'&&id===MATCH_ID){join(MATCH_ID,true);return;}showError(error?.type==='unavailable-id'?'That room code is already being used. Create another room.':'Multiplayer could not connect. Check your internet connection and try again.');});}
 function join(id,isMatchmaking=false){resetNetwork();state.side='right';if(isMatchmaking)setWaiting('MATCHMAKING','Found a waiting player. Connecting…');else setWaiting('JOINING ROOM','Connecting to '+id.slice(ROOM_PREFIX.length).toUpperCase()+'…');const peer=new Peer(undefined,{debug:0});state.peer=peer;peer.on('open',()=>{const connection=peer.connect(id,{reliable:true,serialization:'json'});bindConnection(connection);});peer.on('error',error=>{if(isMatchmaking&&error?.type==='peer-unavailable'){setTimeout(()=>host(MATCH_ID,'MATCHMAKING','Looking for another player…'),700);return;}showError('No player was found with that room code. Check the code and try again.');});}
 function roomCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code='';for(let i=0;i<6;i++)code+=alphabet[Math.floor(Math.random()*alphabet.length)];return code;}
 async function ready(action){try{setWaiting('CONNECTING','Starting online multiplayer…');await loadPeerJS();action();}catch{showError('Online multiplayer could not load. Check your internet connection and try again.');}}

 multiplayerButton.onclick=()=>{resetLobby();lobby.hidden=false;};
 $('multiplayerClose').onclick=()=>{resetNetwork();lobby.hidden=true;resetLobby();};$('cancelMatch').onclick=()=>{resetNetwork();resetLobby();};
 $('createRoom').onclick=()=>ready(()=>{const code=roomCode();host(ROOM_PREFIX+code,'ROOM '+code,'Share this code with the other player. Waiting for them to join…');});
 $('joinRoom').onclick=()=>{const code=$('roomCode').value.toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length!==6){$('multiplayerMessage').textContent='Enter the six-character room code.';return;}ready(()=>join(ROOM_PREFIX+code));};
 $('roomCode').oninput=()=>{$('roomCode').value=$('roomCode').value.toUpperCase().replace(/[^A-Z0-9]/g,'');};
 $('findMatch').onclick=()=>ready(()=>host(MATCH_ID,'MATCHMAKING','Looking for another player…'));
 $('forgeBack').addEventListener('click',()=>{if(state.connected)resetNetwork();});window.addEventListener('pagehide',resetNetwork);
})();

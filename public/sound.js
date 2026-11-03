/* कौतुक — कोड से बनी आवाज़ें (कोई ऑडियो फाइल नहीं) */
window.Snd=(function(){
  var AC=window.AudioContext||window.webkitAudioContext,ctx=null,muted=false,mt=null,mode=null,step=0;
  try{muted=localStorage.getItem("mute")==="1"}catch(e){}
  function hz(n){return 440*Math.pow(2,(n-69)/12)}
  function unlock(){try{if(!AC)return;if(!ctx)ctx=new AC();if(ctx.state==="suspended")ctx.resume()}catch(e){}}
  function tone(n,t,d,type,v){
    if(!ctx||muted||ctx.state!=="running")return;
    var o=ctx.createOscillator(),g=ctx.createGain(),t0=ctx.currentTime+(t||0);
    o.type=type||"sine";o.frequency.value=hz(n);
    g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(v||.12,t0+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+d);
    o.connect(g);g.connect(ctx.destination);o.start(t0);o.stop(t0+d+.05)}
  var LOBBY=[60,64,67,72,67,64,62,65,69,74,69,65],
      Q=[48,55,48,55,50,57,50,57,52,59,52,55];
  function play(){
    if(muted||!mode)return;
    if(mode==="lobby"){tone(LOBBY[step%LOBBY.length],0,.35,"triangle",.07);if(step%12===0)tone(48,0,1.4,"sine",.05)}
    else{tone(Q[step%Q.length],0,.18,"square",.035);if(step%4===0)tone(36,0,.2,"sine",.08)}
    step++}
  function stop(){if(mt){clearInterval(mt);mt=null}}
  function music(m){stop();mode=m;step=0;if(!m)return;mt=setInterval(play,m==="lobby"?320:230)}
  function fx(k){
    if(k==="tap")tone(76,0,.08,"triangle",.12);
    else if(k==="tick")tone(88,0,.07,"square",.06);
    else if(k==="start"){tone(67,0,.12,"triangle");tone(72,.1,.12,"triangle");tone(79,.2,.2,"triangle")}
    else if(k==="correct"){[72,76,79,84].forEach(function(n,i){tone(n,i*.09,.22,"triangle",.14)})}
    else if(k==="wrong"){tone(52,0,.25,"sawtooth",.09);tone(46,.2,.35,"sawtooth",.09)}
    else if(k==="reveal"){tone(79,0,.25,"sine",.14);tone(84,.12,.5,"sine",.14)}
    else if(k==="win"){[72,72,72,76,79,76,79,84].forEach(function(n,i){tone(n,i*.14,.3,"triangle",.14)});tone(60,1.0,1.2,"sine",.1)}}
  function setMute(v){muted=v;try{localStorage.setItem("mute",v?"1":"0")}catch(e){}
    var b=document.getElementById("snd-btn");if(b)b.textContent=v?"🔇":"🔊";if(v)stop();else if(mode)music(mode)}
  function btn(){
    if(document.getElementById("snd-btn"))return;
    var b=document.createElement("button");b.id="snd-btn";b.textContent=muted?"🔇":"🔊";b.title="आवाज़ चालू/बंद";
    b.style.cssText="position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:99;width:48px;height:48px;border-radius:50%;padding:0;font-size:1.3rem;background:var(--card);border:1px solid var(--bd);cursor:pointer";
    b.onclick=function(){unlock();setMute(!muted)};document.body.appendChild(b)}
  document.addEventListener("pointerdown",unlock,{passive:true});
  document.addEventListener("keydown",unlock);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",btn);else btn();
  return{unlock:unlock,music:music,stop:function(){stop();mode=null},fx:fx,
    tick:function(){fx("tick")},start:function(){fx("start")},reveal:function(){fx("reveal")},win:function(){fx("win")}}
})();

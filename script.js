(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const symbols = ["ベル","リプレイ","スイカ","BAR","チェリー","赤7"];
  const reels = [0,1,2].map(i => $("reel"+i));
  const stopButtons = [$("leftStop"),$("centerStop"),$("rightStop")];
  const state = {
    phase:"bet", mode:"normal", total:0, sinceBonus:0, bb:0, rb:0, artSets:0,
    coins:0, peak:0, bet:0, payout:0, spinning:false, stopped:0,
    outcome:null, targets:[], spinTimers:[], graph:[0], nav:0, infiniteAvoid:false,
    artG:0, zoneG:0, pendingBonus:null, bonusPayout:0, bonusType:null,
    bonusArt:false, bonusFromArt:false, lastResult:""
  };
  const symbolClass = s => s === "赤7" ? "red" : s === "BAR" ? "bar" : s === "スイカ" ? "watermelon" : s === "チェリー" ? "cherry" : s === "リプレイ" ? "replay" : "";
  function renderReel(i, center, randomize=false) {
    const list = reels[i].querySelectorAll(".reel-symbol");
    const before = randomize ? symbols[Math.floor(Math.random()*symbols.length)] : (symbols[(symbols.indexOf(center)+symbols.length-1)%symbols.length] || "ベル");
    const after = randomize ? symbols[Math.floor(Math.random()*symbols.length)] : symbols[(symbols.indexOf(center)+1)%symbols.length];
    [before,center,after].forEach((s,j)=>{list[j].textContent=s;list[j].dataset.symbol=s;list[j].className="reel-symbol";});
  }
  function say(main, sub="", level="") {
    $("dialogue").textContent=main; $("dialogue").className="dialogue"+(level?" "+level:"");
    $("subDialogue").textContent=sub;
  }
  function setPhase(phase) {
    state.phase=phase;
    $("betButton").disabled=phase!=="bet";
    $("leverButton").disabled=phase!=="lever";
    stopButtons.forEach((b,i)=>b.disabled=phase!=="spin"||state.targets[i]===null);
    $("panelTap").disabled=false;
    $("panelAction").textContent=({bet:"MAX BET",lever:"レバー",spin:"停止",result:"MAX BET",bonus:"ボーナス中"})[phase]||"操作";
    if(phase==="spin") {
      const first=state.targets.findIndex((v,i)=>v!==null);
      $("panelAction").textContent=first===0?"左停止":first===1?"中停止":"右停止";
    }
    updateStats();
  }
  function updateStats() {
    $("totalGames").textContent=state.total.toLocaleString();
    $("gamesSinceBonus").textContent=state.sinceBonus+" G";
    $("bbCount").textContent=state.bb;
    $("rbCount").textContent=state.rb;
    $("artCount").textContent=state.artSets;
    $("netCoins").textContent=(state.coins>0?"+":"")+state.coins+" 枚";
    $("netCoins").style.color=state.coins<0?"#ff7777":"#f0c66c";
    $("peakCoins").textContent="MAX "+(state.peak>0?"+":"")+state.peak;
    $("payout").textContent=state.payout;
    $("betDisplay").textContent=state.bet;
    const modeNames={normal:"通常時",art:"準備ノ間",zone:"決戦ノ刻",ending:"終幕ノ物語",ultimate:"究極ノ力",last:"最後ノタタカイ",bonus:"ボーナス中"};
    $("stateBadge").textContent=modeNames[state.mode]||"通常時";
    $("modeLabel").textContent=modeNames[state.mode]||"通常区間";
    drawGraph();
  }
  function drawGraph() {
    const canvas=$("graph"), rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    if(!rect.width)return;
    canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(83*dpr);
    const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);
    const w=rect.width,h=83,pad=7;
    ctx.clearRect(0,0,w,h);ctx.strokeStyle="#263848";ctx.lineWidth=1;
    for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,i*h/4);ctx.lineTo(w,i*h/4);ctx.stroke();}
    const data=state.graph.slice(-120),min=Math.min(-60,...data),max=Math.max(60,...data),range=max-min||1;
    ctx.strokeStyle="#71e5ed";ctx.lineWidth=2;ctx.beginPath();
    data.forEach((v,i)=>{const x=pad+(w-pad*2)*(i/Math.max(1,data.length-1)),y=h-pad-(v-min)/range*(h-pad*2);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
    ctx.stroke();
    const zeroY=h-pad-(0-min)/range*(h-pad*2);ctx.strokeStyle="#708194";ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(0,zeroY);ctx.lineTo(w,zeroY);ctx.stroke();ctx.setLineDash([]);
  }
  function chooseOutcome() {
    if(state.pendingBonus)return {role:"miss",bonus:null};
    const r=Math.random();
    if(r<1/240)return {role:"big",bonus:"BIG"};
    if(r<1/240+1/160)return {role:"reg",bonus:"REG"};
    const artMode=["art","ending","ultimate"].includes(state.mode);
    const zoneMode=state.mode==="zone"||state.mode==="last";
    if(zoneMode) {
      if(r<.12)return {role:"artReplay"};
      if(r<.12+1/4.1)return {role:"fall"};
      if(r<.12+1/4.1+1/14.7)return {role:"commonBell"};
      if(r<.12+1/4.1+1/14.7+1/48.8)return {role:"watermelon"};
      if(r<.12+1/4.1+1/14.7+1/48.8+1/62.3)return {role:"cherry"};
      return {role:"miss"};
    }
    if(artMode) {
      if(r<.204)return {role:"bell"};
      if(r<.408)return {role:"replay"};
      if(r<.408+1/14.7)return {role:"commonBell"};
      if(r<.408+1/14.7+1/48.8)return {role:"watermelon"};
      if(r<.408+1/14.7+1/48.8+1/62.3)return {role:"cherry"};
      return {role:"miss"};
    }
    if(r<.078)return {role:"replay"};
    if(r<.078+1/14.7)return {role:"commonBell"};
    if(r<.078+1/14.7+1/48.8)return {role:"watermelon"};
    if(r<.078+1/14.7+1/48.8+1/62.3)return {role:"cherry"};
    return {role:"miss"};
  }
  function targetsFor(outcome) {
    const role=outcome.role;
    if(role==="big")return ["赤7","赤7","赤7"];
    if(role==="reg")return ["BAR","BAR","BAR"];
    if(role==="watermelon")return ["スイカ","ベル","スイカ"];
    if(role==="cherry")return ["チェリー","ベル","リプレイ"];
    if(role==="replay"||role==="artReplay")return ["リプレイ","リプレイ","リプレイ"];
    if(role==="bell"||role==="commonBell")return ["ベル","ベル","ベル"];
    if(role==="fall")return ["リプレイ","ベル","リプレイ"];
    return ["ベル","リプレイ","ベル"];
  }
  function startSpin() {
    if(state.phase!=="lever")return;
    state.spinning=true;state.stopped=0;state.outcome=chooseOutcome();state.targets=targetsFor(state.outcome);
    state.targets=[...state.targets];
    state.payout=0;state.bet=3;state.coins-=3;state.total++;state.sinceBonus++;
    if(state.mode==="art"||state.mode==="ending"||state.mode==="ultimate")state.artG++;
    if(state.mode==="zone"||state.mode==="last")state.zoneG++;
    $("演出種別").textContent="遊技演出";$("expectation").textContent="期待度 --";
    const o=state.outcome;
    if(o.bonus){say("大塚「……何か来る！」","記録に異常反応。停止して確認しよう。","hot");$("expectation").textContent="期待度 高";}
    else if(o.role==="cherry"||o.role==="watermelon"){say("大塚「これは……？」","住吉「小役の反応を確認します」","chance");$("expectation").textContent="小役示唆";}
    else say("大塚「何だ？」","住吉「リールを停止してください」");
    reels.forEach((reel,i)=>{
      state.spinTimers[i]=window.setInterval(()=>renderReel(i,symbols[Math.floor(Math.random()*symbols.length)],true),70+i*12);
    });
    state.targets.forEach((_,i)=>stopButtons[i].disabled=false);
    setPhase("spin");
    stopButtons.forEach((b,i)=>b.disabled=false);
    $("betButton").disabled=true;$("leverButton").disabled=true;
    $("panelAction").textContent="左停止";
  }
  function stopReel(i) {
    if(state.phase!=="spin"||state.targets[i]===null)return;
    clearInterval(state.spinTimers[i]);
    renderReel(i,state.targets[i]);
    state.targets[i]=null;state.stopped++;
    stopButtons[i].disabled=true;
    const remaining=state.targets.findIndex(v=>v!==null);
    if(state.stopped===1 && state.outcome.bonus) say("住吉「分析します」","大塚「……続けろ」","hot");
    if(state.stopped===2 && state.outcome.bonus) say("住吉「これは……！」","大塚「結果を見よう」","hot");
    if(state.stopped===3) finishGame();
    else $("panelAction").textContent=remaining===0?"停止":(["左停止","中停止","右停止"][remaining]);
  }
  function finishGame() {
    state.spinning=false;
    const o=state.outcome;
    let gain=0;
    if(o.role==="big"||o.role==="reg") {
      state.pendingBonus=o.bonus;state.bonusType=o.bonus;state.bonusPayout=0;state.bonusFromArt=["art","ending","ultimate"].includes(state.mode);
      if(o.bonus==="BIG"){state.bb++;say("住吉「BIGボーナス確定！」","赤7を確認。ボーナスを開始します。","confirm");}
      else {state.rb++;say("住吉「REGボーナス確定！」","BARを確認。ボーナスを開始します。","confirm");}
      state.sinceBonus=0;
      if(!state.bonusFromArt && o.bonus==="BIG")state.bonusArt=true;
      else if(!state.bonusFromArt && o.bonus==="REG")state.bonusArt=Math.random()<.25;
    } else if(o.role==="replay"||o.role==="artReplay") {
      gain=3;
      if(["art","ending","ultimate"].includes(state.mode) && Math.random()<(state.mode==="ultimate"?1/3:1/6))state.nav++;
      if(o.role==="artReplay"){state.mode="art";state.artG++;state.artG=0;say("住吉「ART突入リプレイです！」","準備ノ間へ移行します。","confirm");}
      else say("住吉「リプレイです」","投入分を再遊技します。");
    } else if(o.role==="bell"||o.role==="commonBell") {
      gain=o.role==="bell"?8:3;say("住吉「ベルです」",gain+"枚の払い出しを確認。");
    } else if(o.role==="watermelon") {
      gain=12;if(["art","ultimate"].includes(state.mode))state.nav+=Math.random()<.5?1:2;
      say("住吉「スイカです！」","12枚の払い出し。","chance");
    } else if(o.role==="cherry") {
      gain=4;if(["art","ultimate"].includes(state.mode))state.nav+=2;
      say("住吉「チェリーです！」","4枚の払い出し。","chance");
    } else if(o.role==="fall") {
      if(state.infiniteAvoid||state.nav>0){if(!state.infiniteAvoid)state.nav--;say("住吉「回避成功です」","転落リプレイを回避しました。","chance");}
      else if(Math.random()<.5){say("住吉「回避成功です」","2択に正解。ART継続。","chance");}
      else {state.mode=state.mode==="last"?"normal":"normal";state.artG=0;state.zoneG=0;say("大塚「……ここまでか」","回避失敗。通常時へ戻ります。");}
    } else {
      say("大塚「……何もないか」","次のゲームに備えよう。");
    }
    if(gain){state.coins+=gain;state.payout=gain;}
    state.peak=Math.max(state.peak,state.coins);
    state.graph.push(state.coins);
    if(state.mode==="art" && state.artG>=30 && !state.pendingBonus){state.mode="zone";state.zoneG=0;state.artG=0;say("住吉「準備ノ間、終了です」","決戦ノ刻へ移行します。","hot");}
    if(state.mode==="ending" && state.coins>=2400){state.mode="ultimate";state.coins=0;state.nav=0;state.infiniteAvoid=false;state.artG=0;say("住吉「終幕ノ物語、完了です」","差枚数区間をリセット。究極ノ力へ。","confirm");}
    if(state.mode!=="ending" && state.coins>=2200){state.mode="ending";state.artG=0;say("住吉「終幕ノ物語へ移行します」","差枚数+2200枚到達。","confirm");}
    if(state.mode==="zone"&&state.zoneG>0&&state.zoneG%30===0){say("大塚「決戦は続く」","転落リプレイに注意。","hot");}
    updateStats();
    setPhase("result");
  }
  function startBonus() {
    if(!state.pendingBonus)return;
    state.mode="bonus";state.bet=2;state.bonusPayout=0;
    $("演出種別").textContent="BONUS";
    say(state.pendingBonus==="BIG"?"BIGボーナス":"レギュラーボーナス","ボーナス中。パネルをタップして進行。","confirm");
    setPhase("bonus");
  }
  function playBonusGame() {
    if(!state.pendingBonus)return;
    const isReplay=Math.random()<1/12.8;
    const gain=isReplay?2:11;
    state.bonusPayout+=gain;state.coins+=gain-2;state.payout=gain;
    const target=state.pendingBonus==="BIG"?242:66;
    if(state.bonusPayout>=target){
      const wasArt=state.bonusFromArt, type=state.pendingBonus, artWin=state.bonusArt;
      state.pendingBonus=null;state.bonusType=null;state.bonusPayout=0;
      if(wasArt){state.infiniteAvoid=true;state.mode="zone";state.zoneG=0;say("住吉「ボーナス終了。無限回避状態です」","転落リプレイを回避しながらART復帰を待ちます。","confirm");}
      else if(artWin){state.mode="art";state.artG=0;state.artSets++;state.infiniteAvoid=false;say("住吉「ART当選です！」","準備ノ間、30G開始。","confirm");}
      else {state.mode="normal";say("大塚「……記録を続けるぞ」","ボーナス終了。通常時へ。");}
      state.bonusFromArt=false;state.bonusArt=false;
      state.peak=Math.max(state.peak,state.coins);state.graph.push(state.coins);
      updateStats();setPhase("result");
    } else {
      say("住吉「ボーナス消化中です」",state.bonusPayout+" / "+target+" 枚","confirm");
      state.peak=Math.max(state.peak,state.coins);state.graph.push(state.coins);updateStats();setPhase("bonus");
    }
  }
  function bet() {
    if(state.phase!=="bet"&&state.phase!=="result")return;
    if(state.pendingBonus){startBonus();return;}
    state.bet=3;state.payout=0;setPhase("lever");
    say("住吉「準備完了です」","レバーを操作してください。");
  }
  function tapPanel() {
    if(state.phase==="bet"||state.phase==="result"){bet();return;}
    if(state.phase==="lever"){startSpin();return;}
    if(state.phase==="spin"){const i=state.targets.findIndex(v=>v!==null);if(i>=0)stopReel(i);return;}
    if(state.phase==="bonus"){playBonusGame();return;}
  }
  $("betButton").addEventListener("click",bet);
  $("leverButton").addEventListener("click",startSpin);
  $("panelTap").addEventListener("click",tapPanel);
  stopButtons.forEach((b,i)=>b.addEventListener("click",()=>stopReel(i)));
  $("resetButton").addEventListener("click",()=>{
    if(state.spinning)state.spinTimers.forEach(clearInterval);
    Object.assign(state,{phase:"bet",mode:"normal",total:0,sinceBonus:0,bb:0,rb:0,artSets:0,coins:0,peak:0,bet:0,payout:0,spinning:false,stopped:0,outcome:null,targets:[],spinTimers:[],graph:[0],nav:0,infiniteAvoid:false,artG:0,zoneG:0,pendingBonus:null,bonusPayout:0,bonusType:null,bonusArt:false,bonusFromArt:false});
    reels.forEach((_,i)=>renderReel(i,["ベル","リプレイ","BAR"][i]));
    $("演出種別").textContent="通常演出";$("expectation").textContent="期待度 --";say("大塚「……記録を始めるか」","MAX BETで遊技開始");
    setPhase("bet");updateStats();
  });
  window.addEventListener("resize",drawGraph);
  reels.forEach((_,i)=>renderReel(i,["ベル","リプレイ","BAR"][i]));
  setPhase("bet");updateStats();
})();
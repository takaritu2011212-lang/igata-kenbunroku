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
    bonusArt:false, bonusFromArt:false, bonusAnnounced:false, presentation:null, normalScene:null, lastResult:"", forcedRole:null
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
    // Keep drawing small roles while an ART bonus is queued, but never draw another bonus.
    const bonusAlreadyPending=!!state.pendingBonus;
    const artMode=["art","ending","ultimate"].includes(state.mode);
    const zoneMode=state.mode==="zone"||state.mode==="last";
    let role=null;

    // Debug mode forces ONLY the small role. It never forces BIG/REG.
    if(state.forcedRole) {
      role=state.forcedRole;
      state.forcedRole=null;
      $("debugRole").value="";
      $("debugStatus").textContent="強制小役を適用："+({miss:"ハズレ",replay:"リプレイ",bell:"押し順ベル",commonBell:"共通ベル",watermelon:"スイカ",cherry:"チェリー",artReplay:"ART突入リプレイ",fall:"転落リプレイ"}[role]||role);
    } else {
      const r=Math.random();
      if(zoneMode) {
        if(r<1/12.4)role="artReplay";
        else if(r<1/12.4+1/4.1)role="fall";
        else if(r<1/12.4+1/4.1+1/14.7)role="commonBell";
        else if(r<1/12.4+1/4.1+1/14.7+1/48.8)role="watermelon";
        else if(r<1/12.4+1/4.1+1/14.7+1/48.8+1/62.3)role="cherry";
        else role="miss";
      } else if(artMode) {
        if(r<1/4.0)role="bell";
        else if(r<1/4.0+1/4.9)role="replay";
        else if(r<1/4.0+1/4.9+1/14.7)role="commonBell";
        else if(r<1/4.0+1/4.9+1/14.7+1/48.8)role="watermelon";
        else if(r<1/4.0+1/4.9+1/14.7+1/48.8+1/62.3)role="cherry";
        else role="miss";
      } else {
        if(r<1/12.8)role="replay";
        else if(r<1/12.8+1/14.7)role="commonBell";
        else if(r<1/12.8+1/14.7+1/48.8)role="watermelon";
        else if(r<1/12.8+1/14.7+1/48.8+1/62.3)role="cherry";
        else role="miss";
      }
    }

    // Bonus lottery is conditional on the established role-specific rates.
    // Replay roles never trigger bonus lottery. BIG and REG are mutually exclusive.
    const replayRole=role==="replay"||role==="artReplay"||role==="fall";
    let bonus=null;
    if(!replayRole && !bonusAlreadyPending) {
      const rates = {
        commonBell: { big: 1/97.95, reg: 1/65.30 },
        watermelon: { big: 1/29.50, reg: 1/19.67 },
        cherry: { big: 1/23.11, reg: 1/15.40 },
        miss: { big: 1/392.30, reg: 1/261.53 },
        bell: { big: 0, reg: 0 }
      };
      const rate=rates[role]||{big:0,reg:0};
      const b=Math.random();
      if(b<rate.big)bonus="BIG";
      else if(b<rate.big+rate.reg)bonus="REG";
    }
    if(bonus)return {role,bonus};
    return {role};
  }
  function targetsFor(outcome) {
    const role=outcome.role;
    if(role==="big" || (role==="miss" && outcome.bonus==="BIG"))return ["赤7","赤7","赤7"];
    if(role==="reg" || (role==="miss" && outcome.bonus==="REG"))return ["BAR","BAR","BAR"];
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
    const tease=Math.random();
    if(state.mode==="normal" && !state.presentation && !o.bonus) {
      if(!state.normalScene && tease<.12) state.normalScene={stage:"investigation",age:0,kind:Math.random()<.5?"mission":"battle",chance:Math.random()<.20?"red":Math.random()<.55?"blue":"none"};
      if(state.normalScene) {
        say("住吉「さきほどの記録に、気になる点があります」","調査の予兆。まだ発展するとは限らない。",state.normalScene.chance==="red"?"hot":state.normalScene.chance==="blue"?"chance":"");
        $("演出種別").textContent="調査煽り";
        $("expectation").textContent=state.normalScene.chance==="red"?"期待度 高":state.normalScene.chance==="blue"?"期待度 中":"期待度 ?";
      } else {
        const daily=[
          ["郡山「この事務所、資料の山で床が見えないんだが」","大塚「床が見えるとでも思っていたのか」"],
          ["住吉「本日の調査予定を確認します」","大塚「その前に郡山が昨日の報告書を出していない」"],
          ["郡山「腹減った。調査の前に飯にしないか？」","大塚「調査の後だ。……たぶん」"],
          ["住吉「新しい依頼が届いています」","大塚「まずは内容を確認しよう」"],
          ["郡山「平和だな。今日は何も起きないといいが」","大塚「そういうことを言うな」"],
          ["住吉「備品の補充をしておきました」","郡山「お菓子も？」 住吉「備品ではありません」"],
          ["大塚「この資料、誰がここに置いた？」","郡山「知らん。資料が勝手に増える事務所だし」"],
          ["住吉「天気は安定しています」","大塚「事件まで安定していると助かるんだがな」"]
        ];
        const line=daily[Math.floor(Math.random()*daily.length)];
        say(line[0],line[1]);
        $("演出種別").textContent="日常演出";
        $("expectation").textContent="期待度 --";
      }
    } else if(o.bonus){say("大塚「……今の反応、妙だな」","住吉「まだ断定できません。記録を続けます」","hot");$("expectation").textContent="期待度 高";}
    else if(o.role==="cherry"||o.role==="watermelon"){say("大塚「これは……？」","住吉「レア役を確認。何か起きるかもしれません」","chance");$("expectation").textContent="小役示唆";}
    else if(o.role==="bell"&&tease<.13){say("住吉「反応が一瞬だけ……？」","大塚「見間違いでなければいいが」","chance");$("expectation").textContent="期待度 ?";
    } else if(o.role==="miss"&&tease<.055){say("大塚「……気配がした」","住吉「記録上はハズレですが、反応が残っています」","chance");$("expectation").textContent="期待度 ?";}
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
    const presentationAtStart=state.presentation;
    const o=state.outcome;
    const modeAtStart=state.mode;
    const wasArtMode=["art","ending","ultimate"].includes(modeAtStart);
    let gain=0;

    // Register a bonus exactly once. In ART it is queued until the 30G set ends.
    if(o.bonus && !state.pendingBonus) {
      state.pendingBonus=o.bonus;
      state.bonusAnnounced=false;
      state.presentation={bonus:o.bonus,age:0,stage:"tease",development:0,kind:Math.random()<.55?"battle":"mission",chance:Math.random()<.22?"red":Math.random()<.60?"blue":"none"};
      state.normalScene=null;
      state.bonusType=o.bonus;
      state.bonusPayout=0;
      state.bonusFromArt=wasArtMode;
      if(o.bonus==="BIG") {
        state.bb++;
        say("住吉「内部データに異常値……」","大塚「まだ結論を出すな。記録を続けろ」","hot");
      } else {
        state.rb++;
        say("住吉「反応を検出しました」","大塚「……正体が分かるまで待つぞ」","hot");
      }
      state.sinceBonus=0;
      if(!wasArtMode && o.bonus==="BIG")state.bonusArt=true;
      else if(!wasArtMode && o.bonus==="REG")state.bonusArt=Math.random()<.25;
    }

    // Process the small role independently, including its payout when it overlaps a bonus.
    if(o.role==="replay"||o.role==="artReplay") {
      gain=3;
      if(["art","ending","ultimate"].includes(modeAtStart) && Math.random()<(modeAtStart==="ultimate"?1/3:1/6))state.nav++;
      if(o.role==="artReplay") {
        state.mode="art";state.artG=0;state.artSets++;state.infiniteAvoid=false;state.zoneG=0;
        say("住吉「ART突入リプレイです！」","準備ノ間へ移行します。","confirm");
      } else if(!o.bonus) say("住吉「リプレイです」","投入分を再遊技します。");
    } else if(o.role==="bell"||o.role==="commonBell") {
      gain=o.role==="bell"?8:3;
      if(!o.bonus)say("住吉「ベルです」",gain+"枚の払い出しを確認。");
    } else if(o.role==="watermelon") {
      gain=12;
      if(["art","ending","ultimate"].includes(modeAtStart))state.nav+=Math.random()<.5?1:2;
      if(!o.bonus)say("住吉「スイカです！」","12枚の払い出し。","chance");
    } else if(o.role==="cherry") {
      gain=4;
      if(["art","ending","ultimate"].includes(modeAtStart))state.nav+=2;
      if(!o.bonus)say("住吉「チェリーです！」","4枚の払い出し。","chance");
    } else if(o.role==="fall") {
      if(state.infiniteAvoid||state.nav>0) {
        if(!state.infiniteAvoid)state.nav--;
        say("住吉「回避成功です」","転落リプレイを回避しました。","chance");
      } else if(Math.random()<.5) {
        say("住吉「回避成功です」","2択に正解。ART継続。","chance");
      } else {
        state.mode="normal";state.artG=0;state.zoneG=0;state.infiniteAvoid=false;
        say("大塚「……ここまでか」","回避失敗。通常時へ戻ります。");
      }
    } else if(!o.bonus) {
      say("大塚「……何もないか」","次のゲームに備えよう。");
    }

    if(gain){state.coins+=gain;state.payout=gain;}
    state.peak=Math.max(state.peak,state.coins);
    state.graph.push(state.coins);

    // 演出進行：当選ゲームから数ゲーム後に発展し、3Gの発展演出後に告知。
    // 内部当選フラグは保持するが、告知まではボーナスを開始しない。
    if(presentationAtStart && state.presentation) {
      const p=state.presentation;
      if(p.stage==="tease") {
        p.age++;
        if(p.age>=6) {
          p.stage="development";p.development=0;
          $("演出種別").textContent="発展演出";
          $("expectation").textContent="期待度 上昇";
          const battle=p.kind==="battle";
          say(battle?"郡山「反応の中心はあそこだ！　行くぞ！」":"住吉「異常の原因を特定しました。証拠を確保します」",
            battle?"怪異との対決へ発展！":"ミッション発展！",p.chance==="red"||battle?"hot":"chance");
          $("演出種別").textContent=battle?"対決発展":"ミッション発展";
          $("expectation").textContent=battle?"期待度 高":"期待度 中";
        } else if(!o.bonus) {
          const lines=[
            ["大塚「気のせい……か？」","住吉「反応は微弱ですが、消えていません」"],
            ["住吉「記録にノイズがあります」","大塚「そのまま追跡しろ」"],
            ["大塚「妙に静かだな」","住吉「静かな時ほど、油断は禁物です」"],
            ["住吉「さきほどの反応と似ています」","大塚「偶然か、それとも……」"]
          ];
          const line=lines[Math.floor(Math.random()*lines.length)];
          say(line[0],line[1],p.age>=4?"hot":"chance");
          $("演出種別").textContent=p.age>=4?"前兆演出":"通常演出";
          $("expectation").textContent=p.age>=4?"期待度 上昇":"期待度 ?";
        }
      } else if(p.stage==="development") {
        p.development++;
        const battle=p.kind==="battle";
        const devLines=battle?[
          ["郡山「正面から来るぞ！」","対決 1G目"],
          ["大塚「動きを読んだ。ここで決める」","対決 2G目"],
          ["大塚「これで終わりだ！」","対決 最終G"]
        ]:[
          ["住吉「現場の痕跡を照合します」","ミッション 1G目"],
          ["住吉「証拠を確保。あと一歩です」","ミッション 2G目"],
          ["大塚「よし、結果を確認する」","ミッション 最終G"]
        ];
        const line=devLines[Math.min(p.development-1,2)];
        $("演出種別").textContent=battle?"対決演出":"ミッション演出";
        $("expectation").textContent=battle?"期待度 高":p.development>=2?"期待度 高":"期待度 上昇";
        say(line[0],line[1],battle||p.development>=2?"hot":"chance");
        if(p.development>=3) {
          p.stage="announced";state.bonusAnnounced=true;
          $("演出種別").textContent="BONUS確定";
          $("expectation").textContent="当選確定";
          say(p.bonus==="BIG"?"住吉「BIGボーナス確定！」":"住吉「レギュラーボーナス確定！」",
            p.bonus==="BIG"?"大塚「よし、次に進むぞ」":"大塚「REGか。ここからが本番だ」","confirm");
        }
      }
    } else if(!state.presentation && !o.bonus) {
      // 通常時専用：日常→調査→発展。調査止まりや発展失敗もある。
      if(modeAtStart==="normal" && state.normalScene) {
        const s=state.normalScene;
        s.age++;
        if(s.stage==="investigation") {
          if(s.age===1) {
            say("大塚「現場の記録を洗い直すぞ」","怪異調査演出。ここで終了する場合もある。",s.chance==="red"?"hot":s.chance==="blue"?"chance":"");
            $("演出種別").textContent="怪異調査";
            $("expectation").textContent=s.chance==="red"?"期待度 高":s.chance==="blue"?"期待度 中":"期待度 ?";
          } else if(s.age>=2) {
            const develop=Math.random()<(s.kind==="battle" ? 0.58 : 0.42);
            if(develop) {
              s.stage="development";s.age=0;
              const battle=s.kind==="battle";
              say(battle?"郡山「来るぞ！　正面から押さえる！」":"住吉「証拠の確保を開始します」",
                battle?"対決発展！ 強演出。":"ミッション発展。",s.chance==="red"||battle?"hot":"chance");
              $("演出種別").textContent=battle?"対決発展":"ミッション発展";
              $("expectation").textContent=battle?"期待度 高":"期待度 中";
            } else {
              say("住吉「調査結果、異常なしです」","発展せず。日常へ戻ります。");
              $("演出種別").textContent="調査終了";
              $("expectation").textContent="期待度 --";
              state.normalScene=null;
            }
          }
        } else if(s.stage==="development") {
          s.age++;
          const battle=s.kind==="battle";
          if(s.age===1) {
            say(battle?"大塚「相手の動きを見極めろ！」":"住吉「証拠を確保できれば解決です」",
              battle?"対決中。":"ミッション進行中。",s.chance==="red"||battle?"hot":"chance");
            $("演出種別").textContent=battle?"対決演出":"ミッション演出";
            $("expectation").textContent=battle?"期待度 高":"期待度 中";
          } else {
            const success=Math.random()<(battle ? 0.38 : 0.20);
            if(success) {
              say(battle?"大塚「制圧した……！」":"住吉「証拠の確保に成功しました」","演出成功。ボーナス告知とは別判定です。","confirm");
              $("演出種別").textContent=battle?"対決成功":"ミッション成功";
              $("expectation").textContent="期待度 高";
            } else {
              say(battle?"大塚「逃げられたか……！」":"住吉「証拠が足りません」","発展失敗。通常演出へ戻ります。");
              $("演出種別").textContent="発展失敗";
              $("expectation").textContent="期待度 --";
            }
            state.normalScene=null;
          }
        }
      } else if(modeAtStart==="normal" && (o.role==="cherry"||o.role==="watermelon")) {
        const red=o.role==="cherry"&&Math.random()<.18;
        say(red?"住吉「赤い反応です！　これは見逃せません」":"住吉「レア役を確認しました」",
          red?"赤文字！ 大チャンス！":"青文字でチャンス。",red?"hot":"chance");
        $("演出種別").textContent=red?"赤文字チャンス":"青文字チャンス";
        $("expectation").textContent=red?"期待度 高":"期待度 中";
      }
    }

    // ART, including special ART modes, runs its full 30G even with a queued bonus.
    if(["art","ending","ultimate"].includes(state.mode) && state.artG>=30) {
      if(state.pendingBonus) {
        // Keep the current ART state; the next MAX BET starts the queued bonus.
      } else {
        state.mode="zone";state.zoneG=0;state.artG=0;
        say("住吉「ART 30G終了です」","継続ゾーン、決戦ノ刻へ移行します。","hot");
      }
    }

    if(state.mode==="ending" && state.coins>=2400) {
      state.mode="ultimate";state.coins=0;state.nav=0;state.infiniteAvoid=false;state.artG=0;
      say("住吉「終幕ノ物語、完了です」","差枚数区間をリセット。究極ノ力へ。","confirm");
    } else if(state.mode!=="ending" && state.coins>=2200) {
      state.mode="ending";state.artG=0;
      say("住吉「終幕ノ物語へ移行します」","差枚数+2200枚到達。","confirm");
    }
    if((state.mode==="zone"||state.mode==="last")&&state.zoneG>0&&state.zoneG%30===0) {
      say("大塚「決戦は続く」","転落リプレイに注意。","hot");
    }
    updateStats();
    setPhase("result");
  }
  function startBonus() {
    if(!state.pendingBonus || !state.bonusAnnounced)return;
    state.mode="bonus";state.bet=2;state.bonusPayout=0;
    $("演出種別").textContent="BONUS";
    say(state.pendingBonus==="BIG"?"BIGボーナス":"レギュラーボーナス","ボーナス中。パネルをタップして進行。","confirm");
    setPhase("bonus");
  }
  function playBonusGame() {
    if(!state.pendingBonus)return;
    const isReplay=Math.random()<1/12.8;
    const gain=isReplay?2:11;
    state.bonusPayout+=gain;
    state.coins+=gain-2;
    state.payout=gain;
    const target=state.pendingBonus==="BIG"?242:66;

    if(state.bonusPayout>=target) {
      const wasArt=state.bonusFromArt;
      const type=state.pendingBonus;
      const normalArtWin=type==="BIG" ? true : Math.random()<.25;
      state.pendingBonus=null;state.bonusType=null;state.bonusPayout=0;state.bonusAnnounced=false;state.presentation=null;

      if(wasArt) {
        // ART bonuses are consumed after the 30G set. BIG guarantees ART;
        // REG uses the ART lottery. The next zone receives the infinite-avoid flag.
        state.infiniteAvoid=true;
        if(normalArtWin) {
          state.mode="art";state.artG=0;state.artSets++;
          say("住吉「ART中ボーナス終了」","ART継続確定。次の継続ゾーンに無限回避を設定。","confirm");
        } else {
          state.mode="zone";state.zoneG=0;state.artG=0;
          say("住吉「ART中REG終了」","ART非当選。無限回避状態で継続ゾーンへ。","confirm");
        }
      } else if(normalArtWin) {
        state.mode="art";state.artG=0;state.artSets++;state.infiniteAvoid=false;
        say("住吉「ART当選です！」","準備ノ間、30G開始。","confirm");
      } else {
        state.mode="normal";state.artG=0;state.zoneG=0;state.infiniteAvoid=false;
        say("大塚「……記録を続けるぞ」","REG終了。ART非当選、通常時へ。");
      }
      state.bonusFromArt=false;state.bonusArt=false;
      state.peak=Math.max(state.peak,state.coins);state.graph.push(state.coins);
      updateStats();setPhase("result");
    } else {
      say("住吉「ボーナス消化中です」",state.bonusPayout+" / "+target+" 枚","confirm");
      state.peak=Math.max(state.peak,state.coins);state.graph.push(state.coins);
      updateStats();setPhase("bonus");
    }
  }
  function bet() {
    if(state.phase!=="bet"&&state.phase!=="result")return;
    if(state.pendingBonus) {
      if(!state.bonusAnnounced) { state.bet=3;state.payout=0;setPhase("lever");say("大塚「調査を続けるぞ」","反応を追跡中。告知まで遊技を続けます。","chance");return; }
      const waitingForArtEnd=state.bonusFromArt &&
        ["art","ending","ultimate"].includes(state.mode) && state.artG<30;
      if(!waitingForArtEnd){startBonus();return;}
    }
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
  $("applyDebugState").addEventListener("click",()=>{
    if(state.phase==="spin"){ $("debugStatus").textContent="リール回転中は状態変更できません。先に停止してください。"; return; }
    const requested=$("debugMode").value;
    state.mode=requested;
    state.artG=Math.max(0,Math.min(30,Number($("debugArtG").value)||0));
    state.nav=Math.max(0,Number($("debugNav").value)||0);
    state.infiniteAvoid=$("debugInfinite").checked;
    if(requested==="bonus"){
      if(!state.pendingBonus){state.pendingBonus=$("debugBonus").value;state.bonusType=state.pendingBonus;state.bonusPayout=0;state.bonusFromArt=false;state.bonusArt=false;state.bonusAnnounced=true;state.presentation=null;}
      state.mode="bonus";
      startBonus();
    } else {
      state.pendingBonus=null;state.bonusType=null;state.bonusPayout=0;state.bonusAnnounced=false;state.presentation=null;state.bonusFromArt=false;state.bonusArt=false;
      setPhase("bet");
      say("デバッグ「状態を変更しました」", "状態："+$("stateBadge").textContent+" / ART残りG："+state.artG+" / ナビ："+state.nav);
      updateStats();
    }
    $("debugStatus").textContent="適用済み："+$("stateBadge").textContent+"、ART "+state.artG+"G、ナビ "+state.nav+"、無限回避 "+(state.infiniteAvoid?"ON":"OFF");
  });
  $("debugRole").addEventListener("change",()=>{
    const role=$("debugRole").value;
    state.forcedRole=role||null;
    $("debugStatus").textContent=role?"次の通常ゲームに強制適用："+$("debugRole").selectedOptions[0].textContent:"次ゲームの強制小役は未設定";
  });
  $("clearDebugRole").addEventListener("click",()=>{
    state.forcedRole=null;$("debugRole").value="";
    $("debugStatus").textContent="強制小役を解除しました。次ゲームは通常抽選です。";
  });
  $("debugMode").addEventListener("change",()=>{
    if($("debugMode").value==="bonus")$("debugStatus").textContent="ボーナス種別を選び「状態を適用」を押してください。";
  });
  $("resetButton").addEventListener("click",()=>{
    if(state.spinning)state.spinTimers.forEach(clearInterval);
    Object.assign(state,{phase:"bet",mode:"normal",total:0,sinceBonus:0,bb:0,rb:0,artSets:0,coins:0,peak:0,bet:0,payout:0,spinning:false,stopped:0,outcome:null,targets:[],spinTimers:[],graph:[0],nav:0,infiniteAvoid:false,artG:0,zoneG:0,pendingBonus:null,bonusPayout:0,bonusType:null,bonusArt:false,bonusFromArt:false,bonusAnnounced:false,presentation:null,normalScene:null,forcedRole:null});
    reels.forEach((_,i)=>renderReel(i,["ベル","リプレイ","BAR"][i]));
    $("演出種別").textContent="通常演出";$("expectation").textContent="期待度 --";say("大塚「……記録を始めるか」","MAX BETで遊技開始");
    setPhase("bet");updateStats();
  });
  window.addEventListener("resize",drawGraph);
  reels.forEach((_,i)=>renderReel(i,["ベル","リプレイ","BAR"][i]));
  setPhase("bet");updateStats();
})();
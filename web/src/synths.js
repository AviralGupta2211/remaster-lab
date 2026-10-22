// Synths view: six classic synthesizer architectures, 1964 to 1983, each with its own panel,
// sound engine (Web Audio) and presets. Rendered into a shadow root so its styles and the
// app's never touch. Mounted on first open by setView('synths') in app.js.
(function () {
"use strict";
const CSS=`/* Layout: app chrome (picker, scope, keys) stays fixed and dark; the panel between swaps its whole identity per instrument, each an original panel built on that era's real architecture. */
:host{display:block}
.root{
  --bg:#0d1013; --chrome:#151a1f; --line:#2b343d; --ink:#ebe7dd; --muted:#939ca5; --dim:#58626c; --hot:#f09a46; --cool:#5ac6da;
  --wood-a:#6b4529; --wood-b:#3e2615;
  --f-disp:"Chakra Petch","Rajdhani",ui-sans-serif,system-ui,sans-serif;
  --f-label:"Chakra Petch","Rajdhani",ui-sans-serif,system-ui,sans-serif;
  --f-body:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,monospace;
  color-scheme:dark;
}
*{box-sizing:border-box}
.root{background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.45;border-radius:12px;border:1px solid var(--line);padding:18px 18px 22px}
[hidden]{display:none!important}
button,select{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--cool);outline-offset:2px}
.wrap{max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:14px}
.brand{display:flex;flex-direction:column;gap:6px;min-width:0}
.eyebrow{font-family:var(--f-mono);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
h1{font-family:var(--f-disp);font-weight:600;font-size:clamp(20px,3vw,30px);letter-spacing:.06em;margin:0}
.picker{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.selwrap{position:relative}
.selwrap select{appearance:none;-webkit-appearance:none;background:var(--chrome);border:1px solid var(--line);border-radius:10px;padding:10px 40px 10px 14px;font-size:16px;font-weight:600;min-width:260px;max-width:100%;cursor:pointer}
.selwrap::after{content:"";position:absolute;right:16px;top:50%;width:8px;height:8px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:translateY(-70%) rotate(45deg);pointer-events:none}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.power{display:inline-flex;align-items:center;gap:10px;background:var(--chrome);border:1px solid var(--line);border-radius:999px;padding:9px 16px 9px 12px;cursor:pointer;font-weight:600}
.power .led{width:12px;height:12px;border-radius:50%;background:#3a2a20;box-shadow:inset 0 0 0 1px #000}
.power.on .led{background:#ff5a3c;box-shadow:0 0 10px #ff5a3c,inset 0 0 0 1px #000}
.chip{font-family:var(--f-mono);font-size:12px;padding:8px 11px;border-radius:999px;border:1px solid var(--line);color:var(--muted);background:transparent;cursor:pointer}
.chip.ok{color:var(--cool)} .chip.warn{color:#e4d066} .chip.active{background:var(--cool);color:#0b1014;border-color:var(--cool)}

.era{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:center;background:var(--chrome);border:1px solid var(--line);border-radius:12px;padding:12px 16px}
.era .yr{font-family:var(--f-disp);font-weight:700;font-size:32px;letter-spacing:.04em;color:var(--hot);line-height:1}
.era p{margin:0;color:var(--muted);font-size:14px;max-width:62ch}
.era p b{color:var(--ink);font-weight:600}
.scopes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
.scopes canvas{width:100%;height:58px;display:block;background:#090c0f;border-radius:6px;border:1px solid #11161b}
.presets{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.presets .label{font-family:var(--f-mono);font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-right:2px}
.pbtn{background:transparent;border:1px solid var(--line);border-radius:8px;padding:7px 12px;cursor:pointer}
.pbtn:hover{border-color:var(--muted)} .pbtn.cur{border-color:var(--hot);color:var(--hot)}
.hint{color:var(--muted);font-size:14px;margin:0}
kbd{font-family:var(--f-mono);font-size:11.5px;border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:0 5px;color:var(--ink)}

/* ===== instrument panel, themed ===== */
.panel{--p-bg:#1b1713;--p-ink:#efe3c6;--p-sub:#cdb98f;--p-line:#3a322a;--k-cap:#0f0e0d;--k-cap2:#1d1b19;--k-ptr:#efe3c6;--k-arc:#e8a33d;--k-trk:#0b0a09;--seg-on:#e8a33d;
  position:relative;background:var(--p-bg);color:var(--p-ink);border-radius:14px;padding:16px 18px 18px;display:flex;flex-direction:column;gap:14px}
.panel.wood{padding-left:34px;padding-right:34px;background:
  repeating-linear-gradient(92deg,rgba(0,0,0,.2) 0 2px,transparent 2px 7px) left/16px 100% no-repeat,
  repeating-linear-gradient(88deg,rgba(0,0,0,.2) 0 2px,transparent 2px 7px) right/16px 100% no-repeat,
  linear-gradient(180deg,var(--wood-a),var(--wood-b)) left/16px 100% no-repeat,
  linear-gradient(180deg,var(--wood-a),var(--wood-b)) right/16px 100% no-repeat,var(--p-bg)}
.plate{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--p-line);padding-bottom:10px}
.pname{font-family:var(--f-disp);font-weight:700;font-size:16px;letter-spacing:.2em}
.pyear{font-family:var(--f-label);font-weight:600;letter-spacing:.18em;font-size:12px;color:var(--p-sub);text-transform:uppercase}
.secs{display:flex;flex-wrap:wrap;gap:12px}
.sec{flex:1 1 auto;min-width:0;border:1px solid var(--p-line);border-radius:8px;padding:9px 12px 12px;display:flex;flex-direction:column;gap:8px}
.sec[style*="--c"]{border-top:4px solid var(--c)}
.sec h3{font-family:var(--f-label);font-weight:700;letter-spacing:.16em;font-size:12.5px;text-transform:uppercase;margin:0;color:var(--p-sub)}
.ctrls{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:flex-start}

.knob{display:flex;flex-direction:column;align-items:center;gap:1px;cursor:ns-resize;touch-action:none;user-select:none;-webkit-user-select:none;border-radius:8px;padding:2px 1px;min-width:58px}
.knob svg{width:52px;height:52px;display:block}
.knob.sm{min-width:44px}.knob.sm svg{width:38px;height:38px}
.knob .trk{stroke:var(--k-trk);stroke-width:4;fill:none;stroke-linecap:round}
.knob .va{stroke:var(--k-arc);stroke-width:3.5;fill:none;stroke-linecap:round}
.knob .cap{fill:var(--k-cap);stroke:rgba(0,0,0,.55);stroke-width:2}
.knob .cap2{fill:var(--k-cap2)}
.knob .ptr{stroke:var(--k-ptr);stroke-width:3;stroke-linecap:round}
.knob .tick{stroke:var(--p-sub);stroke-width:1.6}
.kl{font-family:var(--f-label);font-size:12.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--p-ink);text-align:center;line-height:1.1}
.kv{font-family:var(--f-mono);font-size:10.5px;color:var(--p-sub);font-variant-numeric:tabular-nums;white-space:nowrap}
.kcc{font-family:var(--f-mono);font-size:9px;color:var(--p-sub);opacity:.7;height:11px}
.learning{background:color-mix(in srgb,var(--cool) 22%,transparent);outline:1px dashed var(--cool)}

.fader{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:ns-resize;touch-action:none;user-select:none;-webkit-user-select:none;width:46px;padding:2px 0;border-radius:6px}
.ftrack{position:relative;width:8px;height:108px;background:#141518;border-radius:4px;box-shadow:inset 0 0 0 1px #000}
.ffill{position:absolute;left:0;right:0;bottom:0;background:var(--c,var(--k-arc));opacity:.55;border-radius:4px}
.fcap{position:absolute;left:50%;width:30px;height:14px;transform:translateX(-50%);background:linear-gradient(#f3f1ea,#cfccc3);border-radius:3px;box-shadow:0 2px 3px rgba(0,0,0,.6),inset 0 -2px 0 rgba(0,0,0,.18)}
.fcap::after{content:"";position:absolute;left:4px;right:4px;top:6px;height:2px;background:#333}

.choice{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.seg{display:flex;flex-wrap:wrap;gap:4px}
.seg button{background:rgba(0,0,0,.18);border:1px solid var(--p-line);border-radius:6px;padding:5px 8px;cursor:pointer;font-family:var(--f-label);font-weight:600;font-size:12.5px;letter-spacing:.04em;color:var(--p-sub)}
.seg button.sel{color:var(--p-bg);background:var(--seg-on);border-color:var(--seg-on)}
.tg{display:inline-flex;align-items:center;gap:7px;background:rgba(0,0,0,.18);border:1px solid var(--p-line);border-radius:6px;padding:6px 9px;cursor:pointer;font-family:var(--f-label);font-weight:600;font-size:12.5px;letter-spacing:.05em;color:var(--p-sub);align-self:center}
.tg i{width:9px;height:9px;border-radius:50%;background:#3a2c22;box-shadow:inset 0 0 0 1px rgba(0,0,0,.6)}
.tg.on{color:var(--p-ink)} .tg.on i{background:var(--seg-on);box-shadow:0 0 8px var(--seg-on)}

/* themes */
.th-mono3{--p-bg:#1b1713;--p-ink:#efe3c6;--p-sub:#c8b48a;--p-line:#3a322a;--k-cap:#0f0e0d;--k-cap2:#201d1a;--k-ptr:#efe3c6;--k-arc:#e8a33d;--k-trk:#0b0a09;--seg-on:#e8a33d}
.th-acid{--p-bg:#c7cac6;--p-ink:#1c1e21;--p-sub:#4b5056;--p-line:#a5a9a4;--k-cap:#1b1c1e;--k-cap2:#2c2e31;--k-ptr:#f4f3ee;--k-arc:#d9481f;--k-trk:#9a9e99;--seg-on:#d9481f}
.th-acid .seg button:not(.sel),.th-acid .tg{background:rgba(255,255,255,.35)}
.th-acid .seg button.sel{color:#fff}
.th-poly6{--p-bg:#28292d;--p-ink:#ecebe6;--p-sub:#b7bac0;--p-line:#3c3f46;--k-arc:#e9e3d2;--seg-on:#e3c46a}
.th-prog5{--p-bg:#111111;--p-ink:#f0ede6;--p-sub:#cdb27a;--p-line:#2b2824;--k-cap:#e2dccd;--k-cap2:#f1ece1;--k-ptr:#151515;--k-arc:#cdb27a;--k-trk:#26231f;--seg-on:#cdb27a}
.th-fm6{--p-bg:#2a2623;--p-ink:#e7e1d5;--p-sub:#a89f91;--p-line:#433d37;--k-cap:#3b3631;--k-cap2:#48423c;--k-ptr:#e7e1d5;--k-arc:#5fb3a8;--k-trk:#1c1917;--seg-on:#5fb3a8}
.th-mod{--p-bg:#0d0e10;--p-ink:#e9e9e4;--p-sub:#a6a8a4;--p-line:#26282c;--k-cap:#c4c6c8;--k-cap2:#e2e4e5;--k-ptr:#111;--k-arc:#d9b45a;--k-trk:#1b1c1f;--seg-on:#d9b45a}

/* pattern sequencer (every synth) */
.seq{display:flex;flex-direction:column;gap:8px;min-width:0}
.seqbar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.seqbar .kl{color:var(--p-sub)}
.run{font-family:var(--f-label);font-weight:700;letter-spacing:.12em;background:var(--p-ink);color:var(--p-bg);border:0;border-radius:6px;padding:8px 16px;cursor:pointer;min-width:78px}
.run.on{background:var(--k-arc);color:#14110f}
.sbtn{background:transparent;border:1px solid var(--p-line);border-radius:6px;padding:5px 10px;cursor:pointer;color:var(--p-ink);font-family:var(--f-label);font-weight:600;font-size:13px}
.sbtn:hover{border-color:var(--p-sub)}
.sfield{display:inline-flex;align-items:center;gap:6px}
.sfield select{background:transparent;border:1px solid var(--p-line);border-radius:6px;padding:5px 8px;color:var(--p-ink);font-family:var(--f-label);font-weight:600;font-size:13px;cursor:pointer}
.sfield option{background:#1b1e22;color:#ece8de}
.sfield input[type=range]{accent-color:var(--k-arc);width:120px}
.sval{font-family:var(--f-mono);font-size:12px;color:var(--p-ink);min-width:4.2em;text-align:center;font-variant-numeric:tabular-nums}
.shint{font-size:13px;color:var(--p-sub);margin:0}
.seqscroll{overflow-x:auto}
.grid{display:grid;grid-template-columns:44px repeat(16,minmax(22px,1fr));gap:3px;min-width:560px}
.grid .rl{font-family:var(--f-mono);font-size:10px;color:var(--p-sub);display:flex;align-items:center;justify-content:flex-end;padding-right:6px}
.cell{height:16px;border-radius:3px;background:color-mix(in srgb,var(--p-ink) 9%,transparent);cursor:pointer;border:0;padding:0}
.cell.blk{background:color-mix(in srgb,var(--p-ink) 15%,transparent)}
.cell.bar{box-shadow:inset 2px 0 0 color-mix(in srgb,var(--p-ink) 30%,transparent)}
.cell.on{background:var(--k-arc)}
.cell.flag.on{background:var(--p-ink)}
.cell.ph{box-shadow:inset 0 0 0 1px var(--p-ink)}
.cell.on.ph{box-shadow:inset 0 0 0 2px var(--p-ink)}
.grid .sep{grid-column:1/-1;height:4px}

/* fm */
.fmtop{display:flex;flex-wrap:wrap;gap:12px}
.fmtop .sec{flex:1 1 280px}.fmtop .sec:first-child{flex:2 1 420px;flex-direction:row;flex-wrap:wrap;align-items:flex-start;gap:12px 16px}.fmtop .sec:first-child h3{flex-basis:100%}
.fmtop .ctrls{flex:1 1 200px}
.lcd{background:var(--lcd,#b8c896);border-radius:6px;padding:8px 10px;box-shadow:inset 0 2px 6px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:4px;flex:0 1 300px;min-width:0}
.lcd .lt{font-family:var(--f-mono);font-size:11px;color:#20291a;letter-spacing:.06em}
.alg{display:block;width:100%;max-width:260px;height:auto}
.alg .aline,.alg .abus{stroke:#20291a;stroke-width:1.6;fill:none}
.alg .abus{stroke-width:3}
.alg .afb{stroke:#20291a;stroke-width:1.4;fill:none;stroke-dasharray:3 2}
.alg .acar{fill:#20291a}.alg .amod{fill:none;stroke:#20291a;stroke-width:1.6}
.alg .atxt{font-family:var(--f-mono);font-size:12px;text-anchor:middle;fill:#20291a}
.alg .acar+.atxt{fill:#b8c896}
.optable{overflow-x:auto}
.ops{display:grid;grid-template-columns:72px repeat(7,minmax(46px,1fr));gap:2px 6px;align-items:center;min-width:520px}
.ops .oh{font-family:var(--f-label);font-weight:700;font-size:11.5px;letter-spacing:.14em;color:var(--p-sub);text-align:center;text-transform:uppercase}
.ops .on{display:flex;flex-direction:column;gap:2px;font-family:var(--f-label);font-weight:700;letter-spacing:.1em}
.badge{font-family:var(--f-mono);font-size:9.5px;font-weight:400;letter-spacing:.04em;border-radius:3px;padding:1px 4px;align-self:flex-start}
.badge.car{background:var(--k-arc);color:#14110f}.badge.mod{border:1px solid var(--p-sub);color:var(--p-sub)}
.ops .knob .kl{display:none}

/* modular */
.cabwrap{position:relative}
.cab{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px}
.mod{background:#17191c;border:1px solid #2c2f34;border-radius:6px;padding:8px 8px 10px;display:flex;flex-direction:column;gap:8px;min-width:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.mod h4{margin:0;font-family:var(--f-label);font-weight:700;letter-spacing:.16em;font-size:12.5px;text-transform:uppercase;display:flex;justify-content:space-between;align-items:baseline}
.mod h4 span{font-family:var(--f-mono);font-weight:400;font-size:9.5px;color:var(--p-sub);letter-spacing:.04em}
.mod .ctrls{justify-content:center}
.jrow{display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;border-top:1px solid #26292e;padding-top:8px;margin-top:auto}
.jgrp{display:flex;gap:8px;flex-wrap:wrap}
.mj{display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;background:none;border:0;padding:0}
.mj i{width:22px;height:22px;border-radius:50%;background:radial-gradient(circle,#030405 0 32%,#9aa1a8 34% 50%,#50575e 52% 100%);box-shadow:0 0 0 1px #000;display:block}
.mj.out i{background:radial-gradient(circle,#030405 0 32%,#d9b45a 34% 50%,#7a6230 52% 100%)}
.mj span{font-family:var(--f-mono);font-size:9.5px;color:var(--p-sub)}
.mj.armed i{box-shadow:0 0 0 3px var(--k-arc),0 0 12px var(--k-arc)}
.cabsvg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:4}

/* keys */
.keysbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.keyboard{position:relative;height:140px;display:flex;user-select:none;-webkit-user-select:none;touch-action:none;border-radius:8px;overflow:hidden;border:1px solid #000;background:#000}
.wk{flex:1;background:linear-gradient(#efe9dc,#d9d1c0);border-right:1px solid #8b8478;position:relative;cursor:pointer}
.wk:last-child{border-right:0}.wk.down{background:linear-gradient(#e8b98a,#e3a46a)}
.wk span{position:absolute;bottom:8px;left:0;right:0;text-align:center;font-family:var(--f-mono);font-size:10px;color:#7a7266;line-height:1.2}
.bk{position:absolute;top:0;height:60%;background:linear-gradient(#2a2f35,#0e1114);border-radius:0 0 4px 4px;z-index:2;cursor:pointer}
.bk.down{background:linear-gradient(#b8763d,#7d4a20)}
.bk span{position:absolute;bottom:6px;left:0;right:0;text-align:center;font-family:var(--f-mono);font-size:9px;color:#8c949c}
.card{background:var(--chrome);border:1px solid var(--line);border-radius:10px;padding:12px 16px}
.card h2{font-family:var(--f-disp);font-size:11.5px;letter-spacing:.14em;margin:0 0 6px;font-weight:400}
.card p{color:var(--muted);font-size:14px;margin:0}
.map{font-family:var(--f-mono);font-size:12px;color:var(--muted);display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:3px 12px;margin-top:8px}
.ctlgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px 28px}
.padhead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.padhead h2{margin:0}
.bank{font-family:var(--f-mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:10px 0 5px}
.padmap{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.pad{border:1px solid var(--line);border-radius:7px;padding:7px 6px;background:var(--bg);color:var(--muted);font-family:var(--f-mono);font-size:10.5px;min-height:46px;display:flex;flex-direction:column;gap:2px;align-items:center;justify-content:center;text-align:center;cursor:pointer;transition:border-color .12s,box-shadow .12s}
.pad b{color:var(--ink);font-family:var(--f-body);font-weight:600;font-size:12.5px;line-height:1.15}
.pad:hover{border-color:var(--muted)}
.pad.hit{border-color:var(--hot);box-shadow:inset 0 0 0 1px var(--hot),0 0 14px -4px var(--hot)}
.pad.cur{border-color:var(--cool)}
.padstat{font-size:13px;color:var(--ink);min-height:1.4em;margin:8px 0 0}
.padoff .padmap{opacity:.45}

@media (max-width:860px){.era{grid-template-columns:auto minmax(0,1fr)}.scopes{grid-column:1/-1}.ctlgrid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:560px){.root{padding:14px 12px 18px}.era{grid-template-columns:1fr}.selwrap select{min-width:0;width:100%}.selwrap{flex:1}.panel.wood{padding-left:24px;padding-right:24px}.keyboard{height:116px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;
const HTML=`<div class="root"><div class="wrap">
  <header class="top">
    <div class="brand">
      <span class="eyebrow">Sixty years of synthesis, one keyboard</span>
      <h1>Synths</h1>
    </div>
    <div class="picker">
      <div class="selwrap"><select id="instSel" aria-label="Choose a synthesizer"></select></div>
      <div class="controls">
        <button class="power" id="power" aria-pressed="false"><span class="led"></span><span id="powerTxt">Power on</span></button>
        <button class="chip" id="midiChip">MIDI: connect</button>
        <button class="chip" id="learnBtn">MIDI learn</button>
      </div>
    </div>
  </header>

  <div class="era">
    <div class="yr" id="eraYear">1970</div>
    <p id="eraText"></p>
    <div class="scopes"><canvas id="cvScope"></canvas><canvas id="cvSpec"></canvas></div>
  </div>

  <div class="presets" id="presetRow"></div>
  <p class="hint" id="hint"></p>

  <div class="panel" id="panel"></div>

  <div class="keysbar">
    <div class="presets"><span class="label">Keys</span>
      <button class="pbtn" id="octDown">Oct −</button>
      <span class="eyebrow" id="octLbl">C3 – C5</span>
      <button class="pbtn" id="octUp">Oct +</button>
    </div>
    <span class="eyebrow">Computer keys <kbd>A</kbd>–<kbd>K</kbd> · <kbd>Z</kbd> <kbd>X</kbd> octave · drag knobs, <kbd>Shift</kbd> for fine, double-click to reset</span>
  </div>
  <div class="keyboard" id="kb" aria-label="Keyboard"></div>

  <div class="card ctlgrid" id="ctlCard">
    <div>
      <h2>CONTROLLER</h2>
      <p id="midiInfo">Plug in a USB MIDI keyboard, then press MIDI: connect and allow access. On an Akai MPK Mini the eight knobs (CC 70–77) map to the eight most useful controls of whichever synth is loaded. The joystick bends pitch left and right (±2 semitones) and pushes the synth's modulation up (CC 1). Use MIDI learn to remap a knob.</p>
      <div class="map" id="mapList"></div>
    </div>
    <div>
      <div class="padhead"><h2>PADS</h2><button class="chip ok" id="padMode" aria-pressed="true" title="Pads on MIDI channel 10 run the show; turn off to play them as notes">Pads: control</button></div>
      <p class="hint" style="font-size:13px">Pads on MIDI channel 10 (the MPK Mini's default) run the synths. You can click them here too.</p>
      <div class="bank">Bank A · the show</div>
      <div class="padmap" id="padsA"></div>
      <div class="bank">Bank B · key of the running pattern</div>
      <div class="padmap" id="padsB"></div>
      <p class="padstat" id="padStat" aria-live="polite"></p>
    </div>
  </div>
</div></div>`;
let ROOT=null,ACTIVE=false,WAS_ON=false;
const $=s=>ROOT.querySelector(s), $$=s=>[...ROOT.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const clone=o=>JSON.parse(JSON.stringify(o));
const mtof=n=>440*Math.pow(2,(n-69)/12);
const hz=v=>v<1000?(v<100?v.toFixed(1):v.toFixed(0))+' Hz':(v/1000).toFixed(2)+' kHz';
const tm=v=>v<1?(v*1000).toFixed(0)+' ms':v.toFixed(2)+' s';
const pct=v=>Math.round(v*100)+'%';
const f10=v=>v.toFixed(1);
const ct=v=>(v>0?'+':'')+v.toFixed(0)+' ct';
const stF=v=>(v>0?'+':'')+v.toFixed(2)+' st';
const stI=v=>(v>0?'+':'')+v.toFixed(0)+' st';

/* ================= audio helpers ================= */
function hold(p,t){if(p.cancelAndHoldAtTime){p.cancelAndHoldAtTime(t)}else{const v=p.value;p.cancelScheduledValues(t);p.setValueAtTime(v,t)}}
function envOn(p,t,peak,a,d,s){a=Math.max(.001,a);hold(p,t);p.linearRampToValueAtTime(peak,t+a);p.setTargetAtTime(peak*s,t+a,Math.max(.002,d)/3)}
function envOff(p,t,r){hold(p,t);p.setTargetAtTime(0,t,Math.max(.002,r)/4)}
const tgt=(p,v,t,tc)=>p.setTargetAtTime(v,t,tc||.012);
const curves={};
// velocity to envelope peak: soft keys a little quieter, accents full
const velPeak=v=>.55+.45*((v===undefined?100:v)/127);
function tanhCurve(k){const key='t'+k;if(curves[key])return curves[key];const c=new Float32Array(2048);for(let i=0;i<2048;i++){const x=i/1023.5-1;c[i]=Math.tanh(x*k)/Math.tanh(k)}return curves[key]=c}
function waves(ctx){
  if(ctx._w)return ctx._w;const H=64;
  const mk=fn=>{const re=new Float32Array(H),im=new Float32Array(H);for(let n=1;n<H;n++){const r=fn(n);re[n]=r[0];im[n]=r[1]}return ctx.createPeriodicWave(re,im)};
  const saw=n=>[0,2/(Math.PI*n)*(n%2?1:-1)];
  const tri=n=>[0,n%2?8/(Math.PI*Math.PI*n*n)*(((n-1)/2)%2?-1:1):0];
  const pulse=d=>n=>[2/(n*Math.PI)*Math.sin(n*Math.PI*d),0];
  return ctx._w={tri:mk(tri),saw:mk(saw),shark:mk(n=>[0,(tri(n)[1]+saw(n)[1])/2]),square:mk(pulse(.5)),wide:mk(pulse(.3)),narrow:mk(pulse(.12)),sine:mk(n=>[0,n===1?1:0])};
}
function noiseBuf(ctx){if(ctx._nb)return ctx._nb;const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return ctx._nb=b}
function factory(ctx){
  const all=[],src=[];const P=n=>(all.push(n),n);const Q=n=>(src.push(n),P(n));let bg=null;
  return{
    // pitch bend: ctx._bend (cents) reaches every pitched oscillator of this engine through one gain,
    // so disposing the engine disconnects it cleanly
    bend:o=>{if(!ctx._bend)return;if(!bg){bg=new GainNode(ctx,{gain:1});ctx._bend.connect(bg)}bg.connect(o.detune)},
    osc:o=>Q(new OscillatorNode(ctx,o||{})),
    gain:g=>P(new GainNode(ctx,{gain:g===undefined?1:g})),
    bq:o=>P(new BiquadFilterNode(ctx,o)),
    cs:v=>Q(new ConstantSourceNode(ctx,{offset:v||0})),
    noise:()=>Q(new AudioBufferSourceNode(ctx,{buffer:noiseBuf(ctx),loop:true})),
    shaper:c=>{const n=new WaveShaperNode(ctx,{oversample:'2x'});n.curve=c;return P(n)},
    delay:m=>P(new DelayNode(ctx,{maxDelayTime:m})),
    merger:n=>P(new ChannelMergerNode(ctx,{numberOfInputs:n})),
    start(){const t=ctx.currentTime;src.forEach(s=>{if(s._st)return;s._st=1;if(s instanceof AudioBufferSourceNode)s.start(t,Math.random()*1.5);else s.start(t)})},
    dispose(){src.forEach(s=>{try{s.stop()}catch(e){}});all.forEach(n=>{try{n.disconnect()}catch(e){}});if(bg){try{ctx._bend.disconnect(bg)}catch(e){}try{bg.disconnect()}catch(e){}}}
  };
}
function ladder(f){
  const a=f.bq({type:'lowpass',frequency:1000,Q:.7}),b=f.bq({type:'lowpass',frequency:1000,Q:.7});a.connect(b);
  return{in:a,out:b,det:[a.detune,b.detune],
    mod(s){s.connect(a.detune);s.connect(b.detune)},
    freq(v,t){v=clamp(v,20,20000);tgt(a.frequency,v,t,.01);tgt(b.frequency,v,t,.01)},
    res(r,t){tgt(b.Q,.7+Math.pow(r,1.6)*25,t,.02);tgt(a.Q,.6+r*1.4,t,.02)}};
}
function monoStack(){const h=[];return{
  on(n){const i=h.indexOf(n);if(i>=0)h.splice(i,1);const leg=h.length>0;h.push(n);return leg},
  off(n){const i=h.indexOf(n);if(i<0)return null;h.splice(i,1);return h.length?h[h.length-1]:undefined},
  clear(){h.length=0},get size(){return h.length}}}
function alloc(voices){return{
  on(n){const v=voices.find(x=>x.note===n)||voices.filter(x=>!x.gate).sort((a,b)=>a.t-b.t)[0]||voices.slice().sort((a,b)=>a.t-b.t)[0];v.note=n;v.gate=true;v.t=performance.now();return v},
  off(n){const v=voices.find(x=>x.note===n&&x.gate);if(v){v.gate=false;v.t=performance.now()}return v}}}

/* ================= instrument definitions ================= */
let S={};
const DEFS={};
const RANGES=[[-7,"LO"],[-2,"32'"],[-1,"16'"],[0,"8'"],[1,"4'"],[2,"2'"]];
const MW=[["tri","Tri"],["shark","Shark"],["saw","Saw"],["square","Sq"],["wide","Wide"],["narrow","Nar"]];

/* ---------- 1964 Modular cabinet ---------- */
const MR=RANGES.slice(1), MR3=RANGES, MWV=[["tri","Tri"],["saw","Saw"],["square","Sq"],["narrow","Pulse"]];
const CABLE_COLS=['#e4c04a','#d9482f','#4b8fe0','#5fb070','#ece8de','#e08a3a','#b06ad9','#4fc7c4'];
DEFS.mod={
  year:1964, plate:'MODULAR CABINET', sub:'voltage control · patch cords · no presets on the hardware',
  name:'1964 · Modular Cabinet', theme:'th-mod', wood:true,
  era:'<b>Where it started.</b> Separate modules for each job, joined by patch cords. Every sound is a wiring decision, which is why it teaches synthesis better than anything since.',
  hint:'Click an output (gold ring), then an input (silver ring) to patch. Click an input to unplug it. Try "Empty cabinet" and build a voice yourself.',
  params:{
    v1rng:{t:'s',l:'Range',o:MR,v:0}, v1tune:{t:'k',l:'Tune',min:-12,max:12,v:0,fmt:stF}, v1wave:{t:'s',l:'Wave',o:MWV,v:'saw'}, v1fm:{t:'k',l:'FM amt',min:0,max:1,v:.3,fmt:pct},
    v2rng:{t:'s',l:'Range',o:MR,v:0}, v2tune:{t:'k',l:'Tune',min:-12,max:12,v:.08,fmt:stF}, v2wave:{t:'s',l:'Wave',o:MWV,v:'saw'}, v2fm:{t:'k',l:'FM amt',min:0,max:1,v:.3,fmt:pct},
    v3rng:{t:'s',l:'Range',o:MR3,v:-1}, v3tune:{t:'k',l:'Tune',min:-12,max:12,v:-.05,fmt:stF}, v3wave:{t:'s',l:'Wave',o:MWV,v:'square'}, v3kbd:{t:'t',l:'Kbd',v:true},
    lrate:{t:'k',l:'Rate',min:.05,max:30,log:true,v:1.5,fmt:hz}, lshape:{t:'s',l:'Shape',o:[["triangle","Tri"],["square","Sq"],["sawtooth","Saw"]],v:'triangle'},
    mx1:{t:'k',l:'In 1',min:0,max:1,v:.7,fmt:pct}, mx2:{t:'k',l:'In 2',min:0,max:1,v:.6,fmt:pct}, mx3:{t:'k',l:'In 3',min:0,max:1,v:.5,fmt:pct}, mx4:{t:'k',l:'In 4',min:0,max:1,v:.4,fmt:pct},
    fcut:{t:'k',l:'Cutoff',min:20,max:18000,log:true,v:800,fmt:hz}, femph:{t:'k',l:'Emphasis',min:0,max:1,v:.3,fmt:pct}, fcv:{t:'k',l:'CV amt',min:0,max:1,v:.6,fmt:pct}, fkbd:{t:'s',l:'Kbd',o:[[0,'Off'],[.5,'Half'],[1,'Full']],v:.5},
    alvl:{t:'k',l:'Initial',min:0,max:1,v:0,fmt:pct}, acv:{t:'k',l:'CV amt',min:0,max:1,v:1,fmt:pct},
    e1a:{t:'k',l:'Attack',min:.001,max:8,log:true,v:.005,fmt:tm}, e1d:{t:'k',l:'Decay',min:.005,max:8,log:true,v:.5,fmt:tm}, e1s:{t:'k',l:'Sustain',min:0,max:1,v:.3,fmt:pct}, e1r:{t:'k',l:'Release',min:.005,max:8,log:true,v:.3,fmt:tm},
    e2a:{t:'k',l:'Attack',min:.001,max:8,log:true,v:.005,fmt:tm}, e2d:{t:'k',l:'Decay',min:.005,max:8,log:true,v:.4,fmt:tm}, e2s:{t:'k',l:'Sustain',min:0,max:1,v:.8,fmt:pct}, e2r:{t:'k',l:'Release',min:.005,max:8,log:true,v:.4,fmt:tm},
    ovol:{t:'k',l:'Volume',min:0,max:1,v:.7,fmt:pct}
  },
  extraDefaults:()=>({cables:[]}),
  patterns:[
    riff('Bass riff',36,110,pat([[0,0,1,0],null,[0,0,0,0],[12,0,0,0],null,[10,0,0,0],[7,0,0,1],[5,0,0,0],[0,0,1,0],null,[3,0,0,0],null,[5,0,0,1],[7,0,0,0],[10,0,0,0],[12,0,1,0]])),
    riff('Arpeggio',48,120,pat([0,3,7,12,0,3,7,12,2,5,8,12,2,5,8,12].map((n,i)=>[n,0,i%4===0?1:0,0]))),
    riff('Slow drone',36,70,chords([[[0],8],[[7],8]]))
  ],
  cc:['fcut','femph','fcv','e1d','e1s','e2d','e2s','lrate'], wheel:'fcv',
  modules:[
    {name:'VCO 1',tag:'921',knobs:['v1rng','v1tune','v1wave','v1fm'],ins:[['vco1.fm','FM']],outs:[['vco1.out','Out']]},
    {name:'VCO 2',tag:'921',knobs:['v2rng','v2tune','v2wave','v2fm'],ins:[['vco2.fm','FM']],outs:[['vco2.out','Out']]},
    {name:'VCO 3',tag:'921',knobs:['v3rng','v3tune','v3wave','v3kbd'],ins:[],outs:[['vco3.out','Out']]},
    {name:'Noise',tag:'white',knobs:[],ins:[],outs:[['noise.out','Out']]},
    {name:'LFO',tag:'slow',knobs:['lrate','lshape'],ins:[],outs:[['lfo.out','Out']]},
    {name:'Mixer',tag:'4 in',knobs:['mx1','mx2','mx3','mx4'],ins:[['mix.in1','1'],['mix.in2','2'],['mix.in3','3'],['mix.in4','4']],outs:[['mix.out','Out']]},
    {name:'Ladder VCF',tag:'904A',knobs:['fcut','femph','fcv','fkbd'],ins:[['vcf.in','In'],['vcf.cv','CV']],outs:[['vcf.out','Out']]},
    {name:'VCA',tag:'902',knobs:['alvl','acv'],ins:[['vca.in','In'],['vca.cv','CV']],outs:[['vca.out','Out']]},
    {name:'Envelope 1',tag:'911',knobs:['e1a','e1d','e1s','e1r'],ins:[],outs:[['eg1.out','Out']]},
    {name:'Envelope 2',tag:'911',knobs:['e2a','e2d','e2s','e2r'],ins:[],outs:[['eg2.out','Out']]},
    {name:'Output',tag:'to amp',knobs:['ovol'],ins:[['out.in','In']],outs:[]}
  ],
  presets:[
    {name:'Classic voice',p:{cables:[['vco1.out','mix.in1'],['vco2.out','mix.in2'],['mix.out','vcf.in'],['vcf.out','vca.in'],['vca.out','out.in'],['eg1.out','vcf.cv'],['eg2.out','vca.cv']]}},
    {name:'Drone, no VCA',p:{v3rng:0,v3tune:7,v3wave:'saw',mx3:.55,lrate:.15,fcv:.45,fcut:500,femph:.45,cables:[['vco1.out','mix.in1'],['vco2.out','mix.in2'],['vco3.out','mix.in3'],['mix.out','vcf.in'],['vcf.out','out.in'],['lfo.out','vcf.cv']]}},
    {name:'FM bell',p:{v1wave:'tri',v2rng:2,v2tune:0,v2wave:'tri',v1fm:.75,e2a:.002,e2d:2.2,e2s:0,e2r:1.6,cables:[['vco2.out','vco1.fm'],['vco1.out','vca.in'],['vca.out','out.in'],['eg2.out','vca.cv']]}},
    {name:'Osc 3 wobble',p:{v3rng:-7,v3kbd:false,v3tune:5,fcut:350,femph:.6,fcv:.55,cables:[['vco1.out','mix.in1'],['vco2.out','mix.in2'],['mix.out','vcf.in'],['vcf.out','vca.in'],['vca.out','out.in'],['vco3.out','vcf.cv'],['eg2.out','vca.cv']]}},
    {name:'Empty cabinet',p:{cables:[]}}
  ],
  render(pn){
    const wrap=document.createElement('div');wrap.className='cabwrap';
    const cab=document.createElement('div');cab.className='cab';
    this.modules.forEach(m=>{
      const el=document.createElement('div');el.className='mod';
      el.innerHTML=`<h4>${m.name}<span>${m.tag}</span></h4>`;
      const c=document.createElement('div');c.className='ctrls';m.knobs.forEach(id=>{const o=ctrl(id);if(o.el.classList.contains('knob'))o.el.classList.add('sm');c.appendChild(o.el)});el.appendChild(c);
      const jr=document.createElement('div');jr.className='jrow';
      const gi=document.createElement('div');gi.className='jgrp';m.ins.forEach(([j,l])=>gi.appendChild(jack(j,l,false)));
      const go=document.createElement('div');go.className='jgrp';m.outs.forEach(([j,l])=>go.appendChild(jack(j,l,true)));
      jr.appendChild(gi);jr.appendChild(go);el.appendChild(jr);cab.appendChild(el);
    });
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','cabsvg');svg.id='cabsvg';
    wrap.appendChild(cab);wrap.appendChild(svg);pn.appendChild(wrap);
    requestAnimationFrame(drawCables);
  },
  build(ctx,dest){
    const f=factory(ctx),W=waves(ctx),outs={},ins={};
    const vco=[1,2,3].map(i=>{const o=f.osc({frequency:110});o.setPeriodicWave(W.saw);f.bend(o);outs[`vco${i}.out`]=o;if(i<3){const fm=f.gain(0);fm.connect(o.detune);ins[`vco${i}.fm`]=fm}return o});
    const nz=f.noise(),nzg=f.gain(.5);nz.connect(nzg);outs['noise.out']=nzg;
    const lfo=f.osc({type:'triangle',frequency:1.5});outs['lfo.out']=lfo;
    const msum=f.gain(.35);outs['mix.out']=msum;
    const mins=[1,2,3,4].map(i=>{const g=f.gain(.5);g.connect(msum);ins['mix.in'+i]=g;return g});
    const fin=f.gain(1),drv=f.shaper(tanhCurve(1.6)),L=ladder(f),fcv=f.gain(0);fin.connect(drv);drv.connect(L.in);L.mod(fcv);ins['vcf.in']=fin;ins['vcf.cv']=fcv;outs['vcf.out']=L.out;
    const ain=f.gain(1),vg=f.gain(0),acv=f.gain(1);ain.connect(vg);acv.connect(vg.gain);ins['vca.in']=ain;ins['vca.cv']=acv;outs['vca.out']=vg;
    const eg=[f.cs(0),f.cs(0)];outs['eg1.out']=eg[0];outs['eg2.out']=eg[1];
    const oin=f.gain(1),vol=f.gain(.6);oin.connect(vol);vol.connect(dest);ins['out.in']=oin;
    const st=monoStack();let cur=48;
    const pitch=(n,t)=>{vco.forEach((o,i)=>{const k=i+1;const base=(k===3&&!S.v3kbd)?mtof(48):mtof(n);const fr=base*Math.pow(2,S['v'+k+'rng'])*Math.pow(2,S['v'+k+'tune']/12);o.frequency.cancelScheduledValues(t);o.frequency.setValueAtTime(fr,t)});L.freq(S.fcut*Math.pow(2,(n-60)/12*S.fkbd),t)};
    const gate=(on,t,vel)=>{[1,2].forEach(k=>{const p=eg[k-1].offset;on?envOn(p,t,k===2?velPeak(vel):1,S['e'+k+'a'],S['e'+k+'d'],S['e'+k+'s']):envOff(p,t,S['e'+k+'r'])})};
    f.start();
    return{
      noteOn(n,vel,at){const t=at===undefined?ctx.currentTime:at,leg=st.on(n);cur=n;pitch(n,t);if(!leg)gate(true,t,vel)},
      noteOff(n,at){const t=at===undefined?ctx.currentTime:at,nx=st.off(n);if(nx===null)return;if(nx!==undefined){cur=nx;pitch(nx,t)}else gate(false,t)},
      allOff(){st.clear();gate(false,ctx.currentTime)},
      set(id,v){const t=ctx.currentTime;const m=id.match(/^v(\d)(rng|tune|wave|fm|kbd)$/);
        if(m){const i=+m[1]-1;if(m[2]==='wave')vco[i].setPeriodicWave(W[v]);else if(m[2]==='fm')tgt(ins[`vco${i+1}.fm`].gain,v*2400,t);else pitch(cur,t);return}
        if(/^mx\d$/.test(id)){tgt(mins[+id[2]-1].gain,v*v,t);return}
        switch(id){
          case 'lrate':tgt(lfo.frequency,v,t);break; case 'lshape':lfo.type=v;break;
          case 'fcut':case 'fkbd':L.freq(S.fcut*Math.pow(2,(cur-60)/12*S.fkbd),t);break;
          case 'femph':L.res(v*.94,t);break; case 'fcv':tgt(fcv.gain,v*6000,t);break;
          case 'alvl':tgt(vg.gain,v,t);break; case 'acv':tgt(acv.gain,v,t);break;
          case 'ovol':tgt(vol.gain,v*v*.9,t);break;
        }},
      post(){this.patch(S.cables)},
      patch(cs){Object.values(outs).forEach(o=>{try{o.disconnect()}catch(e){}});cs.forEach(([a,b])=>{if(outs[a]&&ins[b])outs[a].connect(ins[b])})},
      dispose(){f.dispose()}
    };
  }
};

/* ---------- 1970 Three-oscillator portable mono ---------- */
DEFS.mono3={
  year:1970, plate:'THREE-OSC MONO', sub:'three oscillators · ladder filter · hard-wired', name:'1970 · Three-Osc Mono', theme:'th-mono3', wood:true,
  era:'<b>The modular, pre-patched and portable.</b> The cables were fixed inside so you could take it on stage. Three oscillators, a mixer you can overdrive, and the 24 dB ladder filter.',
  hint:'Push the mixer past 7 so it drives the filter, keep Osc 2 slightly detuned, and sweep Cutoff with Emphasis around 6. Set Osc 3 to LO, turn off its key tracking, and it becomes a modulation source.',
  params:{
    tune:{t:'k',l:'Tune',min:-100,max:100,v:0,fmt:ct}, glide:{t:'k',l:'Glide',min:0,max:1.5,v:.06,fmt:tm},
    modmix:{t:'k',l:'Mod mix',min:0,max:1,v:0,fmt:v=>v<.03?'Osc 3':v>.97?'Noise':pct(v)}, modamt:{t:'k',l:'Mod amt',min:0,max:1,v:0,fmt:pct},
    oscmod:{t:'t',l:'Osc mod',v:false}, filtmod:{t:'t',l:'Filter mod',v:false},
    o1range:{t:'s',l:'Range',o:RANGES.slice(1),v:-1}, o1wave:{t:'s',l:'Wave',o:MW,v:'saw'},
    o2range:{t:'s',l:'Range',o:RANGES.slice(1),v:-1}, o2freq:{t:'k',l:'Freq',min:-7,max:7,v:.08,fmt:stF}, o2wave:{t:'s',l:'Wave',o:MW,v:'saw'},
    o3range:{t:'s',l:'Range',o:RANGES,v:0}, o3freq:{t:'k',l:'Freq',min:-7,max:7,v:-.05,fmt:stF}, o3wave:{t:'s',l:'Wave',o:MW,v:'square'}, o3kbd:{t:'t',l:'Kbd ctrl',v:true},
    m1:{t:'k',l:'Osc 1',min:0,max:10,v:8,fmt:f10}, m1on:{t:'t',l:'On',v:true},
    m2:{t:'k',l:'Osc 2',min:0,max:10,v:7,fmt:f10}, m2on:{t:'t',l:'On',v:true},
    m3:{t:'k',l:'Osc 3',min:0,max:10,v:5,fmt:f10}, m3on:{t:'t',l:'On',v:true},
    mn:{t:'k',l:'Noise',min:0,max:10,v:0,fmt:f10}, ncol:{t:'c',l:'Color',o:[['white','White'],['pink','Pink']],v:'white'},
    cut:{t:'k',l:'Cutoff',min:20,max:20000,log:true,v:1100,fmt:hz}, emph:{t:'k',l:'Emphasis',min:0,max:10,v:4,fmt:f10}, cont:{t:'k',l:'Contour amt',min:0,max:10,v:6,fmt:f10},
    kbd:{t:'s',l:'Kbd ctrl',o:[[0,'Off'],[.33,'1/3'],[.67,'2/3'],[1,'Full']],v:.33},
    fa:{t:'k',l:'Attack',min:.001,max:10,log:true,v:.005,fmt:tm}, fd:{t:'k',l:'Decay',min:.005,max:10,log:true,v:.5,fmt:tm}, fs:{t:'k',l:'Sustain',min:0,max:10,v:4,fmt:f10},
    la:{t:'k',l:'Attack',min:.001,max:10,log:true,v:.005,fmt:tm}, ld:{t:'k',l:'Decay',min:.005,max:10,log:true,v:.3,fmt:tm}, ls:{t:'k',l:'Sustain',min:0,max:10,v:9,fmt:f10},
    decsw:{t:'t',l:'Release = decay',v:true}, vol:{t:'k',l:'Volume',min:0,max:10,v:6,fmt:f10}
  },
  sections:[
    {title:'Controllers',ids:['tune','glide','modmix','modamt','oscmod','filtmod']},
    {title:'Oscillator 1',ids:['o1range','o1wave']},
    {title:'Oscillator 2',ids:['o2range','o2freq','o2wave']},
    {title:'Oscillator 3',ids:['o3range','o3freq','o3wave','o3kbd']},
    {title:'Mixer',ids:['m1','m1on','m2','m2on','m3','m3on','mn','ncol']},
    {title:'Filter',ids:['cut','emph','cont','kbd']},
    {title:'Filter contour',ids:['fa','fd','fs']},
    {title:'Loudness contour',ids:['la','ld','ls','decsw']},
    {title:'Output',ids:['vol']}
  ],
  cc:['cut','emph','cont','fd','fs','ld','glide','o2freq'], wheel:'modamt',
  patterns:[
    riff('Lead riff',48,96,pat([[0,0,1,0],null,[3,0,0,0],[5,0,0,1],[7,0,0,0],null,[10,0,0,1],[12,0,0,0],[10,0,1,0],null,[7,0,0,0],[5,0,0,1],[3,0,0,0],null,[0,0,0,1],[3,0,0,0]])),
    riff('Funk bass',36,104,pat([[0,0,1,0],null,[0,1,0,0],[0,0,0,0],null,[10,0,0,0],[0,0,1,0],null,[3,0,0,1],[5,0,0,0],null,[0,0,0,0],[7,0,1,0],null,[10,0,0,1],[12,0,0,0]])),
    riff('Octave pulse',36,124,pat(Array.from({length:16},(_,i)=>[i%8===6?7:0,i%2,i%4===0?1:0,0])))
  ],
  presets:[
    {name:'Fat lead',p:{}},
    {name:'Deep bass',p:{glide:0,o1range:-2,o2range:-1,o2wave:'square',o3range:-2,o3freq:.1,o3wave:'saw',m1:9,m2:6,m3:6,cut:280,emph:3,cont:6,fd:.3,fs:1,ld:.25,ls:8,decsw:false}},
    {name:'Brass',p:{glide:0,m3on:false,cut:600,emph:1,cont:5,fa:.09,fd:.8,fs:6,la:.05,ld:.5,ls:9}},
    {name:'Osc 3 wobble',p:{o3range:-7,o3kbd:false,o3freq:3,m3on:false,modamt:.55,filtmod:true,modmix:0,cut:500,emph:6,cont:3,ls:10}},
    {name:'Noise wind',p:{m1on:false,m2on:false,m3on:false,mn:7,ncol:'pink',cut:900,emph:8,cont:4,fa:1.5,fd:3,fs:4,la:1,ld:3,ls:8,decsw:true,o3range:-7,o3kbd:false,modamt:.4,filtmod:true}}
  ],
  build(ctx,dest){
    const f=factory(ctx),W=waves(ctx);
    const o=[0,1,2].map(()=>{const x=f.osc({frequency:110});x.setPeriodicWave(W.saw);f.bend(x);return x});
    const og=o.map(x=>{const g=f.gain(0);x.connect(g);return g});
    const nz=f.noise(),pk=f.bq({type:'lowpass',frequency:1100,Q:.3}),nW=f.gain(1),nP=f.gain(0),ng=f.gain(0);
    nz.connect(nW);nz.connect(pk);pk.connect(nP);nW.connect(ng);nP.connect(ng);
    const sum=f.gain(.28),drv=f.shaper(tanhCurve(2.2));og.forEach(g=>g.connect(sum));ng.connect(sum);sum.connect(drv);
    const L=ladder(f);drv.connect(L.in);const vca=f.gain(0),vol=f.gain(.4);L.out.connect(vca);vca.connect(vol);vol.connect(dest);
    const t3=f.gain(1),tN=f.gain(0),ms=f.gain(1),ma=f.gain(0),mO=f.gain(0),mF=f.gain(0);
    o[2].connect(t3);nz.connect(tN);t3.connect(ms);tN.connect(ms);ms.connect(ma);ma.connect(mO);ma.connect(mF);mO.connect(o[0].detune);mO.connect(o[1].detune);L.mod(mF);
    const st=monoStack();let cur=48,played=false;
    const freqs=(n,t,glide)=>{for(let i=0;i<3;i++){const k=i+1,rng=S['o'+k+'range'],off=i?S['o'+k+'freq']:0;const base=(k===3&&!S.o3kbd?mtof(48):mtof(n))*Math.pow(2,S.tune/1200);const fr=base*Math.pow(2,rng)*Math.pow(2,off/12);const p=o[i].frequency;
      if(glide&&S.glide>.002&&!(k===3&&!S.o3kbd)){hold(p,t);p.setTargetAtTime(fr,t,S.glide/3)}else{p.cancelScheduledValues(t);p.setValueAtTime(fr,t)}}
      L.freq(S.cut*Math.pow(2,(n-60)/12*S.kbd),t)};
    const gateOn=(t,vel)=>{envOn(vca.gain,t,velPeak(vel),S.la,S.ld,S.ls/10);L.det.forEach(p=>envOn(p,t,S.cont/10*4800,S.fa,S.fd,S.fs/10))};
    const gateOff=t=>{envOff(vca.gain,t,S.decsw?S.ld:.012);L.det.forEach(p=>envOff(p,t,S.decsw?S.fd:.012))};
    f.start();freqs(48,ctx.currentTime,false);
    return{
      noteOn(n,vel,at){const t=at===undefined?ctx.currentTime:at,leg=st.on(n);freqs(n,t,played);played=true;cur=n;if(!leg)gateOn(t,vel)},
      noteOff(n,at){const t=at===undefined?ctx.currentTime:at,nx=st.off(n);if(nx===null)return;if(nx!==undefined){cur=nx;freqs(nx,t,true)}else gateOff(t)},
      allOff(){st.clear();gateOff(ctx.currentTime)},
      set(id,v){const t=ctx.currentTime;
        if(/^o\dwave$/.test(id)){o[+id[1]-1].setPeriodicWave(W[v]);return}
        if(/^o\d(range|freq|kbd)$/.test(id)||id==='tune'){freqs(cur,t,false);return}
        if(/^m\d(on)?$/.test(id)){const i=+id[1];tgt(og[i-1].gain,S['m'+i+'on']?Math.pow(S['m'+i]/10,2):0,t);return}
        switch(id){
          case 'mn':tgt(ng.gain,Math.pow(v/10,2)*.9,t);break;
          case 'ncol':tgt(nW.gain,v==='white'?1:0,t);tgt(nP.gain,v==='pink'?2.2:0,t);break;
          case 'cut':case 'kbd':L.freq(S.cut*Math.pow(2,(cur-60)/12*S.kbd),t);break;
          case 'emph':L.res(v/10*.94,t);break;
          case 'modmix':tgt(t3.gain,1-v,t);tgt(tN.gain,v,t);break;
          case 'modamt':tgt(ma.gain,v,t);break;
          case 'oscmod':tgt(mO.gain,v?1200:0,t);break;
          case 'filtmod':tgt(mF.gain,v?4200:0,t);break;
          case 'vol':tgt(vol.gain,Math.pow(v/10,2)*.8,t);break;
        }},
      dispose(){f.dispose()}
    };
  }
};

/* ---------- 1978 Five-voice programmable poly ---------- */
DEFS.prog5={
  year:1978, plate:'FIVE-VOICE POLY', sub:'two oscillators per voice · poly-mod · memory', name:'1978 · Five-Voice Poly', theme:'th-prog5', wood:true,
  era:'<b>Polyphony you could save.</b> Five complete voices under a microprocessor, so a sound became something you could store and recall. Poly-mod let one oscillator or the filter envelope bend another for bells and growls.',
  hint:'Try "Poly-mod bell": Osc B is set as a modulator, not a sound, and it bends Osc A. Turn up Osc B amt in Poly-mod and listen to the metal appear.',
  params:{
    pmenv:{t:'k',l:'Filt env amt',min:0,max:1,v:0,fmt:pct}, pmoscb:{t:'k',l:'Osc B amt',min:0,max:1,v:0,fmt:pct},
    pmfreq:{t:'t',l:'Freq A',v:false}, pmpw:{t:'t',l:'PW A',v:false}, pmfilt:{t:'t',l:'Filter',v:false},
    lfofreq:{t:'k',l:'Freq',min:.05,max:20,log:true,v:5,fmt:hz}, lfoshape:{t:'c',l:'Shape',o:[['triangle','Tri'],['sawtooth','Saw'],['square','Sq']],v:'triangle'}, lfoamt:{t:'k',l:'Wheel amt',min:0,max:1,v:0,fmt:pct},
    lfofa:{t:'t',l:'Freq A',v:false}, lfofb:{t:'t',l:'Freq B',v:false}, lfopwa:{t:'t',l:'PW A',v:false}, lfopwb:{t:'t',l:'PW B',v:false}, lfofilt:{t:'t',l:'Filter',v:false},
    oafreq:{t:'k',l:'Freq',min:-24,max:24,step:1,v:0,fmt:stI}, oasaw:{t:'t',l:'Saw',v:true}, oapul:{t:'t',l:'Pulse',v:false}, oapw:{t:'k',l:'PW',min:.05,max:.95,v:.5,fmt:pct},
    obfreq:{t:'k',l:'Freq',min:-24,max:24,step:1,v:0,fmt:stI}, obfine:{t:'k',l:'Fine',min:-50,max:50,v:8,fmt:ct}, obsaw:{t:'t',l:'Saw',v:true}, obtri:{t:'t',l:'Tri',v:false}, obpul:{t:'t',l:'Pulse',v:false}, obpw:{t:'k',l:'PW',min:.05,max:.95,v:.5,fmt:pct}, oblo:{t:'t',l:'Lo freq',v:false}, obkbd:{t:'t',l:'Kbd',v:true},
    mixa:{t:'k',l:'Osc A',min:0,max:1,v:.8,fmt:pct}, mixb:{t:'k',l:'Osc B',min:0,max:1,v:.65,fmt:pct}, mixn:{t:'k',l:'Noise',min:0,max:1,v:0,fmt:pct},
    cut:{t:'k',l:'Cutoff',min:30,max:16000,log:true,v:900,fmt:hz}, res:{t:'k',l:'Resonance',min:0,max:1,v:.15,fmt:pct}, fenv:{t:'k',l:'Env amt',min:0,max:1,v:.5,fmt:pct}, fkbd:{t:'c',l:'Keyboard',o:[[0,'Off'],[.5,'Half'],[1,'Full']],v:.5},
    fa:{t:'k',l:'Attack',min:.001,max:8,log:true,v:.08,fmt:tm}, fd:{t:'k',l:'Decay',min:.005,max:8,log:true,v:.6,fmt:tm}, fs:{t:'k',l:'Sustain',min:0,max:1,v:.5,fmt:pct}, fr:{t:'k',l:'Release',min:.005,max:8,log:true,v:.3,fmt:tm},
    aa:{t:'k',l:'Attack',min:.001,max:8,log:true,v:.05,fmt:tm}, ad:{t:'k',l:'Decay',min:.005,max:8,log:true,v:.4,fmt:tm}, as:{t:'k',l:'Sustain',min:0,max:1,v:.85,fmt:pct}, ar:{t:'k',l:'Release',min:.005,max:8,log:true,v:.3,fmt:tm},
    glide:{t:'k',l:'Glide',min:0,max:1,v:0,fmt:tm}, unison:{t:'t',l:'Unison',v:false}, vol:{t:'k',l:'Volume',min:0,max:1,v:.7,fmt:pct}
  },
  sections:[
    {title:'Poly-mod',ids:['pmenv','pmoscb','pmfreq','pmpw','pmfilt']},
    {title:'LFO',ids:['lfofreq','lfoshape','lfoamt','lfofa','lfofb','lfopwa','lfopwb','lfofilt']},
    {title:'Oscillator A',ids:['oafreq','oapw','oasaw','oapul']},
    {title:'Oscillator B',ids:['obfreq','obfine','obpw','obsaw','obtri','obpul','oblo','obkbd']},
    {title:'Mixer',ids:['mixa','mixb','mixn']},
    {title:'Filter',ids:['cut','res','fenv','fkbd']},
    {title:'Filter envelope',ids:['fa','fd','fs','fr']},
    {title:'Amplifier envelope',ids:['aa','ad','as','ar']},
    {title:'Performance',ids:['glide','unison','vol']}
  ],
  cc:['cut','res','fenv','fd','fs','pmenv','pmoscb','obfine'], wheel:'lfoamt', poly:true,
  patterns:[
    riff('Chord progression',48,92,chords([[[0,3,7],4,1],[[0,3,8],4,1],[[2,5,10],4,1],[[2,7,11],4,1]])),
    riff('Arpeggio',48,112,pat([0,3,7,12,0,3,8,12,2,5,10,12,2,7,11,7].map((n,i)=>[n,0,i%4===0?1:0,0]))),
    riff('Offbeat stabs',48,120,pat([null,null,{c:[3,7,10],acc:1},null,null,null,{c:[3,7,10]},null,null,null,{c:[3,7,10],acc:1},null,null,null,{c:[2,5,10]},{c:[2,5,10]}]))
  ],
  presets:[
    {name:'Poly brass',p:{}},
    {name:'Poly-mod bell',p:{pmoscb:.45,pmfreq:true,obfreq:19,obsaw:false,obtri:true,mixb:0,mixa:.9,cut:5000,res:.05,fenv:.15,fa:.001,fd:2,fs:0,aa:.002,ad:2.6,as:0,ar:1.6}},
    {name:'Soft pad',p:{oasaw:false,oapul:true,oapw:.35,lfopwa:true,lfoamt:.45,lfofreq:.4,cut:1300,res:.1,fenv:.25,fa:1.2,fd:2,fs:.7,fr:2,aa:1,ad:2,as:.75,ar:2.2}},
    {name:'Unison lead',p:{unison:true,glide:.07,cut:1500,res:.35,fenv:.45,fa:.005,fd:.5,fs:.4,aa:.005,ad:.3,as:.9,ar:.2,obfine:14}},
    {name:'Growl',p:{pmenv:.5,pmfreq:true,pmfilt:true,oafreq:-12,obfreq:-12,cut:350,res:.45,fenv:.55,fa:.01,fd:.35,fs:.2}}
  ],
  build(ctx,dest){
    const f=factory(ctx);
    const lfo=f.osc({type:'triangle',frequency:5}),lfoA=f.gain(0);lfo.connect(lfoA);
    const lFA=f.gain(0),lFB=f.gain(0),lPA=f.gain(0),lPB=f.gain(0),lFl=f.gain(0);[lFA,lFB,lPA,lPB,lFl].forEach(g=>lfoA.connect(g));
    const pwA=f.cs(0),pwB=f.cs(0),nz=f.noise(),bus=f.gain(.22),vol=f.gain(.7);bus.connect(vol);vol.connect(dest);
    const cmp=tanhCurve(40);
    const voices=Array.from({length:5},()=>{
      const sA=f.osc({type:'sawtooth'}),sB=f.osc({type:'sawtooth'}),tB=f.osc({type:'triangle'});f.bend(sA);f.bend(sB);f.bend(tB);
      const aSaw=f.gain(0),aPw=f.gain(1),aC=f.shaper(cmp),aPul=f.gain(0),aOut=f.gain(1);
      sA.connect(aSaw);sA.connect(aPw);pwA.connect(aPw);lPA.connect(aPw);aPw.connect(aC);aC.connect(aPul);aSaw.connect(aOut);aPul.connect(aOut);
      const bSaw=f.gain(0),bTri=f.gain(0),bPw=f.gain(1),bC=f.shaper(cmp),bPul=f.gain(0),bOut=f.gain(1);
      sB.connect(bSaw);tB.connect(bTri);sB.connect(bPw);pwB.connect(bPw);lPB.connect(bPw);bPw.connect(bC);bC.connect(bPul);[bSaw,bTri,bPul].forEach(g=>g.connect(bOut));
      const mA=f.gain(0),mB=f.gain(0),mN=f.gain(0),mix=f.gain(.5);aOut.connect(mA);bOut.connect(mB);nz.connect(mN);[mA,mB,mN].forEach(g=>g.connect(mix));
      const L=ladder(f),vca=f.gain(0);mix.connect(L.in);L.out.connect(vca);vca.connect(bus);
      const fe=f.cs(0),feF=f.gain(0);fe.connect(feF);L.mod(feF);
      const pEF=f.gain(0),pEP=f.gain(0),pEL=f.gain(0),pBF=f.gain(0),pBP=f.gain(0),pBL=f.gain(0);
      [pEF,pEP,pEL].forEach(g=>fe.connect(g));[pBF,pBP,pBL].forEach(g=>bOut.connect(g));
      pEF.connect(sA.detune);pBF.connect(sA.detune);pEP.connect(aPw);pBP.connect(aPw);L.mod(pEL);L.mod(pBL);
      lFA.connect(sA.detune);lFB.connect(sB.detune);lFB.connect(tB.detune);L.mod(lFl);
      return{sA,sB,tB,aSaw,aPul,bSaw,bTri,bPul,mA,mB,mN,L,vca,fe,feF,pEF,pEP,pEL,pBF,pBP,pBL,note:-1,gate:false,t:0,last:null};
    });
    const al=alloc(voices),st=monoStack();
    const each=fn=>voices.forEach(fn);
    const freq=(v,n,t)=>{const fa=mtof(n+S.oafreq);let fb=(S.obkbd?mtof(n+S.obfreq):mtof(48+S.obfreq))*Math.pow(2,S.obfine/1200);if(S.oblo)fb*=Math.pow(2,-7);
      const set=(p,fr)=>{if(S.glide>.002&&v.last!==null){hold(p,t);p.setTargetAtTime(fr,t,S.glide/3)}else{p.cancelScheduledValues(t);p.setValueAtTime(fr,t)}};
      set(v.sA.frequency,fa);set(v.sB.frequency,fb);set(v.tB.frequency,fb);v.last=n;v.L.freq(S.cut*Math.pow(2,(n-60)/12*S.fkbd),t)};
    const gOn=(v,t,vel)=>{envOn(v.fe.offset,t,1,S.fa,S.fd,S.fs);envOn(v.vca.gain,t,velPeak(vel),S.aa,S.ad,S.as)};
    const gOff=(v,t)=>{envOff(v.fe.offset,t,S.fr);envOff(v.vca.gain,t,S.ar)};
    const spread=()=>each((v,i)=>{const d=S.unison?(i-2)*7:0;v.sA.detune.value=d;v.sB.detune.value=d;v.tB.detune.value=d});
    f.start();
    return{
      noteOn(n,vel,at){const t=at===undefined?ctx.currentTime:at;if(S.unison){const leg=st.on(n);each(v=>{freq(v,n,t);if(!leg)gOn(v,t,vel)})}else{const v=al.on(n);freq(v,n,t);gOn(v,t,vel)}},
      noteOff(n,at){const t=at===undefined?ctx.currentTime:at;if(S.unison){const nx=st.off(n);if(nx===null)return;if(nx!==undefined)each(v=>freq(v,nx,t));else each(v=>gOff(v,t))}else{const v=al.off(n);if(v)gOff(v,t)}},
      allOff(){st.clear();const t=ctx.currentTime;each(v=>{v.gate=false;gOff(v,t)})},
      set(id,v){const t=ctx.currentTime;
        switch(id){
          case 'lfofreq':tgt(lfo.frequency,v,t);break; case 'lfoshape':lfo.type=v;break; case 'lfoamt':tgt(lfoA.gain,v,t);break;
          case 'lfofa':tgt(lFA.gain,v?700:0,t);break; case 'lfofb':tgt(lFB.gain,v?700:0,t);break;
          case 'lfopwa':tgt(lPA.gain,v?.8:0,t);break; case 'lfopwb':tgt(lPB.gain,v?.8:0,t);break; case 'lfofilt':tgt(lFl.gain,v?3600:0,t);break;
          case 'oapw':tgt(pwA.offset,2*v-1,t);break; case 'obpw':tgt(pwB.offset,2*v-1,t);break;
          case 'oasaw':each(x=>tgt(x.aSaw.gain,v?.6:0,t));break; case 'oapul':each(x=>tgt(x.aPul.gain,v?.5:0,t));break;
          case 'obsaw':each(x=>tgt(x.bSaw.gain,v?.6:0,t));break; case 'obtri':each(x=>tgt(x.bTri.gain,v?.8:0,t));break; case 'obpul':each(x=>tgt(x.bPul.gain,v?.5:0,t));break;
          case 'mixa':each(x=>tgt(x.mA.gain,v*v,t));break; case 'mixb':each(x=>tgt(x.mB.gain,v*v,t));break; case 'mixn':each(x=>tgt(x.mN.gain,v*v*.6,t));break;
          case 'res':each(x=>x.L.res(v*.93,t));break; case 'fenv':each(x=>tgt(x.feF.gain,v*6000,t));break;
          case 'cut':case 'fkbd':each(x=>x.L.freq(S.cut*Math.pow(2,((x.last===null?60:x.last)-60)/12*S.fkbd),t));break;
          case 'pmenv':case 'pmoscb':case 'pmfreq':case 'pmpw':case 'pmfilt':each(x=>{
            tgt(x.pEF.gain,S.pmfreq?S.pmenv*4800:0,t);tgt(x.pEP.gain,S.pmpw?S.pmenv*.9:0,t);tgt(x.pEL.gain,S.pmfilt?S.pmenv*4800:0,t);
            tgt(x.pBF.gain,S.pmfreq?S.pmoscb*2400:0,t);tgt(x.pBP.gain,S.pmpw?S.pmoscb*.9:0,t);tgt(x.pBL.gain,S.pmfilt?S.pmoscb*4800:0,t)});break;
          case 'unison':this.allOff();spread();break;
          case 'vol':tgt(vol.gain,v*v,t);break;
        }},
      dispose(){f.dispose()}
    };
  }
};

/* ---------- 1981 Acid bass line ---------- */
// pattern steps: null = rest, [note, up, accent, slide] = one note, {c:[notes], acc, sl, up} = a chord; notes are semitones 0-12 above the pattern root
function pat(a){return a.map(s=>!s?{notes:[],up:false,acc:false,sl:false}:Array.isArray(s)?{notes:[s[0]],up:!!s[1],acc:!!s[2],sl:!!s[3]}:{notes:s.c.slice(),up:!!s.up,acc:!!s.acc,sl:!!s.sl})}
// held chords: [[notes] or null, steps, accent] -> tied steps
function chords(list){const out=[];list.forEach(([c,len,acc])=>{for(let i=0;i<len;i++)out.push(c?{c,sl:i<len-1,acc:!!acc&&i===0}:null)});return pat(out)}
function riff(name,root,tempo,steps){return {name,root,tempo,steps}}
const PAT_A=pat([[0,0,1,0],[0,0,0,0],[12,0,0,1],[0,0,0,0],[3,0,1,0],null,[0,0,0,1],[7,0,0,0],[0,0,1,0],[10,0,0,1],[12,0,0,0],[0,0,0,0],[3,1,1,0],[0,0,0,1],[5,0,0,0],[7,0,1,0]]);
const PAT_B=pat([[0,0,1,0],[0,0,0,1],[0,1,0,0],null,[5,0,0,0],[5,0,1,1],[7,0,0,0],null,[0,0,1,0],[0,0,0,0],[3,0,0,1],[2,0,0,0],[0,1,1,0],null,[10,0,0,1],[0,0,0,0]]);
const PAT_C=pat([[0,0,1,1],[3,0,0,1],[5,0,0,1],[7,0,1,0],[0,0,0,0],[0,1,0,1],[10,0,0,0],[0,0,1,0],[0,0,0,1],[3,0,0,0],[0,0,1,1],[12,0,0,0],[0,0,0,0],[7,0,1,1],[5,0,0,1],[3,0,0,0]]);
DEFS.acid={
  year:1981, plate:'ACID BASS LINE', sub:'one oscillator · step sequencer · accent and slide', name:'1981 · Acid Bass Line', theme:'th-acid',
  era:'<b>Built to replace a bass player, adopted by a genre.</b> One oscillator, a resonant filter, and a 16-step sequencer with accent and slide. Pushed to extremes, it gave dance music the acid squelch.',
  hint:'Press Run, then slowly turn Cutoff, Resonance and Env mod while it plays. Accented steps hit the filter harder; slid steps glide into the next note.',
  params:{
    wave:{t:'c',l:'Waveform',o:[['sawtooth','Saw'],['square','Square']],v:'sawtooth'}, tune:{t:'k',l:'Tuning',min:-12,max:12,step:1,v:0,fmt:stI},
    cut:{t:'k',l:'Cutoff',min:60,max:6000,log:true,v:420,fmt:hz}, res:{t:'k',l:'Resonance',min:0,max:1,v:.75,fmt:pct}, env:{t:'k',l:'Env mod',min:0,max:1,v:.55,fmt:pct},
    dec:{t:'k',l:'Decay',min:.08,max:2.5,log:true,v:.45,fmt:tm}, acc:{t:'k',l:'Accent',min:0,max:1,v:.6,fmt:pct},
    vol:{t:'k',l:'Volume',min:0,max:1,v:.75,fmt:pct}
  },
  sections:[{title:'Voice',ids:['wave','tune']},{title:'Filter',ids:['cut','res','env','dec','acc']},{title:'Out',ids:['vol']}],
  cc:['cut','res','env','dec','acc','tune','vol'], wheel:'env',
  presets:[{name:'Classic',p:{}},{name:'Darker',p:{cut:300,res:.82,env:.7,dec:.3}},{name:'Squelch',p:{wave:'square',cut:250,res:.9,env:.8,dec:.6,acc:.9}}],
  patterns:[riff('Pattern A',36,124,PAT_A),riff('Pattern B',36,132,PAT_B),riff('Pattern C',36,118,PAT_C)],
  build(ctx,dest){
    const f=factory(ctx),osc=f.osc({type:'sawtooth',frequency:65}),L=ladder(f),vca=f.gain(0),drv=f.shaper(tanhCurve(1.4)),vol=f.gain(.6);f.bend(osc);
    osc.connect(L.in);L.out.connect(vca);vca.connect(drv);drv.connect(vol);vol.connect(dest);
    const st=monoStack();
    const trig=(fr,t,acc,slide)=>{const p=osc.frequency;if(slide){hold(p,t);p.setTargetAtTime(fr,t,.022)}else{p.cancelScheduledValues(t);p.setValueAtTime(fr,t)}
      if(slide)return;const peak=S.env*4200+(acc?S.acc*2600:0),dk=S.dec*(acc?.4:1);
      L.det.forEach(d=>{hold(d,t);d.linearRampToValueAtTime(peak,t+.003);d.setTargetAtTime(0,t+.003,dk/3)});
      const g=vca.gain;hold(g,t);g.linearRampToValueAtTime(acc?.95+S.acc*.35:.7,t+.003);g.setTargetAtTime(acc?.7:.55,t+.003,.35)};
    const rel=t=>{hold(vca.gain,t);vca.gain.setTargetAtTime(0,t,.008)};
    f.start();
    return{
      noteOn(n,vel,at){const t=at===undefined?ctx.currentTime:at,leg=st.on(n);trig(mtof(n+S.tune),t,(vel||0)>=120,leg)},
      noteOff(n,at){const t=at===undefined?ctx.currentTime:at,nx=st.off(n);if(nx===null)return;if(nx!==undefined)trig(mtof(nx+S.tune),t,false,true);else rel(t)},
      allOff(){st.clear();rel(ctx.currentTime)},
      set(id,v){const t=ctx.currentTime;switch(id){case 'wave':osc.type=v;break;case 'cut':L.freq(v,t);break;case 'res':L.res(v*.97,t);break;case 'vol':tgt(vol.gain,v*v*.9,t);break}},
      dispose(){f.dispose()}
    };
  }
};

/* ---------- 1982 Six-voice chorus poly ---------- */
const SC=['#86b29a','#d48f7e','#d8b85c','#7f9dcc','#b494c9','#9aa0a8'];
DEFS.poly6={
  year:1982, plate:'CHORUS POLY · SIX', sub:'stable DCOs · one filter per voice · stereo chorus', name:'1982 · Six-Voice Chorus Poly', theme:'th-poly6',
  era:'<b>Polyphony got affordable.</b> Digitally controlled oscillators stayed in tune, one slider did one job, and a built-in stereo chorus made a single oscillator sound like an ensemble.',
  hint:'Play a chord, then switch Chorus between Off, I and II. Raise PWM with the LFO as source and the pulse wave starts to shimmer.',
  params:{
    lforate:{t:'f',l:'Rate',min:.1,max:20,log:true,v:.8,fmt:hz}, lfodelay:{t:'f',l:'Delay',min:0,max:3,v:.3,fmt:tm},
    range:{t:'c',l:'Range',o:[[-1,"16'"],[0,"8'"],[1,"4'"]],v:0},
    dcolfo:{t:'f',l:'LFO',min:0,max:1,v:0,fmt:pct}, dcopwm:{t:'f',l:'PWM',min:0,max:1,v:.45,fmt:pct}, pwmsrc:{t:'c',l:'PWM src',o:[['lfo','LFO'],['man','Man']],v:'lfo'},
    pulse:{t:'t',l:'Pulse',v:true}, saw:{t:'t',l:'Saw',v:true}, sub:{t:'f',l:'Sub',min:0,max:1,v:.35,fmt:pct}, noise:{t:'f',l:'Noise',min:0,max:1,v:0,fmt:pct},
    hpf:{t:'c',l:'HPF',o:[[0,'0'],[1,'1'],[2,'2'],[3,'3']],v:1},
    vcffreq:{t:'f',l:'Freq',min:30,max:16000,log:true,v:1400,fmt:hz}, vcfres:{t:'f',l:'Res',min:0,max:1,v:.15,fmt:pct}, envpol:{t:'c',l:'Env',o:[[1,'+'],[-1,'−']],v:1},
    vcfenv:{t:'f',l:'Env',min:0,max:1,v:.25,fmt:pct}, vcflfo:{t:'f',l:'LFO',min:0,max:1,v:0,fmt:pct}, vcfkbd:{t:'f',l:'Kybd',min:0,max:1,v:.5,fmt:pct},
    vcamode:{t:'c',l:'VCA',o:[['env','Env'],['gate','Gate']],v:'env'}, vcalevel:{t:'f',l:'Level',min:0,max:1,v:.75,fmt:pct},
    a:{t:'f',l:'A',min:.001,max:3,log:true,v:.6,fmt:tm}, d:{t:'f',l:'D',min:.005,max:10,log:true,v:1.6,fmt:tm}, s:{t:'f',l:'S',min:0,max:1,v:.7,fmt:pct}, r:{t:'f',l:'R',min:.005,max:10,log:true,v:1.4,fmt:tm},
    chorus:{t:'c',l:'Chorus',o:[['off','Off'],['I','I'],['II','II'],['I+II','I+II']],v:'I'}
  },
  sections:[
    {title:'LFO',c:SC[0],ids:['lforate','lfodelay']},
    {title:'DCO',c:SC[1],ids:['range','dcolfo','dcopwm','pwmsrc','pulse','saw','sub','noise']},
    {title:'HPF',c:SC[2],ids:['hpf']},
    {title:'VCF',c:SC[3],ids:['vcffreq','vcfres','envpol','vcfenv','vcflfo','vcfkbd']},
    {title:'VCA',c:SC[4],ids:['vcamode','vcalevel']},
    {title:'ENV',c:SC[2],ids:['a','d','s','r']},
    {title:'Chorus',c:SC[5],ids:['chorus']}
  ],
  cc:['vcffreq','vcfres','vcfenv','vcflfo','a','d','s','r'], wheel:'dcolfo', poly:true,
  patterns:[
    riff('Pad chords',48,84,chords([[[0,4,7,11],4,1],[[2,5,9,12],4,1],[[0,4,9],4,1],[[2,7,11],4,1]])),
    riff('House stabs',48,122,pat([null,null,{c:[0,3,7,10],acc:1},null,null,null,{c:[0,3,7,10]},null,null,null,{c:[0,3,7,10],acc:1},null,null,null,{c:[2,5,9,12]},null])),
    riff('Strings swell',48,70,chords([[[0,7,12],8,1],[[3,7,10],8,1]]))
  ],
  presets:[
    {name:'Warm pad',p:{}},
    {name:'Brass stab',p:{pulse:false,sub:.2,dcopwm:0,vcffreq:500,vcfenv:.55,vcfres:.1,a:.03,d:.5,s:.4,r:.25,chorus:'II'}},
    {name:'Strings',p:{pulse:false,sub:0,vcffreq:3200,vcfres:0,vcfenv:.05,a:1.2,d:1,s:.9,r:1.6,chorus:'I+II',dcolfo:.06,lforate:5.5,lfodelay:.8}},
    {name:'Bass',p:{range:-1,saw:false,pwmsrc:'man',dcopwm:.35,sub:.75,vcffreq:380,vcfenv:.45,vcfres:.2,a:.002,d:.3,s:.3,r:.12,chorus:'off',hpf:0}},
    {name:'Organ',p:{pulse:true,saw:false,pwmsrc:'man',dcopwm:0,sub:.6,vcffreq:5000,vcfenv:0,vcamode:'gate',chorus:'II',hpf:2}}
  ],
  build(ctx,dest){
    const f=factory(ctx);
    const lfo=f.osc({type:'triangle',frequency:1}),lfoD=f.gain(1);lfo.connect(lfoD);
    const lP=f.gain(0),lW=f.gain(0),lF=f.gain(0);[lP,lW,lF].forEach(g=>lfoD.connect(g));
    const pwM=f.cs(0),nz=f.noise(),bus=f.gain(.2);
    const shelf=f.bq({type:'lowshelf',frequency:110,gain:0}),hp=f.bq({type:'highpass',frequency:20,Q:.5});bus.connect(shelf);shelf.connect(hp);
    const dry=f.gain(1),dl=f.delay(.03),dr=f.delay(.03),cl=f.osc({type:'triangle',frequency:.5}),cd=f.gain(0),ci=f.gain(-1),wl=f.gain(0),wr=f.gain(0),mg=f.merger(2),out=f.gain(1);
    dl.delayTime.value=.0035;dr.delayTime.value=.0035;hp.connect(dry);hp.connect(dl);hp.connect(dr);cl.connect(cd);cd.connect(dl.delayTime);cd.connect(ci);ci.connect(dr.delayTime);
    dl.connect(wl);dr.connect(wr);dry.connect(mg,0,0);dry.connect(mg,0,1);wl.connect(mg,0,0);wr.connect(mg,0,1);mg.connect(out);out.connect(dest);
    const cmp=tanhCurve(40);
    const voices=Array.from({length:6},()=>{
      const saw=f.osc({type:'sawtooth'}),sub=f.osc({type:'square'});f.bend(saw);f.bend(sub);
      const sG=f.gain(0),pw=f.gain(1),c=f.shaper(cmp),pG=f.gain(0),uG=f.gain(0),nG=f.gain(0),mix=f.gain(.5);
      saw.connect(sG);saw.connect(pw);pwM.connect(pw);lW.connect(pw);pw.connect(c);c.connect(pG);sub.connect(uG);nz.connect(nG);[sG,pG,uG,nG].forEach(g=>g.connect(mix));
      const L=ladder(f),vca=f.gain(0);mix.connect(L.in);L.out.connect(vca);vca.connect(bus);lP.connect(saw.detune);lP.connect(sub.detune);L.mod(lF);
      return{saw,sub,sG,pG,uG,nG,L,vca,note:-1,gate:false,t:0};
    });
    const al=alloc(voices),each=fn=>voices.forEach(fn);
    f.start();
    return{
      noteOn(n,vel,at){const t=at===undefined?ctx.currentTime:at;if(!voices.some(v=>v.gate)){hold(lfoD.gain,t);lfoD.gain.setValueAtTime(0,t);lfoD.gain.linearRampToValueAtTime(1,t+S.lfodelay+.001)}
        const v=al.on(n),fr=mtof(n)*Math.pow(2,S.range);v.saw.frequency.setValueAtTime(fr,t);v.sub.frequency.setValueAtTime(fr/2,t);
        v.L.freq(S.vcffreq*Math.pow(2,(n-60)/12*S.vcfkbd),t);
        if(S.vcamode==='gate')envOn(v.vca.gain,t,velPeak(vel),.002,.01,1);else envOn(v.vca.gain,t,velPeak(vel),S.a,S.d,S.s);
        v.L.det.forEach(p=>envOn(p,t,S.envpol*S.vcfenv*6000,S.a,S.d,S.s))},
      noteOff(n,at){const t=at===undefined?ctx.currentTime:at,v=al.off(n);if(!v)return;envOff(v.vca.gain,t,S.vcamode==='gate'?.01:S.r);v.L.det.forEach(p=>envOff(p,t,S.r))},
      allOff(){const t=ctx.currentTime;each(v=>{v.gate=false;envOff(v.vca.gain,t,.05)})},
      set(id,v){const t=ctx.currentTime;
        switch(id){
          case 'lforate':tgt(lfo.frequency,v,t);break;
          case 'dcolfo':tgt(lP.gain,v*v*300,t);break;
          case 'dcopwm':case 'pwmsrc':tgt(lW.gain,S.pwmsrc==='lfo'?S.dcopwm*.85:0,t);tgt(pwM.offset,S.pwmsrc==='man'?S.dcopwm*.85:0,t);break;
          case 'pulse':each(x=>tgt(x.pG.gain,v?.5:0,t));break; case 'saw':each(x=>tgt(x.sG.gain,v?.6:0,t));break;
          case 'sub':each(x=>tgt(x.uG.gain,v*.55,t));break; case 'noise':each(x=>tgt(x.nG.gain,v*v*.45,t));break;
          case 'hpf':tgt(shelf.gain,v===0?6:0,t);tgt(hp.frequency,[20,20,230,620][v],t);break;
          case 'vcffreq':case 'vcfkbd':each(x=>x.L.freq(S.vcffreq*Math.pow(2,((x.note<0?60:x.note)-60)/12*S.vcfkbd),t));break;
          case 'vcfres':each(x=>x.L.res(v*.92,t));break;
          case 'vcflfo':tgt(lF.gain,v*3600,t);break;
          case 'vcalevel':tgt(bus.gain,v*v*.3,t);break;
          case 'chorus':{const m={off:[0,0,0],I:[.513,.0018,.75],II:[.863,.0018,.75],'I+II':[9.75,.00035,.65]}[v];tgt(cl.frequency,m[0]||.5,t);tgt(cd.gain,m[1],t);tgt(wl.gain,m[2],t);tgt(wr.gain,m[2],t);tgt(dry.gain,v==='off'?1:.8,t);break}
        }},
      dispose(){f.dispose()}
    };
  }
};

/* ---------- 1983 Six-operator FM ---------- */
const ALGS={
  1:{e:[[2,1],[4,3],[5,4],[6,5]],c:[1,3],fb:6,pos:{1:[0,0],2:[0,1],3:[1,0],4:[1,1],5:[1,2],6:[1,3]}},
  2:{e:[[2,1],[4,3],[5,4],[6,5]],c:[1,3],fb:2,pos:{1:[0,0],2:[0,1],3:[1,0],4:[1,1],5:[1,2],6:[1,3]}},
  5:{e:[[2,1],[4,3],[6,5]],c:[1,3,5],fb:6,pos:{1:[0,0],2:[0,1],3:[1,0],4:[1,1],5:[2,0],6:[2,1]}},
  7:{e:[[2,1],[4,3],[5,3],[6,5]],c:[1,3],fb:6,pos:{1:[0,0],2:[0,1],3:[1,0],4:[1,1],5:[2,1],6:[2,2]}},
  16:{e:[[2,1],[3,1],[4,3],[5,1],[6,5]],c:[1],fb:6,pos:{1:[1,0],2:[0,1],3:[1,1],4:[1,2],5:[2,1],6:[2,2]}},
  19:{e:[[2,1],[3,2],[6,4],[6,5]],c:[1,4,5],fb:6,pos:{1:[0,0],2:[0,1],3:[0,2],4:[1,0],5:[2,0],6:[1.5,1]}},
  22:{e:[[2,1],[6,3],[6,4],[6,5]],c:[1,3,4,5],fb:6,pos:{1:[0,0],2:[0,1],3:[1,0],4:[2,0],5:[3,0],6:[2,1]}},
  32:{e:[],c:[1,2,3,4,5,6],fb:6,pos:{1:[0,0],2:[1,0],3:[2,0],4:[3,0],5:[4,0],6:[5,0]}}
};
const RATIOS=[.5,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(r=>[r,r===.5?'0.50':r.toFixed(2)]);
const fmParams={alg:{t:'c',l:'Algorithm',o:Object.keys(ALGS).map(k=>[+k,k]),v:5},fb:{t:'k',l:'Feedback',min:0,max:7,step:1,v:3,fmt:v=>v.toFixed(0)},
  lfospd:{t:'k',l:'LFO speed',min:.1,max:12,log:true,v:5.5,fmt:hz},pmd:{t:'k',l:'Vibrato',min:0,max:1,v:0,fmt:pct},vol:{t:'k',l:'Volume',min:0,max:1,v:.7,fmt:pct}};
for(let i=1;i<=6;i++){Object.assign(fmParams,{
  ['r'+i]:{t:'s',l:'Ratio',o:RATIOS,v:1,sm:1},['fi'+i]:{t:'k',l:'Fine',min:0,max:.99,v:0,fmt:v=>'×'+(1+v).toFixed(2),sm:1},['lv'+i]:{t:'k',l:'Level',min:0,max:99,step:1,v:i===1?99:0,fmt:v=>v.toFixed(0),sm:1},
  ['a'+i]:{t:'k',l:'Attack',min:.001,max:10,log:true,v:.002,fmt:tm,sm:1},['d'+i]:{t:'k',l:'Decay',min:.01,max:20,log:true,v:1,fmt:tm,sm:1},['s'+i]:{t:'k',l:'Sustain',min:0,max:1,v:.5,fmt:pct,sm:1},['rl'+i]:{t:'k',l:'Release',min:.01,max:10,log:true,v:.4,fmt:tm,sm:1}})}
function fmP(alg,fb,ops,x){const p=Object.assign({alg,fb},x||{});ops.forEach((o,i)=>{const k=i+1;[p['r'+k],p['fi'+k],p['lv'+k],p['a'+k],p['d'+k],p['s'+k],p['rl'+k]]=o});return p}
DEFS.fm6={
  year:1983, plate:'SIX-OPERATOR FM', sub:'sine waves modulating sine waves · 16 voices on the original', name:'1983 · Six-Op FM', theme:'th-fm6',
  era:'<b>Synthesis went digital.</b> No filter at all. Six sine-wave operators bend each other\'s pitch at audio rate, and the algorithm decides who modulates whom. The bright electric pianos and bells of the decade came from here.',
  hint:'Solid boxes are carriers you hear; outlined boxes are modulators that add harmonics. Raise a modulator\'s Level to add brightness, and shorten its Decay to make the brightness fade like a struck key.',
  params:fmParams,
  cc:['lv2','lv4','lv6','fb','d2','d4','s1','rl1'], wheel:'pmd', poly:true,
  patterns:[
    riff('E-piano chords',48,88,chords([[[0,4,7,11],3,1],[null,1],[[2,5,9,12],3,1],[null,1],[[4,7,11],3,1],[null,1],[[2,7,11],3,1],[null,1]])),
    riff('Bell arpeggio',60,100,pat([0,7,12,4,7,11,12,7,0,5,9,12,2,7,11,7].map((n,i)=>[n,0,i%4===0?1:0,0]))),
    riff('Slap bass',36,108,pat([[0,0,1,0],null,[12,0,0,0],[0,0,0,0],null,[0,0,1,0],[10,0,0,0],[12,0,0,0],[0,0,1,0],null,[7,0,0,0],[0,1,0,0],null,[5,0,1,0],[7,0,0,0],[10,0,0,0]]))
  ],
  presets:[
    {name:'Electric piano',p:fmP(5,3,[[1,0,99,.002,2.6,0,.8],[1,0,72,.002,1.2,0,.6],[1,0,95,.002,2,0,.7],[14,0,56,.001,.25,0,.3],[1,0,80,.002,1.6,0,.6],[1,.01,62,.002,.9,0,.5]])},
    {name:'Bell',p:fmP(5,1,[[1,0,99,.001,6,0,4],[3,.4,74,.001,4,0,3],[2,0,82,.001,5,0,3.5],[5,.4,70,.001,3,0,2.5],[4,0,72,.001,4,0,3],[7,0,55,.001,2,0,2]])},
    {name:'Brass',p:fmP(22,6,[[1,0,99,.06,.6,.8,.25],[1,0,76,.09,.7,.65,.2],[1,0,96,.06,.6,.8,.25],[1,.004,94,.06,.6,.8,.25],[1,.008,92,.06,.6,.8,.25],[1,0,72,.1,.5,.6,.2]],{pmd:.15})},
    {name:'Organ',p:fmP(32,0,[[.5,0,90,.005,.1,1,.08],[1,0,92,.005,.1,1,.08],[2,0,85,.005,.1,1,.08],[3,0,76,.005,.1,1,.08],[4,0,70,.005,.1,1,.08],[8,0,60,.005,.1,1,.08]],{pmd:.2,lfospd:6})},
    {name:'Slap bass',p:fmP(16,5,[[.5,0,99,.002,1.2,.25,.15],[.5,0,82,.001,.4,.1,.1],[1,0,72,.001,.3,0,.1],[3,0,50,.001,.2,0,.1],[1,0,76,.001,.5,.15,.1],[1,0,60,.001,.3,0,.1]])}
  ],
  render(pn){
    const top=document.createElement('div');top.className='fmtop';
    const s1=document.createElement('div');s1.className='sec';s1.innerHTML='<h3>Algorithm</h3>';
    const lcd=document.createElement('div');lcd.className='lcd';lcd.innerHTML='<span class="lt" id="algT"></span><div id="algSvg"></div>';
    const c1=document.createElement('div');c1.className='ctrls';c1.appendChild(ctrl('alg').el);c1.appendChild(ctrl('fb').el);
    s1.appendChild(lcd);s1.appendChild(c1);
    const s2=document.createElement('div');s2.className='sec';s2.innerHTML='<h3>Global</h3>';const c2=document.createElement('div');c2.className='ctrls';['lfospd','pmd','vol'].forEach(id=>c2.appendChild(ctrl(id).el));s2.appendChild(c2);
    top.appendChild(s1);top.appendChild(s2);pn.appendChild(top);
    const sec=document.createElement('div');sec.className='sec';sec.innerHTML='<h3>Operators</h3>';
    const sc=document.createElement('div');sc.className='optable';const g=document.createElement('div');g.className='ops';
    g.innerHTML='<span></span>'+['Ratio','Fine','Level','Attack','Decay','Sustain','Release'].map(h=>`<span class="oh">${h}</span>`).join('');
    for(let i=1;i<=6;i++){const n=document.createElement('div');n.className='on';n.innerHTML=`OP ${i}<span class="badge" id="bd${i}"></span>`;g.appendChild(n);['r','fi','lv','a','d','s','rl'].forEach(k=>g.appendChild(ctrl(k+i).el))}
    sc.appendChild(g);sec.appendChild(sc);pn.appendChild(sec);
    this.onSet('alg');
  },
  onSet(id){if(id!=='alg'&&id!=='fb')return;const A=ALGS[S.alg];if(!$('#algSvg'))return;$('#algSvg').innerHTML=algSvg(S.alg);$('#algT').textContent=`ALGORITHM ${S.alg} · FEEDBACK ${S.fb} ON OP ${A.fb}`;
    for(let i=1;i<=6;i++){const b=$('#bd'+i),c=A.c.includes(i);b.className='badge '+(c?'car':'mod');b.textContent=c?'carrier':'modulator'}},
  build(ctx,dest){
    const f=factory(ctx),W=waves(ctx);
    const fbW=[W.sine];for(let k=1;k<=7;k++)fbW.push(fbWave(ctx,k/7*1.55));
    const lfo=f.osc({type:'sine',frequency:5}),pm=f.gain(0);lfo.connect(pm);
    const bus=f.gain(.3),vol=f.gain(.7);bus.connect(vol);vol.connect(dest);
    const voices=Array.from({length:8},()=>{const out=f.gain(1);out.connect(bus);
      const ops=[0,1,2,3,4,5].map(()=>{const osc=f.osc({type:'sine',frequency:440}),env=f.gain(0),send=f.gain(0);f.bend(osc);osc.connect(env);env.connect(send);pm.connect(osc.detune);return{osc,env,send}});
      return{out,ops,note:-1,gate:false,t:0}});
    const al=alloc(voices);
    const route=v=>{const A=ALGS[S.alg];v.ops.forEach(o=>{try{o.send.disconnect()}catch(e){}});A.e.forEach(([m,c])=>v.ops[m-1].send.connect(v.ops[c-1].osc.frequency));A.c.forEach(c=>v.ops[c-1].send.connect(v.out));
      v.ops.forEach((o,i)=>{if(i+1===A.fb)o.osc.setPeriodicWave(fbW[S.fb]);else o.osc.setPeriodicWave(W.sine)})};
    f.start();voices.forEach(route);
    return{
      noteOn(n,vel,at){const t=at===undefined?ctx.currentTime:at,v=al.on(n),A=ALGS[S.alg],f0=mtof(n),vs=.55+.45*((vel||100)/127);
        v.ops.forEach((o,i)=>{const k=i+1,fr=f0*S['r'+k]*(1+S['fi'+k]),lv=S['lv'+k];o.osc.frequency.cancelScheduledValues(t);o.osc.frequency.setValueAtTime(fr,t);
          const car=A.c.includes(k);const g=lv<=0?0:car?Math.pow(2,(lv-99)/10)/Math.sqrt(A.c.length)*(.6+.4*vs):13*Math.pow(2,(lv-99)/8)*fr*vs;
          o.send.gain.cancelScheduledValues(t);o.send.gain.setValueAtTime(g,t);envOn(o.env.gain,t,1,S['a'+k],S['d'+k],S['s'+k])})},
      noteOff(n,at){const t=at===undefined?ctx.currentTime:at,v=al.off(n);if(!v)return;v.ops.forEach((o,i)=>envOff(o.env.gain,t,S['rl'+(i+1)]))},
      allOff(){const t=ctx.currentTime;voices.forEach(v=>{v.gate=false;v.ops.forEach(o=>envOff(o.env.gain,t,.05))})},
      set(id,v){const t=ctx.currentTime;switch(id){case 'alg':case 'fb':voices.forEach(route);break;case 'lfospd':tgt(lfo.frequency,v,t);break;case 'pmd':tgt(pm.gain,v*45,t);break;case 'vol':tgt(vol.gain,v*v,t);break}},
      dispose(){f.dispose()}
    };
  }
};
function besselJ(n,x){const N=256;let s=0;for(let i=0;i<=N;i++){const tau=Math.PI*i/N,w=(i===0||i===N)?.5:1;s+=w*Math.cos(n*tau-x*Math.sin(tau))}return s/N}
function fbWave(ctx,beta){const H=48,re=new Float32Array(H),im=new Float32Array(H);for(let n=1;n<H;n++)im[n]=2*besselJ(n,n*beta)/(n*beta);return ctx.createPeriodicWave(re,im)}
function algSvg(a){const A=ALGS[a],P=A.pos,bw=34,bh=22,gx=50,gy=40;let mc=0,mr=0;for(const k in P){mc=Math.max(mc,P[k][0]);mr=Math.max(mr,P[k][1])}
  const W=(mc+1)*gx+24,H=(mr+1)*gy+44,cx=k=>12+P[k][0]*gx+gx/2,cy=k=>H-36-P[k][1]*gy;
  let s=`<svg class="alg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Algorithm ${a}">`;
  A.e.forEach(([m,c])=>{s+=`<path class="aline" d="M${cx(m)} ${cy(m)+bh/2}L${cx(c)} ${cy(c)-bh/2}"/>`});
  const xs=A.c.map(cx);s+=`<path class="abus" d="M${Math.min(...xs)-6} ${H-10}H${Math.max(...xs)+6}"/>`;A.c.forEach(c=>{s+=`<path class="aline" d="M${cx(c)} ${cy(c)+bh/2}V${H-10}"/>`});
  const fo=A.fb;s+=`<path class="afb" d="M${cx(fo)+bw/2} ${cy(fo)}h7v${-bh/2-7}h${-bw/2-7}v7"/>`;
  for(const k in P){const car=A.c.includes(+k);s+=`<rect class="${car?'acar':'amod'}" x="${cx(k)-bw/2}" y="${cy(k)-bh/2}" width="${bw}" height="${bh}" rx="3"/><text class="atxt" x="${cx(k)}" y="${cy(k)+4}">${k}</text>`}
  return s+'</svg>'}

const ORDER=['mod','mono3','prog5','acid','poly6','fm6'];

/* ================= controls ================= */
const A0=-135,A1=135;
const pol=(cx,cy,r,a)=>{const t=(a-90)*Math.PI/180;return [cx+r*Math.cos(t),cy+r*Math.sin(t)]};
const arc=(cx,cy,r,a0,a1)=>{const p0=pol(cx,cy,r,a0),p1=pol(cx,cy,r,a1);return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)}A${r} ${r} 0 ${a1-a0>180?1:0} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`};
const UI={};
let D=null,KEY=null,E=null,ctx=null,inBus=null,an=null,learn=false,learnTarget=null,curPreset=0;
const toN=(p,v)=>{if(p.t==='s'){const i=p.o.findIndex(o=>o[0]===v);return p.o.length>1?Math.max(0,i)/(p.o.length-1):0}return p.log?Math.log(v/p.min)/Math.log(p.max/p.min):(v-p.min)/(p.max-p.min)};
const fromN=(p,n)=>{n=clamp(n,0,1);if(p.t==='s')return p.o[Math.round(n*(p.o.length-1))][0];let v=p.log?p.min*Math.pow(p.max/p.min,n):p.min+n*(p.max-p.min);if(p.step)v=Math.round(v/p.step)*p.step;return v};
const fmtV=(p,v)=>p.t==='s'?((p.o.find(o=>o[0]===v)||[0,'?'])[1]):(p.fmt?p.fmt(v):String(v));
const stepN=p=>p.t==='s'?1/(p.o.length-1):p.step?p.step/(p.max-p.min):.025;
function bindDrag(el,id,p,scale){let sy=0,sn=0,dr=false;
  el.addEventListener('pointerdown',e=>{if(learn){learnTarget=id;$$('.learning').forEach(x=>x.classList.remove('learning'));el.classList.add('learning');return}dr=true;sy=e.clientY;sn=toN(p,S[id]);el.setPointerCapture(e.pointerId);e.preventDefault();el.focus({preventScroll:true})});
  el.addEventListener('pointermove',e=>{if(!dr)return;set(id,fromN(p,sn+(sy-e.clientY)/(e.shiftKey?scale*4:scale)))});
  const end=()=>{dr=false};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
  el.addEventListener('wheel',e=>{e.preventDefault();set(id,fromN(p,toN(p,S[id])-Math.sign(e.deltaY)*stepN(p)))},{passive:false});
  el.addEventListener('dblclick',()=>set(id,p.v));
  el.addEventListener('keydown',e=>{const s=stepN(p)*(e.shiftKey&&p.t!=='s'?.25:1);if(e.key==='ArrowUp'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();set(id,fromN(p,toN(p,S[id])+s))}else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();set(id,fromN(p,toN(p,S[id])-s))}});
}
function ticks(k){let s='';for(let i=0;i<k;i++){const a=A0+i/(k-1)*(A1-A0),p1=pol(32,32,28,a),p2=pol(32,32,31.5,a);s+=`<line class="tick" x1="${p1[0].toFixed(2)}" y1="${p1[1].toFixed(2)}" x2="${p2[0].toFixed(2)}" y2="${p2[1].toFixed(2)}"/>`}return s}
function mkKnob(id,p){const el=document.createElement('div');el.className='knob'+(p.sm?' sm':'');el.tabIndex=0;el.setAttribute('role','slider');el.setAttribute('aria-label',p.l);
  el.innerHTML=`<svg viewBox="0 0 64 64">${p.t==='s'?ticks(p.o.length):''}<path class="trk" d="${arc(32,32,26,A0,A1)}"/><path class="va"/><circle class="cap" cx="32" cy="32" r="19"/><circle class="cap2" cx="32" cy="32" r="14"/><line class="ptr" x1="32" y1="32" x2="32" y2="16"/></svg><span class="kl">${p.l}</span><span class="kv"></span><span class="kcc"></span>`;
  bindDrag(el,id,p,180);const va=el.querySelector('.va'),ptr=el.querySelector('.ptr'),kv=el.querySelector('.kv');
  return{el,upd(){const n=toN(p,S[id]),a=A0+n*(A1-A0);va.setAttribute('d',p.t!=='s'&&n>.004?arc(32,32,26,A0,a):'');ptr.setAttribute('transform',`rotate(${a.toFixed(1)} 32 32)`);const t=fmtV(p,S[id]);kv.textContent=t;el.setAttribute('aria-valuetext',t)}}}
function mkFader(id,p){const el=document.createElement('div');el.className='fader';el.tabIndex=0;el.setAttribute('role','slider');el.setAttribute('aria-label',p.l);
  el.innerHTML=`<div class="ftrack"><div class="ffill"></div><div class="fcap"></div></div><span class="kl">${p.l}</span><span class="kv"></span><span class="kcc"></span>`;
  bindDrag(el,id,p,110);const cap=el.querySelector('.fcap'),fill=el.querySelector('.ffill'),kv=el.querySelector('.kv');
  return{el,upd(){const n=toN(p,S[id]);cap.style.bottom=`calc(${(n*100).toFixed(2)}% - ${(n*14).toFixed(1)}px)`;fill.style.height=(n*100).toFixed(2)+'%';const t=fmtV(p,S[id]);kv.textContent=t;el.setAttribute('aria-valuetext',t)}}}
function mkChoice(id,p){const el=document.createElement('div');el.className='choice';el.innerHTML=`<span class="kl">${p.l}</span><div class="seg">${p.o.map((o,i)=>`<button type="button" data-i="${i}">${o[1]}</button>`).join('')}</div>`;
  const bs=[...el.querySelectorAll('button')];bs.forEach(b=>b.onclick=()=>set(id,p.o[+b.dataset.i][0]));
  return{el,upd(){bs.forEach((b,i)=>{const on=p.o[i][0]===S[id];b.classList.toggle('sel',on);b.setAttribute('aria-pressed',on)})}}}
function mkToggle(id,p){const el=document.createElement('button');el.type='button';el.className='tg';el.innerHTML=`<i></i><span>${p.l}</span>`;el.onclick=()=>set(id,!S[id]);
  return{el,upd(){el.classList.toggle('on',!!S[id]);el.setAttribute('aria-pressed',!!S[id])}}}
function ctrl(id){const p=D.params[id];const o=(p.t==='k'||p.t==='s')?mkKnob(id,p):p.t==='f'?mkFader(id,p):p.t==='c'?mkChoice(id,p):mkToggle(id,p);UI[id]=o;o.upd();return o}
function jack(id,label,isOut){const b=document.createElement('button');b.type='button';b.className='mj'+(isOut?' out':'');b.dataset.j=id;b.innerHTML=`<i></i><span>${label}</span>`;b.title=(isOut?'Output: ':'Input: ')+id;b.onclick=()=>jackClick(id,isOut);return b}

/* ================= state + rendering ================= */
function defaults(){const o={};for(const k in D.params)o[k]=D.params[k].v;if(D.extraDefaults)Object.assign(o,D.extraDefaults());return o}
function set(id,v){S[id]=v;UI[id]&&UI[id].upd();if(E)E.set(id,v);if(D.onSet)D.onSet(id,v);markPreset(-1)}
function markPreset(i){curPreset=i;$$('#presetRow .pbtn').forEach((b,j)=>b.classList.toggle('cur',j===i))}
function applyPreset(i){S=defaults();Object.assign(S,clone(D.presets[i].p));for(const id in UI)UI[id].upd();if(E){E.allOff&&E.allOff();engineSync()}if(D.onSet)D.onSet('alg');if(KEY==='mod')drawCables();markPreset(i)}
function engineSync(){for(const id in D.params)E.set(id,S[id]);if(E.post)E.post()}
function loadInstrument(key){
  const wasRunning=SEQ.run;seqStop();
  if(E){E.allOff&&E.allOff();const old=E;setTimeout(()=>old.dispose(),120);E=null}
  held.length=0;keyVis();
  KEY=key;D=DEFS[key];for(const k in UI)delete UI[k];
  S=defaults();Object.assign(S,clone(D.presets[0].p));
  $('#eraYear').textContent=D.year;$('#eraText').innerHTML=D.era;$('#hint').textContent=D.hint;
  const pr=$('#presetRow');pr.innerHTML='<span class="label">Start from</span>';D.presets.forEach((p,i)=>{const b=document.createElement('button');b.className='pbtn';b.textContent=p.name;b.onclick=()=>applyPreset(i);pr.appendChild(b)});
  const pn=$('#panel');pn.className='panel '+D.theme+(D.wood?' wood':'');pn.innerHTML=`<div class="plate"><span class="pname">${D.plate}</span><span class="pyear">${D.sub}</span></div>`;
  if(D.render)D.render(pn);else{const secs=document.createElement('div');secs.className='secs';D.sections.forEach(sec=>{const s=document.createElement('div');s.className='sec';if(sec.c)s.style.setProperty('--c',sec.c);s.innerHTML=`<h3>${sec.title}</h3>`;const c=document.createElement('div');c.className='ctrls';sec.ids.forEach(id=>c.appendChild(ctrl(id).el));s.appendChild(c);secs.appendChild(s)});pn.appendChild(secs);if(D.extra)D.extra(pn)}
  buildSeq(pn);
  markPreset(0);renderMap();
  if(ctx){E=D.build(ctx,inBus);engineSync()}
  try{localStorage.setItem('rl-synth',key)}catch(e){}
  if(wasRunning&&E)seqStart();
}

/* ================= pattern sequencer (every synth) ================= */
// 16 steps of sixteenth notes; each step holds notes (one for mono synths, a chord for poly),
// an octave-up flag, an accent (played at full velocity) and a slide/tie into the next step.
const PATS={},MINE={},SEQ={run:false,timer:null,step:0,nextT:0,marks:[],held:[],tr:0};
const NM=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B','C'];
const noteName=n=>NM[((n%12)+12)%12]+(Math.floor(n/12)-1);
function curPat(){if(!PATS[KEY]){let p=null;try{const j=localStorage.getItem('rl-synth-pat-'+KEY);if(j)p=JSON.parse(j)}catch(e){}
  PATS[KEY]=p&&Array.isArray(p.steps)&&p.steps.length===16&&p.steps.every(x=>Array.isArray(x.notes))?p:clone(D.patterns[0])}return PATS[KEY]}
function savePat(){try{localStorage.setItem('rl-synth-pat-'+KEY,JSON.stringify(PATS[KEY]))}catch(e){}}
function seqSched(){
  if(!SEQ.run||!E||!ctx)return;const P=curPat(),sp=60/P.tempo/4;
  while(SEQ.nextT<ctx.currentTime+.12){
    const t=SEQ.nextT,s=P.steps[SEQ.step],pv=P.steps[(SEQ.step+15)%16],nx=P.steps[(SEQ.step+1)%16];
    const notes=s.notes.map(n=>P.root+SEQ.tr+n+(s.up?12:0)),vel=s.acc?127:88;
    if(notes.length){
      if(pv.sl&&SEQ.held.length){ // tie or slide: start the new notes first so mono synths glide instead of retriggering
        notes.forEach(n=>{if(!SEQ.held.includes(n))E.noteOn(n,vel,t)});SEQ.held.filter(n=>!notes.includes(n)).forEach(n=>E.noteOff(n,t+.002));
      }else{SEQ.held.forEach(n=>E.noteOff(n,t));notes.forEach(n=>E.noteOn(n,vel,t))}
      SEQ.held=notes.slice();
      if(!(s.sl&&nx.notes.length)){const e=t+sp*.55;SEQ.held.forEach(n=>E.noteOff(n,e));SEQ.held=[]}
    }else if(SEQ.held.length){SEQ.held.forEach(n=>E.noteOff(n,t));SEQ.held=[]}
    SEQ.marks.push({t,step:SEQ.step});if(SEQ.marks.length>64)SEQ.marks.shift();
    SEQ.nextT+=sp;SEQ.step=(SEQ.step+1)%16;
  }
}
async function seqStart(){if(!ctx)await power();if(!ctx)return;if(ctx.state!=='running'){await ctx.resume();uiPower(true)}
  if(!E||SEQ.run)return;SEQ.run=true;SEQ.step=0;SEQ.held=[];SEQ.marks.length=0;SEQ.nextT=ctx.currentTime+.06;seqSched();SEQ.timer=setInterval(seqSched,25);seqUi()}
function seqStop(){if(!SEQ.run)return;SEQ.run=false;clearInterval(SEQ.timer);SEQ.timer=null;if(E&&ctx){const t=ctx.currentTime;SEQ.held.forEach(n=>E.noteOff(n,t));if(E.allOff)E.allOff()}SEQ.held=[];SEQ.marks.length=0;seqUi()}
function seqUi(){const b=$('#seqRun');if(b){b.classList.toggle('on',SEQ.run);b.textContent=SEQ.run?'STOP':'RUN';b.setAttribute('aria-pressed',SEQ.run)}}
function seqPlayhead(now){if(!SEQ.run)return -1;let st=-1;for(const m of SEQ.marks)if(m.t<=now)st=m.step;return st}
function riffIndex(){const j=JSON.stringify(curPat());return D.patterns.findIndex(p=>JSON.stringify(p)===j)}
function seqVals(){const P=curPat();$('#seqTempo').value=P.tempo;$('#seqTempoV').textContent=P.tempo+' bpm';$('#rootV').textContent=noteName(P.root+SEQ.tr)+(SEQ.tr?' +'+SEQ.tr:'');
  const ri=riffIndex(),mine=$('#riffSel option[value="-1"]');if(mine)mine.disabled=!(ri<0||getMine());$('#riffSel').value=String(ri<0?-1:ri)}
// "Your riff": an edited pattern is kept aside when you pick a starter riff, so it can be picked again
function getMine(){if(!(KEY in MINE)){let m=null;try{const j=localStorage.getItem('rl-synth-mine-'+KEY);if(j)m=JSON.parse(j)}catch(e){}MINE[KEY]=m&&Array.isArray(m.steps)&&m.steps.length===16?m:null}return MINE[KEY]}
function stashMine(){if(riffIndex()>=0||!curPat().steps.some(x=>x.notes.length))return;MINE[KEY]=clone(curPat());try{localStorage.setItem('rl-synth-mine-'+KEY,JSON.stringify(MINE[KEY]))}catch(e){}}
function chooseRiff(i){if(i>=0){stashMine();PATS[KEY]=clone(D.patterns[i])}else{const m=getMine();if(!m)return null;PATS[KEY]=clone(m)}savePat();drawSeq();seqVals();return i>=0?D.patterns[i].name:'Your riff'}
function drawSeq(){const P=curPat();$$('#seqGrid .cell').forEach(c=>{const st=P.steps[+c.dataset.s];c.classList.toggle('on',c.dataset.f?!!st[c.dataset.f]:st.notes.includes(+c.dataset.r))})}
function buildSeq(pn){
  const poly=!!D.poly,sec=document.createElement('div');sec.className='sec seq';
  sec.innerHTML=`<h3>Pattern</h3>
   <div class="seqbar"><button class="run" id="seqRun" aria-pressed="false">RUN</button>
    <label class="sfield"><span class="kl">Riff</span><select id="riffSel" aria-label="Riff">${D.patterns.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('')}<option value="-1">Your riff</option></select></label>
    <span class="sfield"><span class="kl">Tempo</span><input type="range" id="seqTempo" min="60" max="180" step="1" aria-label="Tempo"><span class="sval" id="seqTempoV"></span></span>
    <span class="sfield"><span class="kl">Root</span><button class="sbtn" id="rootDn" aria-label="Pattern an octave lower">−</button><span class="sval" id="rootV"></span><button class="sbtn" id="rootUp" aria-label="Pattern an octave higher">+</button></span>
    <button class="sbtn" id="seqClr">Clear</button></div>
   <p class="shint">${poly?'Click cells to write notes, and stack several in one step for a chord. Acc plays a step louder; Tie holds it into the next step.':'Click a cell to write a note, again to rest. Acc plays a step louder; Slide glides into the next note without restarting it.'}</p>
   <div class="seqscroll"><div class="grid" id="seqGrid"></div></div>`;
  pn.appendChild(sec);
  let h='';
  for(let r=12;r>=0;r--){h+=`<div class="rl">${NM[r]}${r===12?'′':''}</div>`;for(let i=0;i<16;i++)h+=`<button class="cell${NM[r].includes('#')?' blk':''}${i%4===0&&i?' bar':''}" data-r="${r}" data-s="${i}" aria-label="Step ${i+1} ${NM[r]}"></button>`}
  h+='<div class="sep"></div>';
  [['up','Up'],['acc','Acc'],['sl',poly?'Tie':'Slide']].forEach(([k,l])=>{h+=`<div class="rl">${l}</div>`;for(let i=0;i<16;i++)h+=`<button class="cell flag${i%4===0&&i?' bar':''}" data-f="${k}" data-s="${i}" aria-label="Step ${i+1} ${l}"></button>`});
  const g=$('#seqGrid');g.innerHTML=h;
  g.onclick=e=>{const c=e.target.closest('.cell');if(!c)return;const st=curPat().steps[+c.dataset.s];
    if(c.dataset.f)st[c.dataset.f]=!st[c.dataset.f];
    else{const r=+c.dataset.r,i=st.notes.indexOf(r);if(poly){if(i>=0)st.notes.splice(i,1);else st.notes.push(r)}else st.notes=i>=0?[]:[r]}
    savePat();drawSeq();$('#riffSel').value=String(riffIndex())};
  $('#seqRun').onclick=()=>{SEQ.run?seqStop():seqStart()};
  $('#riffSel').onchange=e=>{chooseRiff(+e.target.value);e.target.blur()};
  $('#seqTempo').oninput=e=>{curPat().tempo=+e.target.value;$('#seqTempoV').textContent=e.target.value+' bpm';savePat();$('#riffSel').value=String(riffIndex())};
  const oct=d=>{const P=curPat();P.root=clamp(P.root+12*d,24,72);savePat();seqVals()};
  $('#rootDn').onclick=()=>oct(-1);$('#rootUp').onclick=()=>oct(1);
  $('#seqClr').onclick=()=>{curPat().steps=pat(Array(16).fill(null));savePat();drawSeq();seqVals()};
  drawSeq();seqVals();seqUi();
}

/* modular cables */
let armed=null;
function jackClick(id,isOut){
  if(isOut){armed=armed===id?null:id}
  else if(armed){S.cables=S.cables.filter(c=>c[1]!==id);S.cables.push([armed,id]);armed=null;if(E)E.patch(S.cables);markPreset(-1)}
  else{const before=S.cables.length;S.cables=S.cables.filter(c=>c[1]!==id);if(before!==S.cables.length){if(E)E.patch(S.cables);markPreset(-1)}}
  $$('.mj').forEach(j=>j.classList.toggle('armed',j.dataset.j===armed));drawCables();
}
function drawCables(){const svg=$('#cabsvg');if(!svg)return;const box=svg.getBoundingClientRect();
  const pt=id=>{const j=ROOT.querySelector(`.mj[data-j="${id}"] i`);if(!j)return null;const r=j.getBoundingClientRect();return [r.left+r.width/2-box.left,r.top+r.height/2-box.top]};
  let h='';S.cables.forEach(([a,b],i)=>{const p1=pt(a),p2=pt(b);if(!p1||!p2)return;const col=CABLE_COLS[i%CABLE_COLS.length],d=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),sag=Math.min(140,d*.3)+28;
    const path=`M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}C${p1[0].toFixed(1)} ${(p1[1]+sag).toFixed(1)} ${p2[0].toFixed(1)} ${(p2[1]+sag).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    h+=`<path d="${path}" stroke="rgba(0,0,0,.5)" stroke-width="7" fill="none" stroke-linecap="round" transform="translate(0 3)"/><path d="${path}" stroke="${col}" stroke-width="4.5" fill="none" stroke-linecap="round" opacity=".9"/><circle cx="${p1[0]}" cy="${p1[1]}" r="6" fill="${col}"/><circle cx="${p2[0]}" cy="${p2[1]}" r="6" fill="${col}"/>`});
  svg.innerHTML=h}

/* ================= audio context ================= */
async function power(){
  if(ctx){if(ctx.state==='running'){await ctx.suspend();uiPower(false)}else{await ctx.resume();uiPower(true)}return}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC){$('#hint').textContent='This browser has no Web Audio support.';return}
  ctx=new AC({latencyHint:'interactive'});
  ctx._bend=new ConstantSourceNode(ctx,{offset:0});ctx._bend.start();
  inBus=new GainNode(ctx,{gain:.9});const lim=new DynamicsCompressorNode(ctx,{threshold:-8,knee:6,ratio:12,attack:.003,release:.2});
  an=new AnalyserNode(ctx,{fftSize:2048,smoothingTimeConstant:.75});inBus.connect(lim);lim.connect(an);an.connect(ctx.destination);
  E=D.build(ctx,inBus);engineSync();uiPower(true);initMidi(true);
}
function uiPower(on){$('#power').classList.toggle('on',on);$('#power').setAttribute('aria-pressed',on);$('#powerTxt').textContent=on?'Power off':'Power on'}

/* ================= keyboard ================= */
let base=48;const held=[];
const KEYMAP={a:0,w:1,s:2,e:3,d:4,f:5,t:6,g:7,y:8,h:9,u:10,j:11,k:12,o:13,l:14,p:15,';':16,"'":17};
const KEYLBL={};for(const c in KEYMAP)KEYLBL[KEYMAP[c]]=c.toUpperCase();
async function noteOn(n,vel){if(!ctx)await power();if(ctx.state!=='running'){await ctx.resume();uiPower(true)}if(!E)return;if(!held.includes(n))held.push(n);E.noteOn(n,vel||100);keyVis()}
function noteOff(n){const i=held.indexOf(n);if(i>=0)held.splice(i,1);if(E)E.noteOff(n);keyVis()}
function buildKb(){const kb=$('#kb');kb.innerHTML='';const whites=[];for(let i=0;i<25;i++){if(![1,3,6,8,10].includes((base+i)%12))whites.push(i)}const W=whites.length;
  for(let i=0;i<25;i++){const n=base+i,pc=n%12,bl=[1,3,6,8,10].includes(pc),el=document.createElement('div');el.className=bl?'bk':'wk';el.dataset.n=n;
    el.innerHTML=`<span>${pc===0?'C'+(Math.floor(n/12)-1):''}${KEYLBL[i]?(pc===0?'<br>':'')+KEYLBL[i]:''}</span>`;
    if(bl){const wi=whites.filter(w=>w<i).length;el.style.left=`calc(${(wi/W*100).toFixed(3)}% - ${(.32/W*100).toFixed(3)}%)`;el.style.width=`${(.64/W*100).toFixed(3)}%`}kb.appendChild(el)}
  $('#octLbl').textContent=`C${base/12-1} – C${base/12+1}`;keyVis()}
function keyVis(){$$('#kb [data-n]').forEach(el=>el.classList.toggle('down',held.includes(+el.dataset.n)))}
const ptrN={};
const kd={};
function shift(d){base=clamp(base+12*d,24,84);buildKb()}

/* ================= pads ================= */
// Bank A (pads 1-8): the show. Bank B (pads 9-16): live key change of the running pattern, along a minor scale.
// Pads are laid out like the hardware: pads 5-8 on the top row, 1-4 below.
const KEY_STEPS=[0,2,3,5,7,8,10,12];
let padMode='control',taps=[];
try{if(localStorage.getItem('rl-synth-pads')==='notes')padMode='notes'}catch(e){}
function bpmFromTaps(ts){if(ts.length<2)return null;const d=[];for(let i=1;i<ts.length;i++)d.push(ts[i]-ts[i-1]);const avg=d.reduce((a,b)=>a+b,0)/d.length;return clamp(Math.round(60000/avg),60,180)}
function tapTempo(){const now=performance.now();if(taps.length&&now-taps[taps.length-1]>2000)taps=[];taps.push(now);if(taps.length>5)taps.shift();
  const bpm=bpmFromTaps(taps);if(!bpm)return 'Tap tempo: tap again on the beat';curPat().tempo=bpm;savePat();seqVals();return 'Tempo '+bpm+' bpm'}
function stepRiff(d){const list=D.patterns.map((_,i)=>i);if(getMine()||riffIndex()<0)list.push(-1);const cur=list.indexOf(riffIndex());const nx=list[((cur<0?(d>0?-1:0):cur)+d+list.length)%list.length];const name=chooseRiff(nx);return 'Riff: '+name}
function stepSynth(d){const i=ORDER.indexOf(KEY),k=ORDER[(i+d+ORDER.length)%ORDER.length];$('#instSel').value=k;loadInstrument(k);return DEFS[k].name}
function stepSound(d){const n=D.presets.length,i=curPreset<0?(d>0?0:n-1):(curPreset+d+n)%n;applyPreset(i);return 'Sound: '+D.presets[i].name}
function setTranspose(tr){SEQ.tr=tr;seqVals();return tr?'Pattern key +'+tr+' ('+noteName(curPat().root+tr).replace(/-?\d+$/,'')+')':'Pattern key back to the root'}
const PADS=[
  {l:'Run / Stop',fn:()=>{if(SEQ.run){seqStop();return 'Pattern stopped'}seqStart();return 'Pattern running'}},
  {l:'Riff ◀',fn:()=>stepRiff(-1)},{l:'Riff ▶',fn:()=>stepRiff(1)},{l:'Tap tempo',fn:tapTempo},
  {l:'Synth ◀',fn:()=>stepSynth(-1)},{l:'Synth ▶',fn:()=>stepSynth(1)},{l:'Sound ◀',fn:()=>stepSound(-1)},{l:'Sound ▶',fn:()=>stepSound(1)}
].concat(KEY_STEPS.map(tr=>({l:tr?'+'+tr:'Root',tr,fn:()=>setTranspose(tr)})));
function padName(i){return 'Pad '+(i%8+1)+(i>=8?' (B)':'')}
function renderPads(){
  const order=[4,5,6,7,0,1,2,3],mk=(i)=>`<button type="button" class="pad" data-pad="${i}"><b>${PADS[i].l}</b><span>${padName(i)}</span></button>`;
  $('#padsA').innerHTML=order.map(i=>mk(i)).join('');$('#padsB').innerHTML=order.map(i=>mk(i+8)).join('');
  $$('.pad').forEach(b=>b.onclick=()=>padHit(+b.dataset.pad));padUi();
}
function padUi(){const on=padMode==='control',b=$('#padMode');b.textContent=on?'Pads: control':'Pads: play notes';b.className='chip'+(on?' ok':'');b.setAttribute('aria-pressed',on);
  $('#ctlCard').classList.toggle('padoff',!on);$$('.pad').forEach(x=>{const i=+x.dataset.pad;x.classList.toggle('cur',i>=8&&PADS[i].tr===SEQ.tr)})}
async function padHit(i){const P=PADS[i];if(!P)return;if(!ctx&&i!==0)await power();const msg=P.fn();
  const el=ROOT.querySelector(`.pad[data-pad="${i}"]`);if(el){el.classList.remove('hit');void el.offsetWidth;el.classList.add('hit');setTimeout(()=>el.classList.remove('hit'),180)}
  $('#padStat').textContent=padName(i)+' · '+(msg||P.l);padUi()}

/* ================= MIDI ================= */
const ccMaps={};
function ccMap(){if(!ccMaps[KEY]){const m={};D.cc.forEach((id,i)=>m[70+i]=id);if(D.wheel)m[1]=D.wheel;ccMaps[KEY]=m}return ccMaps[KEY]}
function renderMap(){$$('.kcc').forEach(x=>x.textContent='');const m=ccMap(),rows=[];for(const cc in m){const id=m[cc];if(UI[id]){const k=UI[id].el.querySelector('.kcc');if(k)k.textContent='CC '+cc}rows.push(`<span>CC ${cc} → ${D.params[id].l}</span>`)}$('#mapList').innerHTML=rows.join('')}
let midi=null;
async function initMidi(quiet){const chip=$('#midiChip');
  if(!navigator.requestMIDIAccess){chip.textContent='MIDI: not in this browser';chip.className='chip warn';return}
  try{midi=await navigator.requestMIDIAccess();const hook=()=>{const names=[];midi.inputs.forEach(i=>{i.onmidimessage=onMidi;names.push(i.name)});chip.textContent=names.length?'MIDI: '+names[0].slice(0,22):'MIDI: no device';chip.className='chip '+(names.length?'ok':'warn')};hook();midi.onstatechange=hook}
  catch(e){chip.textContent='MIDI: not allowed';chip.className='chip warn';if(!quiet)$('#midiInfo').textContent='The browser refused MIDI access. Allow MIDI for this site in the browser\'s site settings, then press MIDI: connect again. Chrome and Edge support it; Safari does not.'}}
function setBend(v){const cents=v/8192*200;if(ctx&&ctx._bend)ctx._bend.offset.setTargetAtTime(cents,ctx.currentTime,.008)}
function onMidi(m){const [st,d1,d2]=m.data,ty=st&0xf0,ch=st&0x0f;
  if(ty===0xE0){setBend(((d2<<7)|d1)-8192);return}
  if((ty===0x90||ty===0x80)&&ch===9&&padMode==='control'){if(ty===0x90&&d2>0)padHit((((d1-36)%16)+16)%16);return}
  if(ty===0x90&&d2>0)noteOn(d1,d2);else if(ty===0x80||(ty===0x90&&d2===0))noteOff(d1);
  else if(ty===0xB0){const map=ccMap();if(learn&&learnTarget){for(const c in map)if(map[c]===learnTarget)delete map[c];map[d1]=learnTarget;learnTarget=null;$$('.learning').forEach(x=>x.classList.remove('learning'));renderMap();return}
    const id=map[d1];if(id&&D.params[id])set(id,fromN(D.params[id],d2/127))}}

/* ================= visuals ================= */
let cS=null,cF=null;const td=new Float32Array(2048),fd=new Float32Array(1024);
function fit(){const dpr=Math.min(2,window.devicePixelRatio||1);[cS,cF].forEach(c=>{c.width=Math.max(10,c.clientWidth*dpr);c.height=Math.max(10,c.clientHeight*dpr)})}
let lastPh=-2;
function frame(){
  if(!ACTIVE){requestAnimationFrame(frame);return}
  const now=ctx?ctx.currentTime:0,s=cS.width/Math.max(1,cS.clientWidth);
  let g=cS.getContext('2d');g.fillStyle='#090c0f';g.fillRect(0,0,cS.width,cS.height);
  if(an){an.getFloatTimeDomainData(td);let z=0;for(let i=1;i<1024;i++)if(td[i-1]<0&&td[i]>=0){z=i;break}
    g.strokeStyle='#ebe7dd';g.lineWidth=1.6*s;g.beginPath();for(let i=0;i<900;i++){const x=i/899*cS.width,y=cS.height/2-(td[z+i]||0)*cS.height*.6;i?g.lineTo(x,y):g.moveTo(x,y)}g.stroke()}
  else{g.fillStyle='#58626c';g.font=`${10.5*s}px JetBrains Mono, monospace`;g.textAlign='center';g.fillText('press Power, then play',cS.width/2,cS.height/2+4)}
  g=cF.getContext('2d');g.fillStyle='#090c0f';g.fillRect(0,0,cF.width,cF.height);
  if(an){an.getFloatFrequencyData(fd);const bin=ctx.sampleRate/2048,fx=f=>Math.log(f/30)/Math.log(16000/30)*cF.width;g.beginPath();let first=true;
    for(let i=1;i<1024;i++){const fq=i*bin;if(fq<30||fq>16000)continue;const x=fx(fq),y=cF.height-clamp((fd[i]+100)/85,0,1)*cF.height;if(first){g.moveTo(x,cF.height);first=false}g.lineTo(x,y)}
    g.lineTo(cF.width,cF.height);g.closePath();g.fillStyle='rgba(240,154,70,.35)';g.fill()}
  else{g.fillStyle='#58626c';g.font=`${10.5*s}px JetBrains Mono, monospace`;g.textAlign='center';g.fillText('spectrum',cF.width/2,cF.height/2+4)}
  const ph=seqPlayhead(now);if(ph!==lastPh){lastPh=ph;$$('#seqGrid .cell').forEach(c=>c.classList.toggle('ph',+c.dataset.s===ph))}
  requestAnimationFrame(frame);
}

/* ================= boot ================= */

function init(){
new ResizeObserver(()=>{if(KEY==='mod')drawCables();fit()}).observe($('#panel'));
window.addEventListener('keydown',e=>{if(!ACTIVE)return;if(e.key==='Escape'&&armed){armed=null;$$('.mj').forEach(j=>j.classList.remove('armed'))}});
$('#power').onclick=power;
$('#kb').addEventListener('pointerdown',e=>{const el=e.target.closest('[data-n]');if(!el)return;e.preventDefault();ptrN[e.pointerId]=+el.dataset.n;noteOn(+el.dataset.n)});
$('#kb').addEventListener('pointerover',e=>{if(!(e.pointerId in ptrN))return;const el=e.target.closest('[data-n]');if(!el)return;const n=+el.dataset.n;if(n===ptrN[e.pointerId])return;const old=ptrN[e.pointerId];ptrN[e.pointerId]=n;noteOn(n);noteOff(old)});
const up=e=>{if(e.pointerId in ptrN){noteOff(ptrN[e.pointerId]);delete ptrN[e.pointerId]}};window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
window.addEventListener('keydown',e=>{if(!ACTIVE)return;if(e.metaKey||e.ctrlKey||e.altKey||e.repeat)return;const tg=(e.composedPath()[0]||e.target).tagName;if(tg==='SELECT'||tg==='INPUT')return;const c=e.key.toLowerCase();
  if(c==='z'){shift(-1);return}if(c==='x'){shift(1);return}if(c in KEYMAP){const n=base+KEYMAP[c];kd[c]=n;noteOn(n)}});
window.addEventListener('keyup',e=>{if(!ACTIVE)return;const c=e.key.toLowerCase();if(c in kd){noteOff(kd[c]);delete kd[c]}});
window.addEventListener('blur',()=>{[...held].forEach(noteOff)});
$('#octDown').onclick=()=>shift(-1);$('#octUp').onclick=()=>shift(1);
$('#midiChip').onclick=()=>initMidi(false);
$('#learnBtn').onclick=()=>{learn=!learn;learnTarget=null;$('#learnBtn').classList.toggle('active',learn);$$('.learning').forEach(x=>x.classList.remove('learning'));$('#hint').textContent=learn?'MIDI learn is on: click a control on screen, then move a knob on your controller. Click MIDI learn again when done.':D.hint};
cS=$('#cvScope');cF=$('#cvSpec');
const sel=$('#instSel');ORDER.forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=DEFS[k].name;sel.appendChild(o)});
let start='mono3';try{const s=localStorage.getItem('rl-synth');if(s&&DEFS[s])start=s}catch(e){}
sel.value=start;sel.onchange=()=>{loadInstrument(sel.value);sel.blur()};
renderPads();$('#padMode').onclick=()=>{padMode=padMode==='control'?'notes':'control';try{localStorage.setItem('rl-synth-pads',padMode)}catch(e){}padUi()};
buildKb();loadInstrument(start);fit();requestAnimationFrame(frame);
window.addEventListener('resize',()=>{if(!ACTIVE)return;fit();if(KEY==='mod')drawCables()});
}
// frame() only draws while the view is open

function mount(host){
  if(ROOT)return;
  ROOT=host.attachShadow({mode:'open'});
  ROOT.innerHTML='<style>'+CSS+'</style>'+HTML;
  init();
}
// called by the app when the Synths view opens or closes: notes are released, the sequencer
// stops and audio is suspended while hidden, then resumed if it was on
async function setActive(on){
  ACTIVE=!!on;
  if(!ROOT)return;
  if(on){fit();if(KEY==='mod')requestAnimationFrame(drawCables);if(ctx&&WAS_ON){await ctx.resume();uiPower(true)}WAS_ON=false}
  else{seqStop();[...held].forEach(noteOff);if(E&&E.allOff)E.allOff();
    if(ctx&&ctx.state==='running'){WAS_ON=true;await ctx.suspend();uiPower(false)}}
}

// _midi feeds raw MIDI bytes in, as a controller would (used by the browser tests)
const api={mount,setActive,get active(){return ACTIVE},_midi:b=>onMidi({data:b})};
if(typeof window!=='undefined')window.RLSynths=api;
if(typeof module!=='undefined'&&module.exports)module.exports={DEFS,ALGS,ORDER,besselJ,toN,fromN,mtof,pat,chords,bpmFromTaps,KEY_STEPS,PADS};
})();

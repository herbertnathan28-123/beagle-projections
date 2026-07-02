const HUNTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hunter — Behavioral Forensics</title>
<style>
:root{
  --bg:#06080E;--bg1:#04101E;--bg2:#0A1C32;--bg3:#080C14;
  --bg4:#0C1020;--bg5:#0E1428;--bdr:#141C2E;--bdr2:#1C2840;--bdr3:#253550;
  --gold:#E8B84B;--gold2:#C4920A;--txt:#E2EAF4;--txt2:#8AAABB;--txt3:#4A6070;
  --red:#E74C3C;--amber:#F9A825;--green:#00D68F;--slate:#3A6090;
  --mono:'Consolas','Courier New',monospace;--sans:'Segoe UI',Calibri,sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bg);color:var(--txt);font-family:var(--sans);}
::-webkit-scrollbar{width:3px;background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px}

/* LOCK */
#lock{display:flex;align-items:center;justify-content:center;min-height:100vh;}
.lock-card{width:380px;text-align:center;background:linear-gradient(160deg,var(--bg1),var(--bg2));border:1px solid var(--bdr2);border-top:2px solid var(--gold2);border-radius:4px;padding:44px 36px 40px;box-shadow:0 24px 80px rgba(0,0,0,.7);}
.lock-diamond{font-size:13px;font-weight:700;color:var(--gold);letter-spacing:4px;margin-bottom:18px;display:block;}
.lock-title{font-size:22px;font-weight:700;color:var(--gold);letter-spacing:4px;text-transform:uppercase;margin-bottom:4px;}
.lock-sub{font-size:9px;color:var(--txt3);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:34px;}
.lock-input{width:100%;background:var(--bg5);border:1px solid var(--bdr3);color:var(--gold);font-family:var(--mono);font-size:16px;padding:13px;text-align:center;letter-spacing:4px;border-radius:3px;outline:none;margin-bottom:10px;transition:border-color .2s,box-shadow .2s;}
.lock-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(232,184,75,.12);}
.lock-input::placeholder{color:var(--txt3);letter-spacing:2px;font-size:11px;}
.lock-btn{width:100%;background:var(--gold2);color:#000;border:none;border-radius:3px;padding:13px;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;cursor:pointer;transition:opacity .15s;}
.lock-btn:hover{opacity:.88;}
.lock-err{font-size:10px;color:var(--red);margin-top:12px;letter-spacing:1px;display:none;}

/* MODAL */
.modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:999;align-items:center;justify-content:center;padding:20px;}
.modal-bg.on{display:flex;}
.modal{background:var(--bg1);border:1px solid var(--bdr3);border-top:2px solid var(--gold2);border-radius:3px;max-width:540px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,.8);}
.modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--bdr);}
.modal-title{font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);}
.modal-close{background:none;border:none;color:var(--txt3);font-size:18px;cursor:pointer;padding:0 4px;line-height:1;}
.modal-close:hover{color:var(--txt);}
.modal-body{padding:20px;}
.modal-body p{font-size:13px;color:var(--txt2);line-height:1.7;margin-bottom:12px;}
.modal-body p:last-child{margin-bottom:0;}
.modal-body strong{color:var(--txt);font-weight:600;}
.modal-kv{display:grid;grid-template-columns:140px 1fr;gap:8px 16px;margin-bottom:14px;}
.modal-k{font-size:9px;color:var(--txt3);letter-spacing:1.5px;text-transform:uppercase;padding-top:2px;}
.modal-v{font-size:13px;color:var(--txt);font-family:var(--mono);}
.modal-rule{border:none;border-top:1px solid var(--bdr);margin:16px 0;}
.hist-bars{display:flex;align-items:flex-end;gap:6px;height:80px;margin-bottom:6px;}
.hist-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;}
.hist-bar{width:100%;border-radius:2px 2px 0 0;min-height:4px;}
.hist-bar-val{font-size:8px;color:var(--txt3);text-align:center;font-family:var(--mono);white-space:nowrap;}
.hist-bar-date{font-size:8px;color:var(--txt3);text-align:center;}
.hist-lbl{display:flex;justify-content:space-between;font-size:8px;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-top:4px;padding-top:6px;border-top:1px solid var(--bdr);}
.trend-note{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--txt2);margin-top:10px;}

/* HEADER */
.hdr{background:linear-gradient(90deg,var(--bg1),var(--bg2));border-bottom:2px solid var(--gold2);position:sticky;top:0;z-index:100;}
.hdr-top{display:flex;align-items:center;justify-content:space-between;padding:10px 24px 0;}
.brand{font-size:22px;font-weight:700;color:var(--gold);letter-spacing:2px;}
.brand-sub{font-size:9px;color:var(--txt3);letter-spacing:3px;text-transform:uppercase;margin-top:2px;padding-bottom:10px;}
.live{display:flex;align-items:center;gap:6px;}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 2s infinite;}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(0,214,143,.5)}70%{box-shadow:0 0 0 7px rgba(0,214,143,0)}100%{box-shadow:0 0 0 0 rgba(0,214,143,0)}}
.live-txt{font-size:10px;font-weight:700;color:var(--green);letter-spacing:2px;}

/* COMMAND STRIP */
.cmd{display:grid;grid-template-columns:200px 1fr 260px;border-top:1px solid var(--bdr);min-height:88px;}
.cmd-cell{padding:14px 20px;border-right:1px solid var(--bdr);cursor:pointer;transition:background .12s;}
.cmd-cell:last-child{border-right:none;}
.cmd-cell:hover{background:rgba(255,255,255,.02);}
.cmd-lbl{font-size:8px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--txt3);margin-bottom:8px;display:flex;align-items:center;gap:5px;}
.cmd-lbl::after{content:'?';width:12px;height:12px;border-radius:50%;background:var(--bdr2);color:var(--txt3);font-size:7px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;letter-spacing:0;flex-shrink:0;}
.threat-lvl{font-size:26px;font-weight:900;letter-spacing:3px;text-transform:uppercase;line-height:1;}
.threat-CLEAR{color:var(--green);}
.threat-WATCH{color:var(--amber);}
.threat-ELEVATED{color:var(--amber);}
.threat-CRITICAL{color:var(--red);text-shadow:0 0 18px rgba(231,76,60,.35);}
.threat-sub{font-size:10px;color:var(--txt3);margin-top:6px;letter-spacing:.5px;line-height:1.5;}
.threat-dot{width:5px;height:5px;border-radius:50%;display:inline-block;margin-right:4px;vertical-align:middle;}
.alert-name{font-family:var(--mono);font-size:18px;font-weight:700;color:var(--txt);margin-bottom:5px;}
.alert-band{display:inline-block;font-size:9px;font-weight:900;letter-spacing:2px;padding:2px 8px;border-radius:2px;margin-right:8px;}
.band-ELEVATED{background:rgba(249,160,37,.15);color:var(--amber);border:1px solid rgba(249,160,37,.3);}
.band-EXTREME{background:rgba(231,76,60,.18);color:var(--red);border:1px solid rgba(231,76,60,.35);}
.band-ELITE{background:rgba(232,184,75,.12);color:var(--gold);}
.band-GOOD{background:rgba(0,214,143,.1);color:var(--green);}
.band-NORMAL{background:var(--bdr);color:var(--txt3);}
.alert-cd{font-family:var(--mono);font-size:13px;font-weight:700;color:var(--amber);}
.alert-meta{font-size:10px;color:var(--txt3);margin-top:5px;}
.alert-flags{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:var(--red);background:rgba(231,76,60,.1);border:1px solid rgba(231,76,60,.2);padding:2px 7px;border-radius:2px;margin-top:6px;}
.scan-row{display:flex;justify-content:space-between;margin-bottom:7px;}
.scan-n{font-family:var(--mono);font-size:20px;font-weight:700;color:var(--txt2);line-height:1;}
.scan-l{font-size:8px;color:var(--txt3);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;}
.pill-row{display:flex;gap:5px;flex-wrap:wrap;}
.spill{font-size:8px;font-weight:700;letter-spacing:1px;padding:2px 7px;border-radius:2px;}
.sp-r{background:rgba(231,76,60,.15);color:var(--red);}
.sp-a{background:rgba(249,160,37,.12);color:var(--amber);}
.sp-g{background:rgba(0,214,143,.1);color:var(--green);}
.sp-u{background:var(--bdr);color:var(--txt3);}

/* NAV */
.nav{display:flex;gap:3px;padding:6px 16px;background:var(--bg3);border-bottom:1px solid var(--bdr);flex-wrap:wrap;}
.tab{padding:5px 14px;border-radius:2px;font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;background:transparent;border:1px solid var(--bdr2);color:var(--txt3);}
.tab:hover{color:var(--txt2);border-color:var(--bdr3);}
.tab.on{background:#0D2240;border-color:var(--bdr3);color:var(--gold);}
.tab.on.danger{background:#1A0608;border-color:rgba(231,76,60,.3);color:var(--red);}
.tab.on.anomaly{background:#100E06;border-color:rgba(249,160,37,.3);color:var(--amber);}
.tbadge{display:inline-flex;align-items:center;justify-content:center;min-width:15px;height:15px;padding:0 3px;background:var(--bdr2);border-radius:8px;font-size:9px;font-weight:800;margin-left:4px;}
.tab.on.danger .tbadge{background:var(--red);color:#fff;}
.tab.on.anomaly .tbadge{background:var(--amber);color:#000;}
.nav-ts{margin-left:auto;font-size:9px;color:var(--txt3);letter-spacing:1px;align-self:center;}

/* PANELS */
.content{padding:14px 16px 60px;max-width:1440px;margin:0 auto;}
.panel{display:none;}
.panel.on{display:block;}
.sec-hdr{font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--txt3);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--bdr);}

/* ALLIANCE BLOCK */
.ablock{background:var(--bg4);border:1px solid var(--bdr);border-radius:2px;margin-bottom:12px;overflow:hidden;}
.ahdr{display:flex;align-items:center;justify-content:space-between;padding:13px 20px;border-bottom:1px solid var(--bdr);cursor:pointer;user-select:none;transition:background .12s;}
.ahdr:hover{background:var(--bg5);}
.aname{font-size:14px;font-weight:700;letter-spacing:.5px;}
.asub{font-size:9px;color:var(--txt3);letter-spacing:1px;margin-top:3px;}
.apills{display:flex;gap:10px;align-items:center;}
.apill{font-size:9px;font-weight:700;letter-spacing:1px;display:flex;align-items:center;gap:4px;}
.dot{width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0;}
.dr{background:var(--red);box-shadow:0 0 5px rgba(231,76,60,.6);}
.da{background:var(--amber);}
.dg{background:var(--green);}
.ds{background:var(--slate);}
.chev{font-size:10px;color:var(--txt3);margin-left:14px;transition:transform .18s;display:inline-block;}
.ablock.col>.ablock-body{display:none;}
.ablock.col .achev{transform:rotate(-90deg);}

/* LEVEL SECTIONS */
.lvl-section{border-bottom:1px solid var(--bdr);}
.lvl-section:last-child{border-bottom:none;}
.lvl-section-hdr{display:flex;align-items:center;gap:10px;padding:9px 20px;background:var(--bg3);border-bottom:1px solid var(--bdr);}
.lvl-section-hdr .dot{width:7px;height:7px;}
.lvl-section-lbl{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;}

/* CARD GRID */
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:10px;padding:12px;}

/* PLAYER CARD */
.pcard{background:var(--bg5);border:1px solid var(--bdr);border-radius:2px;overflow:hidden;position:relative;}
.pcard::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;}
.pcard.R::before{background:var(--red);}
.pcard.A::before{background:var(--amber);}
.pcard.L::before{background:var(--amber);}
.pcard.G::before{background:var(--green);}
.pcard.U::before{background:var(--bdr3);}
.pcard.R{background:linear-gradient(160deg,rgba(231,76,60,.05) 0%,var(--bg5) 40%);}
.pcard.A{background:linear-gradient(160deg,rgba(249,160,37,.03) 0%,var(--bg5) 40%);}
.ctop{display:flex;align-items:flex-start;justify-content:space-between;padding:14px 16px 11px;cursor:pointer;transition:background .1s;}
.ctop:hover{background:rgba(255,255,255,.015);}
.cname{font-family:var(--mono);font-size:14px;font-weight:700;letter-spacing:.3px;}
.cally{font-size:9px;color:var(--txt3);letter-spacing:1px;margin-top:3px;text-transform:uppercase;}
.clevel-txt{font-size:17px;font-weight:900;letter-spacing:3px;text-transform:uppercase;line-height:1;text-align:right;}
.clevel-txt.R{color:var(--red);text-shadow:0 0 18px rgba(231,76,60,.35);}
.clevel-txt.A,.clevel-txt.L{color:var(--amber);}
.clevel-txt.G{color:var(--green);}
.clevel-txt.U{color:var(--slate);}
.clevel-flags{font-size:9px;color:var(--txt3);letter-spacing:1px;margin-top:4px;text-align:right;}
.view-hist{font-size:8px;color:var(--txt3);letter-spacing:1px;border:1px solid var(--bdr2);border-radius:2px;padding:2px 6px;margin-top:6px;display:inline-block;cursor:pointer;text-align:right;}
.ctop:hover .view-hist{border-color:var(--bdr3);color:var(--txt2);}

/* METER */
.meter{padding:4px 16px 12px;border-bottom:1px solid var(--bdr);}
.meter-lbl{font-size:8px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--txt3);margin-bottom:9px;}
.meter-track{position:relative;height:10px;border-radius:5px;background:linear-gradient(to right,#00D68F 0%,#69F0AE 20%,#E8B84B 40%,#F9A825 57%,#F57F17 76%,#E74C3C 100%);box-shadow:inset 0 1px 3px rgba(0,0,0,.6);}
.meter-ball{position:absolute;top:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 38% 35%,#fff,#c0ccd8);box-shadow:0 2px 6px rgba(0,0,0,.8),0 0 0 2px rgba(255,255,255,.2);}
.meter-foot{position:relative;height:16px;margin-top:5px;}
.meter-tick-wrap{position:absolute;display:flex;flex-direction:column;align-items:center;transform:translateX(-50%);}
.meter-tick{width:1px;height:4px;background:var(--bdr3);margin-bottom:2px;}
.meter-tick-lbl{font-size:8px;color:var(--txt3);white-space:nowrap;}
.meter-readout{display:flex;align-items:baseline;justify-content:space-between;margin-top:9px;}
.meter-band{font-size:11px;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;}
.meter-val{font-family:var(--mono);font-size:11px;font-weight:700;color:var(--txt2);}

/* METRICS */
.cmetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--bdr);border-bottom:1px solid var(--bdr);}
.cm{background:var(--bg3);padding:9px 10px;text-align:center;}
.cmv{font-family:var(--mono);font-size:12px;font-weight:700;}
.cml{font-size:8px;color:var(--txt3);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;}

/* FLAGS */
.cflags{padding:9px 14px 4px;}
.chk-section{padding:10px 14px 4px;border-top:1px solid var(--bdr);}
.chk-title{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--txt3);margin-bottom:8px;font-weight:700;}
.chk-list{display:flex;flex-direction:column;gap:5px;}
.chk-row{display:flex;align-items:flex-start;gap:8px;}
.chk-icon{font-size:11px;margin-top:1px;min-width:12px;}
.chk-lbl{font-family:var(--mono);font-size:10px;color:var(--txt2);line-height:1.3;}
.chk-detail{font-size:10px;color:var(--txt3);line-height:1.4;margin-top:1px;}
.chk-profile-note{font-size:9px;color:var(--txt3);margin-top:8px;padding-top:6px;border-top:1px solid var(--bdr);}
.flag-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 9px;margin-bottom:5px;background:rgba(249,160,37,.03);border-left:2px solid rgba(249,160,37,.2);cursor:pointer;transition:background .1s;}
.flag-row:hover{background:rgba(249,160,37,.07);}
.flag-inner{display:grid;grid-template-columns:118px 1fr;gap:8px;}
.ftag{font-family:var(--mono);font-size:8px;font-weight:900;color:var(--amber);letter-spacing:1px;padding-top:1px;}
.fdet{font-size:11px;color:var(--txt3);line-height:1.5;}
.fconf{display:inline-block;font-size:8px;font-weight:700;padding:1px 6px;border-radius:2px;margin-top:3px;}
.fc-w{background:rgba(245,160,37,.15);color:var(--amber);}
.fc-m{background:rgba(245,160,37,.25);color:var(--amber);}
.fc-e{background:rgba(231,76,60,.2);color:var(--red);}
.fwhy{align-self:center;flex-shrink:0;width:18px;height:18px;border-radius:50%;background:var(--bdr2);border:1px solid var(--bdr3);color:var(--txt3);font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.flag-row:hover .fwhy{background:var(--bdr3);color:var(--txt2);}
.cftr{display:flex;align-items:center;justify-content:space-between;padding:7px 14px;border-top:1px solid var(--bdr);font-size:9px;color:var(--txt3);}
.fnew{font-size:8px;font-weight:800;letter-spacing:1px;padding:2px 7px;border-radius:2px;background:rgba(59,130,246,.12);color:#7AAAF0;border:1px solid rgba(59,130,246,.2);}

/* CLEAR COLLAPSE */
.clear-summary{display:flex;align-items:center;justify-content:space-between;padding:13px 20px;cursor:pointer;transition:background .12s;}
.clear-summary:hover{background:rgba(0,214,143,.02);}
.clear-sum-left{display:flex;align-items:center;gap:14px;}
.clear-count{font-family:var(--mono);font-size:26px;font-weight:700;color:var(--green);line-height:1;}
.clear-label{font-size:12px;color:var(--txt2);font-weight:600;}
.clear-sub{font-size:10px;color:var(--txt3);margin-top:3px;}
.clear-toggle{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--txt3);background:var(--bdr2);border:1px solid var(--bdr3);border-radius:2px;padding:5px 12px;cursor:pointer;transition:all .12s;white-space:nowrap;}
.clear-toggle:hover{color:var(--txt2);}
.compact-list{display:none;border-top:1px solid var(--bdr);}
.compact-list.on{display:block;}
.compact-hdr{display:grid;grid-template-columns:1fr 140px 110px 70px 55px;gap:8px;padding:6px 20px;background:var(--bg3);border-bottom:1px solid var(--bdr);}
.compact-hdr span{font-size:8px;color:var(--txt3);letter-spacing:1.5px;text-transform:uppercase;font-weight:700;}
.compact-row{display:grid;grid-template-columns:1fr 140px 110px 70px 55px;gap:8px;padding:8px 20px;border-bottom:1px solid var(--bdr);align-items:center;transition:background .1s;}
.compact-row:last-child{border-bottom:none;}
.compact-row:hover{background:rgba(255,255,255,.012);}
.cmp-name{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--txt2);}
.cmp-band{display:inline-flex;align-items:center;gap:5px;font-size:9px;font-weight:700;letter-spacing:1px;}
.band-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
.cmp-cd{font-family:var(--mono);font-size:12px;color:var(--txt2);}
.cmp-reads{font-size:11px;color:var(--txt3);text-align:center;}
.cmp-ago{font-size:10px;color:var(--txt3);text-align:right;}

/* ANOMALY CARDS */
.anoms{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px;}
.anom-card{background:var(--bg4);border:1px solid var(--bdr);border-radius:2px;overflow:hidden;cursor:pointer;transition:border-color .12s;}
.anom-card:hover{border-color:var(--bdr3);}
.anom-card.high{border-color:rgba(231,76,60,.2);}
.anom-card.med{border-color:rgba(249,160,37,.18);}
.anom-top{display:flex;align-items:flex-start;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid var(--bdr);}
.anom-name{font-size:14px;font-weight:700;}
.anom-rank{font-size:9px;color:var(--txt3);margin-top:3px;}
.anom-spike-n{font-family:var(--mono);font-size:20px;font-weight:900;text-align:right;}
.anom-spike-l{font-size:8px;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-top:3px;text-align:right;}
.anom-row{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--bdr);}
.anom-cell{background:var(--bg3);padding:9px 12px;text-align:center;}
.anom-v{font-family:var(--mono);font-size:12px;font-weight:700;}
.anom-l{font-size:8px;color:var(--txt3);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;}
.anom-note{padding:9px 14px;font-size:10px;color:var(--txt3);border-top:1px solid var(--bdr);line-height:1.6;}
.anom-note strong{color:var(--txt2);font-weight:600;}
.empty-state{text-align:center;padding:60px 20px;}
.empty-state h3{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--txt2);margin-bottom:10px;}
.empty-state p{font-size:12px;color:var(--txt3);}

@media(max-width:700px){
  .cmd{grid-template-columns:1fr}
  .cmd-cell{border-right:none;border-bottom:1px solid var(--bdr)}
  .pgrid,.anoms{grid-template-columns:1fr}
  .cmetrics{grid-template-columns:repeat(2,1fr)}
  .compact-hdr,.compact-row{grid-template-columns:1fr 100px 80px 50px}
  .compact-hdr span:last-child,.cmp-ago{display:none}
}
</style>
</head>
<body>

<!-- APP -->
<div id="app">

<!-- MODAL -->
<div class="modal-bg" id="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <div class="modal-hdr">
      <div class="modal-title" id="mtitle">—</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" id="mbody"></div>
  </div>
</div>

<!-- HEADER -->
<div class="hdr">
  <div class="hdr-top">
    <div>
      <div class="brand">◆ HUNTER</div>
      <div class="brand-sub">Behavioral Forensics</div>
    </div>
    <div class="live">
      <div class="live-dot"></div>
      <span class="live-txt">LIVE</span>
      <span style="font-size:10px;color:var(--txt3);">&nbsp;<span id="lastscan">—</span></span>
    </div>
  </div>
  <div class="cmd">
    <div class="cmd-cell" onclick="showModal('Threat Level',threatHtml())">
      <div class="cmd-lbl">Threat Level</div>
      <div class="threat-lvl" id="tlvl-txt">—</div>
      <div class="threat-sub" id="tlvl-sub">Loading...</div>
    </div>
    <div class="cmd-cell" onclick="showModal('Highest Anomaly Score',topSubjectHtml())">
      <div class="cmd-lbl">Highest Anomaly Score</div>
      <div id="top-name" class="alert-name">—</div>
      <div id="top-band"></div>
      <div id="top-meta" class="alert-meta"></div>
      <div id="top-flags" class="alert-flags" style="display:none"></div>
    </div>
    <div class="cmd-cell" onclick="showModal('Scan Summary',scanHtml())">
      <div class="cmd-lbl">Scan Summary</div>
      <div class="scan-row">
        <div><div class="scan-n" id="s-tot">—</div><div class="scan-l">Players</div></div>
        <div><div class="scan-n" id="s-ali">—</div><div class="scan-l">Alliances</div></div>
        <div><div class="scan-n" id="s-flags">—</div><div class="scan-l">Anomalies</div></div>
      </div>
      <div class="pill-row">
        <span class="spill sp-r" id="p-red">—</span>
        <span class="spill sp-a" id="p-amb">—</span>
        <span class="spill sp-g" id="p-grn">—</span>
      </div>
    </div>
  </div>
</div>

<!-- NAV -->
<div class="nav">
  <button class="tab on danger" onclick="sw('flagged',this)">Flagged <span class="tbadge" id="rc">0</span></button>
  <button class="tab" onclick="sw('all',this)">All Subjects</button>
  <button class="tab" id="anom-tab" onclick="sw('anom',this)">Pace Anomalies <span class="tbadge" id="ac">0</span></button>
  <button class="tab" onclick="sw('ind',this)">Individuals</button>
  <span class="nav-ts" id="ts-lbl">—</span>
</div>

<!-- PANELS -->
<div class="content">
  <div class="panel on" id="p-flagged"><div id="c-flagged"></div></div>
  <div class="panel" id="p-all"><div id="c-all"></div></div>
  <div class="panel" id="p-anom">
    <div class="sec-hdr">Alliance Pace Anomalies — cross-referenced from Projections data</div>
    <div class="anoms" id="c-anom"></div>
  </div>
  <div class="panel" id="p-ind">
    <div class="sec-hdr">Individual Subjects</div>
    <div id="c-ind"></div>
  </div>
</div>

</div><!-- /app -->

<script>

let _data=null;
addEventListener('DOMContentLoaded',load);

/* TABS */
function sw(name,el){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on','danger','anomaly'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
  if(name==='flagged')el.classList.add('danger');
  if(name==='anom')el.classList.add('anomaly');
  document.getElementById('p-'+name).classList.add('on');
}

/* MODAL */
function showModal(t,h){document.getElementById('mtitle').textContent=t;document.getElementById('mbody').innerHTML=h;document.getElementById('modal').classList.add('on');}
function closeModal(){document.getElementById('modal').classList.remove('on');}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

/* UTILS */
const fm=v=>{if(!v&&v!==0)return'—';if(v>=1e6)return'$'+(v/1e6).toFixed(2)+'M';if(v>=1e3)return'$'+(v/1e3).toFixed(0)+'K';return'$'+Math.round(v).toLocaleString();};
function ago(iso){if(!iso)return'—';const m=Math.floor((Date.now()-new Date(iso))/60000);if(m<1)return'Just now';if(m<60)return m+'m ago';const h=Math.floor(m/60);if(h<24)return h+'h ago';return Math.floor(h/24)+'d ago';}
function cdToPct(cd){if(cd<=0)return 2;if(cd<200000)return 2+(cd/200000)*16;if(cd<550000)return 18+((cd-200000)/350000)*20;if(cd<900000)return 38+((cd-550000)/350000)*17;if(cd<3500000)return 55+((cd-900000)/2600000)*33;return 93;}
function bandInfo(cd){
  if(cd<200000)return{label:'NORMAL',color:'#00D68F',cls:'NORMAL'};
  if(cd<550000)return{label:'GOOD',color:'#69F0AE',cls:'GOOD'};
  if(cd<900000)return{label:'ELITE',color:'#E8B84B',cls:'ELITE'};
  if(cd<3500000)return{label:'ELEVATED MONITORING',color:'#F9A825',cls:'ELEVATED'};
  return{label:'EXTREME ANOMALY',color:'#E74C3C',cls:'EXTREME'};
}
function confBadge(n){
  if(n<5)return\`<span class="fconf fc-w">\${n} readings — watch only</span>\`;
  if(n<10)return\`<span class="fconf fc-m">\${n} readings — pattern emerging</span>\`;
  return\`<span class="fconf fc-e">\${n} readings — established pattern</span>\`;
}
function lvlColor(l){return{RED:'var(--red)',AMBER:'var(--amber)',LOW:'var(--amber)',GREEN:'var(--green)',UNRATED:'var(--slate)'}[l]||'var(--slate)';}
function lvlClass(l){return{RED:'R',AMBER:'A',LOW:'L',GREEN:'G',UNRATED:'U'}[l]||'U';}
function levelLabel(l){return{RED:'RED',AMBER:'WATCH',LOW:'WATCH',GREEN:'CLEAR',UNRATED:'—'}[l]||'—';}
function flagLabel(f){
  const m={CD_IMPOSSIBLE:'EXTREME OUTPUT',CD_SUSPICIOUS:'HIGH OUTPUT',OFFLINE_OUTPUT:'OUTPUT WITHOUT PRESENCE',CONT_BURST:'ACCELERATION SPIKE',SV_BURST:'VALUE SPIKE',CONT_Z_SCORE:'STATISTICAL STANDOUT'};
  return m[f]||f;
}
function snapCtx(n){if(n<5)return'watch only';if(n<10)return'pattern emerging';return'established pattern';}

/* METER HTML */
function meterHtml(cd){
  const pct=Math.min(95,Math.max(4,cdToPct(cd||0)));
  const bi=bandInfo(cd||0);
  return\`<div class="meter">
<div class="meter-lbl">C/D Output Band</div>
<div class="meter-track"><div class="meter-ball" style="left:\${pct}%"></div></div>
<div class="meter-foot">
<div class="meter-tick-wrap" style="left:20%"><div class="meter-tick"></div><div class="meter-tick-lbl">$200K</div></div>
<div class="meter-tick-wrap" style="left:40%"><div class="meter-tick"></div><div class="meter-tick-lbl">$550K</div></div>
<div class="meter-tick-wrap" style="left:57%"><div class="meter-tick"></div><div class="meter-tick-lbl">$900K</div></div>
<div class="meter-tick-wrap" style="left:88%"><div class="meter-tick"></div><div class="meter-tick-lbl">$3.5M</div></div>
</div>
<div class="meter-readout">
<span class="meter-band" style="color:\${bi.color}">\${bi.label}</span>
<span class="meter-val">\${fm(cd)} / day</span>
</div></div>\`;
}

/* FLAG HTML */
const FLAG_HELP={
  CD_IMPOSSIBLE:{sub:'Output band',what:'The contribution output for this player sits in the Extreme range — above $3.5M/day. This level is not achievable through normal play patterns.',why:'The system tracks output over multiple readings, not just one data point. Reaching and sustaining this level is a significant standout.'},
  CD_SUSPICIOUS:{sub:'Output band',what:'The C/D output is in the Elevated Monitoring range ($900K–$3.5M). Sustained across multiple readings, not a single spike.',why:'Most active competitive players sit between $200K–$550K. Readings consistently above $900K are a notable standout from the group.'},
  OFFLINE_OUTPUT:{sub:'Online time vs output',what:'This flag triggers when output is high but logged online hours are consistently low. More play time generally means more output.',why:'When high output occurs during periods of very low logged online time, across multiple readings, it is a pattern worth monitoring.'},
  CONT_BURST:{sub:'Contribution rate vs the group',what:'This flag compares how fast this player is growing relative to others in the same scan. One player significantly outpacing the rest stands out.',why:'A rate several times higher than the group average is notable — especially when it holds across multiple readings rather than appearing once.'},
  SV_BURST:{sub:'Share value growth vs the group',what:'Share value growing significantly faster than the other players scanned at the same time.',why:'Share value growth reflects consistent output over time. A sustained gap versus the rest of the group is worth monitoring.'},
  CONT_Z_SCORE:{sub:'Statistical comparison',what:'The contribution rate is a statistical outlier compared to the group — sitting well outside the normal range for players at this level.',why:'Statistics alone do not confirm anything. Combined with other flags and sustained across many readings, a consistent outlier position adds to the overall picture.'}
};
function flagHtml(fd){
  const label=flagLabel(fd.flag);
  const help=FLAG_HELP[fd.flag]||{sub:'Detection flag',what:'This flag has been triggered based on the player\\'s tracked output pattern.',why:'More readings over more days will confirm or clear this flag.'};
  const detail=fd.detail||'';
  return\`<div class="flag-row" onclick="showModal('\${label}',flagModalHtml('\${label}','\${help.sub}','\${help.what.replace(/'/g,"\\\\'")}','\${help.why.replace(/'/g,"\\\\'")}'))">
<div class="flag-inner"><div class="ftag">\${label}</div><div><div class="fdet">\${detail}</div></div></div>
<div class="fwhy">?</div></div>\`;
}
function flagModalHtml(name,sub,what,why){
  return\`<p style="font-size:10px;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">\${sub}</p>
<p><strong>What is this?</strong><br>\${what}</p>
<hr class="modal-rule">
<p><strong>Why does it matter?</strong><br>\${why}</p>
<hr class="modal-rule">
<p style="color:var(--txt3);font-size:11px;">A single flag on its own is not a conclusion. Hunter looks for multiple flags building across multiple readings before escalating a subject's status.</p>\`;
}

/* HISTORY MODAL */
function histModal(p){
  const hist=p.hist||[];
  if(hist.length<2){showModal('Reading History — '+p.airline_name,'<p style="color:var(--txt3)">Not enough readings yet to show a trend. Submit more scans over the coming days to build the history chart.</p>');return;}
  const vals=hist.map(h=>h.cd_value||0);
  const max=Math.max(...vals,1);
  const bi=bandInfo(p.cd_value||0);
  const first=vals[0],last=vals[vals.length-1];
  const rising=last>first;
  const pct=first>0?Math.abs(Math.round((last-first)/first*100)):0;
  const bars=hist.slice(-8).map((h,i,arr)=>{
    const v=h.cd_value||0;
    const ht=Math.max(6,Math.round((v/max)*76));
    const opacity=0.4+0.6*(i/(arr.length-1));
    const dt=h.snapshot_time?(new Date(h.snapshot_time).toLocaleDateString('en-AU',{day:'numeric',month:'short'})):'—';
    return\`<div class="hist-bar-wrap"><div class="hist-bar-val">\${fm(v)}</div><div class="hist-bar" style="height:\${ht}px;background:\${bi.color};opacity:\${opacity}"></div><div class="hist-bar-date">\${dt}</div></div>\`;
  }).join('');
  showModal('Reading History — '+p.airline_name,\`
<p style="font-size:10px;color:var(--txt3);letter-spacing:1px;margin-bottom:16px;">\${hist.length} READINGS · \${p.days_tracked||'?'} DAYS TRACKED</p>
<div style="margin-top:4px;"><div class="hist-bars">\${bars}</div><div class="hist-lbl"><span>C/D Output per day</span><span>Older → Recent</span></div></div>
<div class="trend-note"><span style="font-size:16px;color:\${bi.color}">\${rising?'↑':'→'}</span><span>Output \${rising?'increased':'remained stable'} <strong style="color:\${bi.color}">\${rising?'+':'-'}\${pct}%</strong> from first reading to most recent.</span></div>
<hr class="modal-rule">
<p style="font-size:11px;color:var(--txt3);">Each bar is a separate submission. Rising bars across multiple readings build a stronger picture than any single data point. More readings over more days = higher confidence.</p>\`);
}

/* PLAYER CARD */
function card(p){
  const lv=p.level||'UNRATED';
  const lc=lvlClass(lv);
  const ll=levelLabel(lv);
  const ally=p.alliance_name&&p.alliance_name!=='UNKNOWN'?p.alliance_name:'Independent';
  const flags=(p.flag_details||[]).map(flagHtml).join('');
  const flagSection=flags?\`<div class="cflags">\${flags}</div>\`:'';
  const newBadge=p.roster_status==='NEW'?'<span class="fnew">NEW ENTRANT</span>':'';
  const anomCount=p.flags?.length||0;
  const pSub=anomCount?\`\${anomCount} anomal\${anomCount===1?'y':'ies'}\`:'No anomalies';
  const showChecks=(lv==='GREEN'||lv==='UNRATED')?checksPassedSection(p):'';
  return\`<div class="pcard \${lc}">
<div class="ctop" onclick="histModal(\${JSON.stringify(p).replace(/</g,'\\\\u003c')})">
<div><div class="cname">\${p.airline_name}</div><div class="cally">\${ally} · \${p.snap_count||0} readings · \${p.days_tracked||0}d</div></div>
<div><div class="clevel-txt \${lc}">\${ll}</div><div class="clevel-flags">\${pSub}</div><div class="view-hist">View history →</div></div>
</div>
\${meterHtml(p.cd_value)}
<div class="cmetrics">
<div class="cm"><div class="cmv" style="color:\${bandInfo(p.cd_value||0).color}">\${fm(p.cd_value)}</div><div class="cml">C / Day</div></div>
<div class="cm"><div class="cmv">\${fm(p.sv)}</div><div class="cml">Share Value</div></div>
<div class="cm"><div class="cmv">\${p.snap_count||0}</div><div class="cml">Readings</div></div>
<div class="cm"><div class="cmv">\${p.days_tracked>0?p.days_tracked.toFixed(1)+'d':'<1d'}</div><div class="cml">Tracked</div></div>
</div>
\${flagSection}\${showChecks}
<div class="cftr"><span>\${ago(p.lastUpdated)}</span>\${newBadge}</div>
</div>\`;
}

/* COMPACT ROW */
function compactRow(p){
  const bi=bandInfo(p.cd_value||0);
  const safe=p.airline_name.replace(/\\\\/g,'\\\\\\\\').replace(/'/g,"\\\\'");
  return\`<div class="compact-row" onclick="showPlayerDetail('\${safe}')" style="cursor:pointer" title="Click to view full assessment">
<div class="cmp-name">\${p.airline_name}</div>
<div class="cmp-band"><span class="band-dot" style="background:\${bi.color}"></span><span style="color:\${bi.color}">\${bi.label.replace(' MONITORING','')}</span></div>
<div class="cmp-cd">\${fm(p.cd_value)}</div>
<div class="cmp-reads">\${p.snap_count||0} readings</div>
<div class="cmp-ago">\${ago(p.lastUpdated)}&nbsp;›</div>
</div>\`;
}

/* CHECKS PASSED SECTION — shown on CLEAR cards and player detail modal */
function checksPassedSection(p){
  const active=new Set(p.flags||[]);
  const hasProfile=p.profile&&p.profile.on_file;
  const insufficient=(p.snap_count||0)<2;
  const checks=[
    {flag:'CD_IMPOSSIBLE',label:'Extreme Output',pass:'Below extreme threshold ($3.5M/day)',always:true},
    {flag:'CD_SUSPICIOUS',label:'High Output Band',pass:'Below high-scrutiny threshold ($900K/day)',always:true},
    {flag:'OFFLINE_OUTPUT',label:'Output vs Presence',pass:'Output is consistent with observed play time'},
    {flag:'SV_BURST',label:'Share Value Growth',pass:'SV growth within normal range for this group'},
    {flag:'CONT_BURST',label:'Contribution Acceleration',pass:'Contribution pace within normal range'},
    {flag:'CONT_Z_SCORE',label:'Statistical Comparison',pass:'Within normal statistical range for this group'},
  ];
  if(hasProfile){
    checks.push(
      {flag:'FLEET_CEILING_BREACH',label:'Fleet Ceiling',pass:'Output within theoretical fleet maximum ('+fm(p.profile.theoretical_max_cd)+')'},
      {flag:'IMPOSSIBLE_FLIGHT_DENSITY',label:'Flight Rate — Physical Limit',pass:'Historical flight rate within physical limits'},
      {flag:'HIGH_FLIGHT_DENSITY',label:'Flight Rate — Concorde Benchmark',pass:'Historical flight rate below Concorde + 4x ceiling'}
    );
  }
  const rows=checks.map(c=>{
    if(active.has(c.flag))return''; // flagged — already shown in anomaly section
    const pending=insufficient&&!c.always;
    const icon=pending?'\u23f3':'✓';
    const iconColor=pending?'var(--txt3)':'var(--green)';
    const detail=pending?'Needs 2+ readings to assess':c.pass;
    const detailColor=pending?'var(--txt3)':'var(--txt3)';
    return\`<div class="chk-row">
<span class="chk-icon" style="color:\${iconColor}">\${icon}</span>
<div><div class="chk-lbl">\${c.label}</div><div class="chk-detail" style="color:\${detailColor}">\${detail}</div></div>
</div>\`;
  }).filter(Boolean).join('');
  if(!rows)return'';
  return\`<div class="chk-section">
<div class="chk-title">Parameters checked</div>
<div class="chk-list">\${rows}</div>
\${hasProfile?\`<div class="chk-profile-note">\u{1F4CC} Profile on file \u00b7 Fleet \${p.profile.fleet_total}\${p.profile.level_am4?' \u00b7 Lvl '+p.profile.level_am4:''}\${p.profile.aircraft_class?' \u00b7 '+p.profile.aircraft_class:''}</div>\`:''}
</div>\`;
}

/* PLAYER DETAIL MODAL — triggered by compact row click */
function playerDetailHtml(p){
  const bi=bandInfo(p.cd_value||0);
  const lv=p.level||'UNRATED';
  const ll=levelLabel(lv);
  const lc=lvlClass(lv);
  const ally=p.alliance_name&&p.alliance_name!=='UNKNOWN'?p.alliance_name:'Independent';
  const flags=(p.flag_details||[]).map(flagHtml).join('');
  const flagSection=flags?\`<div class="cflags" style="margin:0 -20px;padding:12px 20px;border-top:1px solid var(--bdr)">\${flags}</div>\`:'';
  return\`<div style="margin:-4px 0 8px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
<div style="font-size:9px;color:var(--txt3);letter-spacing:1.5px;text-transform:uppercase">\${ally} \u00b7 \${p.snap_count||0} readings \u00b7 \${p.days_tracked||0}d tracked</div>
<div class="clevel-txt \${lc}" style="font-size:13px">\${ll}</div>
</div>
\${meterHtml(p.cd_value)}
<div class="cmetrics" style="border:none;padding:12px 0 8px">
<div class="cm"><div class="cmv" style="color:\${bi.color}">\${fm(p.cd_value)}</div><div class="cml">C / Day</div></div>
<div class="cm"><div class="cmv">\${fm(p.sv)}</div><div class="cml">Share Value</div></div>
<div class="cm"><div class="cmv">\${p.snap_count||0}</div><div class="cml">Readings</div></div>
<div class="cm"><div class="cmv">\${p.days_tracked>0?p.days_tracked.toFixed(1)+'d':'<1d'}</div><div class="cml">Tracked</div></div>
</div>
\${flagSection}
\${checksPassedSection(p)}
<div style="margin-top:12px"><button class="clear-toggle" onclick="histModal(\${JSON.stringify(p).replace(/</g,'\\\\u003c')});closeModal()" style="width:100%;justify-content:center">View reading history \u2192</button></div>
</div>\`;
}

function showPlayerDetail(name){
  const all=getAllPlayers();
  const p=all.find(pl=>pl.airline_name===name);
  if(!p)return;
  showModal(p.airline_name,playerDetailHtml(p));
}

/* ALLIANCE BLOCK */
function allianceBlock(a){
  const pl=a.players||[];
  const dep=a.departed||[];
  const red=pl.filter(p=>p.level==='RED');
  const watch=pl.filter(p=>p.level==='AMBER'||p.level==='LOW');
  const clear=pl.filter(p=>p.level==='GREEN'||p.level==='UNRATED');
  const partial=a._partial?\`<span style="color:var(--txt3);font-size:9px;"> · Partial scan — \${pl.length} of ~\${a._knownTotal||'?'} players</span>\`:'';
  const pills=[
    red.length?\`<span class="apill"><span class="dot dr"></span><span style="color:var(--red)">\${red.length} Red</span></span>\`:'',
    watch.length?\`<span class="apill"><span class="dot da"></span><span style="color:var(--amber)">\${watch.length} Watch</span></span>\`:'',
    clear.length?\`<span class="apill"><span class="dot dg"></span><span style="color:var(--green)">\${clear.length} Clear</span></span>\`:''
  ].filter(Boolean).join('');
  const bid=\`ab_\${Math.random().toString(36).slice(2)}\`;

  let sections='';
  if(red.length){sections+=\`<div class="lvl-section"><div class="lvl-section-hdr"><span class="dot dr"></span><span class="lvl-section-lbl" style="color:var(--red)">Red — Elevated Monitoring (\${red.length})</span></div><div class="pgrid">\${red.map(card).join('')}</div></div>\`;}
  if(watch.length){sections+=\`<div class="lvl-section"><div class="lvl-section-hdr"><span class="dot da"></span><span class="lvl-section-lbl" style="color:var(--amber)">Watch — Anomalies Building (\${watch.length})</span></div><div class="pgrid">\${watch.map(card).join('')}</div></div>\`;}
  if(clear.length){
    const cid=\`cl_\${bid}\`;const cbid=\`clb_\${bid}\`;
    sections+=\`<div class="lvl-section">
<div class="clear-summary" onclick="toggleClear('\${cid}','\${cbid}')">
<div class="clear-sum-left">
<div class="clear-count">\${clear.length}</div>
<div><div class="clear-label">\${clear.length===1?'Player':'Players'} within normal output range</div><div class="clear-sub">No anomalies detected · All C/D output in Good or Normal band</div></div>
</div>
<button class="clear-toggle" id="\${cbid}">Show all <span>▾</span></button>
</div>
<div class="compact-list" id="\${cid}">
<div class="compact-hdr"><span>Player</span><span>Band</span><span>C/Day</span><span>Readings</span><span>Last seen</span></div>
\${clear.map(compactRow).join('')}
</div></div>\`;
  }
  if(dep.length){sections+=\`<div style="padding:8px 20px 12px;background:var(--bg3);border-top:1px solid var(--bdr);"><div style="font-size:8px;color:var(--txt3);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Departed (\${dep.length})</div><div style="display:flex;flex-wrap:wrap;gap:5px;">\${dep.map(n=>\`<span style="font-family:var(--mono);font-size:9px;color:var(--txt3);padding:2px 8px;border:1px solid var(--bdr);border-radius:2px;text-decoration:line-through">\${n}</span>\`).join('')}</div></div>\`;}
  return\`<div class="ablock">
<div class="ahdr" onclick="this.nextElementSibling.classList.toggle('hidden');this.querySelector('.achev').style.transform=this.nextElementSibling.classList.contains('hidden')?'rotate(-90deg)':''">
<div><div class="aname">\${a.allianceName}</div><div class="asub">\${pl.length} subjects monitored\${partial}</div></div>
<div style="display:flex;align-items:center;"><div class="apills">\${pills}</div><span class="achev chev">▾</span></div>
</div>
<div class="ablock-body">\${sections}</div>
</div>\`;
}

function toggleClear(listId,btnId){
  const list=document.getElementById(listId);const btn=document.getElementById(btnId);
  const on=list.classList.toggle('on');
  btn.innerHTML=on?'Collapse <span>▴</span>':'Show all <span>▾</span>';
}

/* COMMAND STRIP HTML */
function threatHtml(){
  return\`<p>The <strong>Threat Level</strong> reflects the most severe status across all monitored subjects right now.</p>
<div class="modal-kv">
<div class="modal-k" style="color:var(--green)">CLEAR</div><div class="modal-v">No anomalies across any subjects. All output within normal ranges.</div>
<div class="modal-k" style="color:var(--amber)">WATCH</div><div class="modal-v">One or more subjects showing a single anomaly. Monitoring in progress — no action needed yet.</div>
<div class="modal-k" style="color:var(--amber)">ELEVATED</div><div class="modal-v">Multiple anomalies across one or more subjects. A pattern is building.</div>
<div class="modal-k" style="color:var(--red)">CRITICAL</div><div class="modal-v">One or more subjects in the Extreme output range, or with a fully established pattern across 10+ readings.</div>
</div>
<hr class="modal-rule">
<p style="color:var(--txt3);font-size:11px;">Status updates every time new data is submitted. A subject can move from Red back to Green if their output normalises over subsequent readings. This is not a permanent label.</p>\`;
}
function topSubjectHtml(){
  const all=getAllPlayers();const top=all.sort((a,b)=>(b.flags?.length||0)-(a.flags?.length||0))[0];
  if(!top)return'<p style="color:var(--txt3)">No subjects on file yet.</p>';
  return\`<p>This shows the player currently carrying the most active anomaly flags. It is <strong>not an accusation</strong> — it identifies who is furthest outside normal patterns right now.</p>
<div class="modal-kv">
<div class="modal-k">Player</div><div class="modal-v">\${top.airline_name}</div>
<div class="modal-k">Alliance</div><div class="modal-v">\${top.alliance_name||'—'}</div>
<div class="modal-k">C/D Output</div><div class="modal-v">\${fm(top.cd_value)}/day</div>
<div class="modal-k">Active anomalies</div><div class="modal-v">\${top.flags?.length||0}</div>
<div class="modal-k">Readings</div><div class="modal-v">\${top.snap_count||0} over \${top.days_tracked||0} days</div>
</div>
<hr class="modal-rule">
<p style="color:var(--txt3);font-size:11px;">Tap the player card below to view their full reading history and see how their output has moved over time.</p>\`;
}
function scanHtml(){
  const all=getAllPlayers();
  const rc=all.filter(p=>p.level==='RED').length;const ac=all.filter(p=>p.level==='AMBER'||p.level==='LOW').length;const gc=all.filter(p=>p.level==='GREEN').length;
  return\`<p>A count of everything currently in the system.</p>
<div class="modal-kv">
<div class="modal-k">Players</div><div class="modal-v">Total players being tracked.</div>
<div class="modal-k">Alliances</div><div class="modal-v">Distinct alliances with at least one monitored player.</div>
<div class="modal-k">Anomalies</div><div class="modal-v">Total flags active across all subjects. One player can have more than one.</div>
</div>
<hr class="modal-rule">
<div class="modal-kv">
<div class="modal-k" style="color:var(--red)">RED · \${rc}</div><div class="modal-v">3+ separate flags triggered. Multiple anomalies building across readings.</div>
<div class="modal-k" style="color:var(--amber)">WATCH · \${ac}</div><div class="modal-v">1–2 flags active. Pattern is emerging — not yet established.</div>
<div class="modal-k" style="color:var(--green)">CLEAR · \${gc}</div><div class="modal-v">No flags. Output within normal range across all readings.</div>
</div>\`;
}
function getAllPlayers(){
  if(!_data)return[];
  return[...(_data.alliances||[]).flatMap(a=>a.players||[]),...(_data.individuals||[])];
}

/* RENDER */
function render(data){
  if(!data)return;
  _data=data;
  const alliances=data.alliances||[];const individuals=data.individuals||[];
  const all=[...alliances.flatMap(a=>a.players||[]),...individuals];
  const rc=all.filter(p=>p.level==='RED').length;
  const ac=all.filter(p=>p.level==='AMBER'||p.level==='LOW').length;
  const gc=all.filter(p=>p.level==='GREEN').length;
  const uc=all.filter(p=>p.level==='UNRATED').length;
  const totalFlags=all.reduce((s,p)=>s+(p.flags?.length||0),0);

  // Command strip
  const tl=rc>0?'CRITICAL':ac>0?'ELEVATED':all.some(p=>p.level==='UNRATED')?'WATCH':'CLEAR';
  const tlEl=document.getElementById('tlvl-txt');
  tlEl.className='threat-lvl threat-'+tl;tlEl.textContent=tl;
  const rStr=rc?\`<span class="threat-dot" style="background:var(--red)"></span>\${rc} red &nbsp;·&nbsp; \`:'';
  const aStr=ac?\`<span class="threat-dot" style="background:var(--amber)"></span>\${ac} watch\`:(rc?'':all.length+' subjects — all clear');
  document.getElementById('tlvl-sub').innerHTML=\`\${rStr}\${aStr}<br>\${all.length} subjects monitored across \${alliances.length} alliance\${alliances.length!==1?'s':''}\`;

  const top=all.sort((a,b)=>(b.flags?.length||0)-(a.flags?.length||0))[0];
  if(top){
    const bi=bandInfo(top.cd_value||0);
    document.getElementById('top-name').textContent=top.airline_name;
    document.getElementById('top-band').innerHTML=\`<span class="alert-band band-\${bi.cls}">\${bi.label}</span><span class="alert-cd">\${fm(top.cd_value)} / day</span>\`;
    document.getElementById('top-meta').textContent=\`\${top.alliance_name||'Individual'} · \${top.snap_count||0} readings · \${top.days_tracked||0} days tracked\`;
    const tf=document.getElementById('top-flags');
    if(top.flags?.length){tf.style.display='inline-flex';tf.textContent=\`\${top.flags.length} anomal\${top.flags.length===1?'y':'ies'} · \${(top.flags||[]).map(f=>f.replace('CD_IMPOSSIBLE','EXTREME').replace('CD_SUSPICIOUS','HIGH OUTPUT').replace('OFFLINE_OUTPUT','PRESENCE').replace('CONT_BURST','ACCELERATION').replace('SV_BURST','VALUE').replace('CONT_Z_SCORE','STANDOUT')).join(' · ')}\`;}
  } else {document.getElementById('top-name').textContent='No subjects yet';}

  document.getElementById('s-tot').textContent=all.length||'—';
  document.getElementById('s-ali').textContent=alliances.length||'—';
  document.getElementById('s-flags').textContent=totalFlags||'—';
  document.getElementById('p-red').textContent=rc+' Red';
  document.getElementById('p-amb').textContent=ac+' Watch';
  document.getElementById('p-grn').textContent=(gc+uc)+' Clear';
  document.getElementById('rc').textContent=rc;
  if(data.lastUpdated){
    document.getElementById('lastscan').textContent='Last scan '+ago(data.lastUpdated);
    document.getElementById('ts-lbl').textContent=new Date(data.lastUpdated).toISOString().replace('T',' ').slice(0,16)+' UTC';
  }

  // Panels
  const red=all.filter(p=>p.level==='RED'),watch=all.filter(p=>p.level==='AMBER'||p.level==='LOW');
  let flagH='';
  if(red.length){flagH+=\`<div class="sec-hdr" style="color:var(--red)">Red — Elevated Monitoring</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:10px;margin-bottom:20px;">\${red.map(card).join('')}</div>\`;}
  if(watch.length){flagH+=\`<div class="sec-hdr" style="color:var(--amber)">Watch — Anomalies Building</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:10px;">\${watch.map(card).join('')}</div>\`;}
  document.getElementById('c-flagged').innerHTML=flagH||\`<div class="empty-state"><h3>All Clear</h3><p>No subjects currently flagged. Submit a paste to begin monitoring.</p></div>\`;

  const allH=alliances.map(allianceBlock).join('')+(individuals.length?\`<div class="sec-hdr" style="margin-top:20px;">Individual Subjects</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:10px;">\${individuals.map(card).join('')}</div>\`:'');
  document.getElementById('c-all').innerHTML=allH||\`<div class="empty-state"><h3>No Subjects</h3><p>Submit a paste via Discord to begin monitoring.</p></div>\`;
  document.getElementById('c-ind').innerHTML=individuals.length?\`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:10px;">\${individuals.map(card).join('')}</div>\`:\`<div class="empty-state"><h3>No Individual Subjects</h3><p>Individual player pastes will appear here.</p></div>\`;

  // Anomaly tab — pull from projections if available
  const anomTab=document.getElementById('anom-tab');
  if(data.paceAnomalies&&data.paceAnomalies.length){
    document.getElementById('ac').textContent=data.paceAnomalies.length;
    anomTab.style.display='';
    document.getElementById('c-anom').innerHTML=data.paceAnomalies.map(a=>\`
<div class="anom-card \${a.pct>200?'high':'med'}" onclick="showModal('Pace Anomaly — \${a.name}',anomHtml('\${a.name}','\${a.rank}','\${a.prevPace}','\${a.currPace}',\${a.pct}))">
<div class="anom-top"><div><div class="anom-name">\${a.name}</div><div class="anom-rank">Rank #\${a.rank} · Projections data</div></div>
<div><div class="anom-spike-n" style="color:\${a.pct>200?'var(--red)':'var(--amber)'}">+\${a.pct}%</div><div class="anom-spike-l">Pace spike</div></div></div>
<div class="anom-row">
<div class="anom-cell"><div class="anom-v" style="color:var(--txt2)">$\${a.prevPace}/day</div><div class="anom-l">Previous</div></div>
<div class="anom-cell"><div class="anom-v" style="color:\${a.pct>200?'var(--red)':'var(--amber)'}">$\${a.currPace}/day</div><div class="anom-l">Current</div></div>
<div class="anom-cell"><div class="anom-v" style="color:var(--amber)">+\${a.gain}</div><div class="anom-l">Gain</div></div></div>
<div class="anom-note"><strong>\${a.pct>200?'Standout:':'Watch:'}</strong> \${a.note} <span style="color:var(--txt3);font-style:italic;">Tap for details →</span></div>
</div>\`).join('');
  } else { anomTab.style.display='none'; }
}
function anomHtml(name,rank,prev,curr,pct){
  return\`<p>This alert comes from the <strong>Alliance Projections</strong> data. It flags alliances whose overall pace jumped significantly between the last two uploads.</p>
<div class="modal-kv">
<div class="modal-k">Alliance</div><div class="modal-v">\${name}</div>
<div class="modal-k">Current rank</div><div class="modal-v">#\${rank}</div>
<div class="modal-k">Pace spike</div><div class="modal-v" style="color:\${pct>200?'var(--red)':'var(--amber)'}">+\${pct}% between uploads</div>
<div class="modal-k">Previous pace</div><div class="modal-v">$\${prev}/day</div>
<div class="modal-k">Current pace</div><div class="modal-v">$\${curr}/day</div></div>
<hr class="modal-rule">
<p><strong>What to do:</strong><br>A pace spike can have legitimate explanations — new players joining, a coordinated push, or a recruitment drive. Submit a player paste from this alliance into your Hunter channel to investigate at the individual level.</p>\`;
}

/* LOAD */
async function load(){
  try{const r=await fetch('/api/hunter-data?key='+encodeURIComponent(window._HUNTER_KEY||''));if(r.ok)render(await r.json());}
  catch(e){console.error('Hunter load error:',e);}
  setTimeout(load,180000);
}
</script>
</div>
</body>
</html>
`;

module.exports = { HUNTER_HTML };

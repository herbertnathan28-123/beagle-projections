const FUEL_SETUP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Beagle Fuel Profile Setup</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#030B17;color:#E2EAF4;font-family:'Segoe UI',Calibri,sans-serif;font-size:18px;min-height:100vh}
::-webkit-scrollbar{width:4px;background:#040C18}
::-webkit-scrollbar-thumb{background:#1A3050;border-radius:2px}
.hdr{background:linear-gradient(90deg,#04101E,#0A1C32);border-bottom:2px solid #C4920A;padding:11px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.brand{font-size:26px;font-weight:700;color:#E8B84B;letter-spacing:2px}
.brand-sub{font-size:12px;color:#4A6070;letter-spacing:3px;text-transform:uppercase;margin-top:2px}
.hdr-note{font-size:13px;color:#4A6070;border:1px solid #162030;padding:5px 12px;border-radius:2px}
.container{max-width:860px;margin:0 auto;padding:24px 16px 80px}
.notice{background:#06101C;border:1px solid #0A2040;border-left:3px solid #E8B84B;border-radius:2px;padding:14px 18px;margin-bottom:20px;font-size:15px;color:#8AAABB;line-height:1.8}
.card{background:#04101E;border:1px solid #0A1E30;border-radius:3px;margin-bottom:14px;overflow:hidden}
.card-title{font-size:14px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#5A8AAB;padding:12px 20px;border-bottom:1px solid #0A1E30;background:#030B17}
.card-body{padding:18px 20px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:13px;font-weight:600;color:#5A8AAB}
.warn{font-size:12px;color:#E8B84B;font-weight:400;margin-left:5px}
input[type=text],input[type=number],input[type=time],select{background:#06121E;border:1px solid #1A2840;color:#E2EAF4;padding:11px 13px;border-radius:2px;font-family:inherit;font-size:17px;width:100%;outline:none;transition:border-color .12s}
input:focus,select:focus{border-color:#2A5080}
input::placeholder{color:#4A6580}
select option{background:#040C18;color:#E2EAF4}
.toggle-wrap{display:inline-flex;border-radius:2px;overflow:hidden;border:1px solid #1A2840}
.tbtn{padding:11px 28px;background:#040C18;border:none;color:#3A5070;font-size:15px;font-weight:700;letter-spacing:1.5px;cursor:pointer;font-family:inherit;transition:all .12s;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.tbtn.on{background:#0E2235;color:#E8B84B}
.tbtn:not(:last-child){border-right:1px solid #1A2840}
.hint{font-size:14px;color:#7A9AB0;margin-top:5px;line-height:1.5}
.select-all-btn{display:inline-flex;align-items:center;gap:8px;padding:9px 18px;background:#06121E;border:1px solid #1A5A3A;border-radius:2px;color:#3AAA6A;font-size:13px;font-weight:700;letter-spacing:1.5px;cursor:pointer;font-family:inherit;transition:all .15s;margin-bottom:16px;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.select-all-btn:hover{border-color:#23A55A;color:#23A55A;background:#040C18}
.select-all-btn:active{transform:scale(.98)}
.dep-wrap{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #0A1E30;flex-wrap:wrap}
.dep-wrap:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
.dep-wrap label{font-size:13px;font-weight:600;color:#5A8AAB;white-space:nowrap;min-width:100px}
.dep-wrap input[type=time]{max-width:140px;font-size:17px}
.dep-tz{font-size:13px;color:#6A8A9B}
.now-btn{height:44px;min-width:56px;background:#0D2818;border:2px solid #23A55A;border-radius:3px;color:#23A55A;font-size:26px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;line-height:1;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.now-btn:hover{background:#1A4028;border-color:#00E676;color:#00E676}
.now-btn:active{transform:scale(.95)}
.dep-empty{font-size:13px;color:#5A7A8B;padding:8px 0;font-style:italic}
.fleet-row{display:grid;grid-template-columns:2fr 1fr 1fr 44px;gap:8px;align-items:end;padding:12px 0;border-bottom:1px solid #06101C}
.fleet-row:last-child{border-bottom:none}
.fleet-row .field label{font-size:12px}
.rm-btn{height:44px;background:transparent;border:1px solid #1E1020;border-radius:2px;color:#6A2030;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.rm-btn:hover{background:#1A0610;border-color:#E74C3C;color:#E74C3C}
.add-btn{margin-top:12px;padding:11px 14px;background:#06121E;border:1px solid #2A4A6A;color:#7AAABB;font-size:14px;font-weight:700;letter-spacing:1px;cursor:pointer;border-radius:2px;font-family:inherit;transition:all .12s;width:100%;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.add-btn:hover{border-color:#3A6A8A;color:#9ACABB;background:#081828}
.add-btn:active{background:#0A2038;transform:scale(.98)}
.fleet-total{font-size:15px;color:#E8B84B;font-weight:700;padding:10px 0;letter-spacing:1px;margin-top:8px;border-top:1px solid #0A1E30}
.dur-wrap{display:inline-flex;gap:0;margin-top:10px;border-radius:2px;overflow:hidden;border:1px solid #1A2840}
.dur-btn{padding:11px 24px;background:#040C18;border:none;color:#3A5070;font-size:15px;font-weight:700;letter-spacing:1.5px;cursor:pointer;font-family:inherit;transition:all .12s;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.dur-btn.on{background:#0D2818;color:#23A55A}
.dur-btn:not(:last-child){border-right:1px solid #1A2840}
.footer-note{font-size:13px;color:#7A9AB0;margin-top:16px;padding:12px 16px;border:1px solid #0A1E30;border-radius:2px;line-height:1.7}
.submit-btn{width:100%;padding:16px;background:#C4920A;color:#000;border:none;border-radius:2px;font-size:14px;font-weight:900;letter-spacing:2px;cursor:pointer;font-family:inherit;transition:opacity .15s;margin-top:8px}
.submit-btn:hover:not(:disabled){opacity:.88}
.submit-btn:disabled{opacity:.35;cursor:default}
.success-box{background:#04120A;border:1px solid #23A55A;border-radius:3px;padding:28px 24px;text-align:center;color:#23A55A;font-size:17px;line-height:2;margin-top:12px;display:none}
.success-box code{background:#040C18;padding:5px 12px;border-radius:2px;font-family:monospace;color:#E8B84B;font-size:14px;display:inline-block;margin:4px 0}
.err-box{background:#120408;border:1px solid #E74C3C;border-radius:2px;padding:12px 16px;color:#E74C3C;font-size:14px;margin-top:10px;display:none}
@media(max-width:640px){
  .g2{grid-template-columns:1fr}
  .fleet-row{grid-template-columns:1fr 80px;grid-template-rows:auto auto auto;gap:8px}
}
</style>
</head>
<body>
<div class="hdr">
  <div><div class="brand">&#9670; BEAGLE GLOBAL</div><div class="brand-sub">Fuel Profile Setup</div></div>
  <div class="hdr-note">&#128274; Private &mdash; not posted to Discord</div>
</div>
<div class="container">
  <div class="notice">
    This form is <strong>private</strong>. Your fleet composition, reserves and strategy never appear on Discord. Fill this out once and the fuel bot uses your settings automatically. You can update it anytime by re-submitting.
  </div>
  <div id="already-reg-bar" style="margin-bottom:16px;padding:16px;background:#0A1C32;border:1px solid #C4920A;border-radius:4px;text-align:center">
    <div style="font-size:12px;color:#E8B84B;font-weight:700;letter-spacing:1px;margin-bottom:12px">ALREADY REGISTERED?</div>
    <a id="already-reg-link" href="/fuel-calculator" style="display:inline-block;padding:14px 28px;background:#C4920A;color:#030B17;font-weight:700;font-size:14px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:4px;">GO TO FUEL CALCULATOR &rarr;</a>
  </div>
  <form id="f" autocomplete="off">
    <input type="hidden" id="discord_id" value="">

    <!-- IDENTITY -->
    <div class="card">
      <div class="card-title">Your Identity</div>
      <div class="card-body">
        <div class="field" style="margin-bottom:16px;max-width:380px">
            <label>Discord ID <span style="color:#c99a3a">(numbers only — this is your login)</span></label>
            <input id="discord_id_input" type="text" inputmode="numeric" pattern="[0-9]{17,20}" placeholder="e.g. 690861328507731978" required>
            <div style="font-size:11px;color:#6a8296;margin-top:5px;line-height:1.45">In Discord: <b>Settings → Advanced → Developer Mode ON</b>, then right-click your name → <b>Copy User ID</b>. This is a number, not your username — it's what loads your saved fleet.</div>
        </div>
        <div class="field" style="max-width:320px">
          <label>Your Timezone</label>
          <select id="timezone">
            <option value="UTC-12">UTC-12</option>
            <option value="UTC-11">UTC-11 (Samoa)</option>
            <option value="UTC-10">UTC-10 (Hawaii)</option>
            <option value="UTC-9">UTC-9 (Alaska)</option>
            <option value="UTC-8">UTC-8 (Los Angeles / PST)</option>
            <option value="UTC-7">UTC-7 (Denver / MST)</option>
            <option value="UTC-6">UTC-6 (Chicago / CST)</option>
            <option value="UTC-5">UTC-5 (New York / EST)</option>
            <option value="UTC-4">UTC-4 (Atlantic)</option>
            <option value="UTC-3">UTC-3 (Sao Paulo)</option>
            <option value="UTC-2">UTC-2</option>
            <option value="UTC-1">UTC-1 (Azores)</option>
            <option value="UTC+0">UTC+0 (London / GMT)</option>
            <option value="UTC+1">UTC+1 (Paris / CET / Game Time Winter)</option>
            <option value="UTC+2">UTC+2 (Game Time Summer)</option>
            <option value="UTC+3">UTC+3 (Moscow)</option>
            <option value="UTC+3.5">UTC+3:30 (Tehran)</option>
            <option value="UTC+4">UTC+4 (Dubai)</option>
            <option value="UTC+4.5">UTC+4:30 (Kabul)</option>
            <option value="UTC+5">UTC+5 (Karachi)</option>
            <option value="UTC+5.5">UTC+5:30 (India / IST)</option>
            <option value="UTC+5.75">UTC+5:45 (Nepal / Kathmandu)</option>
            <option value="UTC+6">UTC+6 (Dhaka)</option>
            <option value="UTC+6.5">UTC+6:30 (Yangon)</option>
            <option value="UTC+7">UTC+7 (Bangkok)</option>
            <option value="UTC+8" selected>UTC+8 (Perth / Singapore / AWST)</option>
            <option value="UTC+9">UTC+9 (Tokyo / JST)</option>
            <option value="UTC+9.5">UTC+9:30 (Adelaide / ACST)</option>
            <option value="UTC+10">UTC+10 (Sydney / AEST)</option>
            <option value="UTC+10.5">UTC+10:30 (Lord Howe Is.)</option>
            <option value="UTC+11">UTC+11</option>
            <option value="UTC+12">UTC+12 (Auckland)</option>
            <option value="UTC+13">UTC+13</option>
            <option value="UTC+14">UTC+14</option>
          </select>
        </div>
      </div>
    </div>

    <!-- TANK LIMITS -->
    <div class="card">
      <div class="card-title">Tank Limits</div>
      <div class="card-body">
        <div class="g2">
          <div class="field">
            <label>Fuel Tank Capacity (Lbs) <span class="warn">* required</span></label>
            <input id="fuel_tank" type="number" min="0" placeholder="e.g. 1403097000" required>
            <span class="hint">Fuel purchase screen &rarr; Capacity field</span>
          </div>
          <div class="field">
            <label>CO&#8322; Tank Capacity (Quotas) <span class="warn">* required</span></label>
            <input id="co2_tank" type="number" min="0" placeholder="e.g. 2438330000" required>
            <span class="hint">CO&#8322; purchase screen &rarr; Capacity field</span>
          </div>
        </div>
        <div class="g2" style="margin-top:16px">
          <div class="field">
            <label>Current Fuel Reserves (Lbs) <span class="warn">* required</span></label>
            <input id="fuel_reserves" type="number" min="0" placeholder="e.g. 800000000" required>
            <span class="hint">Your current fuel stock &mdash; enter from fuel screen</span>
          </div>
          <div class="field">
            <label>Current CO&#8322; Reserves (Quotas) <span class="warn">* required</span></label>
            <input id="co2_reserves" type="number" min="0" placeholder="e.g. 1200000000" required>
            <span class="hint">Your current CO&#8322; stock &mdash; enter from CO&#8322; screen</span>
          </div>
        </div>
      </div>
    </div>

    <!-- GAME SPEED -->
    <div class="card">
      <div class="card-title">Game Speed</div>
      <div class="card-body">
        <div class="toggle-wrap">
          <button type="button" id="btn-rl" class="tbtn on" onclick="setSp(false)">REALISM</button>
          <button type="button" id="btn-ez" class="tbtn" onclick="setSp(true)">EASY</button>
        </div>
        <div class="hint" style="margin-top:12px">Select your game mode. Both buttons always visible. Easy mode is 1.5&times; faster than Realism.</div>
      </div>
    </div>

    <!-- RESERVE BUFFER -->
    <div class="card">
      <div class="card-title">Safety Reserve</div>
      <div class="card-body">
        <div class="field" style="max-width:320px">
          <label>Reserve Buffer (Lbs)</label>
          <select id="reserve_buffer">
            <option value="0">0 lbs</option>
            <option value="5000">5,000 lbs</option>
            <option value="10000" selected>10,000 lbs</option>
            <option value="15000">15,000 lbs</option>
            <option value="20000">20,000 lbs</option>
          </select>
          <span class="hint">Fuel planning treats your tank capacity as reduced by this amount. The system will never plan purchases that draw on your reserve.</span>
        </div>
      </div>
    </div>

    <!-- FLEET -->
    <div class="card">
      <div class="card-title">Your Fleet</div>
      <div class="card-body">
        <div class="hint" style="margin-bottom:14px">Add each group of aircraft. Enter the aircraft type, total number you own, and your actual flight time in hours. Departure time fields below update automatically.</div>
        <div id="fleet-list"></div>
        <button type="button" class="add-btn" onclick="addFleetRow()">+ ADD AIRCRAFT GROUP</button>
        <div class="fleet-total" id="fleet-total">Total aircraft: 0</div>
      </div>
    </div>

    <div class="footer-note">
      &#9432; Purchase buffers are applied automatically based on your total fleet size:<br>
      Under 500 aircraft = 2 min &nbsp;&middot;&nbsp; 501&ndash;1,200 = 3 min &nbsp;&middot;&nbsp; Above 1,200 = 4 min
    </div>

    <button type="submit" class="submit-btn" id="sub-btn" style="margin-top:16px">SAVE PROFILE</button>
    <div class="err-box" id="err-box"></div>
  </form>

  <div class="success-box" id="ok-box">
    &#10003; Profile saved.<br><br>
    You are enrolled in the Stepping Stone system.<br>
    Your personal dashboard link will be posted to the fuel upload channel.<br><br>
    You can update your profile anytime by re-submitting this form.
    <div style="margin-top:20px"><a id="dash-link" href="/fuel-calculator" style="display:none;padding:14px 24px;background:#C4920A;color:#030B17;font-weight:700;font-size:14px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:4px;text-align:center;">OPEN FUEL CALCULATOR &rarr;</a></div>
  </div>

  <div class="success-box" id="already-box" style="display:none">
    &#10003; You are already registered.<br><br>
    Your fuel profile is active. Click below to open your personalised dashboard.<br><br>
    To update your fleet, reserves or departure times, click <strong>Update Profile</strong> below.
    <div style="margin-top:20px;display:flex;flex-direction:column;gap:12px;align-items:center">
      <a id="already-dash-link" href="/fuel-calculator" style="padding:14px 24px;background:#C4920A;color:#030B17;font-weight:700;font-size:14px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:4px;text-align:center;">OPEN FUEL CALCULATOR &rarr;</a>
      <button type="button" id="update-btn" style="padding:10px 20px;background:transparent;border:1px solid #C4920A;color:#C4920A;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;border-radius:4px;cursor:pointer;font-family:inherit;" onclick="document.getElementById('already-box').style.display='none';document.getElementById('f').style.display='block';">UPDATE PROFILE</button>
    </div>
  </div>
</div>

<script>
let spd4x=false;
(function(){
  const params=new URLSearchParams(window.location.search);
  const did=params.get('did')||'';
  const editMode=params.get('edit')==='1';
  if(did){
    document.getElementById('discord_id').value=did;
    const _idIn=document.getElementById('discord_id_input'); if(_idIn) _idIn.value=did.replace(/\D/g,'');
    // If edit=1, skip "already registered" screen and show form directly
    if(!editMode){
      fetch('/api/fuel-check?did='+encodeURIComponent(did))
        .then(r=>r.json())
        .then(data=>{
          if(data.exists){
            document.getElementById('f').style.display='none';
            document.getElementById('already-reg-bar').style.display='none';
            document.getElementById('already-box').style.display='block';
            // Point dashboard link to personal fuel dashboard
            var adl=document.getElementById('already-dash-link');
            if(adl) adl.href='/fuel/'+encodeURIComponent(did);
          }
        }).catch(()=>{});
    } else {
      document.getElementById('already-reg-bar').style.display='none';
    }
  }
})();

function setSp(v){
  spd4x=v;
  document.getElementById('btn-rl').classList.toggle('on',!v);
  document.getElementById('btn-ez').classList.toggle('on',v);
}

function getDK(){
  return new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Copenhagen',
    hour:'2-digit',minute:'2-digit',hour12:false
  }).format(new Date());
}

function depNow(id){document.getElementById(id).value=getDK();}

function depNowAll(){
  const t=getDK();
  document.querySelectorAll('#dep-times-rows input[type=time]').forEach(inp=>inp.value=t);
}

function updateFleetTotal(){
  let total=0;
  document.querySelectorAll('.ac-total').forEach(inp=>{total+=parseInt(inp.value)||0;});
  document.getElementById('fleet-total').textContent='Total aircraft: '+total.toLocaleString();
}

function addFleetRow(){
  const list=document.getElementById('fleet-list');
  const d=document.createElement('div');
  d.className='fleet-row';
  d.innerHTML=
    '<div class="field"><label>Aircraft Type</label><select class="ac-type" required>'+
    '<option value="">Select aircraft...</option>'+
    '<option>A380-800</option><option>A380F</option>'+
    '<option>A330-900neo</option><option>A330-800neo</option><option>A330-300</option><option>A330-200</option>'+
    '<option>B747-8</option><option>B747-8F</option><option>B747SP</option>'+
    '<option>B787-10</option><option>B787-9</option><option>B787-8</option>'+
    '<option>A350-900ULR</option><option>DC-10</option><option>MC-21-400</option>'+
    '<option>Concorde</option><option>A320neo</option><option>B737 MAX 8</option><option>Spacejet M100</option>'+
    '</select></div>'+
    '<div class="field"><label>Total Aircraft</label><input type="number" class="ac-total" min="1" placeholder="0" required oninput="updateFleetTotal()" onchange="updateFleetTotal()"></div>'+
    '<div class="field"><label>Flight Time (hrs)</label><input type="number" class="ac-hours" min="0.5" step="0.5" placeholder="e.g. 12" required></div>'+
    '<button type="button" class="rm-btn" onclick="removeFleetRow(this)" title="Remove">&#10005;</button>';
  list.appendChild(d);
}

function removeFleetRow(btn){
  btn.closest('.fleet-row').remove();
  updateFleetTotal();
}

// Departure times and 4x speed are set live on the calculator, not at registration.
function updateDepTimes(){}

function collectFleet(){
  return [...document.querySelectorAll('.fleet-row')].map(r=>({
    type:r.querySelector('.ac-type').value.trim(),
    total_aircraft:parseInt(r.querySelector('.ac-total').value)||0,
    flight_hours:parseFloat(r.querySelector('.ac-hours').value)||0
  })).filter(r=>r.type&&r.total_aircraft>0&&r.flight_hours>0);
}

document.getElementById('f').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=document.getElementById('sub-btn');
  const err=document.getElementById('err-box');
  err.style.display='none';
  const fleet=collectFleet();
  if(fleet.length===0){
    err.textContent='Please add at least one aircraft group.';
    err.style.display='block';return;
  }
  const didVal=(document.getElementById('discord_id_input').value||'').replace(/\D/g,'')
    || (document.getElementById('discord_id').value||'').replace(/\D/g,'');
  if(!/^\d{17,20}$/.test(didVal)){
    err.textContent='Enter your Discord ID — a 17–19 digit number. In Discord: Settings → Advanced → Developer Mode, then right-click your name → Copy User ID. (Not your username.)';
    err.style.display='block';return;
  }
  btn.textContent='SAVING...';btn.disabled=true;
  const profile={
    discord_id:didVal,
    discord_name:didVal,
    timezone:document.getElementById('timezone').value,
    fuel_tank_capacity:parseInt(document.getElementById('fuel_tank').value)||0,
    co2_tank_capacity:parseInt(document.getElementById('co2_tank').value)||0,
    fuel_reserves:parseInt(document.getElementById('fuel_reserves').value)||0,
    co2_reserves:parseInt(document.getElementById('co2_reserves').value)||0,
    reserve_buffer:parseInt(document.getElementById('reserve_buffer').value)||10000,
    fleet:fleet,
    setup_complete:1
  };
  try{
    const r=await fetch('/api/fuel-setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});
    const data=await r.json();
    if(data.ok){
      document.getElementById('f').style.display='none';
      document.getElementById('ok-box').style.display='block';
      const dl=document.getElementById('dash-link');
      dl.href='/fuel-calculator?did='+encodeURIComponent(didVal);
      dl.style.display='inline-block';
      window.scrollTo(0,0);
    } else {
      err.textContent='Error: '+(data.error||'Save failed');
      err.style.display='block';btn.textContent='SAVE PROFILE';btn.disabled=false;
    }
  }catch(ex){
    err.textContent='Connection error - try again.';
    err.style.display='block';btn.textContent='SAVE PROFILE';btn.disabled=false;
  }
});
</script>
</body>
</html>`;

module.exports = { FUEL_SETUP_HTML };

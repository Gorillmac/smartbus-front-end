/* SmartBus Driver Dashboard — SWP316D Group P */
import { DB, showToast, formatDate, timeNow, dateToday } from './data.js';

const user = DB.requireAuth('driver');
if (!user) throw new Error('Not logged in');

document.getElementById('userName').textContent = user.name.split(' ')[0];
document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();

window.logout = function() { DB.clearSession(); window.location.href = './index.html'; };

window.showPanel = function(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const p = document.getElementById('panel-' + name);
  if (p) p.classList.add('active');
  const n = document.getElementById('nav-' + name);
  if (n) n.classList.add('active');
  const loaders = {
    home: loadHome, route: loadRoute, trip: loadTrip, seats: loadSeats,
    delay: loadDelay, notify: loadNotify, schedule: loadSchedule,
    bookings: loadBookings, driverchat: loadDriverChat,
  };
  if (loaders[name]) loaders[name]();
};

function getBus()   { return DB.getById('buses', user.busId); }
function getRoute() { const b=getBus(); return b ? DB.getById('routes', b.routeId) : null; }

let tripActive = false;
let tripStart  = null;
let elapsedTimer;

// ===== HOME =====
function loadHome() {
  const bus   = getBus();
  const route = getRoute();
  document.getElementById('driverBus').textContent      = bus   ? bus.number   : '—';
  document.getElementById('driverBusPlate').textContent = bus   ? bus.plate     : '—';
  document.getElementById('driverRoute').textContent    = route ? route.name   : '—';
  document.getElementById('driverRouteNum').textContent = route ? 'Route '+route.number : '—';
  document.getElementById('driverCapacity').textContent = bus   ? bus.capacity : '—';
  document.getElementById('driverTripStatus').textContent = tripActive ? '🟢 Active' : 'Idle';
  document.getElementById('driverTripTime').textContent   = tripActive ? 'Started '+tripStart : '—';

  const el = document.getElementById('driverInfoPanel');
  if (!bus || !route) { el.innerHTML='<div class="alert alert-warning">No bus or route assigned. Please contact admin.</div>'; return; }
  const upcoming = route.schedule.filter(t => t >= timeNow());
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px">
      <div class="flex-between"><span class="text-sm text-gray">Bus</span><strong>${bus.number} (${bus.plate})</strong></div>
      <div class="flex-between"><span class="text-sm text-gray">Route</span><strong>${route.name}</strong></div>
      <div class="flex-between"><span class="text-sm text-gray">Next departure</span><strong>${upcoming[0]||'Done for today'}</strong></div>
      <div class="flex-between"><span class="text-sm text-gray">Capacity</span><strong>${bus.capacity} seats</strong></div>
      <div class="flex-between"><span class="text-sm text-gray">Fare</span><strong>${route.fare}</strong></div>
      <div class="flex-between"><span class="text-sm text-gray">License</span><strong>${user.licenseNumber||'—'}</strong></div>
    </div>`;
}

// ===== ROUTE =====
function loadRoute() {
  const bus   = getBus();
  const route = getRoute();
  const detailEl = document.getElementById('routeDetails');
  if (!route) { detailEl.innerHTML='<div class="alert alert-warning">No route assigned.</div>'; return; }
  detailEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="flex-between"><span class="text-sm text-gray">Route Name</span><strong>${route.name}</strong></div>
      <div class="flex-between"><span class="text-sm text-gray">Number</span><strong>${route.number}</strong></div>
      <div class="flex-between"><span class="text-sm text-gray">Status</span><span class="badge badge-green">${route.status}</span></div>
      <div class="flex-between"><span class="text-sm text-gray">Distance</span><strong>${route.distance}</strong></div>
      <div class="flex-between"><span class="text-sm text-gray">Duration</span><strong>${route.duration}</strong></div>
      <div class="flex-between"><span class="text-sm text-gray">Fare</span><strong>${route.fare}</strong></div>
    </div>
    <div class="divider"></div>
    <p class="text-sm text-gray bold mb-1">Stops:</p>
    <div class="route-stops">${route.stops.map((s,i)=>i<route.stops.length-1?`<span class="text-sm">${s}</span><span class="stop-line"></span>`:`<span class="text-sm">${s}</span>`).join('')}</div>`;

  const now = timeNow();
  document.getElementById('routeSchedule').innerHTML = route.schedule.map(t =>
    `<div class="schedule-row">
      <span class="time-badge ${t<now?'passed':''}">${t}</span>
      <span class="text-sm">${t<now?'✓ Departed':'🕐 Upcoming'}</span>
    </div>`).join('');
  renderDriverMap(route);
}

function renderDriverMap(route) {
  const map = document.getElementById('driverMap');
  map.querySelectorAll('.bus-marker,.stop-marker,.stop-label').forEach(el => el.remove());
  const positions = [15,35,55,75,90];
  route.stops.forEach((stop,i) => {
    const left = positions[i]||15+i*18;
    const dot  = document.createElement('div');
    dot.className = 'stop-marker';
    dot.style.cssText = `left:${left}%;top:48%;transform:translate(-50%,-50%)`;
    map.appendChild(dot);
    const lbl = document.createElement('div');
    lbl.className = 'stop-label';
    lbl.style.cssText = `left:${left}%;top:calc(48% + 14px);transform:translateX(-50%)`;
    lbl.textContent = stop;
    map.appendChild(lbl);
  });
  const marker = document.createElement('div');
  marker.className = 'bus-marker';
  marker.style.cssText = 'left:10%;top:40%';
  marker.textContent = '🚌';
  map.appendChild(marker);
  let pos = 10;
  setInterval(() => { pos=(pos+0.4)%88; marker.style.left=pos+'%'; }, 500);
}

// ===== TRIP CONTROL =====
function loadTrip() {
  const route = getRoute();
  const sel   = document.getElementById('currentStopSelect');
  if (route) sel.innerHTML = route.stops.map(s=>`<option>${s}</option>`).join('');
  updateTripUI();
}

function updateTripUI() {
  const circle    = document.getElementById('tripCircle');
  const msg       = document.getElementById('tripStatusMsg');
  const startBtn  = document.getElementById('startBtn');
  const stopBtn   = document.getElementById('stopBtn');
  const tripInfo  = document.getElementById('tripInfo');
  const badge     = document.getElementById('tripStatusBadge');
  if (tripActive) {
    circle.classList.add('active');
    circle.innerHTML = '🟢<br><small>Trip Active</small>';
    msg.textContent  = 'GPS tracking is live. Passengers can see your position.';
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    tripInfo.classList.remove('hidden');
    document.getElementById('tripStartTime').textContent = tripStart;
    badge.className  = 'badge badge-green';
    badge.textContent = '🟢 Trip Active';
  } else {
    circle.classList.remove('active');
    circle.innerHTML = '⚫<br><small>Not Started</small>';
    msg.textContent  = 'GPS tracking is not active. Click Start Trip to begin.';
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    tripInfo.classList.add('hidden');
    badge.className  = 'badge badge-gray';
    badge.textContent = '⚫ Not Started';
  }
}

window.startTrip = function() {
  const bus   = getBus();
  const route = getRoute();
  if (!bus || !route) { showToast('No bus or route assigned!','error'); return; }
  tripActive = true;
  tripStart  = timeNow();
  const activeTrips = DB.getAll('active_trips');
  activeTrips.push({ driverId: user.id, busId: bus.id, routeId: route.id, startTime: tripStart, date: dateToday() });
  DB.save('active_trips', activeTrips);
  const notifs = DB.getAll('notifications');
  DB.getAll('users').filter(u=>u.role==='passenger').forEach(u => {
    notifs.push({ id: Date.now()+u.id, userId: u.id, type:'info', message:`Bus ${bus.number} on ${route.name} started its trip at ${tripStart}.`, time: tripStart, date: dateToday(), read: false });
  });
  DB.save('notifications', notifs);
  updateTripUI();
  showToast('Trip started! GPS tracking is now active.','success');
  clearInterval(elapsedTimer);
  let mins=0;
  elapsedTimer = setInterval(() => { mins++; const el=document.getElementById('tripElapsed'); if(el) el.textContent=mins+' min'; }, 60000);
};

window.stopTrip = function() {
  const bus   = getBus();
  const route = getRoute();
  tripActive  = false;
  clearInterval(elapsedTimer);
  DB.save('active_trips', DB.getAll('active_trips').filter(t=>t.driverId!==user.id));
  const notifs = DB.getAll('notifications');
  DB.getAll('users').filter(u=>u.role==='passenger').forEach(u => {
    notifs.push({ id: Date.now()+u.id, userId: u.id, type:'info', message:`Bus ${bus?bus.number:''} on ${route?route.name:''} completed its trip at ${timeNow()}.`, time: timeNow(), date: dateToday(), read: false });
  });
  DB.save('notifications', notifs);
  updateTripUI();
  showToast('Trip ended. Thank you for driving safely!','success');
};

window.updateLocation = function() {
  const stop = document.getElementById('currentStopSelect').value;
  if (!stop) return;
  const bus = getBus();
  DB.getAll('users').filter(u=>u.role==='passenger').forEach(u => {
    const notifs = DB.getAll('notifications');
    notifs.push({ id: Date.now()+u.id, userId: u.id, type:'info', message:`Bus ${bus?bus.number:''} is now at ${stop}.`, time: timeNow(), date: dateToday(), read: false });
    DB.save('notifications', notifs);
  });
  showToast(`Location updated: at ${stop}`,'success');
};

// ===== SEATS =====
function loadSeats() {
  const bus = getBus();
  if (!bus) return;
  const occupied = (DB.getAll('seat_data')[bus.id]||[]).length;
  const available = bus.capacity - occupied;
  document.getElementById('occupiedCount').value = occupied;
  document.getElementById('seatCapacityInfo').textContent = `Bus capacity: ${bus.capacity} seats. ${occupied} occupied, ${available} available.`;
  const pct = Math.round((occupied/bus.capacity)*100);
  document.getElementById('seatProgress').innerHTML = `
    <div><div class="flex-between text-sm mb-1"><span>Occupancy</span><span>${pct}%</span></div>
      <div class="progress-bar-wrap"><div class="progress-bar-fill ${pct>80?'red':pct>60?'yellow':'green'}" style="width:${pct}%"></div></div></div>
    <div class="flex-between text-sm"><span>Occupied</span><strong>${occupied}</strong></div>
    <div class="flex-between text-sm"><span>Available</span><strong class="text-green">${available}</strong></div>
    <div class="flex-between text-sm"><span>Total</span><strong>${bus.capacity}</strong></div>`;
}

window.updateSeats = function() {
  const bus   = getBus();
  if (!bus) return;
  const count = parseInt(document.getElementById('occupiedCount').value)||0;
  if (count > bus.capacity) { showToast('Count cannot exceed capacity!','error'); return; }
  const seats = [];
  for (let i=0; i<count; i++) { let s; do { s=Math.floor(Math.random()*bus.capacity)+1; } while(seats.includes(s)); seats.push(s); }
  const sd = DB.getAll('seat_data');
  sd[bus.id] = seats;
  DB.save('seat_data', sd);
  showToast(`Seat info updated: ${count} occupied`,'success');
  loadSeats();
};

// ===== DELAY =====
let localDelays = [];

function loadDelay() { renderDelays(); }

function renderDelays() {
  const el = document.getElementById('recentDelays');
  el.innerHTML = localDelays.map(d => `
    <div style="padding:10px 0;border-bottom:1px solid var(--gray-light)">
      <div class="flex-between"><strong class="text-sm">${d.type.replace('-',' ').toUpperCase()}</strong><span class="badge badge-yellow">+${d.minutes} min</span></div>
      <p class="text-sm text-gray">${d.desc}</p><small class="text-gray">${d.time}</small>
    </div>`).join('') || '<p class="text-sm text-gray">No recent delay reports.</p>';
}

window.reportDelay = function() {
  const type    = document.getElementById('incidentType').value;
  const minutes = document.getElementById('delayMinutes').value;
  const desc    = document.getElementById('delayDesc').value.trim();
  if (!desc) { showToast('Please describe the incident','error'); return; }
  const route = getRoute();
  const bus   = getBus();
  const typeLabels = { traffic:'Traffic Delay', breakdown:'Breakdown', accident:'Accident', weather:'Weather Delay', detour:'Route Detour', other:'Delay' };
  const notifs = DB.getAll('notifications');
  DB.getAll('users').filter(u=>u.role==='passenger').forEach(u => {
    notifs.push({ id: Date.now()+u.id, userId: u.id, type:'delay', message:`⚠️ ${typeLabels[type]||'Delay'} on ${route?route.name:'your route'}. ${minutes?'Estimated '+minutes+' minute delay. ':''}${desc}`, time: timeNow(), date: dateToday(), read: false });
  });
  DB.save('notifications', notifs);
  localDelays.unshift({ type, minutes: minutes||'?', desc, time: timeNow() });
  document.getElementById('delayDesc').value='';
  document.getElementById('delayMinutes').value='';
  renderDelays();
  showToast('Delay notification sent to all passengers!','success');
};

// ===== NOTIFY =====
let sentNotifs = [];
function loadNotify() { renderSentNotifs(); }
function renderSentNotifs() {
  const el = document.getElementById('sentNotifs');
  el.innerHTML = sentNotifs.map(n =>
    `<div style="padding:10px 0;border-bottom:1px solid var(--gray-light)">
      <div class="flex-between"><span class="badge badge-blue">${n.type}</span><small class="text-gray">${n.time}</small></div>
      <p class="text-sm mt-1">${n.message}</p>
    </div>`).join('') || '<p class="text-sm text-gray">No notifications sent yet.</p>';
}

window.sendDriverNotif = function() {
  const type    = document.getElementById('notifType').value;
  const message = document.getElementById('notifMessage').value.trim();
  if (!message) { showToast('Please type a message','error'); return; }
  const route = getRoute();
  const notifs = DB.getAll('notifications');
  DB.getAll('users').filter(u=>u.role==='passenger').forEach(u => {
    notifs.push({ id: Date.now()+u.id, userId: u.id, type, message:`📣 Driver Update${route?' ('+route.name+')':''}: ${message}`, time: timeNow(), date: dateToday(), read: false });
  });
  DB.save('notifications', notifs);
  sentNotifs.unshift({ type, message, time: timeNow() });
  document.getElementById('notifMessage').value='';
  renderSentNotifs();
  showToast('Notification sent to all passengers!','success');
};

// ===== SCHEDULE =====
function loadSchedule() {
  const route = getRoute();
  const el    = document.getElementById('scheduleContent');
  if (!route) { el.innerHTML='<div class="alert alert-warning">No route assigned.</div>'; return; }
  const now = timeNow();
  el.innerHTML = `
    <div class="alert alert-info mb-2"><strong>Route: ${route.name}</strong> — Bus: ${getBus()?.number||'—'}</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Time</th><th>From</th><th>To</th><th>Status</th></tr></thead>
        <tbody>${route.schedule.map((t,i)=>`
          <tr><td>${i+1}</td>
          <td><span class="time-badge ${t<now?'passed':''}">${t}</span></td>
          <td>${route.stops[0]}</td>
          <td>${route.stops[route.stops.length-1]}</td>
          <td>${t<now?'<span class="badge badge-gray">Completed</span>':'<span class="badge badge-blue">Scheduled</span>'}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ===== PASSENGER BOOKINGS =====
function loadBookings() {
  refreshBookings();
}

window.refreshBookings = function() {
  const bus      = getBus();
  const route    = getRoute();
  if (!bus || !route) {
    document.getElementById('bookingsTableWrap').innerHTML = '<div class="alert alert-warning">No bus or route assigned.</div>';
    return;
  }

  // All bookings for this route
  const allBookings = DB.getAll('bookings').filter(b => b.routeId == route.id);
  const users       = DB.getAll('users');
  const now         = timeNow();

  // Build map panel
  renderBookingsMap(allBookings, users, now);

  // Build table
  const el = document.getElementById('bookingsTableWrap');
  if (!allBookings.length) {
    el.innerHTML = '<p class="text-sm text-gray">No passengers have scheduled a ride on your route yet.</p>';
    return;
  }

  el.innerHTML = allBookings.map(b => {
    const pax      = users.find(u => u.id == b.userId);
    const isLate   = !b.arrived && b.time < now;
    const sc       = b.arrived ? 'badge-green' : isLate ? 'badge-red' : 'badge-blue';
    const statusLbl= b.arrived ? 'Arrived' : isLate ? 'Late / Not arrived' : 'Scheduled';
    const gpsInfo  = b.lat ? `📍 ${parseFloat(b.lat).toFixed(4)}, ${parseFloat(b.lng).toFixed(4)}` : '📍 No GPS shared';
    return `<div class="booking-card">
      <div class="booking-avatar">${pax ? pax.name.charAt(0) : '?'}</div>
      <div style="flex:1">
        <div class="flex-between">
          <strong class="text-sm">${pax ? pax.name : 'Unknown'}</strong>
          <span class="badge ${sc}">${statusLbl}</span>
        </div>
        <div class="text-sm text-gray">${b.stop} at ${b.time} &bull; ${b.seats} seat(s)</div>
        <div class="text-sm ${b.lat?'text-green':'text-gray'}">${gpsInfo}</div>
        <div style="display:flex;gap:6px;margin-top:6px">
          ${!b.arrived ? `<button class="btn btn-success btn-sm" onclick="markArrived(${b.id})">✓ Mark Arrived</button>` : ''}
          <button class="btn btn-primary btn-sm" onclick="openChatWithPassenger(${b.userId})">💬 Chat</button>
        </div>
      </div>
    </div>`;
  }).join('');
};

function renderBookingsMap(bookings, users, now) {
  const map = document.getElementById('bookingsMap');
  map.querySelectorAll('.passenger-marker,.passenger-pin-label,.bus-marker,.stop-marker,.stop-label').forEach(el => el.remove());

  // Add bus
  const busM = document.createElement('div');
  busM.className = 'bus-marker';
  busM.style.cssText = 'left:10%;top:40%';
  busM.textContent = '🚌';
  map.appendChild(busM);

  // Spread passengers across the map
  const spread = [
    { left:'30%', top:'55%' }, { left:'50%', top:'35%' }, { left:'70%', top:'65%' },
    { left:'40%', top:'25%' }, { left:'80%', top:'45%' },
  ];

  bookings.slice(0, 5).forEach((b, i) => {
    if (!b.lat && !b.lng && !spread[i]) return;
    const isLate = !b.arrived && b.time < now;
    const pax    = users.find(u => u.id == b.userId);

    const marker = document.createElement('div');
    marker.className = `passenger-marker ${isLate ? 'late' : 'waiting'}`;
    marker.style.cssText = `left:${spread[i]?.left||'50%'};top:${spread[i]?.top||'50%'};transform:translate(-50%,-50%)`;
    marker.textContent = '👤';
    marker.title = pax ? pax.name : 'Passenger';
    map.appendChild(marker);

    const label = document.createElement('div');
    label.className = 'passenger-pin-label';
    label.style.cssText = `left:${spread[i]?.left||'50%'};top:calc(${spread[i]?.top||'50%'} + 16px);transform:translateX(-50%)`;
    label.textContent = pax ? pax.name.split(' ')[0] : 'Pax';
    map.appendChild(label);
  });
}

window.markArrived = function(bookingId) {
  DB.update('bookings', bookingId, { arrived: true });
  refreshBookings();
  showToast('Passenger marked as arrived!','success');
};

// ===== DRIVER CHAT =====
let activeChatPassengerId = null;
let driverChatPollTimer;

function loadDriverChat() {
  renderConversationList();
  clearInterval(driverChatPollTimer);
  driverChatPollTimer = setInterval(() => {
    if (document.getElementById('panel-driverchat').classList.contains('active')) {
      renderConversationList();
      if (activeChatPassengerId) renderDriverMessages();
    }
  }, 3000);
}

function renderConversationList() {
  const route = getRoute();
  const allKeys = [...new Set(DB.getAll('bookings')
    .filter(b => !route || b.routeId == route.id)
    .map(b => b.userId))];

  const users = DB.getAll('users');
  const el    = document.getElementById('driverConvList');

  if (!allKeys.length) {
    el.innerHTML = '<p class="text-sm text-gray">No conversations yet. Passengers can message you from their dashboard.</p>';
    return;
  }

  el.innerHTML = allKeys.map(passengerId => {
    const pax      = users.find(u => u.id == passengerId);
    const msgs     = DB.getChat(user.id, passengerId);
    const lastMsg  = msgs[msgs.length - 1];
    const unread   = DB.unreadChatCount(user.id, passengerId, 'driver');
    const isActive = activeChatPassengerId == passengerId;
    return `<div class="conv-item ${isActive?'active-conv':''}" onclick="openChatWithPassenger(${passengerId})">
      <div class="conv-avatar">${pax ? pax.name.charAt(0) : '?'}</div>
      <div style="flex:1">
        <div class="flex-between">
          <strong class="text-sm">${pax ? pax.name : 'Passenger'}</strong>
          ${unread > 0 ? `<span class="badge badge-blue">${unread}</span>` : ''}
        </div>
        <div class="text-sm text-gray">${lastMsg ? lastMsg.message.substring(0,40)+'...' : 'No messages'}</div>
      </div>
    </div>`;
  }).join('');
}

window.openChatWithPassenger = async function(passengerId) {
  activeChatPassengerId = passengerId;
  const pax   = DB.getAll('users').find(u => u.id == passengerId);
  const route = getRoute();

  document.getElementById('driverChatBox').style.display = 'block';
  document.getElementById('driverChatPassengerName').textContent  = pax ? pax.name : 'Passenger';
  document.getElementById('driverChatPassengerRoute').textContent = route ? route.name : '—';
  await DB.loadChat(user.id, passengerId);

  // Switch to driverchat panel
  if (!document.getElementById('panel-driverchat').classList.contains('active')) {
    showPanel('driverchat');
    return;
  }

  DB.markChatRead(user.id, passengerId, 'driver');
  renderConversationList();
  renderDriverMessages();
};

function renderDriverMessages() {
  if (!activeChatPassengerId) return;
  const messages = DB.getChat(user.id, activeChatPassengerId);
  const box      = document.getElementById('driverChatMessages');
  box.innerHTML  = messages.map(m => {
    const isMine = m.from === 'driver';
    return `<div class="chat-bubble ${isMine?'mine':'theirs'}">
      ${m.message}<div class="bubble-meta">${m.time}</div>
    </div>`;
  }).join('') || '<div class="chat-system-msg">No messages yet.</div>';
  box.scrollTop = box.scrollHeight;
}

window.sendDriverMsg = function() {
  if (!activeChatPassengerId) return;
  const input = document.getElementById('driverChatInput');
  const text  = input.value.trim();
  if (!text) return;
  DB.sendChat(user.id, activeChatPassengerId, 'driver', text);
  input.value = '';
  renderDriverMessages();
  renderConversationList();
};

// ===== INIT =====
loadHome();

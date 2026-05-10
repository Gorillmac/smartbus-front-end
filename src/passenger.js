/* SmartBus Passenger Dashboard — SWP316D Group P */
import { DB, showToast, formatDate, timeNow, dateToday } from './data.js';

const user = DB.requireAuth('passenger');
if (!user) throw new Error('Not logged in');

document.getElementById('userName').textContent = user.name.split(' ')[0];
document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
document.getElementById('welcomeName').textContent = user.name.split(' ')[0];

window.logout = function() { DB.clearSession(); window.location.href = './index.html'; };

// ===== GPS STATE =====
let capturedLat = null;
let capturedLng = null;

// ===== PANEL NAVIGATION =====
window.showPanel = function(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const p = document.getElementById('panel-' + name);
  if (p) p.classList.add('active');
  const n = document.getElementById('nav-' + name);
  if (n) n.classList.add('active');
  const loaders = {
    home: loadHome, routes: loadRoutes, track: loadTracking,
    ticket: loadTickets, history: loadHistory, notifications: loadNotifications,
    rate: loadRate, complaints: loadComplaints, sos: loadSOS,
    schedule: loadSchedule, chat: loadChat, bot: loadBot,
  };
  if (loaders[name]) loaders[name]();
};

// ===== HOME =====
function loadHome() {
  const tickets  = DB.getAll('tickets').filter(t => t.userId == user.id && t.status === 'active');
  const trips    = DB.getAll('trips').filter(t => t.userId == user.id);
  const routes   = DB.getAll('routes').filter(r => r.status === 'active');
  const notifs   = DB.getAll('notifications').filter(n => n.userId == user.id && !n.read);

  document.getElementById('stat-tickets').textContent = tickets.length;
  document.getElementById('stat-trips').textContent   = trips.length;
  document.getElementById('stat-routes').textContent  = routes.length;
  document.getElementById('stat-notifs').textContent  = notifs.length;
  document.getElementById('notifCount').textContent   = notifs.length;

  const announces = DB.getAll('announcements');
  document.getElementById('announce-count').textContent = announces.length + ' new';
  const annEl = document.getElementById('announcements-home');
  annEl.innerHTML = announces.slice(0, 3).map(a => `
    <div class="announcement-item">
      <h4>${a.title}</h4>
      <p>${a.message.substring(0,90)}${a.message.length>90?'...':''}</p>
      <small>${formatDate(a.date)}</small>
    </div>`).join('') || '<p class="text-sm text-gray">No announcements.</p>';

  const now = timeNow();
  const depEl = document.getElementById('next-departures');
  depEl.innerHTML = routes.slice(0,3).map(r => {
    const upcoming = r.schedule.filter(t => t >= now);
    const next = upcoming[0] || r.schedule[0];
    return `<div class="schedule-row">
      <span class="time-badge ${upcoming.length>0?'soon':'passed'}">${next}</span>
      <div><div class="text-sm bold">${r.name}</div>
      <div class="text-sm text-gray">Route ${r.number} &bull; ${r.fare}</div></div>
    </div>`;
  }).join('') || '<p class="text-sm text-gray">No departures.</p>';
}

// ===== ROUTES =====
function loadRoutes() { renderRoutes(DB.getAll('routes')); }

window.filterRoutes = function() {
  const q = document.getElementById('routeSearch').value.toLowerCase();
  renderRoutes(DB.getAll('routes').filter(r =>
    r.name.toLowerCase().includes(q) || r.number.toLowerCase().includes(q) || r.stops.join(' ').toLowerCase().includes(q)
  ));
};

function renderRoutes(routes) {
  const el = document.getElementById('routesList');
  el.innerHTML = routes.map(r => {
    const badgeClass = r.status === 'active' ? 'badge-green' : 'badge-red';
    const stopsHtml = r.stops.map((s,i) =>
      i < r.stops.length-1 ? `<span class="text-sm">${s}</span><span class="stop-line"></span>` : `<span class="text-sm">${s}</span>`
    ).join('');
    const upcoming = r.schedule.filter(t => t >= timeNow());
    return `
      <div class="route-card">
        <div class="route-number">${r.number}</div>
        <div class="route-info" style="flex:1">
          <div class="flex-between">
            <h4>${r.name}</h4>
            <span class="badge ${badgeClass}">${r.status}</span>
          </div>
          <div class="text-sm text-gray">${r.distance} &bull; ~${r.duration} &bull; Fare: ${r.fare}</div>
          <div class="route-stops mt-1">${stopsHtml}</div>
          <div class="mt-1 text-sm text-gray">Next: <strong>${upcoming[0]||'No more today'}</strong>${upcoming[1]?' &bull; Then: '+upcoming[1]:''}</div>
          <div style="margin-top:8px">
            <button class="btn btn-secondary btn-sm" onclick="viewSchedule(${r.id})">View Schedule</button>
          </div>
        </div>
      </div>`;
  }).join('') || '<p class="text-gray text-sm">No routes found.</p>';
}

window.viewSchedule = function(routeId) {
  const route = DB.getById('routes', routeId);
  if (!route) return;
  const now = timeNow();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>Route ${route.number} Schedule</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      ${route.schedule.map(t => {
        const passed = t < now;
        return `<div class="schedule-row">
          <span class="time-badge ${passed?'passed':t<=timeNow()?'soon':''}">${t}</span>
          <span class="text-sm">${passed?'✓ Departed':'🕐 Scheduled'}</span>
        </div>`;
      }).join('')}
    </div>`;
  document.body.appendChild(modal);
};

// ===== TRACKING =====
function loadTracking() {
  const routes = DB.getAll('routes').filter(r => r.status === 'active');
  const sel = document.getElementById('trackRouteSelect');
  sel.innerHTML = routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  loadTrackInfo();
  renderTrackMap();
}

window.loadTrackInfo = function() {
  const routeId = parseInt(document.getElementById('trackRouteSelect').value);
  const route   = DB.getById('routes', routeId);
  if (!route) return;
  const now = timeNow();
  document.getElementById('trackSchedule').innerHTML = route.schedule.map(t =>
    `<div class="schedule-row">
      <span class="time-badge ${t < now ? 'passed' : ''}">${t}</span>
      <span class="text-sm">${t < now ? '✓ Departed' : '🕐 Scheduled'}</span>
    </div>`).join('');
  const buses = DB.getAll('buses').filter(b => b.routeId == routeId && b.status === 'active');
  const seatData = DB.getAll('seat_data');
  const statusEl = document.getElementById('trackStatus');
  if (!buses.length) { statusEl.innerHTML = '<p class="text-sm text-gray">No active buses on this route.</p>'; return; }
  statusEl.innerHTML = buses.map(bus => {
    const occupied = (seatData[bus.id] || []).length;
    const available = bus.capacity - occupied;
    const pct = Math.round((occupied / bus.capacity) * 100);
    return `<div style="margin-bottom:14px">
      <div class="flex-between text-sm mb-1"><strong>${bus.number}</strong><span class="badge badge-green">Active</span></div>
      <div class="text-sm text-gray mb-1">${available} seats available of ${bus.capacity}</div>
      <div class="progress-bar-wrap"><div class="progress-bar-fill ${pct>80?'red':pct>60?'yellow':'green'}" style="width:${pct}%"></div></div>
      <div class="text-sm text-gray mt-1">${pct}% full</div>
    </div>`;
  }).join('');
};

function renderTrackMap() {
  const map = document.getElementById('trackMap');
  map.querySelectorAll('.bus-marker,.stop-marker,.stop-label').forEach(el => el.remove());
  const buses = DB.getAll('buses').filter(b => b.status === 'active');
  const positions = [{ left:'20%', top:'45%' },{ left:'55%', top:'68%' },{ left:'78%', top:'22%' }];
  buses.slice(0,3).forEach((bus, i) => {
    const m = document.createElement('div');
    m.className = 'bus-marker';
    m.style.left = positions[i].left;
    m.style.top  = positions[i].top;
    m.textContent = '🚌';
    m.title = bus.number;
    map.appendChild(m);
  });
  [{ left:'15%', top:'43%', label:'Stop A' },{ left:'38%', top:'43%', label:'Stop B' },{ left:'65%', top:'43%', label:'Stop C' },{ left:'85%', top:'43%', label:'Terminal' }].forEach(s => {
    const dot = document.createElement('div');
    dot.className = 'stop-marker';
    dot.style.cssText = `left:${s.left};top:${s.top};transform:translate(-50%,-50%)`;
    map.appendChild(dot);
    const lbl = document.createElement('div');
    lbl.className = 'stop-label';
    lbl.style.cssText = `left:${s.left};top:calc(${s.top} + 14px);transform:translateX(-50%)`;
    lbl.textContent = s.label;
    map.appendChild(lbl);
  });
}

window.refreshTracking = function() { renderTrackMap(); loadTrackInfo(); showToast('Tracking refreshed!','info'); };

let busAnimInterval;
(function animateBuses() {
  busAnimInterval = setInterval(() => {
    document.querySelectorAll('#trackMap .bus-marker').forEach(m => {
      const l = parseFloat(m.style.left);
      m.style.left = Math.min(90, Math.max(10, l + (Math.random() * 2 - 0.5))) + '%';
    });
  }, 3000);
})();

// ===== TICKETS =====
function loadTickets() {
  const myTickets = DB.getAll('tickets').filter(t => t.userId == user.id);
  const routes    = DB.getAll('routes');
  const el = document.getElementById('myTickets');
  el.innerHTML = myTickets.map(t => {
    const route = routes.find(r => r.id == t.routeId);
    const sc = t.status==='active'?'badge-green':t.status==='used'?'badge-gray':'badge-red';
    return `<div style="padding:10px 0;border-bottom:1px solid var(--gray-light)">
      <div class="flex-between"><strong style="letter-spacing:2px;font-size:15px">${t.id}</strong><span class="badge ${sc}">${t.status}</span></div>
      <div class="text-sm text-gray">${route?route.name:'Unknown Route'} &bull; ${t.type}</div>
      <div class="text-sm text-gray">Expires: ${formatDate(t.expiryDate)}</div>
    </div>`;
  }).join('') || '<p class="text-sm text-gray">No tickets assigned. Ask the admin to assign one.</p>';
}

window.verifyTicket = function() {
  const num = document.getElementById('ticketNum').value.trim().toUpperCase();
  const el  = document.getElementById('ticketResult');
  if (!num) { el.innerHTML = '<div class="alert alert-warning">Please enter a ticket number.</div>'; return; }
  const ticket = DB.getAll('tickets').find(t => t.id.toUpperCase() === num);
  if (!ticket) {
    el.innerHTML = `<div class="ticket-result invalid"><div class="big-icon">❌</div><h3 style="color:var(--red)">Invalid Ticket</h3><p class="text-sm">Ticket <strong>${num}</strong> was not found in the system.</p></div>`;
    return;
  }
  const route    = DB.getById('routes', ticket.routeId);
  const isExpired = new Date(ticket.expiryDate) < new Date();
  const isValid   = ticket.status === 'active' && !isExpired;
  if (isValid) {
    el.innerHTML = `<div class="ticket-result valid"><div class="big-icon">✅</div><h3 style="color:var(--green)">Valid Ticket!</h3>
      <p class="text-sm"><strong>Route:</strong> ${route?route.name:'—'}</p>
      <p class="text-sm"><strong>Type:</strong> ${ticket.type}</p>
      <p class="text-sm"><strong>Expires:</strong> ${formatDate(ticket.expiryDate)}</p>
      <p class="text-sm text-green mt-1 bold">You may board the bus!</p></div>`;
    showToast('Ticket verified successfully!','success');
  } else {
    const reason = ticket.status==='used'?'This ticket has already been used.':isExpired?'This ticket has expired.':'This ticket is not active.';
    el.innerHTML = `<div class="ticket-result invalid"><div class="big-icon">⚠️</div><h3 style="color:var(--red)">Ticket Not Valid</h3><p class="text-sm">${reason}</p></div>`;
  }
};

// ===== HISTORY =====
function loadHistory() {
  const trips  = DB.getAll('trips').filter(t => t.userId == user.id);
  const routes = DB.getAll('routes');
  const tbody  = document.getElementById('historyBody');
  tbody.innerHTML = trips.map((t,i) => {
    const route = routes.find(r => r.id == t.routeId);
    const stars = '★'.repeat(t.rating||0)+'☆'.repeat(5-(t.rating||0));
    return `<tr><td>${i+1}</td><td>${route?route.name:'—'}</td><td>${formatDate(t.date)}</td><td>${t.departure}</td><td>${t.arrival}</td>
      <td><span class="badge badge-green">${t.status}</span></td><td style="color:var(--yellow)">${stars}</td></tr>`;
  }).join('') || '<tr><td colspan="7" class="text-center text-gray" style="padding:20px">No trip history yet.</td></tr>';
}

window.exportHistory = function() {
  const trips  = DB.getAll('trips').filter(t => t.userId == user.id);
  const routes = DB.getAll('routes');
  let csv = 'Trip,Route,Date,Departure,Arrival,Status,Rating\n';
  trips.forEach((t,i) => { const r = routes.find(r=>r.id==t.routeId); csv += `${i+1},"${r?r.name:''}",${t.date},${t.departure},${t.arrival},${t.status},${t.rating||''}\n`; });
  const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='my_trips.csv'; a.click();
  showToast('Trip history exported!','success');
};

// ===== NOTIFICATIONS =====
function loadNotifications() {
  const notifs    = DB.getAll('notifications').filter(n => n.userId == user.id);
  const announces = DB.getAll('announcements');
  const icons = { delay:'⏰', announcement:'📢', info:'ℹ️', warning:'⚠️' };
  const colors = { delay:'yellow', announcement:'blue', info:'blue', warning:'red' };
  document.getElementById('notifList').innerHTML = notifs.map(n =>
    `<div class="notif-item" style="${!n.read?'background:#f0f7ff;border-radius:6px;padding:12px;':''}">
      <div class="notif-icon ${colors[n.type]||'blue'}">${icons[n.type]||'🔔'}</div>
      <div class="notif-content"><p>${n.message}</p>
      <small>${n.date} at ${n.time}${!n.read?' &bull; <strong style="color:var(--blue)">New</strong>':''}</small></div>
    </div>`).join('') || '<p class="text-sm text-gray">No notifications.</p>';
  const colors2 = { high:'badge-red', medium:'badge-yellow', low:'badge-gray' };
  document.getElementById('announceList').innerHTML = announces.map(a =>
    `<div class="announcement-item">
      <div class="flex-between"><h4>${a.title}</h4><span class="badge ${colors2[a.priority]||'badge-gray'}">${a.priority} priority</span></div>
      <p>${a.message}</p><small>Posted ${formatDate(a.date)} by ${a.author}</small>
    </div>`).join('') || '<p class="text-sm text-gray">No announcements.</p>';
}

window.markAllRead = function() {
  const notifs = DB.getAll('notifications').map(n => ({ ...n, read: true }));
  DB.save('notifications', notifs);
  document.getElementById('notifCount').textContent = '0';
  loadNotifications();
  showToast('All notifications marked as read','success');
};

// ===== RATE =====
let selectedStars = 0;

function loadRate() {
  const trips  = DB.getAll('trips').filter(t => t.userId == user.id);
  const routes = DB.getAll('routes');
  const sel = document.getElementById('rateTrip');
  sel.innerHTML = trips.length
    ? trips.map(t => { const r=routes.find(r=>r.id==t.routeId); return `<option value="${t.id}">${formatDate(t.date)} – ${r?r.name:'Unknown'}</option>`; }).join('')
    : '<option>No trips to rate</option>';
}

window.setStar = function(n) {
  selectedStars = n;
  document.querySelectorAll('.star').forEach((s,i) => s.classList.toggle('active', i<n));
  const labels = ['','Poor','Fair','Good','Very Good','Excellent!'];
  document.getElementById('ratingLabel').textContent = labels[n]||'Click a star to rate';
};

window.submitRating = function() {
  if (selectedStars===0) { showToast('Please select a star rating','error'); return; }
  DB.update('trips', parseInt(document.getElementById('rateTrip').value), { rating: selectedStars, feedback: document.getElementById('rateFeedback').value.trim() });
  showToast('Thank you for your rating! ⭐','success');
  document.getElementById('rateFeedback').value='';
  setStar(0); selectedStars=0;
};

// ===== COMPLAINTS =====
function loadComplaints() {
  const routes = DB.getAll('routes');
  document.getElementById('complaintRoute').innerHTML = '<option value="">-- Select Route --</option>' +
    routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  const myComp = DB.getAll('complaints').filter(c => c.userId == user.id);
  const colors = { 'in-review':'badge-yellow', resolved:'badge-green', open:'badge-red' };
  document.getElementById('myComplaints').innerHTML = myComp.map(c =>
    `<div style="padding:10px 0;border-bottom:1px solid var(--gray-light)">
      <div class="flex-between"><strong class="text-sm">${c.type.replace('-',' ').toUpperCase()}</strong><span class="badge ${colors[c.status]||'badge-gray'}">${c.status}</span></div>
      <p class="text-sm text-gray mt-1">${c.description.substring(0,80)}...</p>
      <small class="text-gray">${formatDate(c.date)}</small>
    </div>`).join('') || '<p class="text-sm text-gray">No reports submitted.</p>';
}

window.submitComplaint = function() {
  const desc = document.getElementById('complaintDesc').value.trim();
  if (!desc) { showToast('Please describe the issue','error'); return; }
  DB.add('complaints', { id: DB.nextId('complaints'), userId: user.id, type: document.getElementById('complaintType').value, routeId: document.getElementById('complaintRoute').value||null, description: desc, status: 'in-review', date: dateToday() });
  document.getElementById('complaintDesc').value='';
  showToast('Your report has been submitted.','success');
  loadComplaints();
};

// ===== SOS =====
function loadSOS() {
  const buses = DB.getAll('buses');
  const sel = document.getElementById('seatBusSelect');
  sel.innerHTML = buses.map(b => `<option value="${b.id}">${b.number} (${b.plate})</option>`).join('');
  loadSeatMap();
}

window.loadSeatMap = function() {
  const busId = parseInt(document.getElementById('seatBusSelect').value);
  const bus   = DB.getById('buses', busId);
  if (!bus) return;
  const occupied = DB.getAll('seat_data')[busId] || [];
  let html = '';
  for (let i=1; i<=Math.min(bus.capacity,40); i++) {
    html += `<div class="seat ${occupied.includes(i)?'occupied':'available'}" title="Seat ${i}">${i}</div>`;
    if (i%2===0 && i%4!==0) html += `<div class="seat aisle"></div><div class="seat aisle"></div>`;
  }
  document.getElementById('seatMapGrid').innerHTML = html;
  document.getElementById('seatSummary').textContent = `${bus.capacity - occupied.length} of ${bus.capacity} seats available on ${bus.number}`;
};

window.triggerSOS = function() {
  // Try to get real location for SOS
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      document.getElementById('sosStatus').innerHTML = `
        <div class="alert alert-danger"><strong>🆘 SOS Alert Sent!</strong><br>
        Emergency services notified. Your GPS location: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}<br>
        Accuracy: ±${Math.round(pos.coords.accuracy)}m</div>`;
    }, () => {
      document.getElementById('sosStatus').innerHTML = `<div class="alert alert-danger"><strong>🆘 SOS Alert Sent!</strong><br>Emergency services notified. Stay calm — help is on the way.</div>`;
    });
  } else {
    document.getElementById('sosStatus').innerHTML = `<div class="alert alert-danger"><strong>🆘 SOS Alert Sent!</strong><br>Emergency services notified. Stay calm.</div>`;
  }
  showToast('SOS alert sent! Help is on the way.','error');
};

window.shareTripInfo = function() {
  const phone = document.getElementById('sharePhone').value.trim();
  if (!phone) { showToast('Please enter a phone number','error'); return; }
  showToast('Trip information sent to '+phone,'success');
};

// ===== SCHEDULE A RIDE =====
function loadSchedule() {
  const routes = DB.getAll('routes').filter(r => r.status === 'active');
  const routeSel = document.getElementById('bookRouteId');
  routeSel.innerHTML = routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  routeSel.addEventListener('change', updateBookingRouteOptions);
  updateBookingRouteOptions();
  renderMyBookings();
}

function updateBookingRouteOptions() {
  const routeId = parseInt(document.getElementById('bookRouteId').value);
  const route   = DB.getById('routes', routeId);
  if (!route) return;
  document.getElementById('bookTime').innerHTML = route.schedule.map(t => `<option>${t}</option>`).join('');
  document.getElementById('bookStop').innerHTML = route.stops.map(s => `<option>${s}</option>`).join('');
}

window.captureLocation = function() {
  const label  = document.getElementById('locLabel');
  const coords = document.getElementById('locCoords');
  const box    = document.getElementById('locationStatus');

  if (!navigator.geolocation) {
    label.textContent  = 'GPS not supported';
    coords.textContent = 'Your browser does not support geolocation.';
    return;
  }
  label.textContent  = 'Searching for your location...';
  coords.textContent = 'Please allow location access.';

  navigator.geolocation.getCurrentPosition(
    pos => {
      capturedLat = pos.coords.latitude;
      capturedLng = pos.coords.longitude;
      label.textContent  = '📍 Location captured!';
      coords.textContent = `Lat: ${capturedLat.toFixed(5)}, Lng: ${capturedLng.toFixed(5)} (±${Math.round(pos.coords.accuracy)}m)`;
      box.classList.add('captured');
      showToast('Your GPS location was captured successfully.','success');
    },
    err => {
      label.textContent  = 'Could not get location';
      coords.textContent = 'Enable location permission in your browser, or booking will proceed without GPS.';
      showToast('Location access denied. Booking will proceed without GPS.','warning');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

window.submitBooking = function() {
  const routeId = parseInt(document.getElementById('bookRouteId').value);
  const time    = document.getElementById('bookTime').value;
  const stop    = document.getElementById('bookStop').value;
  const seats   = parseInt(document.getElementById('bookSeats').value) || 1;
  const route   = DB.getById('routes', routeId);
  if (!route) return;

  // Find the driver/bus for this route so driver can see booking
  const bus = DB.getAll('buses').find(b => b.routeId == routeId);

  DB.add('bookings', {
    id:       DB.nextId('bookings'),
    userId:   user.id,
    routeId,
    driverId: bus ? bus.driverId : null,
    time, stop, seats,
    status:   'scheduled',
    date:     dateToday(),
    lat:      capturedLat,
    lng:      capturedLng,
    arrived:  false,
    name:     user.name,
  });

  showToast(`Booking confirmed! ${seats} seat(s) on ${route.name} at ${time}.`, 'success');
  renderMyBookings();
};

function renderMyBookings() {
  const bookings = DB.getAll('bookings').filter(b => b.userId == user.id);
  const routes   = DB.getAll('routes');
  const el = document.getElementById('myBookingsList');
  if (!bookings.length) { el.innerHTML = '<p class="text-sm text-gray">No bookings yet.</p>'; return; }
  el.innerHTML = bookings.map(b => {
    const route = routes.find(r => r.id == b.routeId);
    const sc = b.arrived ? 'badge-green' : 'badge-blue';
    const label = b.arrived ? 'Arrived' : 'Scheduled';
    return `<div class="booking-card">
      <div class="booking-avatar">${user.name.charAt(0)}</div>
      <div style="flex:1">
        <div class="flex-between">
          <strong class="text-sm">${route?route.name:'Route'}</strong>
          <span class="badge ${sc}">${label}</span>
        </div>
        <div class="text-sm text-gray">${b.time} &bull; ${b.stop} &bull; ${b.seats} seat(s)</div>
        <div class="text-sm text-gray">${formatDate(b.date)}</div>
        ${b.lat ? `<div class="text-sm" style="color:var(--green)">📍 GPS: ${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}</div>` : '<div class="text-sm text-gray">📍 No GPS</div>'}
        <button class="btn btn-danger btn-sm mt-1" onclick="cancelBooking(${b.id})">Cancel</button>
      </div>
    </div>`;
  }).join('');
}

window.cancelBooking = function(id) {
  DB.delete('bookings', id);
  renderMyBookings();
  showToast('Booking cancelled.','info');
};

window.clearMyBookings = function() {
  const bookings = DB.getAll('bookings').filter(b => b.userId != user.id);
  DB.save('bookings', bookings);
  renderMyBookings();
  showToast('Bookings cleared.','info');
};

// ===== PASSENGER CHAT WITH DRIVER =====
let chatDriverId = null;
let chatPollTimer = null;

async function loadChat() {
  // Find driver assigned to passenger's route (via their ticket)
  const tickets = DB.getAll('tickets').filter(t => t.userId == user.id && t.status === 'active');
  const buses   = DB.getAll('buses');
  const users   = DB.getAll('users');

  let driverUser = null;
  let routeName  = '—';

  for (const ticket of tickets) {
    const bus = buses.find(b => b.routeId == ticket.routeId);
    if (bus && bus.driverId) {
      driverUser = users.find(u => u.id == bus.driverId);
      const route = DB.getById('routes', ticket.routeId);
      routeName   = route ? route.name : '—';
      break;
    }
  }

  // Fallback: use default driver
  if (!driverUser) {
    driverUser = users.find(u => u.role === 'driver');
    routeName  = 'Route (unassigned)';
  }

  if (!driverUser) {
    document.getElementById('chatMessages').innerHTML = '<div class="chat-system-msg">No driver assigned to your route yet.</div>';
    return;
  }

  chatDriverId = driverUser.id;
  document.getElementById('chatDriverName').textContent  = driverUser.name;
  document.getElementById('chatDriverRoute').textContent = routeName;

  await DB.loadChat(chatDriverId, user.id);
  renderPassengerChat();
  DB.markChatRead(chatDriverId, user.id, 'passenger');

  clearInterval(chatPollTimer);
  chatPollTimer = setInterval(() => {
    if (document.getElementById('panel-chat').classList.contains('active')) {
      renderPassengerChat();
    }
  }, 3000);
}

function renderPassengerChat() {
  if (!chatDriverId) return;
  const messages = DB.getChat(chatDriverId, user.id);
  const box      = document.getElementById('chatMessages');
  if (!messages.length) {
    box.innerHTML = '<div class="chat-system-msg">No messages yet. Say hello to your driver!</div>';
    return;
  }
  box.innerHTML = messages.map(m => {
    const isMine = m.from === 'passenger';
    return `<div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">
      ${m.message}
      <div class="bubble-meta">${m.time}</div>
    </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

window.sendPassengerMsg = function() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text || !chatDriverId) return;
  DB.sendChat(chatDriverId, user.id, 'passenger', text);
  input.value = '';
  renderPassengerChat();
};

// ===== SMARTBOT =====
const botQA = [
  { q: ['routes','available routes','what routes'], a: () => {
    const routes = DB.getAll('routes').filter(r => r.status==='active');
    return `There are <strong>${routes.length} active routes</strong>:<br>${routes.map(r=>`&bull; ${r.name} (Route ${r.number}) — fare ${r.fare}`).join('<br>')}`;
  }},
  { q: ['ticket','verify ticket','how ticket works','my ticket'], a: () =>
    'To verify a ticket: go to <strong>Verify Ticket</strong> in the sidebar, enter your ticket number (e.g. <strong>SB001</strong>) and click Verify. You\'ll see if you can board the bus.' },
  { q: ['next bus','when is bus','departure','schedule'], a: () => {
    const now = timeNow();
    const route = DB.getAll('routes').find(r => r.status==='active');
    const next  = route ? (route.schedule.filter(t => t>=now)[0] || route.schedule[0]) : '?';
    return `The next bus on <strong>${route?route.name:'your route'}</strong> departs at <strong>${next}</strong>. Check the Routes & Schedules section for full timetables.`;
  }},
  { q: ['emergency','sos','help','police','ambulance'], a: () =>
    '🆘 <strong>Emergency Contacts:</strong><br>&bull; SmartBus: 0800-762-7828<br>&bull; Police: 10111<br>&bull; Ambulance: 10177<br><br>Use the <strong>Emergency / SOS</strong> panel to send an instant alert with your location.' },
  { q: ['booking','schedule a ride','how to book'], a: () =>
    'Go to <strong>Schedule a Ride</strong> in the sidebar. Select your route, time and pickup stop, then click 📡 to capture your GPS location. The driver will see your booking and location.' },
  { q: ['fare','fares','cost','price','how much'], a: () => {
    const routes = DB.getAll('routes').filter(r=>r.status==='active');
    return `Current bus fares:<br>${routes.map(r=>`&bull; ${r.name}: <strong>${r.fare}</strong>`).join('<br>')}`;
  }},
  { q: ['track','tracking','where is bus','live'], a: () =>
    'Click <strong>Track My Bus</strong> in the sidebar. Select your route to see live bus positions on the map, seat availability, and the upcoming schedule.' },
  { q: ['complaint','report issue','problem'], a: () =>
    'Go to <strong>Report Issue</strong> in the sidebar. Choose the issue type, select the route (if applicable) and describe the problem. The admin team will review it.' },
  { q: ['rating','rate','feedback'], a: () =>
    'Go to <strong>Rate Service</strong> in the sidebar. Select a past trip and give it a star rating (1–5) and optional written feedback. Your ratings help improve the service!' },
  { q: ['chat','driver','message'], a: () =>
    'You can chat directly with your driver by clicking <strong>Chat with Driver</strong> in the sidebar. Messages are stored locally and the driver can reply from their dashboard.' },
  { q: ['project','swp316d','who made'], a: () =>
    'SmartBus was built by <strong>Group P</strong> as part of the <strong>SWP316D</strong> module. It uses plain HTML, CSS, JavaScript, PHP and MySQL.' },
];

function botReply(text) {
  const lower = text.toLowerCase();
  for (const item of botQA) {
    if (item.q.some(k => lower.includes(k))) return item.a();
  }
  return `I'm not sure about that yet! Try asking about:<br>&bull; Routes &bull; Tickets &bull; Bus schedules &bull; Fares &bull; Emergency contacts &bull; How to book a ride`;
}

function loadBot() {
  // Already rendered on load, nothing to reload
}

window.sendBotMsg = function() {
  const input = document.getElementById('botInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';

  const box = document.getElementById('botMessages');

  // User bubble
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble mine';
  userBubble.innerHTML = `${text}<div class="bubble-meta">${timeNow()}</div>`;
  box.appendChild(userBubble);

  // Typing indicator
  const typing = document.createElement('div');
  typing.className = 'bot-typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  box.appendChild(typing);
  box.scrollTop = box.scrollHeight;

  setTimeout(() => {
    typing.remove();
    const botBubble = document.createElement('div');
    botBubble.className = 'chat-bubble bot-bubble';
    botBubble.innerHTML = `${botReply(text)}<div class="bubble-meta">${timeNow()}</div>`;
    box.appendChild(botBubble);
    box.scrollTop = box.scrollHeight;
  }, 1000 + Math.random() * 500);
};

window.botQuick = function(q) {
  document.getElementById('botInput').value = q;
  sendBotMsg();
};

// ===== INIT =====
loadHome();
const unread = DB.getAll('notifications').filter(n => n.userId == user.id && !n.read).length;
document.getElementById('notifCount').textContent = unread;

// Initialise route options for scheduling
window.updateBookingRouteOptions = updateBookingRouteOptions;
document.getElementById('bookRouteId')?.addEventListener('change', updateBookingRouteOptions);

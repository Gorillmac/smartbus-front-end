/* SmartBus Admin Dashboard Logic */
import { DB, showToast, formatDate, dateToday } from './data.js';

const user = DB.requireAuth('admin');
if (!user) throw new Error('Not logged in');

document.getElementById('userName').textContent = user.name.split(' ')[0];
document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();

window.logout = function() {
  DB.clearSession();
  window.location.href = './index.html';
};

window.showPanel = function(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const p = document.getElementById('panel-' + name);
  if (p) p.classList.add('active');
  const n = document.getElementById('nav-' + name);
  if (n) n.classList.add('active');
  const loaders = {
    home: loadHome, trips: loadLiveTrips, buses: loadBuses, routes: loadRoutes,
    drivers: loadDrivers, passengers: loadPassengers, tickets: loadTickets,
    feedback: loadFeedback, complaints: loadComplaints, reports: loadReports, announce: loadAnnouncements
  };
  if (loaders[name]) loaders[name]();
};

window.closeModal = function(id) {
  document.getElementById(id).classList.remove('open');
};

// ===== HOME =====
function loadHome() {
  const buses = DB.getAll('buses');
  const routes = DB.getAll('routes');
  const users = DB.getAll('users');
  const tickets = DB.getAll('tickets');
  const trips = DB.getAll('trips');
  const complaints = DB.getAll('complaints');

  const drivers = users.filter(u => u.role === 'driver');
  const passengers = users.filter(u => u.role === 'passenger');
  const activeBuses = buses.filter(b => b.status === 'active');
  const activeRoutes = routes.filter(r => r.status === 'active');
  const activeTickets = tickets.filter(t => t.status === 'active');
  const openComplaints = complaints.filter(c => c.status !== 'resolved');

  document.getElementById('stat-buses').textContent = buses.length;
  document.getElementById('stat-buses-active').textContent = activeBuses.length + ' active';
  document.getElementById('stat-routes').textContent = activeRoutes.length;
  document.getElementById('stat-routes-all').textContent = routes.length + ' total';
  document.getElementById('stat-drivers').textContent = drivers.length;
  document.getElementById('stat-passengers').textContent = passengers.length;
  document.getElementById('stat-tickets').textContent = tickets.length;
  document.getElementById('stat-tickets-active').textContent = activeTickets.length + ' active';
  document.getElementById('stat-trips').textContent = trips.length;
  document.getElementById('stat-complaints').textContent = openComplaints.length;

  // Bus status summary
  const busEl = document.getElementById('busStatusSummary');
  busEl.innerHTML = buses.map(b => {
    const route = DB.getById('routes', b.routeId);
    const statusClass = b.status === 'active' ? 'badge-green' : b.status === 'maintenance' ? 'badge-yellow' : 'badge-gray';
    return `
      <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--gray-light)">
        <div>
          <strong class="text-sm">${b.number}</strong>
          <span class="text-sm text-gray"> — ${b.plate}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${route ? `<span class="text-sm text-gray">Route ${route.number}</span>` : ''}
          <span class="badge ${statusClass}">${b.status}</span>
        </div>
      </div>
    `;
  }).join('') || '<p class="text-sm text-gray">No buses.</p>';

  // Recent activity
  const actEl = document.getElementById('recentActivity');
  const recentTrips = trips.slice(-5).reverse();
  actEl.innerHTML = recentTrips.map(t => {
    const p = users.find(u => u.id == t.userId);
    const r = DB.getById('routes', t.routeId);
    return `
      <div class="notif-item">
        <div class="notif-icon blue">🚌</div>
        <div class="notif-content">
          <p><strong>${p ? p.name : 'Unknown'}</strong> completed a trip on ${r ? r.name : '—'}</p>
          <small>${formatDate(t.date)}</small>
        </div>
      </div>
    `;
  }).join('') || '<p class="text-sm text-gray">No recent activity.</p>';
}

// ===== LIVE TRIPS =====
function loadLiveTrips() {
  const active = DB.getAll('active_trips');
  const el = document.getElementById('liveTripsContent');
  if (active.length === 0) {
    el.innerHTML = `
      <div class="card">
        <div class="card-body text-center" style="padding:40px">
          <p style="font-size:40px">🚌</p>
          <p class="text-gray">No trips are currently active.</p>
          <p class="text-sm text-gray">Active trips will appear here when drivers start their routes.</p>
        </div>
      </div>
    `;
    return;
  }

  el.innerHTML = active.map(t => {
    const bus = DB.getById('buses', t.busId);
    const route = DB.getById('routes', t.routeId);
    const driver = DB.getAll('users').find(u => u.id == t.driverId);
    return `
      <div class="card mb-2">
        <div class="card-header">
          <h3>🟢 Active Trip — ${bus ? bus.number : '—'}</h3>
          <span class="badge badge-green">Live</span>
        </div>
        <div class="card-body">
          <div class="grid-3">
            <div><div class="text-sm text-gray">Driver</div><strong>${driver ? driver.name : '—'}</strong></div>
            <div><div class="text-sm text-gray">Route</div><strong>${route ? route.name : '—'}</strong></div>
            <div><div class="text-sm text-gray">Started</div><strong>${t.startTime}</strong></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== BUSES =====
function loadBuses() {
  const buses = DB.getAll('buses');
  const routes = DB.getAll('routes');
  const users = DB.getAll('users');
  const tbody = document.getElementById('busesBody');

  tbody.innerHTML = buses.map(b => {
    const route = routes.find(r => r.id == b.routeId);
    const driver = users.find(u => u.id == b.driverId);
    const sc = b.status === 'active' ? 'badge-green' : b.status === 'maintenance' ? 'badge-yellow' : 'badge-gray';
    return `
      <tr>
        <td><strong>${b.number}</strong></td>
        <td>${b.plate}</td>
        <td>${b.make}</td>
        <td>${b.capacity}</td>
        <td>${route ? route.name : '—'}</td>
        <td>${driver ? driver.name : '—'}</td>
        <td><span class="badge ${sc}">${b.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editBus(${b.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBus(${b.id})">Delete</button>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="8" class="text-center text-gray" style="padding:20px">No buses.</td></tr>';
}

window.openBusModal = function() {
  document.getElementById('busEditId').value = '';
  document.getElementById('busModalTitle').textContent = 'Add New Bus';
  document.getElementById('busNumber').value = '';
  document.getElementById('busPlate').value = '';
  document.getElementById('busMake').value = '';
  document.getElementById('busCapacity').value = '';
  document.getElementById('busStatus').value = 'active';

  const routes = DB.getAll('routes');
  const drivers = DB.getAll('users').filter(u => u.role === 'driver');
  document.getElementById('busRoute').innerHTML = '<option value="">-- No Route --</option>' +
    routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  document.getElementById('busDriver').innerHTML = '<option value="">-- No Driver --</option>' +
    drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

  document.getElementById('busModal').classList.add('open');
};

window.editBus = function(id) {
  const bus = DB.getById('buses', id);
  if (!bus) return;
  openBusModal();
  document.getElementById('busEditId').value = bus.id;
  document.getElementById('busModalTitle').textContent = 'Edit Bus';
  document.getElementById('busNumber').value = bus.number;
  document.getElementById('busPlate').value = bus.plate;
  document.getElementById('busMake').value = bus.make;
  document.getElementById('busCapacity').value = bus.capacity;
  document.getElementById('busStatus').value = bus.status;
  document.getElementById('busRoute').value = bus.routeId || '';
  document.getElementById('busDriver').value = bus.driverId || '';
};

window.saveBus = function() {
  const editId = document.getElementById('busEditId').value;
  const data = {
    number: document.getElementById('busNumber').value.trim(),
    plate: document.getElementById('busPlate').value.trim(),
    make: document.getElementById('busMake').value.trim(),
    capacity: parseInt(document.getElementById('busCapacity').value) || 40,
    status: document.getElementById('busStatus').value,
    routeId: document.getElementById('busRoute').value ? parseInt(document.getElementById('busRoute').value) : null,
    driverId: document.getElementById('busDriver').value ? parseInt(document.getElementById('busDriver').value) : null,
  };
  if (!data.number || !data.plate) { showToast('Please fill in bus number and plate', 'error'); return; }
  if (editId) {
    DB.update('buses', parseInt(editId), data);
    showToast('Bus updated!', 'success');
  } else {
    DB.add('buses', { id: DB.nextId('buses'), ...data });
    showToast('Bus added!', 'success');
  }
  closeModal('busModal');
  loadBuses();
};

window.deleteBus = function(id) {
  if (!confirm('Delete this bus?')) return;
  DB.delete('buses', id);
  showToast('Bus deleted', 'info');
  loadBuses();
};

// ===== ROUTES =====
function loadRoutes() {
  const routes = DB.getAll('routes');
  const tbody = document.getElementById('routesBody');
  tbody.innerHTML = routes.map(r => {
    const sc = r.status === 'active' ? 'badge-green' : 'badge-red';
    return `
      <tr>
        <td><strong>${r.number}</strong></td>
        <td>${r.name}</td>
        <td>${r.stops.join(' → ')}</td>
        <td>${r.fare}</td>
        <td>${r.distance}</td>
        <td><span class="badge ${sc}">${r.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editRoute(${r.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRoute(${r.id})">Delete</button>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="7" class="text-center text-gray" style="padding:20px">No routes.</td></tr>';
}

window.openRouteModal = function() {
  document.getElementById('routeEditId').value = '';
  document.getElementById('routeModalTitle').textContent = 'Add New Route';
  ['routeNum','routeName','routeStops','routeSchedule','routeFare','routeDistance','routeDuration'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('routeStatus').value = 'active';
  document.getElementById('routeModal').classList.add('open');
};

window.editRoute = function(id) {
  const r = DB.getById('routes', id);
  if (!r) return;
  openRouteModal();
  document.getElementById('routeEditId').value = r.id;
  document.getElementById('routeModalTitle').textContent = 'Edit Route';
  document.getElementById('routeNum').value = r.number;
  document.getElementById('routeName').value = r.name;
  document.getElementById('routeStops').value = r.stops.join(', ');
  document.getElementById('routeSchedule').value = r.schedule.join(', ');
  document.getElementById('routeFare').value = r.fare;
  document.getElementById('routeDistance').value = r.distance;
  document.getElementById('routeDuration').value = r.duration;
  document.getElementById('routeStatus').value = r.status;
};

window.saveRoute = function() {
  const editId = document.getElementById('routeEditId').value;
  const data = {
    number: document.getElementById('routeNum').value.trim(),
    name: document.getElementById('routeName').value.trim(),
    stops: document.getElementById('routeStops').value.split(',').map(s => s.trim()).filter(Boolean),
    schedule: document.getElementById('routeSchedule').value.split(',').map(s => s.trim()).filter(Boolean),
    fare: document.getElementById('routeFare').value.trim(),
    distance: document.getElementById('routeDistance').value.trim(),
    duration: document.getElementById('routeDuration').value.trim(),
    status: document.getElementById('routeStatus').value,
  };
  if (!data.number || !data.name) { showToast('Please fill in route number and name', 'error'); return; }
  if (editId) {
    DB.update('routes', parseInt(editId), data);
    showToast('Route updated!', 'success');
  } else {
    DB.add('routes', { id: DB.nextId('routes'), ...data });
    showToast('Route added!', 'success');
  }
  closeModal('routeModal');
  loadRoutes();
};

window.deleteRoute = function(id) {
  if (!confirm('Delete this route? This may affect buses assigned to it.')) return;
  DB.delete('routes', id);
  showToast('Route deleted', 'info');
  loadRoutes();
};

// ===== DRIVERS =====
function loadDrivers() {
  const drivers = DB.getAll('users').filter(u => u.role === 'driver');
  const buses = DB.getAll('buses');
  const routes = DB.getAll('routes');
  const tbody = document.getElementById('driversBody');

  tbody.innerHTML = drivers.map(d => {
    const bus = buses.find(b => b.driverId == d.id);
    const route = bus ? routes.find(r => r.id == bus.routeId) : null;
    return `
      <tr>
        <td><strong>${d.name}</strong></td>
        <td>${d.email}</td>
        <td>${d.phone || '—'}</td>
        <td>${d.licenseNumber || '—'}</td>
        <td>${bus ? bus.number : '—'}</td>
        <td>${route ? route.name : '—'}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="removeDriver(${d.id})">Remove</button>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="7" class="text-center text-gray" style="padding:20px">No drivers registered.</td></tr>';
}

window.openDriverModal = function() {
  ['drvName','drvEmail','drvPhone','drvLicense','drvPassword'].forEach(id => document.getElementById(id).value = '');
  const buses = DB.getAll('buses');
  document.getElementById('drvBus').innerHTML = '<option value="">-- No Bus --</option>' +
    buses.map(b => `<option value="${b.id}">${b.number}</option>`).join('');
  document.getElementById('driverModal').classList.add('open');
};

window.saveDriver = function() {
  const name    = document.getElementById('drvName').value.trim();
  const email   = document.getElementById('drvEmail').value.trim();
  const phone   = document.getElementById('drvPhone').value.trim();
  const license = document.getElementById('drvLicense').value.trim();
  const pass    = document.getElementById('drvPassword').value;
  const busId   = document.getElementById('drvBus').value;

  if (!name || !email || !pass) { showToast('Fill in name, email and password', 'error'); return; }
  if (DB.getAll('users').find(u => u.email === email)) { showToast('Email already in use', 'error'); return; }

  const newDriver = { id: DB.nextId('users'), name, email, password: pass, phone, licenseNumber: license, role: 'driver', busId: busId ? parseInt(busId) : null, joinDate: dateToday() };
  DB.add('users', newDriver);
  if (busId) DB.update('buses', parseInt(busId), { driverId: newDriver.id });
  showToast('Driver added!', 'success');
  closeModal('driverModal');
  loadDrivers();
};

window.removeDriver = function(id) {
  if (!confirm('Remove this driver account?')) return;
  DB.delete('users', id);
  showToast('Driver removed', 'info');
  loadDrivers();
};

// ===== PASSENGERS =====
let allPassengers = [];

function loadPassengers() {
  allPassengers = DB.getAll('users').filter(u => u.role === 'passenger');
  renderPassengers(allPassengers);
}

function renderPassengers(list) {
  const trips = DB.getAll('trips');
  const tbody = document.getElementById('passengersBody');
  tbody.innerHTML = list.map(p => {
    const tripCount = trips.filter(t => t.userId == p.id).length;
    return `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.email}</td>
        <td>${p.phone || '—'}</td>
        <td>${formatDate(p.joinDate)}</td>
        <td>${tripCount}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="removePassenger(${p.id})">Remove</button>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6" class="text-center text-gray" style="padding:20px">No passengers registered.</td></tr>';
}

window.filterPassengers = function() {
  const q = document.getElementById('passengerSearch').value.toLowerCase();
  renderPassengers(allPassengers.filter(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)));
};

window.removePassenger = function(id) {
  if (!confirm('Remove this passenger account? This cannot be undone.')) return;
  DB.delete('users', id);
  showToast('Passenger removed', 'info');
  loadPassengers();
};

// ===== TICKETS =====
function loadTickets() {
  const tickets = DB.getAll('tickets');
  const users = DB.getAll('users');
  const routes = DB.getAll('routes');
  const tbody = document.getElementById('ticketsBody');

  tbody.innerHTML = tickets.map(t => {
    const pax = users.find(u => u.id == t.userId);
    const route = routes.find(r => r.id == t.routeId);
    const sc = t.status === 'active' ? 'badge-green' : t.status === 'used' ? 'badge-gray' : 'badge-red';
    return `
      <tr>
        <td><strong style="letter-spacing:1px">${t.id}</strong></td>
        <td>${pax ? pax.name : '—'}</td>
        <td>${route ? route.name : '—'}</td>
        <td>${t.type}</td>
        <td>${formatDate(t.issueDate)}</td>
        <td>${formatDate(t.expiryDate)}</td>
        <td><span class="badge ${sc}">${t.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="changeTicketStatus('${t.id}','active')">Activate</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTicket('${t.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="8" class="text-center text-gray" style="padding:20px">No tickets.</td></tr>';
}

window.openTicketModal = function() {
  document.getElementById('ticketId').value = '';
  document.getElementById('ticketExpiry').value = '';
  const passengers = DB.getAll('users').filter(u => u.role === 'passenger');
  const routes = DB.getAll('routes');
  document.getElementById('ticketPassenger').innerHTML = '<option value="">-- Unassigned --</option>' +
    passengers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('ticketRoute').innerHTML = routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  document.getElementById('ticketModal').classList.add('open');
};

window.saveTicket = function() {
  const id = document.getElementById('ticketId').value.trim().toUpperCase();
  if (!id) { showToast('Enter a ticket number', 'error'); return; }
  if (DB.getAll('tickets').find(t => t.id === id)) { showToast('Ticket ID already exists', 'error'); return; }

  const ticket = {
    id,
    userId: document.getElementById('ticketPassenger').value ? parseInt(document.getElementById('ticketPassenger').value) : null,
    routeId: parseInt(document.getElementById('ticketRoute').value),
    type: document.getElementById('ticketType').value,
    status: 'active',
    issueDate: dateToday(),
    expiryDate: document.getElementById('ticketExpiry').value || ''
  };
  DB.add('tickets', ticket);
  showToast(`Ticket ${id} created!`, 'success');
  closeModal('ticketModal');
  loadTickets();
};

window.changeTicketStatus = function(id, status) {
  const tickets = DB.getAll('tickets').map(t => t.id === id ? { ...t, status } : t);
  DB.save('tickets', tickets);
  showToast('Ticket status updated', 'success');
  loadTickets();
};

window.deleteTicket = function(id) {
  if (!confirm('Delete ticket ' + id + '?')) return;
  const tickets = DB.getAll('tickets').filter(t => t.id !== id);
  DB.save('tickets', tickets);
  showToast('Ticket deleted', 'info');
  loadTickets();
};

// ===== FEEDBACK =====
function loadFeedback() {
  const trips = DB.getAll('trips').filter(t => t.rating);
  const avg = trips.reduce((s, t) => s + t.rating, 0) / (trips.length || 1);

  document.getElementById('ratingOverview').innerHTML = `
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:48px;font-weight:700;color:var(--yellow)">${avg.toFixed(1)}</div>
      <div style="font-size:18px;color:var(--yellow)">★★★★★</div>
      <div class="text-sm text-gray mt-1">${trips.length} ratings received</div>
    </div>
    <div class="divider"></div>
    ${[5,4,3,2,1].map(n => {
      const count = trips.filter(t => t.rating === n).length;
      const pct = Math.round((count / (trips.length || 1)) * 100);
      return `
        <div class="flex-between text-sm mb-1">
          <span>${n} ★</span>
          <div class="progress-bar-wrap" style="flex:1;margin:0 10px">
            <div class="progress-bar-fill ${n>=4?'green':n===3?'yellow':'red'}" style="width:${pct}%"></div>
          </div>
          <span>${count}</span>
        </div>
      `;
    }).join('')}
  `;

  const commentsEl = document.getElementById('recentComments');
  const withComments = trips.filter(t => t.feedback);
  if (withComments.length === 0) {
    commentsEl.innerHTML = '<p class="text-sm text-gray">No comments yet.</p>';
    return;
  }
  const users = DB.getAll('users');
  commentsEl.innerHTML = withComments.slice(-5).reverse().map(t => {
    const p = users.find(u => u.id == t.userId);
    const stars = '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating);
    return `
      <div style="padding:10px 0;border-bottom:1px solid var(--gray-light)">
        <div class="flex-between">
          <strong class="text-sm">${p ? p.name : 'Unknown'}</strong>
          <span style="color:var(--yellow);font-size:13px">${stars}</span>
        </div>
        <p class="text-sm text-gray mt-1">"${t.feedback}"</p>
        <small class="text-gray">${formatDate(t.date)}</small>
      </div>
    `;
  }).join('');
}

// ===== COMPLAINTS =====
function loadComplaints() {
  const complaints = DB.getAll('complaints');
  const users = DB.getAll('users');
  const tbody = document.getElementById('complaintsBody');

  tbody.innerHTML = complaints.map((c, i) => {
    const p = users.find(u => u.id == c.userId);
    const sc = c.status === 'resolved' ? 'badge-green' : c.status === 'in-review' ? 'badge-yellow' : 'badge-red';
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${p ? p.name : '—'}</td>
        <td>${c.type.replace('-', ' ')}</td>
        <td class="text-sm">${c.description.substring(0, 60)}...</td>
        <td>${formatDate(c.date)}</td>
        <td><span class="badge ${sc}">${c.status}</span></td>
        <td>
          <button class="btn btn-success btn-sm" onclick="resolveComplaint(${c.id})">Resolve</button>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="7" class="text-center text-gray" style="padding:20px">No complaints.</td></tr>';
}

window.resolveComplaint = function(id) {
  DB.update('complaints', id, { status: 'resolved' });
  showToast('Complaint marked as resolved', 'success');
  loadComplaints();
};

// ===== REPORTS =====
function loadReports() {
  const buses = DB.getAll('buses');
  const routes = DB.getAll('routes');
  const trips = DB.getAll('trips');
  const users = DB.getAll('users');
  const seatData = DB.getAll('seat_data');

  // Bus utilization
  const busEl = document.getElementById('busUtilization');
  busEl.innerHTML = buses.map(b => {
    const occupied = (seatData[b.id] || []).length;
    const pct = Math.round((occupied / (b.capacity || 1)) * 100);
    return `
      <div style="margin-bottom:12px">
        <div class="flex-between text-sm mb-1">
          <strong>${b.number}</strong>
          <span class="${pct > 80 ? 'text-red' : pct > 60 ? 'text-gray' : 'text-green'}">${pct}%</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill ${pct>80?'red':pct>60?'yellow':'green'}" style="width:${pct}%"></div>
        </div>
        <div class="text-sm text-gray">${occupied}/${b.capacity} seats occupied</div>
      </div>
    `;
  }).join('') || '<p class="text-sm text-gray">No buses.</p>';

  // Route performance
  const routeEl = document.getElementById('routePerformance');
  routeEl.innerHTML = routes.map(r => {
    const routeTrips = trips.filter(t => t.routeId == r.id);
    const avgRating = routeTrips.filter(t=>t.rating).reduce((s,t)=>s+t.rating,0) / (routeTrips.filter(t=>t.rating).length || 1);
    return `
      <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--gray-light)">
        <div>
          <strong class="text-sm">${r.name}</strong>
          <div class="text-sm text-gray">${routeTrips.length} trips completed</div>
        </div>
        <div style="text-align:right">
          <div style="color:var(--yellow)">★ ${avgRating.toFixed(1)}</div>
          <span class="badge ${r.status==='active'?'badge-green':'badge-red'}">${r.status}</span>
        </div>
      </div>
    `;
  }).join('') || '<p class="text-sm text-gray">No routes.</p>';

  // Trips log
  const tbody = document.getElementById('tripsLogBody');
  tbody.innerHTML = trips.map((t, i) => {
    const p = users.find(u => u.id == t.userId);
    const r = routes.find(r => r.id == t.routeId);
    const b = buses.find(b => b.id == t.busId);
    const stars = t.rating ? '★'.repeat(t.rating) : '—';
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${p ? p.name : '—'}</td>
        <td>${r ? r.name : '—'}</td>
        <td>${b ? b.number : '—'}</td>
        <td>${formatDate(t.date)}</td>
        <td>${t.departure}</td>
        <td>${t.arrival}</td>
        <td style="color:var(--yellow)">${stars}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="8" class="text-center text-gray" style="padding:20px">No trips logged.</td></tr>';
}

window.exportReport = function(type) {
  let csv = '';
  if (type === 'trips') {
    const trips = DB.getAll('trips');
    const users = DB.getAll('users');
    const routes = DB.getAll('routes');
    csv = 'ID,Passenger,Route,Date,Departure,Arrival,Status,Rating\n';
    trips.forEach((t, i) => {
      const p = users.find(u => u.id == t.userId);
      const r = routes.find(r => r.id == t.routeId);
      csv += `${i+1},"${p?p.name:''}","${r?r.name:''}",${t.date},${t.departure},${t.arrival},${t.status},${t.rating||''}\n`;
    });
  } else if (type === 'routes') {
    const routes = DB.getAll('routes');
    csv = 'Number,Name,Stops,Fare,Distance,Duration,Status\n';
    routes.forEach(r => {
      csv += `${r.number},"${r.name}","${r.stops.join(' - ')}",${r.fare},${r.distance},${r.duration},${r.status}\n`;
    });
  }
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `smartbus_${type}_report.csv`;
  a.click();
  showToast('Report exported!', 'success');
};

// ===== ANNOUNCEMENTS =====
function loadAnnouncements() {
  const el = document.getElementById('announceList');
  const announces = DB.getAll('announcements');
  const colors = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' };
  el.innerHTML = announces.map(a => `
    <div class="announcement-item">
      <div class="flex-between">
        <h4>${a.title}</h4>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="badge ${colors[a.priority]}">${a.priority}</span>
          <button class="btn btn-danger btn-sm" onclick="deleteAnnouncement(${a.id})">✕</button>
        </div>
      </div>
      <p>${a.message}</p>
      <small>${formatDate(a.date)}</small>
    </div>
  `).join('') || '<p class="text-sm text-gray">No announcements.</p>';
}

window.postAnnouncement = function() {
  const title = document.getElementById('annTitle').value.trim();
  const message = document.getElementById('annMessage').value.trim();
  const priority = document.getElementById('annPriority').value;
  if (!title || !message) { showToast('Please fill in title and message', 'error'); return; }

  DB.add('announcements', {
    id: DB.nextId('announcements'),
    title, message, priority,
    date: dateToday(),
    author: user.name
  });

  document.getElementById('annTitle').value = '';
  document.getElementById('annMessage').value = '';
  showToast('Announcement posted to all passengers!', 'success');
  loadAnnouncements();
};

window.deleteAnnouncement = function(id) {
  DB.delete('announcements', id);
  showToast('Announcement removed', 'info');
  loadAnnouncements();
};

window.clearAnnouncements = function() {
  if (!confirm('Clear all announcements?')) return;
  DB.save('announcements', []);
  showToast('All announcements cleared', 'info');
  loadAnnouncements();
};

// Init
loadHome();

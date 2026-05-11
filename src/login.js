/* SmartBus Login Logic
   Handles login, register, role selection
*/
import { DB, showToast } from './data.js';

DB.init();

// Redirect if already logged in
const existing = DB.getSession();
if (existing) goToDashboard(existing.role);

let selectedRole = 'passenger';

window.pickRole = function(role, el) {
  selectedRole = role;
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
};

window.fillDemo = function(email, pass, role) {
  document.getElementById('email').value = email;
  document.getElementById('pass').value = pass;
  const tabs = document.querySelectorAll('.role-tab');
  tabs.forEach(t => t.classList.remove('active'));
  const idx = { passenger:0, driver:1, admin:2 }[role];
  if (tabs[idx]) tabs[idx].classList.add('active');
  selectedRole = role;
};

window.doLogin = async function() {
  const email = document.getElementById('email').value.trim();
  const pass  = document.getElementById('pass').value;
  const err   = document.getElementById('loginErr');

  err.classList.add('hidden');

  if (!email || !pass) {
    err.textContent = 'Please enter your email and password.';
    err.classList.remove('hidden');
    return;
  }

  let user = null;
  try {
    user = await DB.login(email, pass);
  } catch (error) {
    console.error(error);
    err.textContent = 'Wrong email or password. Use the demo accounts below to try.';
    err.classList.remove('hidden');
    return;
  }

  DB.setSession(user);
  showToast(`Welcome, ${user.name.split(' ')[0]}! Redirecting...`, 'success');
  setTimeout(() => goToDashboard(user.role), 700);
};

window.doRegister = async function() {
  const name  = document.getElementById('rName').value.trim();
  const email = document.getElementById('rEmail').value.trim();
  const phone = document.getElementById('rPhone').value.trim();
  const pass  = document.getElementById('rPass').value;
  const err   = document.getElementById('regErr');

  err.classList.add('hidden');
  if (!name || !email || !pass) {
    err.textContent = 'Please fill in all required fields.';
    err.classList.remove('hidden');
    return;
  }
  if (pass.length < 6) {
    err.textContent = 'Password must be at least 6 characters.';
    err.classList.remove('hidden');
    return;
  }
  const existing = DB.getAll('users').find(u => u.email === email);
  if (existing) {
    err.textContent = 'An account with that email already exists.';
    err.classList.remove('hidden');
    return;
  }

  const newUser = {
    name, email, phone, password: pass,
    role: 'passenger',
    joinDate: new Date().toISOString().split('T')[0]
  };
  try {
    const savedUser = await DB.create('users', newUser);
    DB.setSession(savedUser);
    showToast('Account created! Welcome to SmartBus', 'success');
    setTimeout(() => goToDashboard('passenger'), 700);
  } catch (error) {
    console.error(error);
    err.textContent = 'Could not create account. Please check that the backend is running.';
    err.classList.remove('hidden');
  }
};

window.openReg = function() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('regSection').classList.add('open');
};

window.closeReg = function() {
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('regSection').classList.remove('open');
};

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('regSection').classList.contains('open')) window.doRegister();
    else window.doLogin();
  }
});

function goToDashboard(role) {
  const map = { passenger: 'passenger.html', driver: 'driver.html', admin: 'admin.html' };
  window.location.href = './' + (map[role] || 'passenger.html');
}

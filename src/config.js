// SmartBus backend API URL.
//
// Default XAMPP URL:
//   http://localhost/smartbus-backend/public/api
//
// Hosted frontend + ngrok backend example:
//   https://abc123.ngrok-free.app/smartbus-backend/public/api
//
// You can also set the API URL without rebuilding by opening the frontend with:
//   https://your-frontend-site.com/?api=https://abc123.ngrok-free.app/smartbus-backend/public/api

const defaultApiBase = "http://localhost/smartbus-backend/public/api";
const params = new URLSearchParams(window.location.search);
const apiFromUrl = params.get("api");
const apiFromStorage = localStorage.getItem("SMARTBUS_API_BASE");

if (apiFromUrl) {
  localStorage.setItem("SMARTBUS_API_BASE", apiFromUrl);
}

window.SMARTBUS_API_BASE = apiFromUrl || apiFromStorage || defaultApiBase;

// SmartBus backend API URL.
//
// Default XAMPP URL:
//   http://localhost/smartbus-backend/public/api
//
// Frontend on another PC:
//   http://BACKEND-PC-IP/smartbus-backend/public/api
//
// You can also set the API URL without rebuilding by opening the frontend with:
//   http://localhost:5173/?api=http://BACKEND-PC-IP/smartbus-backend/public/api

const defaultApiBase = "http://localhost/smartbus-backend/public/api";
const params = new URLSearchParams(window.location.search);
const apiFromUrl = params.get("api");

if (apiFromUrl === "reset" || apiFromUrl === "clear") {
  localStorage.removeItem("SMARTBUS_API_BASE");
}

if (apiFromUrl && apiFromUrl !== "reset" && apiFromUrl !== "clear") {
  localStorage.setItem("SMARTBUS_API_BASE", apiFromUrl);
}

const apiFromStorage = localStorage.getItem("SMARTBUS_API_BASE");
window.SMARTBUS_API_BASE = apiFromUrl || apiFromStorage || defaultApiBase;

if (window.SMARTBUS_API_BASE === "reset" || window.SMARTBUS_API_BASE === "clear") {
  window.SMARTBUS_API_BASE = defaultApiBase;
}

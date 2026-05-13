# SmartBus Frontend

Plain HTML, CSS, and JavaScript frontend served with Vite.

## Requirements

- Node.js 20+
- npm

## Run Locally

1. Pull the frontend from GitHub:

```bash
git clone https://github.com/Gorillmac/smartbus-front-end.git
cd smartbus-front-end
```

2. Install packages:

```bash
npm install
```

3. Start the frontend:

```bash
npm run dev
```

4. Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Connect To A Backend On Another PC

The frontend does not connect to MySQL directly. It connects to the PHP backend API, and the backend connects to MySQL.

On the backend PC, first confirm this works:

```text
http://BACKEND-PC-IP/smartbus-backend/public/api/debug
```

If that PC uses XAMPP MySQL on port `3307`, the debug response must show `"port": "3307"` and counts for `routes`, `buses`, and `users`.

On the frontend PC, clear any old saved API URL:

```text
http://localhost:5173/?api=reset
```

Then open the frontend with the backend PC API URL:

```text
http://localhost:5173/?api=http://BACKEND-PC-IP/smartbus-backend/public/api
```

Replace `BACKEND-PC-IP` with the real IP address of the PC running XAMPP, for example `192.168.1.25`.

## Hosted Frontend With Ngrok Backend

If the backend is running on a PC through ngrok, open the hosted frontend like this:

```text
https://your-frontend-site.com/?api=https://abc123.ngrok-free.app/smartbus-backend/public/api
```

Replace `abc123.ngrok-free.app` with the real ngrok URL.

The app saves the API URL in the browser, so students do not need to rebuild the frontend every time the ngrok URL changes.

## Build For Hosting

```bash
npm install
npm run build
```

Upload the generated `dist` folder to your frontend hosting provider.

## Backend URL

```text
src/config.js
```

For XAMPP on the same PC:

```js
window.SMARTBUS_API_BASE = "http://localhost/smartbus-backend/public/api";
```

If Apache rewrite is disabled and the normal API URL does not work:

```js
window.SMARTBUS_API_BASE = "http://localhost/smartbus-backend/public/index.php/api";
```

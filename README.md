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

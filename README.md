# SmartBus Frontend

Plain HTML, CSS, and JavaScript frontend served with Vite.

## Requirements

- Node.js 20+
- npm

## Run Locally

1. Open a terminal in this folder:

```text
Student-UI-Build/artifacts/smartbus
```

2. Install packages:

```bash
npm install
```

3. Check the backend URL:

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

4. Start the frontend:

```bash
npm run dev
```

5. Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Build For Hosting

```bash
npm run build
```

Upload the generated `dist` folder to your frontend hosting provider.

Before building for hosting, update `src/config.js` to point to the real public backend URL.

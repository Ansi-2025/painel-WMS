# Dashboard WMS

Dashboard para TV com ordens agrupadas por família de fila, volumes por status e valores de frete por status via API E-SHIP.

Aplicação publicada em: https://painelwms.vercel.app

## Development

Requires Node.js and npm.

```sh
npm install --no-package-lock
npm run dev
```

Configure `API_KEY` as a server-side environment variable. For local development, add it to the ignored `.env` file. On Vercel, add it under **Project Settings → Environment Variables** for the required environments, then redeploy. The legacy `ESHIP_API_KEY` name is also accepted by the server. The key is never stored in browser storage or sent by the client.

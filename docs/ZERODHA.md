# Zerodha (Kite Connect) integration

Users can link their Zerodha account to pull equity holdings into the app. The portfolio value is shown on the dashboard and used by the AI Advisor for planning and advice.

## Setup (one-time)

1. **Kite Connect developer account**
   - Go to [developers.kite.trade](https://developers.kite.trade/) and sign up / log in.
   - Create an app and note the **API key** and **API secret**.

2. **Redirect URL**
   - In the Kite developer console, set the redirect URL to:
   - Production: `https://yourdomain.com/api/zerodha/callback`
   - Local: `http://localhost:3000/api/zerodha/callback`
   - Zerodha will send users back to this URL after they sign in.

3. **Environment variables**
   - In `.env`:
   ```env
   KITE_API_KEY=your_api_key
   KITE_API_SECRET=your_api_secret
   ```
   - Do not commit the secret. Use the same key/secret for all users (your app’s credentials).

## User flow

1. User opens **Dashboard → Integrations**.
2. Clicks **Connect Zerodha** and is redirected to Zerodha to sign in (and 2FA if enabled).
3. After login, Zerodha redirects to `/api/zerodha/callback` with a one-time token. The app exchanges it for an access token and stores it per user.
4. **Holdings** are fetched from Kite’s `GET /portfolio/holdings` (equity delivery holdings in DEMAT).
5. **Token expiry**: Kite access tokens expire around 6 AM next day. Users may need to reconnect from Integrations if the holdings stop updating.

## Where Zerodha data is used

- **Integrations page**: Connection status and portfolio value with list of holdings.
- **Dashboard overview**: “Zerodha portfolio” card when connected.
- **AI Advisor**: Zerodha portfolio value and holdings are included in the context so the AI can use them in chat and “Get AI advice”.

## API (internal)

- `GET /api/zerodha/connect` – Redirects to Kite login (requires auth).
- `GET /api/zerodha/callback` – Handles redirect from Kite, exchanges token, saves connection.
- `GET /api/zerodha/status` – Returns `{ connected, kiteUserId, userName }`.
- `GET /api/zerodha/holdings` – Returns portfolio value and list of holdings (401 if not connected or token invalid).
- `DELETE /api/zerodha/disconnect` – Removes the connection for the current user.

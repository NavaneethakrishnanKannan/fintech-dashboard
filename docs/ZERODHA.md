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

## Who can connect (“user is not enabled for the app”)

By default, a Kite Connect app can only be used by the **same Zerodha account (client ID)** that created the app at [developers.kite.trade](https://developers.kite.trade). There is **no way to “add” another user** for a single app:

- **No “add user” in the console** — The developer dashboard does not let you whitelist or add another Zerodha client ID to an existing app. One app = one client ID (the creator’s).
- **No personal token you can share** — Access tokens are tied to one Zerodha account. You cannot create a token for User A and have User B use it; tokens are not transferable across accounts.
- **No “request access” or “invite user”** — Standard Kite Connect has no built-in flow for inviting other users.

**Your options:**

| Goal | What to do |
|------|------------|
| Only you (or the account that created the app) uses it | Use that Zerodha account only; enable API in Kite **Profile → API**; ensure app is ACTIVE and client ID matches in [developer console](https://developers.kite.trade/apps). |
| Let a few or many other people use your app | Contact **kiteconnect@zerodha.com** (Zerodha compliance). Ask for **multi-user / production** access for your app. Get their go-ahead before building for many users; they will explain the process. You still need a Kite Connect subscription for your app (e.g. ₹500/month for the Connect plan if you use market data); any extra fee for multi-user is not published — confirm with Zerodha when you apply. |
| Each of several people has their own Zerodha + their own app | Each person creates their own Kite Connect app from their Zerodha account (and pays the subscription). Your app would need to support multiple API keys (one per user), which is uncommon and not how this app is designed. |

**If you are the app owner and still see “user is not enabled”:** Log out of any other Zerodha session; use only the account that created the app. In [Kite](https://kite.zerodha.com) go to **Profile → API** and ensure API access is enabled. In the developer console, confirm the app is ACTIVE and the client ID matches (no extra spaces).

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

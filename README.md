# TikBoost Real Starter

A real Node.js/Express starter for TikTok OAuth Login Kit and Display API.

## Run locally

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Create a TikTok Developer app and configure:
   - Login Kit
   - Display API
   - Redirect URI matching `TIKTOK_REDIRECT_URI`
   - Approved scopes: `user.info.basic` and `video.list`
4. Fill in the environment variables.
5. Run:

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Important

- Use HTTPS in production.
- Keep `TIKTOK_CLIENT_SECRET` server-side.
- Replace the default session store with a persistent secure store before production.
- Add CSRF protection, rate limiting, structured logging, token encryption, and a proper database before public launch.
- Content Posting API requires adding the product, enabling Direct Post, URL verification where required, and approval for `video.publish`. Add that flow only after TikTok approval.
- This project does not automate fake views, likes, or follows.

import "dotenv/config";
import express from "express";
import session from "express-session";
import crypto from "node:crypto";

const app = express();
const PORT = process.env.PORT || 3000;
const required = ["SESSION_SECRET", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"];
const missing = required.filter((k) => !process.env[k]);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static("public"));

const scopes = "user.info.basic,video.list";
const authBase = "https://www.tiktok.com/v2/auth/authorize/";
const tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";
const apiBase = "https://open.tiktokapis.com";

function requireConfig(req, res, next) {
  if (missing.length) return res.status(500).json({ error: "Server is not configured", missing });
  next();
}

async function tiktokFetch(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("TikTok API request failed");
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

app.get("/api/status", (req, res) => {
  res.json({
    configured: missing.length === 0,
    missing,
    loggedIn: Boolean(req.session.tiktok?.access_token)
  });
});

app.get("/auth/tiktok", requireConfig, (req, res) => {
  const state = crypto.randomBytes(24).toString("hex");
  req.session.oauthState = state;
  const url = new URL(authBase);
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", process.env.TIKTOK_REDIRECT_URI);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

app.get("/auth/tiktok/callback", requireConfig, async (req, res) => {
  try {
    if (!req.query.code || !req.query.state || req.query.state !== req.session.oauthState) {
      return res.status(400).send("Invalid OAuth state or missing code.");
    }
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code: req.query.code,
      grant_type: "authorization_code",
      redirect_uri: process.env.TIKTOK_REDIRECT_URI
    });
    const token = await tiktokFetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    req.session.tiktok = token.data || token;
    delete req.session.oauthState;
    res.redirect("/?connected=1");
  } catch (err) {
    console.error(err.body || err);
    res.status(502).send("TikTok connection failed. Check server logs.");
  }
});

function accessToken(req) {
  return req.session.tiktok?.access_token;
}

app.get("/api/profile", async (req, res) => {
  try {
    const token = accessToken(req);
    if (!token) return res.status(401).json({ error: "Not connected" });
    const fields = "open_id,union_id,avatar_url,display_name";
    const data = await tiktokFetch(`${apiBase}/v2/user/info/?fields=${fields}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: "Profile request failed", details: err.body || {} });
  }
});

app.post("/api/videos/list", async (req, res) => {
  try {
    const token = accessToken(req);
    if (!token) return res.status(401).json({ error: "Not connected" });
    const fields = "id,title,video_description,duration,cover_image_url,share_url,embed_link";
    const data = await tiktokFetch(`${apiBase}/v2/video/list/?fields=${fields}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ max_count: 20 })
    });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: "Video list request failed", details: err.body || {} });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("*", (req, res) => res.sendFile(process.cwd() + "/public/index.html"));

app.listen(PORT, () => {
  console.log(`TikBoost running at http://localhost:${PORT}`);
  if (missing.length) console.log("Missing environment variables:", missing.join(", "));
});
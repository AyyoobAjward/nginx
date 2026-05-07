# Nginx Proxy Caching with Express — Complete Guide

A step-by-step guide to setting up nginx as a caching reverse proxy in front of an Express.js application, based on a real working setup.

---

## Architecture

```
Client (curl / Postman / Browser)
        │
        ▼
  nginx :3002  ──── cache HIT ──→ return cached response
        │
      cache MISS
        │
        ▼
  Express :3080
        │
        ▼
  response stored in /home/nginx/cached
```

---

## Prerequisites

- Ubuntu server
- nginx installed (`sudo apt install nginx`)
- Node.js + Express installed (`npm install express`)

---

## Step 1 — Express App

The upstream app must use a **GET** route and return a `Cache-Control` header. nginx does not cache `POST` requests by default, and without `Cache-Control`, nginx needs explicit `proxy_cache_valid` to know what to cache.

```javascript
// server.js
const express = require('express');
const app = express();
const PORT = 3080;

app.use(express.json());

app.get('/data', (req, res) => {

    const receivedData = {
        params: req.params,
        headers: req.headers,
        query: req.query
    };

    // Tell nginx (and browsers/CDNs) to cache this response for 60 minutes
    res.set('Cache-Control', 'public, max-age=3600');

    res.status(200).json({
        status: 'success',
        message: 'Request received',
        timestamp: new Date().toISOString(),
        data: receivedData
    });
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
```

> **Why GET and not POST?**
> nginx only caches `GET` and `HEAD` requests by default. `POST` requests are considered non-idempotent (they may change server state), so they are never cached unless explicitly configured with `proxy_cache_methods POST`.

> **Why `Cache-Control: public`?**
> This signals that the response is safe to cache by any intermediary (nginx, CDN, browser). Without it, nginx relies entirely on `proxy_cache_valid` in its config.

---

## Step 2 — nginx Configuration

Create or edit `/etc/nginx/nginx.conf`:

```nginx
user www-data;
worker_processes auto;

events {
    worker_connections 768;
}

http {

    # --- Cache Storage ---
    # Defines where cached files live on disk and how the cache is managed
    proxy_cache_path /home/nginx/cached   # path on disk to store cached files
                     levels=1:2           # 2-level directory structure (e.g. /6/42/filename)
                     keys_zone=my_cache:10m  # shared memory zone name + size (holds keys/metadata)
                     max_size=10g         # max disk usage for cached files
                     inactive=60m         # remove files not accessed within 60 minutes
                     use_temp_path=off;   # write directly to cache dir (avoids extra copy)

    server {
        listen 3002;

        location / {

            # Enable cache using the zone defined above
            proxy_cache my_cache;

            # Cache key — what makes a request unique
            # Using method + host + URI ensures GET /data and POST /data are separate keys
            proxy_cache_key "$request_method$host$request_uri";

            # How long to cache responses by HTTP status code
            proxy_cache_valid 200 60m;
            proxy_cache_valid 404 1m;

            # Prevent cache stampede: only one request goes upstream when cache is cold
            proxy_cache_lock on;

            # Serve stale cache if upstream is unavailable
            proxy_cache_use_stale error timeout updating;

            # Forward original client info to upstream Express app
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;

            # Add a response header so you can inspect cache status
            # Values: HIT, MISS, BYPASS, EXPIRED, STALE, UPDATING, REVALIDATED
            add_header X-Cache-Status $upstream_cache_status;

            # Forward requests to Express
            proxy_pass http://localhost:3080;
        }
    }
}
```

Apply the config:

```bash
sudo nginx -t          # test for syntax errors
sudo nginx -s reload   # reload without downtime
```

---

## Step 3 — Verify It Works

Make two requests and inspect the `X-Cache-Status` header:

```bash
# First request — nginx fetches from Express and stores in cache
curl -I http://your-server-ip:3002/data
# X-Cache-Status: MISS

# Second request — nginx serves from cache, Express is never hit
curl -I http://your-server-ip:3002/data
# X-Cache-Status: HIT
```

The `timestamp` field in the JSON body will be **frozen** on cache hits — it reflects when the response was first cached, not when the request was made. This confirms the response is coming from cache.

---

## How the Cache Is Stored on Disk

nginx stores each cached response as a file using a 2-level directory structure derived from the MD5 hash of the cache key.

```
/home/nginx/cached/
├── 0/
│   └── e4/
│       └── 6220342ebda2c8e7d963b945572a8e40   ← cache key: GET167.172.87.210/data
└── 6/
    └── 42/
        └── 5b9c9b9db2518b84fe7179092495e426   ← cache key: http://localhost:3080/data
```

Each file contains:

```
KEY: GET167.172.87.210/data
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
...

{"status":"success","message":"Request received",...}
```

> **Note:** The two separate cache entries above were created by different `proxy_cache_key` configurations. Once you standardise the key to `"$request_method$host$request_uri"`, all requests for the same endpoint map to the same file.

---

## Cache-Control: Where to Set It

| Set in | Affects | nginx caches? | Browser/CDN caches? |
|---|---|---|---|
| Express only (`res.set`) | Downstream clients + nginx | ✅ (reads the header) | ✅ |
| nginx only (`proxy_cache_valid`) | nginx only | ✅ | ❌ |
| Both | Everything | ✅ | ✅ |

**Recommendation: set both.** `proxy_cache_valid` acts as a fallback in nginx even if the upstream doesn't send headers. `Cache-Control` from Express propagates to browsers and CDNs as well.

---

## `X-Cache-Status` Values Reference

| Value | Meaning |
|---|---|
| `MISS` | Not in cache — fetched from upstream |
| `HIT` | Served from cache |
| `BYPASS` | Cache was intentionally skipped |
| `EXPIRED` | Was in cache but TTL expired — re-fetched |
| `STALE` | Upstream unavailable — served old cached copy |
| `UPDATING` | Stale copy served while cache is being refreshed |
| `REVALIDATED` | Upstream confirmed cached copy is still valid |

---

## Troubleshooting

**Still seeing `MISS` on every request?**

```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Confirm cache directory is writable by www-data
ls -la /home/nginx/cached
```

**Upstream is sending headers that prevent caching?**

If your Express app returns `Cache-Control: no-store` or `Set-Cookie`, nginx will refuse to cache. Override with:

```nginx
proxy_ignore_headers Cache-Control Set-Cookie;
proxy_hide_header Set-Cookie;
```

**Want to clear the cache manually?**

```bash
sudo rm -rf /home/nginx/cached/*
sudo nginx -s reload
```

---

## References

- [NGINX Caching Guide](https://blog.nginx.org/blog/nginx-caching-guide)
- [nginx `proxy_cache_path` docs](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache_path)
- [nginx `proxy_cache_valid` docs](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache_valid)
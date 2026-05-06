# Nginx L4 vs L7 Proxy Experiment

A hands-on experiment on a DigitalOcean Ubuntu server demonstrating the difference between Nginx operating at **Layer 4 (Transport)** and **Layer 7 (Application)**. A Node.js/Express service runs on port `3080` and echoes back every header and body it receives.

## Architecture

```
Client
  │
  ├─► :3001          (L4 — stream proxy)   ──────────► :3080  Node.js app
  │
  └─► :3002/server/  (L7 — http proxy)    ────────────► :3080  Node.js app
```

---

## L4 vs L7 — Feature Comparison

| Feature | L4 — Transport Layer | L7 — Application Layer |
|---|---|---|
| nginx config block | `stream { }` | `http { }` |
| Extra module needed? | Yes — `libnginx-mod-stream` | No — built in |
| Modify HTTP headers | ✗ Not possible | ✓ `proxy_set_header` |
| Headers passed to upstream | All original headers unchanged | Original + any added/modified headers |
| `proxy_pass` format | `IP:PORT` only (no scheme) | `http://host:port` or upstream name |
| URL path routing | ✗ Not possible | ✓ `location /server/` |
| Connection header (upstream) | `keep-alive` (transparent) | `close` (nginx re-opens connection) |
| Host header upstream sees | Original `host:port` as-is | Can be rewritten with `proxy_set_header Host` |
| Typical use-case | TCP/UDP passthrough, raw proxying | HTTP reverse proxy, load balancing, API gateway |

---

## Layer 4 — Transport Layer

Nginx operates at the TCP level. It opens a connection from the client, opens a separate connection to the upstream, and blindly pipes bytes between the two. It has no concept of HTTP — it **cannot** inspect, add, or remove headers.

### nginx config — `stream` block

```nginx
# The stream module is NOT built in. Install it first:
# sudo apt install libnginx-mod-stream
include /etc/nginx/modules-enabled/*.conf;

stream {
    server {
        listen 3001;

        # Must be IP:PORT — http:// scheme is NOT valid here
        proxy_pass 127.0.0.1:3080;
    }
}
```

> **Note:** Once installed, `libnginx-mod-stream` drops a `.conf` file into `/etc/nginx/modules-enabled/` that loads the module. The `include` at the top of `nginx.conf` picks it up automatically.

### Test request

```bash
curl --location 'http://167.172.87.210:3001/data' \
--header 'test-header-1: test-header-1-value' \
--header 'Authorization: 1234' \
--header 'Content-Type: application/json' \
--data '{"hello": "world"}'
```

### Response

```json
{
    "status": "success",
    "message": "Request received",
    "timestamp": "2026-05-06T19:29:45.259Z",
    "data": {
        "body": { "hello": "world" },
        "headers": {
            "test-header-1": "test-header-1-value",
            "authorization": "1234",
            "content-type": "application/json",
            "host": "167.172.87.210:3001",
            "connection": "keep-alive",
            "content-length": "24"
        }
    }
}
```

### Key observations

- **No `x-real-ip` or `x-forwarded-for`** — nginx cannot inject these at L4.
- **`host` still shows port 3001** — the original value is untouched.
- **`connection: keep-alive`** — the client TCP connection is transparently bridged.
- **No URL routing** — `/data` is just bytes to nginx; all paths hit the same upstream.

---

## Layer 7 — Application Layer

Nginx fully parses the incoming HTTP request, applies header manipulation rules, then opens a **new** HTTP connection to the upstream. The client connection and the upstream connection are entirely separate — nginx is the middleman.

### nginx config — `http` block

```nginx
http {
    server {
        listen 3002;

        location /server/ {
            # Header manipulation — only possible at L7
            proxy_set_header Host            $host;
            proxy_set_header X-Real-IP       $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header test            test-value;

            # http:// scheme is valid here.
            # Trailing slash strips the /server/ prefix before forwarding.
            proxy_pass http://localhost:3080/;
        }
    }
}
```

### URL path routing & prefix stripping

The trailing slash on both `location` and `proxy_pass` causes nginx to rewrite the URI before forwarding:

```
Client sends:      POST /server/data
Upstream receives: POST /data        ← /server/ prefix stripped
```

> **Note:** This rewriting only works when both `location` and `proxy_pass` end with `/`. Removing the trailing slash from `proxy_pass` passes the full original path to the upstream.

### Test request

```bash
curl --location 'http://167.172.87.210:3002/server/data' \
--header 'test-header-1: test-header-1-value' \
--header 'Authorization: 1234' \
--header 'Content-Type: application/json' \
--data '{"hello": "world"}'
```

### Response

```json
{
    "status": "success",
    "message": "Request received",
    "timestamp": "2026-05-06T19:30:23.728Z",
    "data": {
        "body": { "hello": "world" },
        "headers": {
            "host": "167.172.87.210",
            "x-real-ip": "175.157.109.224",
            "x-forwarded-for": "175.157.109.224",
            "test": "test-value",
            "connection": "close",
            "test-header-1": "test-header-1-value",
            "authorization": "1234",
            "content-type": "application/json",
            "content-length": "24"
        }
    }
}
```

### Key observations

- **`x-real-ip` and `x-forwarded-for` are present** — nginx injected the real client IP.
- **Custom `test: test-value` header was added** — header manipulation works at L7.
- **`host` no longer includes the port** — nginx rewrote it to just the hostname.
- **`connection: close`** — nginx terminates the client connection and opens a fresh one upstream.
- **Path routing works** — `/server/data` was rewritten to `/data` before forwarding.

---

## Upstream Service

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm install

CMD ["node", "app.js"]
```

### app.js

```javascript
const express = require('express');

const app = express();
const PORT = 3080;

app.use(express.json());

app.post('/data', (req, res) => {
    const receivedData = {
        body: req.body,
        params: req.params,
        headers: req.headers,
        query: req.query
    };

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

---

## Quick Reference

```bash
# Install stream module (one-time, required for L4)
sudo apt install libnginx-mod-stream

# Validate nginx config
sudo nginx -t

# Reload without downtime
sudo systemctl reload nginx

# Watch live logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```
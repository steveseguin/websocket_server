# WebSocket servers for VDO.Ninja and related apps

These Node.js examples provide **signaling**: messages that help clients find each other and negotiate a connection. They do not host the VDO.Ninja website or provide a TURN media relay.

**For a complete local/offline installation, start with [offline_deployment](https://github.com/steveseguin/offline_deployment).** Its main guide uses a normal Linux installation, a local website and HTTPS/WSS on one port. Docker is optional. It covers [creating and installing certificates](https://github.com/steveseguin/offline_deployment/blob/main/docs/certificates.md), [troubleshooting](https://github.com/steveseguin/offline_deployment/blob/main/docs/troubleshooting.md), and [what has actually been tested](https://github.com/steveseguin/offline_deployment/blob/main/docs/validation.md).

## Choose the matching server and browser option

| Script | Behavior | VDO.Ninja URL option | Self-hosted page setting |
|---|---|---|---|
| `server.js` | Generic fanout: forwards each message to every other connected client. Also usable with compatible caption.ninja and overlay clients. | `wss=` | `session.customWSS = true` |
| `vdoninja.js` | VDO.Ninja-specific filtered fanout; clients supply `from`, with stream and room filtering. | `wss=` | `session.customWSS = true` |
| `vdoninja_advanced.js` | Stateful routing: server-assigned peer UUIDs, stream lookup, waiting viewers, room listings and director/migration messages. | **`wss2=`** | **`session.customWSS = false`** |

Use the advanced server for clients expecting the routed protocol, including the reviewed Flutter app. These are different wire protocols: changing the URL alone cannot make a fanout server speak the advanced protocol. `npm start` still runs **vdoninja.js** for compatibility; use **npm run start:advanced** for advanced routing.

The advanced server tracks streams and rooms and routes messages to specific peers. The generic server broadcasts application messages to every other connection; it does not provide private rooms.

## Install dependencies

Use Node.js 22 or newer, preferably a supported LTS release, and npm. Install them using the [Node.js installation guide](https://nodejs.org/en/download) if your distribution provides an older version.

```sh
git clone https://github.com/steveseguin/websocket_server.git
cd websocket_server
npm ci
```

Run npm as the account that owns this checkout, without `sudo`. The advanced server uses Node's built-in `crypto.randomUUID()`; no separate `uuid` installation is needed.

`install_vdoninja_wss.sh` is an older **Debian/Ubuntu system setup helper**, not an unattended deployment recipe. It upgrades OS packages, installs distribution Node/npm and Certbot, changes the invoking user's Vim settings and starts interactive certificate enrollment. It now stops on command errors and installs dependencies from its own directory. Read it before running it and check the installed Node version afterward. The manual steps here are the preferred path.

## Certificates: public host or private LAN

Every connecting device must trust the certificate used by the **WSS endpoint**, and that certificate must cover its exact hostname or IP address. A website certificate does not automatically cover a separate handshake host. Install the public root on clients when using a private CA; keep private keys on the server.

For private LAN/IP-only use, follow the [offline certificate guide](https://github.com/steveseguin/offline_deployment/blob/main/docs/certificates.md). You do not need Docker, a public domain or Caddy for that setup. Browser trust and native-app trust can differ; see the [Android candidate results and limitations](https://github.com/steveseguin/offline_deployment/blob/main/docs/flutter-handoff.md).

For an internet-accessible hostname, follow [Certbot's instructions for your system](https://certbot.eff.org/instructions). With Certbot installed, standalone HTTP validation typically starts with:

```sh
sudo certbot certonly --standalone -d wss.example.com
```

The hostname must resolve to your server and inbound TCP 80 must be reachable and available for this validation method. DNS validation is an alternative. Verify renewal with `sudo certbot renew --dry-run` and check your installation's timer or cron job. The Node scripts read certificates only at startup, so arrange a service restart after successful renewal. See [Certbot's renewal documentation](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates).

Certificate files often live under `/etc/letsencrypt/live/DOMAIN/`, but a regular service account may not be able to read them. Arrange restricted access or a securely maintained copy for that account; do not make the private key world-readable.

## Start the advanced server with TLS

From this repository, set paths to your existing certificate and key:

```sh
export CERT_PATH=/absolute/path/to/fullchain.pem
export KEY_PATH=/absolute/path/to/privkey.pem
export PORT=8443
npm run start:advanced
```

Use `wss://wss.example.com:8443` from clients. Port 8443 avoids requiring root just to bind a low port. Allow its TCP port through the relevant firewall. The advanced server returns a short text response to HTTPS requests; it does not serve the VDO.Ninja UI.

| Configuration | Advanced server | Basic / filtered fanout servers |
|---|---|---|
| Certificate | `SERVER_CERT`, otherwise `CERT_PATH` | `CERT_PATH` |
| Private key | `SERVER_KEY`, otherwise `KEY_PATH` | `KEY_PATH` |
| Port | `PORT`; default 443 with TLS, 80 with HTTP fallback | `PORT`; default 443 |
| No explicit certificate paths | HTTP fallback | Legacy hard-coded certificate paths; edit them or set the environment variables |
| Invalid TLS files | Logs the error and falls back to HTTP | Startup fails |

**Existing fallback behavior:** the advanced server uses HTTP if either certificate path is missing or reading/using the pair fails. If `PORT` is set, the fallback uses that same port. A listening message alone does not prove TLS is working: check the startup error output and verify the HTTPS endpoint without bypassing certificate validation before connecting clients. The [offline_deployment server](https://github.com/steveseguin/offline_deployment/blob/main/server.js) instead stops when TLS setup fails.

Client-facing connections should use WSS. An HTTPS VDO.Ninja page cannot generally connect to insecure `ws://` signaling. If using a reverse proxy for TLS, configure its WebSocket upgrade support and protect any unencrypted backend from direct client access. This guide does not require a proxy.

To run a legacy variant with the same `CERT_PATH`, `KEY_PATH` and `PORT` exports:

```sh
npm start
# Or, for generic fanout:
npm run start:basic
```

Run one script per port. The historical default certificate locations remain in the two legacy scripts for existing installations.

## Connect VDO.Ninja

For the **advanced routing** server, use matching publisher/viewer links:

```text
https://vdo.ninja/?push=example&wss2=wss.example.com:8443
https://vdo.ninja/?view=example&wss2=wss.example.com:8443
```

For `vdoninja.js` or `server.js`, use **`wss=` instead of `wss2=`**. Keep the same server, stream ID, password and salt at both ends. If the clients use a room, use the matching room settings as well.

For a self-hosted website, configure its existing settings directly:

```js
session.wss = "wss://wss.example.com:8443";
session.customWSS = false; // advanced routing; true for the fanout variants
session.salt = "vdo.ninja"; // use the same salt on all clients
```

You do not need `customWSS = true` when selecting the advanced server with `wss2=`. The native Flutter app's handshake field takes **`wss://HOST:PORT`**, without a `wss2` query parameter; `wss2` belongs in browser links. Native app builds differ in certificate handling and link generation; use the [recorded app guidance](https://github.com/steveseguin/offline_deployment#7-connect-the-native-app).

The public `vdo.ninja` links above require internet access to load the website. For offline operation use the local website address from [offline_deployment](https://github.com/steveseguin/offline_deployment), including in shared viewer links.

## Signaling, media and offline operation

A successful WSS connection proves only the signaling path. Audio/video still needs a working direct connection or TURN relay. This repository does not install STUN/TURN, modify the website's ICE configuration, or guarantee media traversal through a VPN/firewall.

The prepared offline website deliberately keeps `session.configuration = {};`, disabling automatic public STUN/TURN configuration. Leave that offline default intact. For optional internet assistance, use the documented [hybrid browser URL options](https://github.com/steveseguin/offline_deployment#optional-hybrid-use-with-internet-access). The native app has separate TURN behavior: an empty field can still fetch public TURN servers.

A private CA accepted by a browser may still be rejected by a native app. Likewise, media that works with public STUN/TURN is not proof that it will work when the internet is disconnected. The offline guide records those distinctions and the remaining USB/iOS/disconnected-LAN checks. Its [Docker path](https://github.com/steveseguin/offline_deployment/blob/main/docs/docker.md) is optional.

## Optional systemd service

First prove the manual WSS connection. Create or select a regular service account that can read the checkout and certificate/key files. Substitute the account, paths and absolute Node executable in this example; it uses port 8443 and does not require a privileged-port capability.

```ini
[Unit]
Description=VDO.Ninja advanced WebSocket signaling
Wants=network-online.target
After=network-online.target

[Service]
User=YOUR_USER
WorkingDirectory=/absolute/path/to/websocket_server
Environment=CERT_PATH=/absolute/path/to/fullchain.pem
Environment=KEY_PATH=/absolute/path/to/privkey.pem
Environment=PORT=8443
ExecStart=/absolute/path/to/node /absolute/path/to/websocket_server/vdoninja_advanced.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Save the edited unit as `/etc/systemd/system/vdoninja-advanced.service`, stop the manual server, then run:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now vdoninja-advanced.service
sudo systemctl status vdoninja-advanced.service --no-pager
journalctl -u vdoninja-advanced.service -n 50 --no-pager
```

Verify TLS again after startup and renewal. If using the advanced script, HTTP fallback can leave the service marked active even though WSS is unavailable. The [offline maintenance guide](https://github.com/steveseguin/offline_deployment/blob/main/docs/maintenance.md) covers its separate, HTTPS-only deployment template.

## Checks and limits

```sh
npm test
```

The automated checks require OpenSSL on PATH and use temporary local certificates and loopback ports. They cover TLS startup, basic fanout, legacy filtering, malformed JSON, advanced identity routing, stream ownership and room listing. Physical media and systemd setup are separate checks; the automated tests do not perform them or install certificates into your OS.

The advanced server allows one stream ID per WebSocket connection. Repeating that ID is allowed; changing it requires a new connection. Its UUID is server-assigned; forwarded advanced messages discard a client-supplied `from` field.

License: [AGPLv3](LICENSE).

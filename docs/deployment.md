# Déploiement en production

The quarry (`server.ts`) serves both the API and the built atelier. By
default it listens on `127.0.0.1:8791` (loopback only) — put it behind an
authenticated reverse proxy to expose it.

## Prérequis

- Node 22+, npm.
- A `.env` with a **changed** `API_TOKEN` (never `changez-moi`), and
  `MISTRAL_API_KEY` if the pen (`POST /api/generate`) must work.
- `HOST=0.0.0.0` in `.env` **only** behind an authenticated reverse proxy.

## Build et lancement

```bash
npm ci
npm run build
npm run serve:prod    # sert dist/ + l'API sur $HOST:$PORT (127.0.0.1:8791 par défaut)
```

## Déploiement conteneurisé (docker compose)

Un seul `docker compose up --build` déploie **l'atelier + PostgreSQL** :

```bash
cp .env.example .env    # puis éditez API_TOKEN, POSTGRES_USER, POSTGRES_PASSWORD
docker compose up --build
```

- Le service `postgres` (`postgres:17-alpine`) garde ses données dans le
  volume nommé `postgres-data` et initialise le schéma au premier
  démarrage via `docker-entrypoint-initdb.d/` (table `rate_limit`,
  issue #85).
- Le service `atelier` attend que la base soit saine
  (`depends_on: condition: service_healthy`) et reçoit
  `DATABASE_URL=postgres://…@postgres:5432/…` : **le rate limiting est
  actif**, partagé entre instances (compteurs en base).
- Vérification : `curl -H "Authorization: Bearer $API_TOKEN" http://127.0.0.1:8791/api/whoami`
  répond 200, et `POST /api/generate` répond **429** après la limite
  (`GENERATE_MAX_REQUESTS` par fenêtre, 10/min par défaut).

Déploiement **sans base** (dev local) : le rate limiting est alors
désactivé, comme sans `DATABASE_URL` :

```bash
DATABASE_URL= docker compose up --no-deps --build atelier
```

## Exemple nginx (reverse proxy + HTTPS)

```nginx
server {
    listen 443 ssl;
    server_name atelier.example.com;

    ssl_certificate     /etc/letsencrypt/live/atelier.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/atelier.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8791;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # SSE (session éditeur partagée) : ne pas bufferiser
        proxy_buffering off;
        proxy_cache off;

        # En-têtes de sécurité
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options DENY always;
        add_header Referrer-Policy no-referrer always;
    }
}
```

With Caddy, the equivalent is simply `reverse_proxy 127.0.0.1:8791` —
HTTPS is automatic.

## Checklist de production

- [ ] `API_TOKEN` changé dans `.env` (jamais la valeur par défaut).
- [ ] `HOST=0.0.0.0` **uniquement** derrière un reverse proxy authentifié.
- [ ] HTTPS actif (Let's Encrypt / Caddy automatique).
- [ ] Rate limiting activé sur `/api/generate` (voir issue #85).
- [ ] En-têtes de sécurité servis (voir bloc nginx ci-dessus, issue #84).
- [ ] Logs redirigés vers un fichier ou un collecteur (`npm run serve:prod > quarry.log 2>&1` sous systemd).
- [ ] Health check : `curl -H "Authorization: Bearer $API_TOKEN" https://atelier.example.com/api/whoami` répond 200.

## Health check

`GET /api/whoami` (avec l'en-tête `Authorization: Bearer <API_TOKEN>`)
renvoie l'identité du serveur — utilisable comme sonde de vie.

## Procédure de mise à jour

```bash
git pull
npm ci
npm run build
# redémarrer le service (systemd : systemctl restart quarry)
```

Vérifier ensuite le health check ci-dessus.

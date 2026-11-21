# Déploiement en production

The quarry (`server.ts`) serves both the API and the built atelier. By
default it listens on `127.0.0.1:8791` (loopback only) — put it behind an
authenticated reverse proxy to expose it.

## Prérequis

- Node 22+, npm.
- A `.env` with the Zitadel auth variables (`AUTH_ISSUER`,
  `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_API_CLIENT_ID`,
  `AUTH_API_CLIENT_SECRET` — secrets through a secure channel, never
  committed), and `MISTRAL_API_KEY` if the pen (`POST /api/generate`)
  must work.
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
cp .env.example .env    # puis éditez AUTH_*, POSTGRES_USERNAME, POSTGRES_PASSWORD
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
- Vérification : `curl -H "Authorization: Bearer $PAT" http://127.0.0.1:8791/api/whoami`
  répond 200 (PAT d'un service user, validé par introspection), et
  `POST /api/generate` répond **429** après la limite
  (`GENERATE_MAX_REQUESTS` par fenêtre, 10/min par défaut).

Déploiement **sans base** (dev local) : le rate limiting est alors
désactivé, comme sans `DATABASE_URL` :

```bash
DATABASE_URL= docker compose up --no-deps --build atelier
```

## Développement conteneurisé avec hot reload (issue #204)

Le déploiement par défaut sert le build de production (`dist/`) : pas de
hot reload. Pour développer **dans** docker compose avec HMR :

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

L'override `docker-compose.dev.yml` :

- construit la cible `dev` du Dockerfile (dépendances complètes, dont
  vite, sans build) ;
- monte le dépôt dans le conteneur (`.:/app`, `node_modules` exclu via un
  volume anonyme) : **toute édition de `src/` sur l'hôte recharge la page** ;
- lance côte à côte `node server.ts` (API sur 8791) et le serveur dev vite
  (port 5173, `0.0.0.0`) — le proxy vite forward `/api` vers `127.0.0.1:8791`.

L'atelier avec hot reload est sur **http://127.0.0.1:5173** ; l'API reste
sur http://127.0.0.1:8791. `docker compose up` (sans l'override) et l'image
de production sont inchangés.

## Déploiement automatique (VPS, issue #242)

La production tourne sur un VPS OVH derrière **nginx + Let's Encrypt**
(`layered-data.linard.fr`). Le workflow `.github/workflows/deploy.yml`
se déclenche à chaque push sur `main` (et manuellement via
`workflow_dispatch`) :

1. connexion SSH en tant que `deploy@$VPS_HOST` avec la clé dédiée
   (secret `SSH_PRIVATE_KEY`, clé publique dans
   `/home/deploy/.ssh/authorized_keys` du VPS) ;
2. `git fetch` + checkout de la branche déployée dans
   `/srv/layered-data/repo` (les secrets de production vivent dans le
   `.env` de ce dossier, jamais commité) ;
3. `docker compose up --build -d` — compose de production uniquement
   (pas d'override dev : pas de hot reload en production) ;
4. health check : `https://layered-data.linard.fr/` doit répondre 200.

Le port 8791 n'est publié que sur `127.0.0.1` ; nginx écoute 80/443 et
proxy vers `127.0.0.1:8791` (SSE non bufferisé). Procédure manuelle :

```bash
ssh deploy@$VPS_HOST
cd /srv/layered-data/repo && git pull && docker compose up --build -d
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

        # En-têtes de sécurité : posés par l'application elle-même
        # (server/httpUtils.ts, sur chaque réponse) — pas ici, sinon
        # ils apparaissent en double (issue #296).
    }
}
```

With Caddy, the equivalent is simply `reverse_proxy 127.0.0.1:8791` —
HTTPS is automatic.

## Checklist de production

- [ ] Variables `AUTH_*` renseignées dans `.env` (émetteur Zitadel `https://auth.linard.fr`, client OIDC, redirect URI `https://<app>.linard.fr/auth/callback` enregistrée côté IdP).
- [ ] `NODE_ENV=production` (posé par défaut dans `docker-compose.yml`) : `AUTH_DISABLED=1` y est alors fatal et le cookie `sid` porte `Secure`.
- [ ] `HOST=0.0.0.0` **uniquement** derrière un reverse proxy authentifié.
- [ ] HTTPS actif (Let's Encrypt / Caddy automatique).
- [ ] Rate limiting activé sur `/api/generate` (voir issue #85).
- [ ] En-têtes de sécurité servis (voir bloc nginx ci-dessus, issue #84).
- [ ] Logs redirigés vers un fichier ou un collecteur (`npm run serve:prod > quarry.log 2>&1` sous systemd).
- [ ] Health check : `curl -H "Authorization: Bearer $PAT" https://atelier.example.com/api/whoami` répond 200.

## Health check

`GET /api/whoami` (avec `Authorization: Bearer <PAT>` ou le cookie de
session `sid`) renvoie l'identité appelante — utilisable comme sonde de
vie. `GET /auth/login` lance le flux OIDC (PKCE), `GET /auth/me` lit la
session, `GET /auth/logout` la détruit (logout RP-initiated côté IdP).

## Procédure de mise à jour

```bash
git pull
npm ci
npm run build
# redémarrer le service (systemd : systemctl restart quarry)
```

Vérifier ensuite le health check ci-dessus.

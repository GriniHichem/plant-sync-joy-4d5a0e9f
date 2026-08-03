# API REST de synchronisation ERP

Module **indépendant** : aucun workflow métier ni écran existant n'est modifié.
Tout passe par une seule Edge Function (`erp-sync`) qui route les endpoints.

## Base URL

```
https://<votre-backend>/functions/v1/erp-sync/api
```

Les préfixes `/api` et `/api/sync` sont acceptés tels quels (ex :
`/functions/v1/erp-sync/api/sync/articles`).

## Authentification

Deux modes, au choix.

### 1. Clé de service — recommandé pour un serveur auto-hébergé (hors Lovable)

Aucune session utilisateur, aucun rafraîchissement de jeton : deux en-têtes suffisent.

```
apikey: <clé publiable du backend>
X-API-Key: <clé de service>
```

La clé se génère et se copie dans **Paramètres > Configuration générale > API ERP**
(onglet *Configuration*). Elle peut aussi être fournie par la variable
d'environnement `ERP_SYNC_API_KEY`. Plusieurs clés séparées par des virgules sont
acceptées, ce qui permet une **rotation sans coupure** (on ajoute la nouvelle, on
migre le serveur, on retire l'ancienne).

Les écritures faites avec la clé sont imputées à l'**utilisateur technique**
choisi dans le même écran (traçabilité complète dans les journaux).
`Authorization: ApiKey <clé>` est également accepté si votre ERP ne permet pas
d'en-tête personnalisé.

Contrôle rapide côté serveur :

```bash
curl -s "$ERP_API_BASE/sync/whoami" \
  -H "apikey: $LOVABLE_ANON_KEY" \
  -H "X-API-Key: $ERP_API_KEY"
# {"authentifie":true,"mode":"api_key","acteur":"...","roles":["service"],"api_activee":true}
```

Variables d'environnement conseillées côté serveur :

```
ERP_API_BASE=https://<votre-backend>/functions/v1/erp-sync/api
LOVABLE_ANON_KEY=<clé publiable>
ERP_API_KEY=<clé de service>
```

En auto-hébergé, `ERP_API_BASE` peut pointer sur le routage interne
(ex : `http://kong:8000/functions/v1/erp-sync/api`) — aucun accès Internet requis.

### 2. JWT applicatif (appels depuis l'application ou un utilisateur réel)

```
Authorization: Bearer <access_token>
apikey: <clé publiable>
```

Rôles autorisés : `admin`, `responsable_si`, `bureau_methode`,
`gestionnaire_magasin`, `responsable_magasin` (liste modifiable dans l'écran
d'administration). Sinon `403`.

Codes : `200` OK, `207` import partiel, `400` validation, `401` clé/jeton,
`403` rôle, `404` endpoint inconnu, `503` API désactivée par l'administrateur,
`500` erreur interne.

## Endpoints publics

| Endpoint | Description |
|---|---|
| `GET /api/ping` | Sonde de disponibilité (indique les modes d'auth disponibles) |
| `GET /api/docs` | Spécification OpenAPI 3.0 (JSON) |
| `GET /api/sync/whoami` | Vérifie la clé/jeton présentés (authentifié requis) |


## Export (Lovable → ERP)

Tous les `GET` acceptent `page` (1), `limit` (100, max 1000) et
`updated_since` (ISO 8601). Réponse : `{ data: [...], pagination: {...} }`.

| Endpoint | Contenu |
|---|---|
| `GET /api/sync/articles` | Articles PDR (code, désignation, unité, statut, stock, emplacement) |
| `GET /api/sync/articles/production` | Produits finis (code, désignation, unité, gamme active) |
| `GET /api/sync/nomenclatures` | BOM : article parent → composants + quantités (`product_code`) |
| `GET /api/sync/stock` | Stocks PDR et articles (`type=pdr\|article\|all`) |
| `GET /api/sync/orders` | Ordres de fabrication (`statut`, `date_from`, `date_to`) |
| `GET /api/sync/campagnes` | Campagnes de réception |

Le champ `code_article` renvoie le `code_erp` s'il est renseigné, sinon le code interne.

## Import des consommations (ERP → Lovable)

| Endpoint | Corps |
|---|---|
| `POST /api/sync/consumption/pdr` | objet ou `{ items: [...] }` |
| `POST /api/sync/consumption/articles` | objet ou `{ items: [...] }` |
| `POST /api/sync/consumption/batch` | `{ pdr: [...], articles: [...] }` |

Exemple :

```json
{ "items": [
  { "article_code": "CHN-08B", "quantite": 1, "of_numero": "OF-2026-0005",
    "lot": "L214", "date": "2026-08-02T10:00:00Z", "erp_ref": "ERP-000123" }
] }
```

Validation par ligne : article existant (et non ambigu), OF existant,
quantité numérique ≥ 0, maximum 1000 lignes par requête.

**Idempotence / conflits** — `erp_ref` est la clé d'unicité côté ERP :
même `erp_ref` et même quantité → `skipped` ; quantité différente → `updated`
(le stock PDR est ajusté du delta). Sans `erp_ref`, un doublon
« même OF + même article + même jour » est mis à jour au lieu d'être dupliqué.

Réponse : `{ success, resume: { total, created, updated, skipped, errors }, resultats: [...] }`
avec le statut et le message de chaque ligne. HTTP `207` si succès partiel.

Les sorties PDR sont écrites en `source_type = 'erp'` (elles ne passent donc pas
par le circuit de demande de pièces) et le stock est mis à jour.

## Supervision

| Endpoint | Description |
|---|---|
| `GET /api/sync/status` | `healthy`/`degraded`, appels et erreurs sur 24 h, état par ressource |
| `GET /api/sync/last` | Date de dernière synchronisation, globale et par ressource |
| `GET /api/sync/history` | Journaux paginés (`resource`, `ok=true\|false`) |

Chaque appel est journalisé (acteur, ressource, méthode, code HTTP, volume,
durée, erreur) avec une **rétention de 30 jours** ; l'état par ressource est
tenu à jour dans une table dédiée. Ces tables sont consultables uniquement par
`admin` et `responsable_si`.

## Non implémenté

Le **rate limiting** (100 req/min, HTTP 429) n'est pas en place : le backend ne
fournit pas encore de primitive de limitation de débit. À ajouter côté
passerelle/reverse-proxy, ou en version ad hoc sur demande explicite.

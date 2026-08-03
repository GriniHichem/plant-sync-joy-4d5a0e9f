// Spécification OpenAPI 3.0 servie par GET /erp-sync/api/docs
export function openApiSpec(baseUrl: string) {
  const bearer = [{ bearerAuth: [] }, { apiKeyAuth: [] }];

  const errorResponses = {
    "400": { description: "Requête invalide (validation)" },
    "401": { description: "JWT absent ou invalide" },
    "403": { description: "Rôle insuffisant" },
    "404": { description: "Endpoint ou ressource inconnue" },
    "500": { description: "Erreur interne" },
  };
  const pageParams = [
    { name: "page", in: "query", schema: { type: "integer", default: 1 } },
    { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 1000 } },
    { name: "updated_since", in: "query", schema: { type: "string", format: "date-time" } },
  ];
  const listGet = (summary: string, extra: unknown[] = []) => ({
    get: {
      summary,
      tags: ["Export (Lovable → ERP)"],
      security: bearer,
      parameters: [...pageParams, ...extra],
      responses: { "200": { description: "Liste paginée" }, ...errorResponses },
    },
  });

  return {
    openapi: "3.0.3",
    info: {
      title: "API de synchronisation ERP",
      version: "1.1.0",
      description:
        "Module indépendant de synchronisation bidirectionnelle entre l'application et l'ERP. " +
        "Deux modes d'authentification : clé de service machine-to-machine (header X-API-Key, recommandé " +
        "pour un serveur auto-hébergé) ou JWT applicatif (Authorization: Bearer <token>). " +
        "Rôles autorisés en mode JWT : admin, responsable_si, bureau_methode, gestionnaire_magasin, responsable_magasin.",
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
      },

      schemas: {
        Paginated: {
          type: "object",
          properties: {
            data: { type: "array", items: { type: "object" } },
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer" },
                limit: { type: "integer" },
                total: { type: "integer" },
                total_pages: { type: "integer" },
              },
            },
          },
        },
        PdrConsumption: {
          type: "object",
          required: ["article_code", "quantite"],
          properties: {
            article_code: { type: "string", description: "reference ou code_erp du PDR" },
            quantite: { type: "number", minimum: 0 },
            of_numero: { type: "string", nullable: true },
            date: { type: "string", format: "date-time", nullable: true },
            lot: { type: "string", nullable: true },
            erp_ref: { type: "string", description: "Clé d'idempotence côté ERP" },
            motif: { type: "string", nullable: true },
          },
        },
        ArticleConsumption: {
          type: "object",
          required: ["article_code", "quantite", "of_numero"],
          properties: {
            article_code: { type: "string", description: "code ou code_erp de l'article" },
            quantite: { type: "number", minimum: 0 },
            of_numero: { type: "string" },
            date: { type: "string", format: "date-time", nullable: true },
            lot: { type: "string", nullable: true },
            unite: { type: "string", nullable: true },
            erp_ref: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/api/ping": {
        get: {
          summary: "Vérifier que l'API est opérationnelle",
          tags: ["Système"],
          responses: { "200": { description: "pong" } },
        },
      },
      "/api/docs": {
        get: { summary: "Spécification OpenAPI", tags: ["Système"], responses: { "200": { description: "OpenAPI JSON" } } },
      },
      "/api/sync/whoami": {
        get: {
          summary: "Vérifier l'authentification (mode, acteur, rôles)",
          tags: ["Système"],
          security: bearer,
          responses: { "200": { description: "Authentifié" }, "401": { description: "Clé ou jeton invalide" } },
        },
      },
      "/api/sync/articles": listGet("Articles PDR (pièces de rechange)"),
      "/api/sync/articles/production": listGet("Articles de production (produits finis)"),

      "/api/sync/nomenclatures": listGet("Nomenclatures (BOM) : parent → composants", [
        { name: "product_code", in: "query", schema: { type: "string" } },
      ]),
      "/api/sync/stock": listGet("Stocks actuels (PDR + articles de production)", [
        { name: "type", in: "query", schema: { type: "string", enum: ["pdr", "article", "all"] } },
      ]),
      "/api/sync/orders": listGet("Ordres de fabrication", [
        { name: "statut", in: "query", schema: { type: "string" } },
        { name: "date_from", in: "query", schema: { type: "string", format: "date" } },
        { name: "date_to", in: "query", schema: { type: "string", format: "date" } },
      ]),
      "/api/sync/campagnes": listGet("Campagnes de réception"),
      "/api/sync/consumption/pdr": {
        post: {
          summary: "Consommation de pièces de rechange (ERP → Lovable)",
          tags: ["Import (ERP → Lovable)"],
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/PdrConsumption" },
                    { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/PdrConsumption" } } } },
                  ],
                },
              },
            },
          },
          responses: { "200": { description: "Résultat d'import détaillé par ligne" }, ...errorResponses },
        },
      },
      "/api/sync/consumption/articles": {
        post: {
          summary: "Consommation / production d'articles (ERP → Lovable)",
          tags: ["Import (ERP → Lovable)"],
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/ArticleConsumption" },
                    { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/ArticleConsumption" } } } },
                  ],
                },
              },
            },
          },
          responses: { "200": { description: "Résultat d'import détaillé par ligne" }, ...errorResponses },
        },
      },
      "/api/sync/consumption/batch": {
        post: {
          summary: "Lot mixte de consommations (PDR + articles)",
          tags: ["Import (ERP → Lovable)"],
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    pdr: { type: "array", items: { $ref: "#/components/schemas/PdrConsumption" } },
                    articles: { type: "array", items: { $ref: "#/components/schemas/ArticleConsumption" } },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Résultat consolidé" }, ...errorResponses },
        },
      },
      "/api/sync/status": {
        get: { summary: "État global de la synchronisation", tags: ["Supervision"], security: bearer, responses: { "200": { description: "OK" }, ...errorResponses } },
      },
      "/api/sync/last": {
        get: { summary: "Date de dernière synchronisation par ressource", tags: ["Supervision"], security: bearer, responses: { "200": { description: "OK" }, ...errorResponses } },
      },
      "/api/sync/history": {
        get: {
          summary: "Historique des appels (30 jours)",
          tags: ["Supervision"],
          security: bearer,
          parameters: [...pageParams, { name: "resource", in: "query", schema: { type: "string" } }, { name: "ok", in: "query", schema: { type: "boolean" } }],
          responses: { "200": { description: "OK" }, ...errorResponses },
        },
      },
    },
  };
}

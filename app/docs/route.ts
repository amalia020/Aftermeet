/**
 * Swagger UI for the AfterMeet API, served as a standalone HTML page from a
 * route handler. Loads Swagger UI from a CDN (no npm dependency, no React
 * version conflicts) and points it at /api/openapi.
 *
 * Open http://localhost:3000/docs and use "Try it out" on any endpoint.
 */

export const runtime = "nodejs";

const HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AfterMeet API — Swagger</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
    <style>
      body { margin: 0; background: #0b0f17; }
      .topbar { display: none; }
      .swagger-ui .info .title { color: #0b0f17; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: "/api/openapi",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: "StandaloneLayout",
          tryItOutEnabled: true,
          persistAuthorization: true,
        });
      };
    </script>
  </body>
</html>`;

export async function GET() {
  return new Response(HTML, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

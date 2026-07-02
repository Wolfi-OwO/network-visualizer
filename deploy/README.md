# Deployment

NetViz is a single self-contained container (Express API that also serves the
built SPA). It deploys to **Azure Container Apps** — managed HTTPS ingress, a
free `*.azurecontainerapps.io` URL, and no server to patch. The database is a
managed MongoDB (Cosmos DB for MongoDB vCore, or MongoDB Atlas).

```mermaid
flowchart LR
    subgraph delivery["Continuous delivery"]
        release["GitHub Release"] --> build["build client"] --> push["docker build & push to ACR"] --> update["az containerapp update"]
    end
    subgraph runtime["Runtime"]
        internet["Internet"] -- HTTPS --> ingress["ACA ingress"] --> container["container :8080"] --> mongo[("managed MongoDB")]
    end
```

## Guides

- **[azure-container-apps.md](./azure-container-apps.md)** — the full runbook:
  provision (ACR, database, Container App), no-domain setup (free ACA URL),
  custom domains, and continuous delivery.

## Continuous delivery

Publishing a GitHub Release (`v1.2.3`) triggers
[`.github/workflows/release-aca.yml`](../.github/workflows/release-aca.yml),
which builds the image in ACR and rolls it out with `az containerapp update`.
Requires the repo secret `AZURE_CREDENTIALS` and variables `AZURE_RG`,
`ACR_NAME`, `ACA_APP`. See the runbook for the one-time provisioning.

## Related

- Image / app metadata (OCI labels, footer version) — see
  [`application/Dockerfile`](../application/Dockerfile) and
  [`application/client/.env.example`](../application/client/.env.example).
- Roles & administration — see [`organizational/`](../organizational/README.md).

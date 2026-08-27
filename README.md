# SupplyMesh

SupplyMesh is a provisional name for a deterministic, map-first fleet operations console for the OpenAI WebMCP Challenge. This repository currently contains the application foundation only.

## Run locally

```sh
bun install
bun run dev
```

## Quality commands

```sh
bun run lint
bun run typecheck
bun run test
bun run build
bun run check
```

## Development environment

Copy `.env.example` to `.env.local` only for local development. `VITE_WEBMCP_DEVELOPMENT_BYPASS` is reserved for the future WebMCP gate and will be honored only by a development build; no secrets belong in this repository.

## Product boundary

The planned console uses deterministic offline fixtures, React, and a minimal WebMCP bridge that share the same application operations. Fleet Edit Mode, `create_vehicle`, and `assign_route` are documented future work and are not implemented in Phase 1.

See [the product contract](docs/product-spec.md), [UI contract](docs/ui-spec.md), and [architecture](docs/architecture.md). Licensed under [MIT](LICENSE).

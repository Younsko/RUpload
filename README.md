# RUpload — Roblox bulk publishing tool

RUpload is a browser-based tool for Roblox creators who need to repeat the same publishing work across experiences. It grew out of a workflow I used in a previous remote Roblox studio role: preparing and uploading thumbnails and other experience assets, and managing batches of developer products and game passes through Roblox Open Cloud.

This repository is a cleaned, standalone portfolio release of that idea. Studio names, client information, credentials, and internal operating details are intentionally omitted. It is an independent community tool, not an official Roblox product.

## What it can do

- Keep a local list of experiences and switch between them.
- Import product and pass rows from tab-, pipe-, or comma-separated text.
- Create or update developer products and game passes in batches.
- Upload group decals and update decal metadata.
- Fetch public game and asset thumbnails for context.
- Export product/pass configuration and image backups.
- Preserve unfinished drafts locally between visits.

The app sends requests through Netlify functions to Roblox Open Cloud. Routes are restricted to the Roblox API paths used by this app; the functions do not hold a Roblox secret on the server.

## Security and credentials

- Enter your own Roblox Open Cloud API key when using the tool. It is held in browser memory for the current page session and sent to the Netlify proxy in the `x-api-key` header. The app does not intentionally persist the key; older saved copies under `rupload_api_key` are removed on launch.
- Experience IDs, drafts, group ID, and preferences are stored in this browser’s local storage. They are not encrypted or synced. Use a dedicated, least-privilege key and remove it from Roblox when finished.
- The proxy uses a fixed Roblox host, an allowlist of supported routes and methods, and a request body limit. CORS is not authentication; do not treat a deployed public proxy as a trust boundary.
- Never paste API keys, `.ROBLOSECURITY` cookies, GitHub tokens, or other credentials into issues, screenshots, source files, or chat.
- Do not deploy the proxy for shared multi-user use without adding server-side abuse controls and reviewing the current Roblox API scopes and Netlify limits.

See [SECURITY.md](SECURITY.md) for the boundary and known limitations.

## Roblox permissions

Create an Open Cloud key for the specific experience or group you manage. Grant only the permissions needed for the operation you plan to run. Product, pass, and asset operations may require different scopes; check Roblox’s current Creator documentation because the names and availability of scopes can change.

## Run locally

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Some Roblox API requests require the Netlify functions. For local function development, use the Netlify CLI with the repository’s `netlify.toml` configuration. Do not place a key in a `.env` file for this app; the browser session accepts the key directly.

## How to use

1. Create a restricted Open Cloud API key for an experience you own or administer.
2. Open RUpload, enter the key, and connect the experience using its Universe ID.
3. Review imported rows and every target experience before starting a batch.
4. Keep the page open while an upload is in progress; Roblox may take time to process asset operations.
5. Remove the key from Roblox when it is no longer needed.

RUpload can send create and update requests to Roblox. Check each row, price, description, image, and target Universe ID before you start; those changes affect the live experience.

## Project context

This is a retrospective automation project from a Roblox development workflow. Roblox Studio’s Asset Manager now supports bulk importing many asset types. RUpload is best read as an example of automating a wider publishing workflow through Open Cloud, including product/pass configuration—not as a replacement for Studio’s importer.

## License

Application code is released under the MIT License. Roblox names, marks, APIs, and any user-uploaded images remain subject to their respective owners’ terms.

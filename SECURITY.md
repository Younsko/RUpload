# Security notes

## Credential flow

The UI keeps the Open Cloud key in React state for the active page session and sends it in an `x-api-key` header to the Netlify function. The function forwards that header to a fixed `https://apis.roblox.com` host. It does not receive or store a server-owned Roblox key. This reduces server-side secret exposure; it does not protect a key from a compromised browser, malicious extension, or a user who pastes it into an untrusted site.

The root app stores experience selections, upload drafts, group ID, and preferences in `localStorage`. This is browser-local plain text. The current UI has a “Reset All” action that removes keys owned by RUpload only.

## Proxy boundary

`netlify/functions/roblox.ts` accepts only the API route families, methods, and limited query forms used by the UI. It rejects unknown routes and request bodies larger than 6 MB. The public game and thumbnail functions use fixed Roblox hosts and GET-only requests.

CORS limits which browser origins can read responses. It is not authentication or a rate limit: direct HTTP clients can still call a public function. Do not use a publicly deployed proxy as a shared credential service. Add platform-level rate limits or authentication before offering it as a multi-user hosted service.

## Safe operating practice

- Use a dedicated API key restricted to the target experience and operations you need.
- Never commit credentials or include them in logs or screenshots.
- Confirm the Universe ID and every edit before sending create/update requests.
- Revoke keys that may have been exposed.
- Review current Roblox Open Cloud requirements before using this tool; API scopes and endpoints can change.

## Release scope

The separate `countdown-scheduler` project was excluded from this release. Its cookie-validation and GitHub secret-writing routes do not belong to RUpload.

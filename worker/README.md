# Stay informed signup Worker

The homepage "Stay informed" form posts here. The Worker checks the input and adds the person to an iContact list through the iContact API (v2.2). It adds the contact, then subscribes that contact to the list. There's no database of its own: iContact is the record.

## Setup

1. In iContact, register an API app (Settings → iContact Integrations → Custom API Integrations). Note the **AppId**, the **API username** and the **API password** you set for it.
2. Find the IDs. With those credentials, `GET https://app.icontact.com/icp/a/` returns the account ID, `GET .../a/{accountId}/c/` returns the client folder ID, and `GET .../c/{folderId}/lists` returns the list IDs.
3. Put the three IDs in `wrangler.toml` under `[vars]`.
4. Deploy from this folder:

   ```sh
   npx wrangler login
   npx wrangler secret put ICONTACT_APP_ID
   npx wrangler secret put ICONTACT_USERNAME
   npx wrangler secret put ICONTACT_PASSWORD
   npx wrangler deploy
   ```

5. Put the Worker URL (live: `https://davidsuarezmb-signup.davidsuarezmb.workers.dev`, on Joe's Cloudflare account) in `SIGNUP_ENDPOINT` in `scripts/home-layout.mjs`, run `npm run build && npm test`, and commit. The section stays hidden until that URL is set.

To try the form before it goes live, open `/?signup=preview`.

## Behaviour

- Only `ALLOWED_ORIGINS` may post (CORS plus a server-side check).
- First name and email are required. Last name and phone are optional, and the phone must have 10–15 digits.
- A hidden `website` field catches bots: if it's filled in, the Worker returns success and drops the signup.
- If iContact fails, the visitor sees an error and the details go to the Worker log (`npx wrangler tail`).

# Latest Code Fetcher

This project contains a minimal Netlify site with a serverless function that reads the latest email from an IMAP inbox and extracts a six‑digit code. It is intended as a demonstration only—you should never embed your email credentials in client‑side code or commit them to version control. Use secure environment variables instead.

## Features

- **Netlify Function**: `netlify/functions/get-latest-code.js` connects to an IMAP inbox and returns the first six‑digit sequence found in the most recent message. It uses [`imap-simple`](https://www.npmjs.com/package/imap-simple) to interact with the IMAP server and [`mailparser`](https://nodemailer.com/extras/mailparser/) to parse message bodies.
- **Simple Frontend**: `index.html` includes a button that calls the serverless function and displays the extracted code. This can be served directly by Netlify.
- **Security**: The function supports an optional API key via the `MY_API_KEY` environment variable. If set, clients must include an `x-api-key` header with the same value. IMAP credentials must be configured as environment variables on Netlify and never committed to the repo.

## Setup and Deployment

1. **Install dependencies**
   
   Although Netlify will install dependencies during build, you can install them locally with `npm install` to test the function:

   ```bash
   npm install
   ```

2. **Create environment variables**

   In Netlify, go to **Site settings → Build & deploy → Environment** and add the following variables:

   - `IMAP_HOST` – The hostname of your IMAP server (e.g. `imap.gmail.com`)
   - `IMAP_PORT` – The port number (usually `993` for TLS)
   - `IMAP_USER` – Your email address
   - `IMAP_PASS` – Your app‑specific password or account password (do not use plain text credentials in production; for Gmail use an app password if two‑factor authentication is enabled)
   - `MY_API_KEY` – (optional) A secret key for simple request authentication. If set, the client must send this value in the `x-api-key` header when calling the function.

3. **Deploy to Netlify**

   - Push this repository to GitHub (or your preferred Git provider).
   - In Netlify, create a new site from your Git repository.
   - Set the build directory to the root (`/`) and specify the functions directory as `netlify/functions` in `netlify.toml` (this is already configured).
   - After deployment, visit your site. Press the button to fetch the latest code. If you defined an API key, modify `index.html` to send the header.

## Security Considerations

Reading emails for authentication codes is brittle and potentially insecure. A more robust approach is to generate one‑time passwords (OTPs) on your own server, store them temporarily, and deliver them via email or SMS. The client can then validate against your server instead of reading from an inbox. Services such as SendGrid, Mailgun, or Twilio offer APIs and webhooks for handling inbound and outbound messages securely.

// Netlify serverless function for retrieving the most recent 6‑digit code
// from the user's IMAP inbox. Uses imap-simple for IMAP and mailparser
// to parse message bodies. To secure this endpoint, set the MY_API_KEY
// environment variable and include it in requests via the `x-api-key` header.

const Imap = require('imap-simple');
const { simpleParser } = require('mailparser');

/**
 * Handler for Netlify function.
 *
 * This function connects to an IMAP inbox using credentials supplied via
 * environment variables (IMAP_USER, IMAP_PASS, IMAP_HOST, IMAP_PORT). It
 * locates the most recent email in the INBOX, parses its contents, and
 * extracts the first six‑digit sequence. The sequence is returned in the
 * response body as JSON: { code: "123456" }. If no six‑digit code is
 * found, or if there are no messages, a 404 error is returned. Any
 * unexpected errors produce a 500 response.
 *
 * To restrict access, define the MY_API_KEY environment variable. When set,
 * this function expects callers to include an `x-api-key` header with the
 * same value. If the keys do not match, a 403 response is returned.
 */
exports.handler = async function(event) {
  // Optional API key check for simple auth
  const expectedKey = process.env.MY_API_KEY;
  if (expectedKey) {
    const providedKey = event.headers['x-api-key'] || event.headers['X-API-KEY'];
    if (!providedKey || providedKey !== expectedKey) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden' }),
      };
    }
  }

  // Verify IMAP configuration is provided
  const { IMAP_USER, IMAP_PASS, IMAP_HOST, IMAP_PORT } = process.env;
  if (!IMAP_USER || !IMAP_PASS || !IMAP_HOST) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'IMAP configuration missing' }),
    };
  }

  const config = {
    imap: {
      user: IMAP_USER,
      password: IMAP_PASS,
      host: IMAP_HOST,
      port: parseInt(IMAP_PORT || '993', 10),
      tls: true,
      authTimeout: 3000,
    },
  };

  let connection;
  try {
    connection = await Imap.connect(config);
    await connection.openBox('INBOX');

    // Search all messages and fetch minimal fields to determine the newest UID
    const searchCriteria = ['ALL'];
    const fetchOptions = { bodies: [], struct: true };
    const messages = await connection.search(searchCriteria, fetchOptions);

    if (!messages || messages.length === 0) {
      await connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No messages' }),
      };
    }

    // Determine the highest UID (most recent message)
    const uids = messages
      .map(msg => (msg.attributes && msg.attributes.uid) || 0)
      .filter(uid => typeof uid === 'number');
    const latestUid = Math.max(...uids);

    // Fetch the full body of the latest message
    const fullMessages = await connection.search([{ uid: latestUid }], {
      bodies: [''],
      markSeen: false,
    });
    const latest = fullMessages && fullMessages[0];
    if (!latest) {
      await connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Latest message not found' }),
      };
    }

    // Parse the raw message into text
    const raw = latest.parts[0].body;
    const parsed = await simpleParser(raw);
    const text = `${parsed.text || ''}\n${parsed.html || ''}`;

    // Extract the first six‑digit code
    const match = text.match(/\b(\d{6})\b/);
    const code = match ? match[1] : null;

    await connection.end();

    if (!code) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No 6‑digit code found' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ code }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (err) {
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        // ignore errors closing connection
      }
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error', details: err.message }),
    };
  }
};

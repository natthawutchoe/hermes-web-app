const crypto = require("crypto");
const { formatTaskSummary, json, processBrainDump, readState, writeState } = require("./_hermes");

const DISCORD_RESPONSE = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4
};

const DISCORD_FLAGS = {
  EPHEMERAL: 64
};

function discordJson(res, payload) {
  json(res, 200, payload);
}

function getHeader(req, name) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === "string") return Buffer.from(req.rawBody, "utf8");
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  if (req.body && typeof req.body === "object") return Buffer.from(JSON.stringify(req.body), "utf8");

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function discordPublicKeyFromHex(hex) {
  const rawKey = Buffer.from(hex, "hex");
  const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
  return crypto.createPublicKey({
    key: Buffer.concat([spkiPrefix, rawKey]),
    format: "der",
    type: "spki"
  });
}

function verifyDiscordRequest(req, rawBody) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) throw new Error("Missing DISCORD_PUBLIC_KEY.");

  const signature = getHeader(req, "x-signature-ed25519");
  const timestamp = getHeader(req, "x-signature-timestamp");
  if (!signature || !timestamp) return false;

  return crypto.verify(
    null,
    Buffer.concat([Buffer.from(timestamp, "utf8"), rawBody]),
    discordPublicKeyFromHex(publicKey),
    Buffer.from(signature, "hex")
  );
}

function optionValue(interaction, name) {
  const options = interaction?.data?.options || [];
  return options.find((option) => option.name === name)?.value;
}

function shortTaskReply(state, task) {
  return `Saved to Hermes: ${formatTaskSummary(state, task)}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    if (!verifyDiscordRequest(req, rawBody)) {
      json(res, 401, { error: "Bad request signature" });
      return;
    }

    const interaction = JSON.parse(rawBody.toString("utf8"));
    if (interaction.type === 1) {
      discordJson(res, { type: DISCORD_RESPONSE.PONG });
      return;
    }

    const text = String(optionValue(interaction, "text") || "").trim();
    if (!text) {
      discordJson(res, {
        type: DISCORD_RESPONSE.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "พิมพ์งานหลัง /hermes ด้วยนะ เช่น /hermes text: QA ส่ง slide พรุ่งนี้",
          flags: DISCORD_FLAGS.EPHEMERAL
        }
      });
      return;
    }

    const channelId = interaction.channel_id || "unknown";
    const userId = interaction.member?.user?.id || interaction.user?.id || "unknown";
    const state = await readState();
    const result = processBrainDump(state, text, `discord-slash:${channelId}`, userId);
    await writeState(state);

    discordJson(res, {
      type: DISCORD_RESPONSE.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: result.needsClarification ? result.question : shortTaskReply(state, result.task),
        flags: DISCORD_FLAGS.EPHEMERAL
      }
    });
  } catch (error) {
    discordJson(res, {
      type: DISCORD_RESPONSE.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `Hermes sync failed: ${error.message}`,
        flags: DISCORD_FLAGS.EPHEMERAL
      }
    });
  }
};

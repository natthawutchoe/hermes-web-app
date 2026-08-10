const { Client, GatewayIntentBits } = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const hermesApiUrl = process.env.HERMES_API_URL || "http://127.0.0.1:4181/api/brain-dump";
const hermesAppKey = process.env.HERMES_APP_KEY || "";
const allowedChannelId = process.env.DISCORD_CHANNEL_ID || "";

if (!token) {
  throw new Error("Missing DISCORD_TOKEN environment variable.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

client.once("ready", () => {
  console.log(`Hermes Discord bridge is online as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (allowedChannelId && message.channelId !== allowedChannelId) return;

  const text = message.content.trim();
  if (!text) return;

  const shouldCapture =
    text.toLowerCase().startsWith("hermes ") ||
    text.toLowerCase().startsWith("/hermes ") ||
    message.channel.type === 1;

  if (!shouldCapture) return;

  const brainDump = text.replace(/^\/?hermes\s+/i, "");

  try {
    const response = await fetch(hermesApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hermes-key": hermesAppKey
      },
      body: JSON.stringify({
        text: brainDump,
        source: `discord:${message.channelId}`
      })
    });

    if (!response.ok) {
      throw new Error(`Hermes API returned ${response.status}`);
    }

    const payload = await response.json();
    await message.reply(`Added to Hermes: ${payload.task.courseCode} - ${payload.task.title} (${payload.task.due})`);
  } catch (error) {
    console.error(error);
    await message.reply("Hermes received it, but I could not sync it to the dashboard yet.");
  }
});

client.login(token);

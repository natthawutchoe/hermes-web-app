const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const apiUrl = process.env.HERMES_STATE_URL || "https://hermes-web-app-gilt.vercel.app/api/state";
const appKey = process.env.HERMES_APP_KEY || "";
const remindDays = Number(process.env.HERMES_REMIND_DAYS || 3);
const statePath = process.env.HERMES_REMINDER_STATE || path.join(process.env.HOME || ".", ".config", "hermes", "reminder-state.json");

if (!token) throw new Error("Missing DISCORD_TOKEN.");
if (!channelId) throw new Error("Missing DISCORD_CHANNEL_ID. Set it to the Discord channel Hermes should remind you in.");
if (!appKey) throw new Error("Missing HERMES_APP_KEY.");

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysUntil(iso) {
  return Math.ceil((startOfDay(new Date(`${iso}T12:00:00`)) - startOfDay(new Date())) / 86400000);
}

function readReminderState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch (_) {
    return {};
  }
}

function writeReminderState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function dueText(days) {
  if (days < 0) return `เลยกำหนด ${Math.abs(days)} วัน`;
  if (days === 0) return "ส่งวันนี้";
  if (days === 1) return "ส่งพรุ่งนี้";
  return `อีก ${days} วัน`;
}

async function fetchHermesState() {
  const response = await fetch(apiUrl, {
    headers: { "x-hermes-key": appKey }
  });
  if (!response.ok) throw new Error(`Hermes API returned ${response.status}`);
  return response.json();
}

async function main() {
  const hermes = await fetchHermesState();
  const tasks = Array.isArray(hermes.tasks) ? hermes.tasks : [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const sent = readReminderState();

  const dueSoon = tasks
    .filter((task) => task.status !== "done")
    .map((task) => ({ ...task, days: daysUntil(task.due) }))
    .filter((task) => task.days <= remindDays)
    .sort((a, b) => a.days - b.days);

  const pending = dueSoon.filter((task) => sent[task.id] !== todayKey);
  if (!pending.length) return;

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  const channel = await client.channels.fetch(channelId);
  if (!channel?.send) throw new Error(`Cannot send to channel ${channelId}.`);

  const lines = pending.slice(0, 8).map((task) => {
    return `- ${task.courseCode}: ${task.title} (${dueText(task.days)}, ${task.due})`;
  });
  await channel.send(`Hermes reminder: งานใกล้ส่ง\n${lines.join("\n")}`);

  for (const task of pending) sent[task.id] = todayKey;
  writeReminderState(sent);
  await client.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

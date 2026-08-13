const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const apiUrl = process.env.HERMES_STATE_URL || "https://hermes-web-app-gilt.vercel.app/api/state";
const appKey = process.env.HERMES_APP_KEY || "";
const remindDays = Number(process.env.HERMES_REMIND_DAYS || 3);
const forceSend = process.argv.includes("--force") || process.env.HERMES_REMINDER_FORCE === "1";
const statePath = process.env.HERMES_REMINDER_STATE || path.join(process.env.HOME || ".", ".config", "hermes", "reminder-state.json");
const TIME_ZONE = "Asia/Bangkok";
const DEFAULT_DUE_TIME = "23:59";

const courseShorts = {
  "01132326-65": "OD",
  "03521101-67": "C",
  "01132417-65": "Sustain",
  "01132333-65": "BIS",
  "03754221-67": "Eng",
  "01132332-65": "QA",
  "01362101-67": "Chinese"
};

if (!token) throw new Error("Missing DISCORD_TOKEN.");
if (!channelId) throw new Error("Missing DISCORD_CHANNEL_ID. Set it to the Discord channel Hermes should remind you in.");
if (!appKey) throw new Error("Missing HERMES_APP_KEY.");

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function nowInBangkok() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TIME_ZONE }));
}

function daysUntil(iso) {
  return Math.ceil((startOfDay(new Date(`${iso}T12:00:00`)) - startOfDay(nowInBangkok())) / 86400000);
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

function priorityRank(task) {
  if (task.days < 0) return 0;
  if (task.days === 0) return 1;
  if (task.priority === "high") return 2;
  if (task.days === 1) return 3;
  if (task.priority === "medium") return 4;
  return 5;
}

function courseLabel(task) {
  return courseShorts[task.courseCode] || task.courseCode;
}

function taskDue(task) {
  return `${task.due} ${task.dueTime || DEFAULT_DUE_TIME}`;
}
function briefingFor(tasks) {
  const top = tasks[0];
  const next = tasks[1];
  if (!top) return "";

  const opener = top.days <= 0
    ? `เย็นนี้เริ่มจาก ${courseLabel(top)} ก่อน เพราะ${dueText(top.days)}`
    : `เย็นนี้ควรเริ่มจาก ${courseLabel(top)} เพราะใกล้สุด (${dueText(top.days)})`;
  const nextText = next ? ` แล้วค่อยต่อด้วย ${courseLabel(next)}` : "";
  return `${opener}${nextText}.`;
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
  const todayKey = nowInBangkok().toISOString().slice(0, 10);
  const sent = readReminderState();

  const dueSoon = tasks
    .filter((task) => task.status !== "done")
    .map((task) => ({ ...task, days: daysUntil(task.due) }))
    .filter((task) => task.days <= remindDays)
    .sort((a, b) => priorityRank(a) - priorityRank(b) || a.days - b.days);

  const pending = forceSend ? dueSoon : dueSoon.filter((task) => sent[task.id] !== todayKey);
  if (!dueSoon.length) {
    console.log(`Hermes reminder: no open tasks due within ${remindDays} days. Open tasks: ${tasks.filter((task) => task.status !== "done").length}.`);
    return;
  }
  if (!pending.length) {
    console.log(`Hermes reminder: ${dueSoon.length} due-soon task(s), but all were already reminded today. Use --force to test-send again.`);
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  const channel = await client.channels.fetch(channelId);
  if (!channel?.send) throw new Error(`Cannot send to channel ${channelId}.`);

  const lines = pending.slice(0, 8).map((task) => {
    return `- ${courseLabel(task)}: ${task.title} (${dueText(task.days)}, ${taskDue(task)})`;
  });
  await channel.send(`Hermes evening plan\n${briefingFor(pending)}\n\nลำดับที่ควรทำก่อน:\n${lines.join("\n")}`);
  console.log(`Hermes reminder: sent ${pending.length} task(s) to Discord channel ${channelId}.`);

  if (!forceSend) {
    for (const task of pending) sent[task.id] = todayKey;
    writeReminderState(sent);
  }
  await client.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


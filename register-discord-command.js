const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !applicationId) {
  throw new Error("Set DISCORD_TOKEN and DISCORD_APPLICATION_ID first.");
}

const command = {
  name: "hermes",
  description: "Save a university task into Hermes Dashboard",
  options: [
    {
      name: "text",
      description: "Task or deadline text, for example FIN301 ส่ง slide วันพุธหน้า",
      type: 3,
      required: true
    }
  ]
};

const route = guildId
  ? `/applications/${applicationId}/guilds/${guildId}/commands`
  : `/applications/${applicationId}/commands`;

async function main() {
  const response = await fetch(`https://discord.com/api/v10${route}`, {
    method: "PUT",
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify([command])
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Discord command registration failed: ${response.status} ${body}`);
  }

  console.log("Registered /hermes command.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

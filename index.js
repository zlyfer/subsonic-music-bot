/* ------------- Imports ------------ */

import { Client, GatewayIntentBits, REST, Routes } from "discord.js";

import fs from "fs";

/* ------------- Classes ------------ */

import SubsonicApi from "./classes/SubsonicApi.js";
import Guild from "./classes/Guild.js";

/* ------ Config & Credentials ------ */

const creds = JSON.parse(fs.readFileSync("./credentials.json"));
const { commands } = JSON.parse(fs.readFileSync("./commands.json"));

/* ------------ Init Bot ------------ */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

/* ---------- Init Subsonic --------- */

const subsonicApi = new SubsonicApi(creds.subsonic);

/* ----------- VC & Player ---------- */

const guilds = {};

/* ----------- Bot Events ----------- */

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const channel = interaction.member.voice.channel;
  const guildId = interaction.guildId;
  let guild = guilds[guildId];
  if (!guild) {
    guild = new Guild();
    guilds[guildId] = guild;
  }

  try {
    switch (interaction.commandName) {
      case "debug":
        if (await checkChannel(channel, interaction)) {
          guild.joinVoice(channel);
          await interaction.reply(`I joined your voice channel: ${channel.name}`);
          debug(guild);
        }
        break;
      case "play":
        if (await checkChannel(channel, interaction)) {
          await interaction.reply("This command is not implemented yet.");
        }
        break;
      case "pause":
        if (await checkChannel(channel, interaction)) {
          guild.pause();
          interaction.reply("Playback paused.");
        }
        break;
      case "continue":
        if (await checkChannel(channel, interaction)) {
          guild.continue();
          interaction.reply("Playback started.");
        }
        break;
      case "stop":
        if (await checkChannel(channel, interaction)) {
          guild.stop();
          interaction.reply("Playback stopped.");
        }
        break;
      case "search":
      case "skip":
      case "show-queue":
      case "clear-queue":
      case "autoplay":
      default:
        await interaction.reply("This command is not implemented yet.");
        break;
    }
  } catch (error) {
    console.error(error);
    await interaction.reply("An error occurred while executing this command.");
  }
});

/* --------- Other Functions -------- */

async function debug(guild) {
  try {
    const data = await subsonicApi.getStarred();
    if (data && data.status === "ok") {
      const streamUrl = await subsonicApi.getStreamUrlById(data.starred2.song[0].id);
      guild.play(streamUrl);
    }
  } catch (error) {
    console.error("Error fetching starred songs:", error.message);
  }
}

async function checkChannel(channel, interaction) {
  if (!channel) {
    await interaction.reply("You need to join a voice channel first!");
    return false;
  }
  return true;
}

/* -------- Discord Functions ------- */

/* ---------- Bot Shutdown ---------- */

const handleShutdown = async () => {
  Object.values(guilds).forEach((guild) => {
    guild.leaveVoice();
  });

  console.log("Logging out and shutting down...");
  await client.destroy();
  process.exit(0);
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

/* ----------- Bot Startup ---------- */

const rest = new REST({ version: "10" }).setToken(creds.discord.token);
try {
  console.log("Attempt: Reload /commands");

  await rest.put(Routes.applicationCommands(creds.discord.client_id), { body: commands });

  console.log("Success: Reload /commands");
} catch (error) {
  console.error(error);
}
client.login(creds.discord.token);

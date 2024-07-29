/* ------------- Imports ------------ */

import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} from "@discordjs/voice";
import fs from "fs";
import md5 from "md5";
import subsonic from "subsonicjs";

/* ------ Config & Credentials ------ */

const credentials = fs.readFileSync("./credentials.json");
const { c_discord, c_subsonic } = JSON.parse(credentials);

/* ------------ Init Bot ------------ */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

/* ---------- Init Subsonic --------- */

const salt = Math.random().toString(36).substring(2, 15);
const token = md5(c_subsonic.password + salt);

const subsonicClient = subsonic(c_subsonic.username, token, salt, {
  protocol: c_subsonic.protocol,
  host: c_subsonic.host,
  port: c_subsonic.port,
  timeout: 30,
  client: "subsonic-music-bot",
  version: "1.16.1",
});

/* ------------- Globals ------------ */

var GLOBAL = {
  vcConnection: null,
  player: null,
};
GLOBAL.player = createAudioPlayer();

/* ----------- / Commands ----------- */

const commands = [
  {
    name: "debug",
    description: "Joins the voice channel you are in and plays the first starred song.",
  },
  {
    name: "search",
    description: "Search for a song.",
    options: [
      {
        name: "query",
        description: "Enter a search query.",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "play",
    description: "Play a song.",
    options: [
      {
        name: "query",
        description: "Enter a search query.",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "pause",
    description: "Pause the current song.",
  },
  {
    name: "stop",
    description: "Stop the current song.",
  },
  {
    name: "skip",
    description: "Skip the current song.",
  },
  {
    name: "show-queue",
    description: "Show the current queue.",
  },
  {
    name: "clear-queue",
    description: "Clear the current queue.",
  },
  {
    name: "autoplay",
    description: "Toggle autoplay.",
    options: [
      {
        name: "mode",
        type: 3,
        choices: [
          {
            name: "None",
            value: "none",
          },
          {
            name: "Random",
            value: "random",
          },
          {
            name: "Similar",
            value: "similar",
          },
        ],
        description: "Enable or disable autoplay.",
        required: true,
      },
    ],
  },
];

/* ----------- Bot Events ----------- */

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case "debug":
        const guild = interaction.guild;
        const channel = interaction.member.voice.channel;
        if (!channel) {
          await interaction.reply("You need to join a voice channel first!");
          return;
        }

        joinVoice(channel);
        await interaction.reply(`I joined your voice channel: ${channel.name}`);
        __debugStreamSong();
        break;
      case "search":
      case "play":
      case "pause":
      case "stop":
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

async function __debugStreamSong() {
  try {
    const data = await subsonicClient.browsing.getStarred({});
    if (data && data.status === "ok") {
      const id = data.starred2.song[0].id;
      const streamUrl = getStreamUrlById(id);

      if (GLOBAL.vcConnection) {
        const resource = createAudioResource(streamUrl, { inlineVolume: true });
        resource.volume.setVolume(0.2);

        GLOBAL.vcConnection.subscribe(player);

        player.play(resource);

        player.on(AudioPlayerStatus.Playing, () => {
          console.log("The audio player has started playing!");
        });

        player.on(AudioPlayerStatus.Idle, () => {
          console.log("The audio player is idle.");
        });

        player.on(AudioPlayerStatus.Buffering, () => {
          console.log("The audio player is buffering.");
        });

        player.on("error", (error) => {
          console.error("Error playing audio:", error);
        });
      }
    }
  } catch (error) {
    console.error("Error fetching starred songs:", error.message);
  }
}

/* -------- Discord Functions ------- */

function joinVoice(channel) {
  leaveVoice();

  GLOBAL.vcConnection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  });
}

function leaveVoice() {
  if (GLOBAL.vcConnection) {
    console.log("Leaving voice channel...");
    GLOBAL.vcConnection.destroy();
    GLOBAL.vcConnection = null;
  }
}

/* ------- Subsonic Functions ------- */

function getStreamUrlById(id) {
  return subsonicClient.media.stream({ id });
}

/* ---------- Bot Shutdown ---------- */

const handleShutdown = async () => {
  leaveVoice();

  console.log("Logging out and shutting down...");
  await client.destroy();
  process.exit(0);
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

/* ----------- Bot Startup ---------- */

const rest = new REST({ version: "10" }).setToken(c_discord.token);
try {
  console.log("Attempt: Reload /commands");

  await rest.put(Routes.applicationCommands(c_discord.client_id), { body: commands });

  console.log("Success: Reload /commands");
} catch (error) {
  console.error(error);
}
client.login(c_discord.token);

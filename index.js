/* ------------- Imports ------------ */

import { Client, GatewayIntentBits, REST, Routes, ChannelType } from "discord.js";

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
  const channel = interaction.member.voice.channel;
  const guildId = interaction.guildId;
  let guild = guilds[guildId];

  /* ------------ Commands ------------ */

  if (interaction.isChatInputCommand()) {
    if (!guild) {
      guild = new Guild();
      guilds[guildId] = guild;
    }

    try {
      switch (interaction.commandName) {
        // case debug:
        //   if (await checkIfInVoice(channel, interaction)) {
        //   }
        //   break;
        case "debug":
          if (await checkIfInVoice(channel, interaction)) {
            guild.joinVoice(channel);
            await interaction.reply(`I joined your voice channel: ${channel.name}`);
            debug(guild);
          }
          break;
        case "play":
          if (await checkIfInVoice(channel, interaction)) {
            await interaction.reply("This command is not implemented yet.");
          }
          break;
        case "pause":
          if (await checkIfInVoice(channel, interaction)) {
            guild.pause();
            interaction.reply("Playback paused.");
          }
          break;
        case "continue":
          if (await checkIfInVoice(channel, interaction)) {
            guild.continue();
            interaction.reply("Playback started.");
          }
          break;
        case "stop":
          if (await checkIfInVoice(channel, interaction)) {
            guild.stop();
            const leaveVoice = interaction.options.getBoolean("leave-voice");
            if (leaveVoice) {
              guild.leaveVoice();
            }
            interaction.reply("Playback stopped.");
          }
          break;
        case "join":
          const customVoiceChannel = interaction.options.getChannel("channel");
          if (customVoiceChannel) {
            if (customVoiceChannel.type !== ChannelType.GuildVoice) {
              await interaction.reply("I can only join voice channels.");
              return;
            }
            guild.joinVoice(customVoiceChannel);
            await interaction.reply(`I joined the voice channel: ${customVoiceChannel.name}`);
            return;
          }
          if (await checkIfInVoice(channel, interaction)) {
            guild.joinVoice(channel);
            await interaction.reply(`I joined your voice channel: ${channel.name}`);
            return;
          }
          break;
        case "leave":
          if (await checkIfInVoice(channel, interaction)) {
            guild.leaveVoice();
            interaction.reply("I left the voice channel.");
          }
          break;
        case "search":
          const query = interaction.options.getString("query");
          const count = interaction.options.getInteger("count") || 50;
          const search = subsonicApi.search(query, count);
          search
            .then(async (data) => {
              const songs = data.searchResult3.song;
              if (!songs) {
                await interaction.reply("No results found for your search.");
                return;
              }
              const pages = Math.ceil(songs.length / 10) - 1;
              const menu = genSearchMenu(query, songs, 0);
              const reply = await interaction.reply({ ...menu, fetchReply: true });

              guild.menus[reply.id] = {
                reply,
                query,
                songs,
                page: 0,
                pages,
              };
            })
            .catch(async (error) => {
              console.error(`error:`, error);
              if (interaction.deferred) {
                await interaction.reply("An error occurred while searching for songs.");
              }
            });
          break;
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
  }

  /* ------------- Buttons ------------ */

  if (interaction.isButton()) {
    if (!guild) {
      await interaction.reply("An error occurred while processing your request.");
      return;
    }

    const menu = guild.menus[interaction.message.id];

    if (!menu) {
      await interaction.reply("An error occurred while processing your request.");
      return;
    }

    switch (interaction.customId) {
      case "next_page":
        menu.page += 1;
        break;
      case "previous_page":
        menu.page -= 1;
        break;
      default:
        await interaction.reply("An error occurred while processing your request.");
        return;
    }

    if (interaction.customId === "next_page" || interaction.customId === "previous_page") {
      guild.menus[interaction.message.id].page = menu.page;
      const updatedMenu = genSearchMenu(menu.query, menu.songs, menu.page);
      await interaction.update(updatedMenu);
    }
  }

  /* ------------ Select Menus ------------ */

  if (interaction.isStringSelectMenu()) {
    if (!guild) {
      await interaction.reply("An error occurred while processing your request.");
      return;
    }
    const songId = interaction.values[0];
    console.log("Selected Song:", songId);
    await interaction.reply("This command is not implemented yet.");
  }
});

/* -------- Discord Functions ------- */

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

async function checkIfInVoice(channel, interaction) {
  if (!channel) {
    await interaction.reply("You need to join a voice channel first!");
    return false;
  }
  return true;
}

function genSearchMenu(query, songs, page) {
  const start = page * 10;
  const end = start + 10;
  const songShard = songs.slice(start, end);
  const fields = songShard.map((song) => {
    return {
      name: ``,
      value: `**${limitText(song.title, 30)}**  |  *${limitText(song.artist, 30)}*
      *${limitText(song.album, 60)}*  |  **${s2MS(song.duration)}**`,
    };
  });
  const options = songShard.map((song) => {
    return {
      label: `${limitText(song.title, 25)}  |  ${limitText(song.artist, 25)}`,
      value: song.id,
      description: `by ${limitText(song.artist, 50)}`,
    };
  });

  const menu = {
    content: "",
    tts: false,
    embeds: [
      {
        title: "Results for: " + query,
        color: 14595902,
        fields,
        footer: {
          text: `Page ${page + 1} / ${Math.ceil(songs.length / 10)}  |  Total results: ${
            songs.length
          }`,
        },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: "Previous Page",
            custom_id: "previous_page",
            disabled: page === 0,
          },
          {
            type: 2,
            style: 2,
            label: "Next Page",
            custom_id: "next_page",
            disabled: page === Math.ceil(songs.length / 10) - 1,
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "select_song",
            options,
            placeholder: "Select a song...",
            disabled: false,
          },
        ],
      },
    ],
    actions: {},
  };

  return menu;
}

/* --------- Other Functions -------- */

function s2MS(duration) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes}m ${seconds}s`;
}

function limitText(text, length, addEllipsis = true) {
  if (length == -1) return text + (addEllipsis ? "..." : "");
  if (text.length > length) {
    return text.substring(0, length - 3) + (addEllipsis ? "..." : "");
  }
  return text;
}

/* ---------- Bot Shutdown ---------- */

const handleShutdown = async () => {
  Object.values(guilds).forEach((guild) => {
    guild.leaveVoice();
  });

  console.info("Logging out and shutting down...");
  await client.destroy();
  process.exit(0);
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

/* ----------- Bot Startup ---------- */

const rest = new REST({ version: "10" }).setToken(creds.discord.token);
try {
  console.info("Attempt: Reload /commands");

  await rest.put(Routes.applicationCommands(creds.discord.client_id), { body: commands });

  console.info("Success: Reload /commands");
} catch (error) {
  console.error(error);
}
client.login(creds.discord.token);

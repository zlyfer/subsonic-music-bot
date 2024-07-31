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
      guild = new Guild(subsonicApi);
      guilds[guildId] = guild;
    }

    let type, query, count, customVoiceChannel;
    try {
      switch (interaction.commandName) {
        // case debug:
        //   if (await checkIfInVoice(channel, interaction)) {
        //   }
        //   break;
        case "debug":
          if (await checkIfInVoice(channel, interaction)) {
            guild.joinVoice(channel);
            debug(guild);
            await interaction.reply(`debugging...`);
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
          customVoiceChannel = interaction.options.getChannel("channel");
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
          query = interaction.options.getString("query");
          count = interaction.options.getInteger("count") || 50;
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
          if (await checkIfInVoice(channel, interaction)) {
            const result = guild.skip();
            if (result) {
              await interaction.reply("Skipped the current song.");
            } else {
              await interaction.reply(
                "The queue is empty. Leaving voice channel in `1 minute` if no songs are added."
              );
            }
          }
          break;
        case "shuffle":
          if (guild.queue.length === 0) {
            await interaction.reply("The queue is empty.");
            return;
          }
          guild.queue = guild.queue.sort(() => Math.random() - 0.5);
          await interaction.reply("The queue has been shuffled.");
          break;
        case "show-queue":
          if (guild.queue.length === 0) {
            await interaction.reply("The queue is empty.");
            return;
          }
          const pages = Math.ceil(guild.queue.length / 10) - 1;
          const menu = genQueueMenu(guild, guild.queue, 0);
          const reply = await interaction.reply({ ...menu, fetchReply: true });
          guild.menus[reply.id] = {
            reply,
            songs: guild.queue,
            page: 0,
            pages,
          };
          break;
        case "remove-from-queue":
          if (guild.queue.length == 0) {
            await interaction.reply("The queue is empty.");
            return;
          }
          type = interaction.options.getString("type");
          if (type == "index") {
            const index = parseInt(interaction.options.getString("query"));
            if (isNaN(index)) {
              await interaction.reply("Index must be a number.");
              return;
            }
            if (index < 1 || index > guild.queue.length) {
              await interaction.reply(`Index must be between 1 and ${guild.queue.length}.`);
              return;
            }
            guild.queue.splice(index - 1, 1);
          } else {
            const title = interaction.options.getString("query");
            const index = guild.queue.findIndex((song) => song.title === title);
            if (index === -1) {
              await interaction.reply("Song not found in queue.");
              return;
            }
            guild.queue.splice(index, 1);
          }
          await interaction.reply("Song removed from queue. " + queueLeftText(guild.queue));
          break;
        case "clear-from-queue":
          type = interaction.options.getString("type");
          query = interaction.options.getString("query");
          let songCount = guild.queue.length;
          if (type == "artist") {
            const index = guild.queue.findIndex((song) => song.artist === query);
            if (index === -1) {
              await interaction.reply("Artist not found in queue.");
              return;
            }
            guild.queue = guild.queue.filter((song) => song.artist !== query);
          } else if (type == "album") {
            const index = guild.queue.findIndex((song) => song.album === query);
            if (index === -1) {
              await interaction.reply("Album not found in queue.");
              return;
            }
            guild.queue = guild.queue.filter((song) => song.album !== query);
          } else if (type == "title") {
            const index = guild.queue.findIndex((song) => song.title === query);
            if (index === -1) {
              await interaction.reply("Title not found in queue.");
              return;
            }
            guild.queue = guild.queue.filter((song) => song.title !== query);
          } else {
            await interaction.reply("Invalid type.");
            return;
          }
          songCount -= guild.queue.length;
          await interaction.reply(
            `${songCount} song${songCount != 1 ? "s" : ""} removed from the queue. ` +
              queueLeftText(guild.queue)
          );
          break;
        case "clear-queue":
          guild.queue = [];
          await interaction.reply("The queue has been cleared.");
          break;

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
      case "next_s_page":
      case "next_q_page":
        menu.page += 1;
        break;
      case "prev_s_page":
      case "prev_q_page":
        menu.page -= 1;
        break;
      default:
        await interaction.reply("An error occurred while processing your request.");
        return;
    }

    if (interaction.customId === "next_s_page" || interaction.customId === "prev_s_page") {
      guild.menus[interaction.message.id].page = menu.page;
      const updatedMenu = genSearchMenu(menu.query, menu.songs, menu.page);
      await interaction.update(updatedMenu);
    }

    if (interaction.customId === "next_q_page" || interaction.customId === "prev_q_page") {
      guild.menus[interaction.message.id].page = menu.page;
      const updatedMenu = genQueueMenu(guild, menu.songs, menu.page);
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
    for (let i = 0; i < 11; i++) {
      let index = Math.floor(Math.random() * data.starred2.song.length);
      const song = data.starred2.song[index];

      if (data && data.status === "ok" && song) {
        if (guild.currentSong) {
          guild.queueSong(song);
        } else {
          await guild.play(song);
        }
      }
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
  const MAX_ENTRIES = 10;

  const start = page * MAX_ENTRIES;
  const end = start + MAX_ENTRIES;
  const songShard = songs.slice(start, end);
  const fields = songShard.map((song) => {
    return {
      name: ``,
      value: `**${limitText(song.title, 30)}** | *${limitText(song.artist, 30)}*
      *${limitText(song.album, 60)}* | **${s2HMS(song.duration)}**`,
    };
  });
  const options = songShard.map((song) => {
    return {
      label: `${limitText(song.title, 25)} | ${limitText(song.artist, 25)}`,
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
          text: `Page ${page + 1} / ${Math.ceil(songs.length / MAX_ENTRIES)} | Total results: ${
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
            custom_id: "prev_s_page",
            disabled: page === 0,
          },
          {
            type: 2,
            style: 2,
            label: "Next Page",
            custom_id: "next_s_page",
            disabled: page === Math.ceil(songs.length / MAX_ENTRIES) - 1,
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

function genQueueMenu(guild, songs, page) {
  const MAX_ENTRIES = 10;
  const start = page * MAX_ENTRIES;
  const end = start + MAX_ENTRIES;
  const songShard = songs.slice(start, end);
  const calcWaitTime = (songs, index) => {
    let time = guild.currentRemaining;
    for (let i = 0; i < index; i++) {
      time += songs[i].duration;
    }

    return time;
  };
  const fields = songShard.map((song, index) => {
    return {
      name: ``,
      value: `**${index + start + 1}.** **${limitText(song.title, 30)}** *(${s2HMS(
        song.duration
      )})*\n*${limitText(song.album, 30)}* | **${limitText(song.artist, 30)}**\n${s2HMS(
        calcWaitTime(songs, index + start)
      )} left`,
    };
  });

  const menu = {
    content: `There are \`${songs.length} song${
      songs.length != 1 ? "s" : ""
    }\` in the queue.\nTotal duration: \`${s2HMS(
      songs.reduce((acc, song) => acc + song.duration, 0) + guild.currentRemaining
    )}\`.
    `,
    tts: false,
    embeds: [
      {
        title: "Queue",
        color: 14595902,
        fields,
        footer: {
          text: `Page ${page + 1} / ${Math.ceil(songs.length / MAX_ENTRIES)} | Total songs: ${
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
            custom_id: "prev_q_page",
            disabled: page === 0,
          },
          {
            type: 2,
            style: 2,
            label: "Next Page",
            custom_id: "next_q_page",
            disabled: page === Math.ceil(songs.length / MAX_ENTRIES) - 1,
          },
        ],
      },
    ],
    actions: {},
  };

  return menu;
}

/* --------- Other Functions -------- */

function s2HMS(duration) {
  let hours = Math.floor(duration / 3600);
  let minutes = Math.floor((duration % 3600) / 60);
  let seconds = duration % 60;
  let time = "";
  if (hours > 0) time += `${hours}h `;
  if (minutes > 0 || hours > 0) time += `${minutes}m `;
  time += `${seconds}s`;
  return time;
}

function limitText(text, length, addEllipsis = true) {
  if (length == -1) return text + (addEllipsis ? "..." : "");
  if (text.length > length) {
    return text.substring(0, length - 3) + (addEllipsis ? "..." : "");
  }
  return text;
}

function queueLeftText(queue) {
  let addition = "";
  if (queue.length === 0) {
    addition = "The queue is now empty.";
  } else if (queue.length === 1) {
    addition = "There is 1 song in the queue.";
  } else {
    addition = `There are ${queue.length} songs in the queue.`;
  }
  return addition;
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

// const currentCommands = await rest.get(Routes.applicationCommands(creds.discord.client_id));
// currentCommands.forEach(async (command) => {
//   console.info(`${command.name} - ${command.description}`);
// });

try {
  console.info("Attempt: Reload /commands");

  await rest.put(Routes.applicationCommands(creds.discord.client_id), { body: commands });

  console.info("Success: Reload /commands");
} catch (error) {
  console.error(error);
}
client.login(creds.discord.token);

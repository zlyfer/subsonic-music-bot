/* ------------- Imports ------------ */

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  ChannelType,
  ActivityType,
} = require("discord.js");
const fs = require("fs");

/* ------------- Classes ------------ */

const SubsonicAPI = require("./classes/SubsonicAPI.js");
const Guild = require("./classes/Guild.js");

/* ------ Config & Credentials ------ */

var creds = JSON.parse(fs.readFileSync("./credentials.json"));
const { commands } = JSON.parse(fs.readFileSync("./commands.json"));
if (!fs.existsSync("./config.json")) {
  console.info("  [SYSTEM] Config file not found. Creating a new one...");
  fs.copyFileSync("./config.template.json", "./config.json");
}
const configTemplate = JSON.parse(fs.readFileSync("./config.template.json"));
const config = JSON.parse(fs.readFileSync("./config.json"));
Object.keys(configTemplate).forEach((key) => {
  if (config[key] === undefined) {
    console.info(`  [SYSTEM] Config is outdated. Adding missing key: ${key}`);
    config[key] = configTemplate[key];
  }
});
fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));

/* -------- Convert Cred File ------- */

if (!creds.version || creds.version < 2) {
  console.info("  [SYSTEM] Found old credentials file. Converting to version 2...");
  const hostSplit = creds.subsonic.host.split(".");
  const newCreds = {
    version: 2,
    discord: creds.discord,
    subsonic: [
      {
        name: hostSplit[hostSplit.length > 1 ? hostSplit.length - 2 : 0],
        protocol: creds.subsonic.protocol || "http",
        host: creds.subsonic.host || "localhost",
        port: creds.subsonic.port || "80",
        username: creds.subsonic.username,
        password: creds.subsonic.password,
      },
    ],
  };

  fs.writeFileSync("./credentials.bak-v1.json", JSON.stringify(creds, null, 2));
  fs.writeFileSync("./credentials.json", JSON.stringify(newCreds, null, 2));
  creds = newCreds;
}

/* ------------ Init Bot ------------ */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

/* ---------- Init Subsonic --------- */

const subsonicAPI = new SubsonicAPI(creds.subsonic);

/* ------------- Globals ------------ */

const guilds = {};
const Colors = {
  yellow: 14595902,
  green: 3066993,
  red: 15158332,
};

/* ----------- Bot Events ----------- */

client.on("ready", () => {
  console.info(` [DISCORD] Bot is ready.`);
  console.info(` [DISCORD] Logged in as ${client.user.tag}!`);

  client.guilds.cache.forEach((guild) => {
    guilds[guild.id] = new Guild(subsonicAPI, config);
  });

  client.user.setPresence({
    status: "invisible",
    activities: [{ name: "good music", type: ActivityType.Listening }],
  });
});

client.on("interactionCreate", async (interaction) => {
  const channel = interaction.member.voice.channel;
  const guildId = interaction.guildId;
  const guild = guilds[guildId];

  /* ------------ Commands ------------ */
  if (interaction.isChatInputCommand()) {
    try {
      let count, customVoiceChannel, query, reply, type;
      switch (interaction.commandName) {
        case "panel":
          if (await checkIfInVoice(channel, interaction)) {
            await interaction.reply("Panel is not implemented yet.");
          }
          break;
        case "volume":
          if (await checkIfInVoice(channel, interaction)) {
            await interaction.reply("Volume is not implemented yet.");
          }
          break;
        case "play":
        case "search":
          if (
            (await checkIfInVoice(channel, interaction, interaction.commandName == "play")) ||
            interaction.commandName == "search"
          ) {
            query = interaction.options.getString("query");
            count =
              interaction.options.getInteger("count") || interaction.commandName == "play"
                ? 1
                : 100;
            subsonicAPI
              .search(query, count)
              .then(async (songs) => {
                if (songs.length === 0) {
                  await interaction.reply(`Could not find any songs for: \`${query}\``);
                  return;
                }
                if (interaction.commandName == "play") {
                  const song = songs[0];
                  if (song) {
                    guild.joinVoice(channel);
                    const status = await play(guild, song);
                    if (!status) {
                      await interaction.reply(
                        "An error occurred while processing your request. **[PLAY]**"
                      );
                      return;
                    }
                    const menu = genSongInfoEmbed(guild, song, status);
                    await interaction.reply({ ...menu, fetchReply: true });
                  }
                } else if (interaction.commandName == "search") {
                  const menu = genSearchMenu(guild, query, songs, 0);
                  reply = await interaction.reply({ ...menu, fetchReply: true });
                  guild.menus[reply.id] = {
                    reply,
                    query,
                    songs,
                    page: 0,
                  };
                }
              })
              .catch(async (error) => {
                console.error(error);
                await reply.reply("An error occurred while processing your request. **[SEARCH]**");
              });
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
        case "skip":
          if (await checkIfInVoice(channel, interaction)) {
            if (guild.queue.length === 0 && !guild.currentSong) {
              await interaction.reply(
                "Cannot skip, there is no song playing and the queue is empty."
              );
              return;
            }
            const { status, song } = await guild.skip();
            if (status == "play") {
              const menu = genSongInfoEmbed(guild, song, status);
              await interaction.reply({ ...menu, fetchReply: true });
            } else if (status == "empty") {
              await interaction.reply("Song skipped. The queue is empty now.");
            } else {
              await interaction.reply(
                "An error occurred while processing your request. **[SKIP]**"
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
          const menu = genQueueMenu(guild, guild.queue, 0);
          reply = await interaction.reply({ ...menu, fetchReply: true });
          guild.menus[reply.id] = {
            reply,
            songs: guild.queue,
            page: 0,
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
        case "show-providers":
          if (await checkIfInVoice(channel, interaction)) {
            await interaction.reply("Show providers is not implemented yet.");
          }
          break;
        default:
          await interaction.reply(
            "You have entered an invalid command. Try restarting your Discord client."
          );
          break;
      }
    } catch (error) {
      console.error(error);
      await interaction.reply("An error occurred while processing your request. **[OPTION]**");
    }
  }

  /* ------------- Buttons ------------ */

  if (interaction.isButton()) {
    try {
      if (!guild) {
        await interaction.reply("An error occurred while processing your request. **[GUILD]**");
        return;
      }

      const menu = guild.menus[interaction.message.id];

      if (!menu) {
        await interaction.reply("An error occurred while processing your request. **[MENU]**");
        return;
      }
      switch (interaction.customId) {
        case "prev_s_page":
        case "prev_q_page":
          menu.page -= 1;
          break;
        case "next_s_page":
        case "next_q_page":
          menu.page += 1;
          break;
        case "first_s_page":
        case "first_q_page":
          menu.page = 0;
          break;
        case "last_s_page":
        case "last_q_page":
          menu.page = Math.ceil(menu.songs.length / config.maxPageEntries) - 1;
          break;
        case "middle_s_page":
        case "middle_q_page":
          menu.page = Math.floor(menu.songs.length / config.maxPageEntries / 2);
          break;
        case "clear_queue":
          guild.queue = [];
          // delete guild.menus[interaction.message.id];
          await interaction.update({
            content: "The queue has been cleared.",
            components: [],
            embeds: [],
          });
          return;
        default:
          await interaction.reply("An error occurred while processing your request. **[PAGE]**");
          return;
      }

      const s_pages = [
        "prev_s_page",
        "next_s_page",
        "first_s_page",
        "last_s_page",
        "middle_s_page",
      ];
      if (s_pages.includes(interaction.customId)) {
        const updatedMenu = genSearchMenu(guild, menu.query, menu.songs, menu.page);
        await interaction.update(updatedMenu);
      }

      const q_pages = [
        "prev_q_page",
        "next_q_page",
        "first_q_page",
        "last_q_page",
        "middle_q_page",
      ];
      if (q_pages.includes(interaction.customId)) {
        const updatedMenu = genQueueMenu(guild, menu.songs, menu.page);
        await interaction.update(updatedMenu);
      }
      return;
    } catch (error) {
      console.error(error);
      await interaction.reply("An error occurred while processing your request. **[PAGE]**");
    }
  }

  /* ------------ Select Menus ------------ */

  if (interaction.isStringSelectMenu()) {
    try {
      if (await checkIfInVoice(channel, interaction)) {
        if (!guild) {
          await interaction.reply("An error occurred while processing your request. **[GUILD]**");
          return;
        }
        const songId = interaction.values[0];
        const song = guild.menus[interaction.message.id].songs.find((song) => song.id === songId);
        if (!song) {
          await interaction.reply("An error occurred while processing your request. **[SONG]**");
          return;
        }
        guild.joinVoice(channel);
        const status = await play(guild, song);
        if (!status) {
          await interaction.reply("An error occurred while processing your request. **[SELECT]**");
          return;
        }
        const menu = genSongInfoEmbed(guild, song, status);
        await interaction.reply({ ...menu, fetchReply: true });
        return;
      }
    } catch (error) {
      console.error(error);
      await interaction.reply("An error occurred while processing your request. **[SELECT]**");
    }
  }
});

async function play(guild, song) {
  if (guild.currentSong) {
    guild.queueSong(song);
    return "queue";
  } else {
    const success = await guild.play(song);
    return success ? "play" : "error";
  }
}

async function checkIfInVoice(channel, interaction, doReply = true) {
  if (!channel) {
    if (doReply) {
      await interaction.reply("You need to join a voice channel first!");
    }
    return false;
  }
  return true;
}

/* ------- Gen Info Functions ------- */

function genSearchMenu(guild, query, songs, page) {
  const start = page * config.maxPageEntries;
  const end = start + config.maxPageEntries;
  const songShard = songs.slice(start, end);
  const fields = genSongFields(guild, songShard, "search", { start });
  const options = songShard.map((song) => {
    return {
      label: `${limitText(song.title, 30)} (${s2HMS(song.duration)})`,
      value: song.id,
      description: `by ${limitText(song.artist, 50)}`,
    };
  });

  const menu = {
    content: "",
    embeds: [
      {
        title: "Results for: " + query,
        color: Colors.green,
        fields,
        footer: {
          text: `Page ${page + 1} of ${Math.ceil(songs.length / config.maxPageEntries)} | ${
            songs.length
          } results`,
        },
      },
    ],
    components: [
      {
        type: 1,
        components: genMenuPageButtons(
          "s",
          page,
          Math.ceil(songs.length / config.maxPageEntries) - 1
        ),
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
  const start = page * config.maxPageEntries;
  const end = start + config.maxPageEntries;
  const songShard = songs.slice(start, end);
  const fields = genSongFields(guild, songShard, "queue", { start });
  const menu = {
    content: `There ${songs.length != 1 ? "are" : "is"} \`${songs.length} song${
      songs.length != 1 ? "s" : ""
    }\` in the queue.\nTotal duration: \`${s2HMS(
      songs.reduce((acc, song) => acc + song.duration, 0) + guild.currentRemaining
    )}\`.
    `,
    embeds: [
      {
        title: "Queue",
        color: Colors.green,
        fields,
        footer: {
          text: `Page ${page + 1} of ${Math.ceil(songs.length / config.maxPageEntries)} | ${
            songs.length
          } song${songs.length == 1 ? "" : "s"} in queue`,
        },
      },
    ],
    components: [
      {
        type: 1,
        components: genMenuPageButtons(
          "q",
          page,
          Math.ceil(songs.length / config.maxPageEntries) - 1
        ),
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: "Clear Queue",
            emoji: {
              name: "❌",
              animated: false,
            },
            custom_id: "clear_queue",
          },
        ],
      },
    ],
    actions: {},
  };

  return menu;
}

function genMenuPageButtons(type, page, maxPage) {
  var buttons = [];
  buttons = [
    ...buttons,
    {
      type: 2,
      style: 2,
      emoji: {
        name: "⏮",
        animated: false,
      },
      custom_id: `first_${type}_page`,
      disabled: page === 0,
    },
    {
      type: 2,
      style: 2,
      emoji: {
        name: "◀️",
        animated: false,
      },
      custom_id: `prev_${type}_page`,
      disabled: page === 0,
    },
  ];
  if (maxPage + 1 > 2) {
    const middlePage = Math.floor((maxPage + 1) / 2);
    buttons = [
      ...buttons,
      {
        type: 2,
        style: 2,
        emoji: {
          name: "↔️",
          animated: false,
        },
        custom_id: `middle_${type}_page`,
        disabled: page === middlePage,
      },
    ];
  }
  buttons = [
    ...buttons,
    {
      type: 2,
      style: 2,
      emoji: {
        name: "▶️",
        animated: false,
      },
      custom_id: `next_${type}_page`,
      disabled: page === maxPage,
    },
    {
      type: 2,
      style: 2,
      emoji: {
        name: "⏭",
        animated: false,
      },
      custom_id: `last_${type}_page`,
      disabled: page === maxPage,
    },
  ];

  return buttons;
}

function genSongInfoEmbed(guild, song, status) {
  const fields = genSongFields(guild, [song], status == "queue" ? "enqueue" : "search");
  const menu = {
    embeds: [
      {
        color: status == "queue" ? Colors.yellow : Colors.green,
        fields,
        author: {
          name: status == "queue" ? "Added to queue:" : "Now playing:",
        },
      },
    ],
  };

  return menu;
}

function genSongFields(guild, songs, type, options = {}) {
  const fields = songs.map((song, index) => {
    const provider = `Provider: \`${song.serverName}\``;
    /* --------- Queue Additions -------- */
    var position = "";
    var timeUntil = "";
    let timeUntilS = 0;
    if (type == "queue") {
      timeUntilS = guild.currentRemaining;
      position = `**${index + options.start + 1}.**`;
      for (let i = 0; i < index; i++) {
        timeUntilS += songs[i].duration;
      }
    }

    /* -------- Enqueue Additions ------- */
    if (type == "enqueue") {
      timeUntilS = guild.currentRemaining;
      position = `**${guild.queue.length - (songs.length - (index + 1))}.**`;
      for (let i = 0; i < guild.queue.length - (songs.length - index); i++) {
        timeUntilS += guild.queue[i].duration;
      }
    }
    timeUntil = `Plays in \`${s2HMS(timeUntilS)}\``;

    return {
      name: ``,
      value: `${position} **${limitText(song.title, 40)}** | ${s2HMS(song.duration)}
      *${limitText(song.album, 30)}* | *${limitText(song.artist, 30)}*
      ${config.showProvider ? `${provider}` : ""}${
        config.showProvider && (type == "queue" || type == "enqueue") ? " | " : ""
      }${timeUntilS > 0 ? timeUntil : ""}`,
    };
  });
  return fields;
}

/* ------- Misc Text Functions ------ */

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

  console.info(" [DISCORD] Logging out and shutting down...");
  await client.destroy();
  process.exit(0);
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

/* ----------- Bot Startup ---------- */

async function main() {
  const rest = new REST({ version: "10" }).setToken(creds.discord.token);

  // const currentCommands = await rest.get(Routes.applicationCommands(creds.discord.client_id));
  // currentCommands.forEach(async (command) => {
  //   console.info(`${command.name} - ${command.description}`);
  // });

  try {
    console.info(" [DISCORD] Attempt: Reload /commands");

    await rest.put(Routes.applicationCommands(creds.discord.client_id), { body: commands });

    console.info(" [DISCORD] Success: Reload /commands");
  } catch (error) {
    console.error(error);
  }
  client.login(creds.discord.token);
}

main();

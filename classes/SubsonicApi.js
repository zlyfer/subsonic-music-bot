const subsonic = require("subsonicjs");
const md5 = require("md5");

class SubsonicAPI {
  constructor(credentialsArray) {
    this.clients = [];
    const clients = credentialsArray.map(({ username, password, protocol, name, host, port }) => {
      const salt = Math.random().toString(36).substring(2, 15);
      const token = md5(password + salt);
      return {
        client: subsonic(username, token, salt, {
          protocol,
          host,
          port,
          timeout: 30,
          client: "subsonic-music-bot",
          version: "1.16.1",
        }),
        serverName: name,
        hostPort: `${host}${port ? `:${port}` : ""}`,
      };
    });
    const maxHostPortLength = Math.max(...clients.map(({ hostPort }) => hostPort.length));
    const initializeClients = async () => {
      await Promise.all(
        clients.map(async ({ client, hostPort, serverName }) => {
          client.serverName = serverName;
          const ping = await client.system.ping();
          const padding = " ".repeat(maxHostPortLength - hostPort.length);
          const message = `[SUBSONIC] Check server: ${padding}${hostPort} [${
            ping.status !== "ok" ? "not " : ""
          }connected]`;
          console[ping.status === "ok" ? "info" : "error"](message);

          if (ping.status === "ok") {
            this.clients.push(client);
          }
        })
      );
      this.clients.sort((a, b) => a.serverName.localeCompare(b.serverName));
    };
    initializeClients();
  }

  /* ------------ Bookmarks ----------- */
  /* ------------ Browsing ------------ */

  /* -------------- Chat -------------- */
  /* --------- InternetRadio ---------- */
  /* ------------- Jukebox ------------ */
  /* -------------- Media ------------- */

  async getStreamUrlById(song) {
    const { id, serverName } = song;
    const client = this.clients.find((client) => client.serverName === serverName);
    try {
      const result = await client.media.stream({ id });
      if (result) return result;
    } catch (error) {
      console.error(`[SUBSONIC] Failed to get stream URL from server ${client.serverName}:`, error);
    }
  }

  async getCoverById(id) {
    for (const client of this.clients) {
      try {
        const result = await client.media.getCoverArt({ id });
        if (result) return result;
      } catch (error) {
        console.error(
          `[SUBSONIC] Failed to get cover art from server ${client.serverName}:`,
          error
        );
      }
    }
    throw new Error("[SUBSONIC] No servers returned results for getCoverById.");
  }

  /* ------------ Playlists ----------- */
  /* ------------ PlayQueue ----------- */
  /* ------------ Podcasts ------------ */
  /* ------------ Searching ----------- */

  async old_search(query, songCount) {
    const searchPromises = this.clients.map(async (client) => {
      try {
        const result = await client.searching.search2({ query, songCount });
        if (
          result &&
          result.status === "ok" &&
          result.searchResult2.song &&
          result.searchResult2.song.length > 0
        ) {
          const songs = result.searchResult2.song.map((song) => {
            song.serverName = client.serverName;
            return song;
          });
          console.info(`[SUBSONIC] Found results on ${client.serverName} for query: ${query}`);
          return songs;
        } else {
          console.warn(`[SUBSONIC] No results found on ${client.serverName} for query: ${query}`);
          return [];
        }
      } catch (error) {
        console.error(error);
        return [];
      }
    });
    const results = await Promise.all(searchPromises);
    const songs = results.flat().slice(0, songCount);
    if (songs.length > 0) {
      return songs;
    }
    console.warn(`[SUBSONIC] No server returned results for query: ${query}`);
    return [];
  }

  async search(query, songCount) {
    const perClientCount = Math.ceil(songCount / this.clients.length);
    const searchPromises = this.clients.map(async (client) => {
      try {
        const result = await client.searching.search2({ query, songCount: perClientCount });
        if (
          result &&
          result.status === "ok" &&
          result.searchResult2.song &&
          result.searchResult2.song.length > 0
        ) {
          const songs = result.searchResult2.song.map((song) => {
            song.serverName = client.serverName;
            return song;
          });
          console.info(
            `[SUBSONIC] Found ${songs.length} result${songs.length == 1 ? "" : "s"} on ${
              client.serverName
            } for query: ${query}`
          );
          return songs;
        } else {
          console.warn(`[SUBSONIC] No results found on ${client.serverName} for query: ${query}`);
          return [];
        }
      } catch (error) {
        console.error(error);
        return [];
      }
    });
    const results = await Promise.all(searchPromises);
    const songs = results.flat().slice(0, songCount);
    if (songs.length > 0) {
      return songs;
    }
    console.warn(`[SUBSONIC] No server returned results for query: ${query}`);
    return [];
  }

  /* ------------- Sharing ------------ */
  /* ------------- System ------------- */

  async ping(client) {
    return client.system.ping();
  }

  /* -------------- User -------------- */
}

module.exports = SubsonicAPI;

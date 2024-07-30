import subsonic from "subsonicjs";
import md5 from "md5";

class SubsonicApi {
  constructor(c_subsonic) {
    const salt = Math.random().toString(36).substring(2, 15);
    const token = md5(c_subsonic.password + salt);

    this.subsonicClient = subsonic(c_subsonic.username, token, salt, {
      protocol: c_subsonic.protocol,
      host: c_subsonic.host,
      port: c_subsonic.port,
      timeout: 30,
      client: "subsonic-music-bot",
      version: "1.16.1",
    });
  }

  /* ------------ Bookmarks ----------- */
  /* ------------ Browsing ------------ */

  getStarred() {
    return this.subsonicClient.browsing.getStarred({});
  }

  /* -------------- Chat -------------- */
  /* --------- InternetRadio ---------- */
  /* ------------- Jukebox ------------ */
  /* -------------- Media ------------- */

  getStreamUrlById(id) {
    return this.subsonicClient.media.stream({ id });
  }

  /* ------------ Playlists ----------- */
  /* ------------ PlayQueue ----------- */
  /* ------------ Podcasts ------------ */
  /* ------------ Searching ----------- */
  /* ------------- Sharing ------------ */
  /* ------------- System ------------- */
  /* -------------- User -------------- */
}

export default SubsonicApi;

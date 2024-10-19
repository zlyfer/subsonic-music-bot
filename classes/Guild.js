const Player = require("./Player.js");
const { joinVoiceChannel, AudioPlayerStatus } = require("@discordjs/voice");

class Guild {
  constructor(subsonicAPI, config) {
    this.voice = null;
    this.player = new Player(config);
    this.subsonicAPI = subsonicAPI;

    this.menus = {};
    this.history = [];
    this.queue = [];

    this.currentSong = null;
    this.currentRemaining = 0;
    this._currentRemaining = null;
    this._autoLeave = null;

    /* ------------- Events ------------- */

    this.player.player.on(AudioPlayerStatus.Playing, () => {
      console.info("  [PLAYER] has started playing!");
    });

    this.player.player.on(AudioPlayerStatus.Paused, () => {
      console.info("  [PLAYER] has been paused.");
    });

    this.player.player.on(AudioPlayerStatus.AutoPaused, () => {
      console.info("  [PLAYER] has been automatically paused.");
    });

    this.player.player.on(AudioPlayerStatus.Idle, () => {
      console.info("  [PLAYER] is idle.");
      if (this._currentRemaining && this.currentRemaining != 0) {
        console.warn("  [SYSTEM] Player seems to have crashed or failed to buffer.");
      }
    });

    this.player.player.on(AudioPlayerStatus.Buffering, () => {
      console.info("  [PLAYER] is buffering.");
    });

    this.player.player.on("error", (error) => {
      console.error(error);
    });
  }

  /* ------------- Player ------------- */

  async play(song) {
    if (this.voice) {
      const streamUrl = await this.subsonicAPI.getStreamUrlById(song);
      clearTimeout(this._autoLeave);
      this.currentSong = song;
      this.currentRemaining = song.duration;
      this.setupCRemainingInterval();
      this.history.unshift(song);
      const success = await this.player.play(streamUrl);
      if (success) {
        this.voice.subscribe(this.player.player);
      }
      return success;
    } else {
      return false;
    }
  }

  continue() {
    if (this.currentSong) {
      this.setupCRemainingInterval();
      this.player.continue();
    } else {
      this.skip();
    }
  }

  pause() {
    clearInterval(this._currentRemaining);
    this.player.pause();
  }

  stop() {
    clearInterval(this._currentRemaining);
    this._currentRemaining = null;
    this.currentSong = null;
    this.currentRemaining = 0;
    this.player.stop();
  }

  async skip() {
    this.stop();
    if (this.queue.length === 0) {
      // this.autoLeave();
      return { status: "empty" };
    }

    const song = this.queue.shift();
    const status = await this.play(song);
    return { status: status ? "play" : "error", song };
  }

  queueSong(song) {
    this.queue.push(song);
  }

  /* -------------- Voice ------------- */

  setupCRemainingInterval() {
    clearInterval(this._currentRemaining);
    this._currentRemaining = setInterval(() => {
      this.currentRemaining -= 1;
      if (this.currentRemaining <= 0) {
        clearInterval(this._currentRemaining);
        this.skip();
      }
    }, 1000);
  }

  autoLeave(seconds = 60) {
    clearTimeout(this._autoLeave);
    this._autoLeave = setTimeout(() => {
      this.leaveVoice();
    }, seconds * 1000);
  }

  joinVoice(channel) {
    if (this.voice) {
      if (channel && this.voice.joinConfig.channelId === channel.id) {
        return;
      }
      this.leaveVoice(channel);
    }

    console.info(" [DISCORD] Joining voice channel...");
    this.voice = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });
  }

  leaveVoice() {
    if (this.voice) {
      console.info(" [DISCORD] Leaving voice channel...");
      this.voice.destroy();
      this.voice = null;
    }
  }
}

module.exports = Guild;

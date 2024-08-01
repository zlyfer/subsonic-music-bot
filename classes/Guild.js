const Player = require("./Player.js");
const { joinVoiceChannel, AudioPlayerStatus } = require("@discordjs/voice");

class Guild {
  constructor(subsonicApi) {
    this.voice = null;
    this.player = new Player();
    this.subsonicApi = subsonicApi;

    this.menus = {};
    this.history = [];
    this.queue = [];

    this.currentSong = null;
    this.currentRemaining = 0;
    this._currentRemaining = null;
    this._autoLeave = null;

    /* ------------- Events ------------- */

    this.player.player.on(AudioPlayerStatus.Playing, () => {
      console.info("[AUDIO PLAYER] has started playing!");
    });

    this.player.player.on(AudioPlayerStatus.Paused, () => {
      console.info("[AUDIO PLAYER] has been paused.");
    });

    this.player.player.on(AudioPlayerStatus.AutoPaused, () => {
      console.info("[AUDIO PLAYER] has been automatically paused.");
    });

    this.player.player.on(AudioPlayerStatus.Idle, () => {
      console.info("[AUDIO PLAYER] is idle.");
    });

    this.player.player.on(AudioPlayerStatus.Buffering, () => {
      console.info("[AUDIO PLAYER] is buffering.");
    });

    this.player.player.on("error", (error) => {
      console.error("Error playing audio:", error);
    });
  }

  /* ------------- Player ------------- */

  async play(song) {
    if (this.voice) {
      clearTimeout(this._autoLeave);
      this.currentSong = song;
      this.currentRemaining = song.duration;
      const streamUrl = await this.subsonicApi.getStreamUrlById(song.id);
      this.setupCRemainingInterval();
      this.history.unshift(song);
      this.player.play(streamUrl);
      this.voice.subscribe(this.player.player);
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
    this.currentSong = null;
    this.currentRemaining = 0;
    clearInterval(this._currentRemaining);
    this.player.stop();
  }

  skip() {
    this.stop();
    if (this.queue.length === 0) {
      // this.autoLeave();
      return false;
    }

    const song = this.queue.shift();
    this.play(song);
    return song;
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

    console.info("Joining voice channel...");
    this.voice = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });
  }

  leaveVoice() {
    console.info("Leaving voice channel...");
    if (this.voice) {
      this.voice.destroy();
      this.voice = null;
    }
  }
}

module.exports = Guild;

import Player from "./Player.js";
import { joinVoiceChannel, AudioPlayerStatus } from "@discordjs/voice";

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
      clearInterval(this._currentRemaining);
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
      const streamUrl = await this.subsonicApi.getStreamUrlById(song.id);
      this.currentSong = song;
      this.currentRemaining = song.duration;
      if (this._currentRemaining) {
        clearInterval(this._currentRemaining);
      }
      this._currentRemaining = setInterval(() => {
        this.currentRemaining -= 1;
      }, 1000);

      this.history.unshift(song);
      this.player.play(streamUrl);
      this.voice.subscribe(this.player.player);
    }
  }

  continue() {
    this.player.continue();
  }

  pause() {
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
    this.play(this.queue.shift());
  }

  isPlaying() {
    return this.player.player.state.status === AudioPlayerStatus.Playing;
  }

  queueSong(song) {
    this.queue.push(song);
  }

  /* -------------- Voice ------------- */

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
    this.voice.destroy();
    this.voice = null;
  }
}

export default Guild;

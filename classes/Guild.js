import Player from "./Player.js";
import { joinVoiceChannel } from "@discordjs/voice";

class Guild {
  constructor() {
    this.voice = null;
    this.player = new Player();
    this.menus = {};
  }

  /* ------------- Player ------------- */

  play(url) {
    if (this.voice) {
      this.player.play(url);
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
    this.player.stop();
  }

  /* -------------- Voice ------------- */

  joinVoice(channel) {
    this.leaveVoice();

    console.info("Joining voice channel...");
    this.voice = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });
  }

  leaveVoice() {
    if (this.voice) {
      console.info("Leaving voice channel...");

      this.voice.destroy();
      this.voice = null;
    }
  }
}

export default Guild;

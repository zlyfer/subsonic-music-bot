const { createAudioPlayer, createAudioResource } = require("@discordjs/voice");
const { Readable } = require("stream");
const axios = require("axios");

class Player {
  constructor(config) {
    this.player = createAudioPlayer();
    this.buffertime = config.bufferTime;
    this.volume = config.volume / 1000;
  }

  async play(url) {
    try {
      const response = await axios.get(url, { responseType: "stream" });
      const resource = createAudioResource(Readable.from(response.data), {
        inlineVolume: true,
        inputType: "arbitrary",
        bufferingTime: this.buffertime,
      });
      resource.volume.setVolume(this.volume);
      this.player.play(resource);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  continue() {
    this.player.unpause();
  }

  pause() {
    this.player.pause();
  }

  stop() {
    this.player.stop();
  }
}

module.exports = Player;

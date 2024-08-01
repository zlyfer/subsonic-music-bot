const { createAudioPlayer, createAudioResource } = require("@discordjs/voice");
const { Readable } = require("stream");
const axios = require("axios");

class Player {
  constructor() {
    this.player = createAudioPlayer();
  }

  async play(url) {
    console.debug(`url:`, url);
    try {
      const response = await axios.get(url, { responseType: "stream" });
      const resource = createAudioResource(Readable.from(response.data), {
        inlineVolume: true,
        inputType: "arbitrary",
        bufferingTime: 10000,
      });
      resource.volume.setVolume(0.1);
      this.player.play(resource);
    } catch (error) {
      console.error(`${error.message}`, error);
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

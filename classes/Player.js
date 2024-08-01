const { createAudioPlayer, createAudioResource } = require("@discordjs/voice");

class Player {
  constructor() {
    this.player = createAudioPlayer();
  }

  play(url) {
    console.debug(`url:`, url);
    const resource = createAudioResource(url, { inlineVolume: true });
    resource.volume.setVolume(0.1);
    this.player.play(resource);
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

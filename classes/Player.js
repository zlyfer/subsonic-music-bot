import { createAudioPlayer, createAudioResource, AudioPlayerStatus } from "@discordjs/voice";

class Player {
  constructor() {
    this.player = createAudioPlayer();

    /* ------------- Events ------------- */

    this.player.on(AudioPlayerStatus.Playing, () => {
      console.log("The audio player has started playing!");
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      console.log("The audio player is idle.");
    });

    this.player.on(AudioPlayerStatus.Buffering, () => {
      console.log("The audio player is buffering.");
    });

    this.player.on("error", (error) => {
      console.error("Error playing audio:", error);
    });
  }

  play(url) {
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

export default Player;

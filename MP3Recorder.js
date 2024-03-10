class MP3Recorder {
  constructor(track) {
    const { readable, writable } = new TransformStream({}, {}, {
      highWaterMark: Infinity,
    });
    Object.assign(this, {
      readable,
      writable,
      track,
    });
    this.writer = this.writable.getWriter();
    this.track.onended = (e) => console.log(e);
    this.processor = new MediaStreamTrackProcessor({
      track: this.track,
    });
    return (async () => {
      const dir = await navigator.storage.getDirectory();
      const entries = await Array.fromAsync(dir.keys());
      let handle;
      if (!entries.includes("lames.js")) {
        handle = await dir.getFileHandle("lame.js", {
          create: true,
        });
        await new Blob([
          await (await fetch(
            "https://raw.githubusercontent.com/guest271314/captureSystemAudio/master/native_messaging/capture_system_audio/lame.min.js",
          )).arrayBuffer(),
        ], {
          type: "text/javascript",
        }).stream().pipeTo(await handle.createWritable());
      } else {
        handle = await dir.getFileHandle("lame.js", {
          create: false,
        });
      }
      const file = await handle.getFile();
      const url = URL.createObjectURL(file);
      const { lamejs } = await import(url);
      this.mp3encoder = new lamejs.Mp3Encoder(2, 44100, 192);
      return this;
    })();
  }
  async start() {
    try {
      this.processor.readable.pipeTo(
        new WritableStream({
          write: async (frame, controller) => {
            // https://github.com/zhuker/lamejs/commit/e18447fefc4b581e33a89bd6a51a4fbf1b3e1660
            const channels = Array.from({
              length: frame.numberOfChannels,
            }, (_, planeIndex) => {
              const size = frame.allocationSize({
                planeIndex,
              });
              const buffer = new ArrayBuffer(size);
              frame.copyTo(buffer, {
                planeIndex,
              });
              return new Int32Array(
                [...new Float32Array(buffer)].map((float) =>
                  float < 0 ? float * 32768 : float * 32767
                ),
              );
            });
            const mp3buffer = this.mp3encoder.encodeBuffer(...channels);
            if (mp3buffer.length > 0) {
              try {
                await this.writer.ready;
                await this.writer.write(new Uint8Array(mp3buffer));
              } catch (e) {
                console.error(e);
              }
            }
          },
        }),
      );
    } catch (e) {
      console.error(e);
    }

    return this.track;
  }
  async stop(e) {
    if (this.track.readyState === "live") {
      this.track.stop();
    }

    const mp3buffer = this.mp3encoder.flush();
    if (mp3buffer.length > 0) {
      try {
        await this.writer.ready;
        await this.writer.write(new Uint8Array(mp3buffer));
      } catch (e) {
        console.error(e);
      }
    }
    await this.writer.close();
    try {
      const blob = new Blob([await new Response(this.readable).arrayBuffer()], {
        type: "audio/mp3",
      });
      return blob;
    } catch (e) {
      throw e;
    }
  }
}

export { MP3Recorder };

// https://www.iis.fraunhofer.de/en/ff/amm/consumer-electronics/mp3.html
// https://www.audioblog.iis.fraunhofer.com/mp3-software-patents-licenses
class MP3Recorder {
  constructor(audioTrack) {
    (async () => {
      let dir = await navigator.storage.getDirectory();
      let handle;
      try {
        handle = await dir.getFileHandle("lame.js", {
          create: false,
        });
      } catch (e) {
        console.log(e);
      } finally {
        if (!handle) {
          handle = await dir.getFileHandle("lame.js", {
            create: true,
          });
          new Blob([
            await (await fetch(
              "https://raw.githubusercontent.com/guest271314/captureSystemAudio/master/native_messaging/capture_system_audio/lame.min.js",
            )).arrayBuffer(),
          ], {
            type: "text/javascript",
          }).stream().pipeTo(await handle.createWritable());
        }
      }
      const file = await handle.getFile();
      const url = URL.createObjectURL(file);
      const { lamejs } = await import(url);

      this.mp3encoder = new lamejs.Mp3Encoder(2, 44100, 128);
    })();
    const { readable, writable } = new TransformStream({}, {}, {
      highWaterMark: Infinity,
    });
    Object.assign(this, {
      readable,
      writable,
      audioTrack,
    });
    this.writer = this.writable.getWriter();
    const processor = `class AudioWorkletStream extends AudioWorkletProcessor {
        process(inputs, outputs) {
          this.port.postMessage(inputs.flat());
          return true;
        }
      };
      registerProcessor(
        "audio-worklet-stream",
        AudioWorkletStream
      )`;
    this.worklet = URL.createObjectURL(
      new Blob([processor], {
        type: "text/javascript",
      }),
    );
    this.ac = new AudioContext({
      latencyHint: 0,
      sampleRate: 44100,
      numberOfChannels: 2,
    });
    const { resolve, promise } = Promise.withResolvers();
    this.promise = promise;
    this.ac.onstatechange = async (e) => {
      if (this.ac.state === "closed") {
        const mp3buffer = this.mp3encoder.flush();
        if (mp3buffer.length > 0) {
          try {
            await this.writer.ready;
            await this.writer.write(new Uint8Array(mp3buffer));
            await this.writer.close();
          } catch (e) {
            console.log(e);
          }
        }
        const blob = new Blob(
          [await new Response(this.readable).arrayBuffer()],
          {
            type: "audio/mp3",
          },
        );
        resolve(blob);
      }
    };
    return this.ac.suspend().then(() =>
      this.ac.audioWorklet.addModule(this.worklet).then(() => {
        this.aw = new AudioWorkletNode(this.ac, "audio-worklet-stream", {
          numberOfInputs: 1,
          numberOfOutputs: 2,
          outputChannelCount: [2, 2],
        });
        this.aw.onprocessorerror = (e) => {
          console.error(e);
          console.trace();
        };
        this.aw.port.onmessage = async (e) => {
          const channels = e.data;
          const left = channels.shift();
          const right = channels.shift();
          let leftChannel, rightChannel;
          // https://github.com/zhuker/lamejs/commit/e18447fefc4b581e33a89bd6a51a4fbf1b3e1660
          leftChannel = new Int32Array(left.length);
          rightChannel = new Int32Array(right.length);
          for (let i = 0; i < left.length; i++) {
            leftChannel[i] = left[i] < 0 ? left[i] * 32768 : left[i] * 32767;
            rightChannel[i] = right[i] < 0
              ? right[i] * 32768
              : right[i] * 32767;
          }
          const mp3buffer = this.mp3encoder.encodeBuffer(
            leftChannel,
            rightChannel,
          );
          if (mp3buffer.length > 0) {
            try {
              await this.writer.ready;
              await this.writer.write(new Uint8Array(mp3buffer));
            } catch (e) {
              console.error(e, this.ac.state);
              this.aw.port.close();
              this.aw.port.onmessage = null;
            }
          }
        };
        this.msasn = new MediaStreamAudioSourceNode(this.ac, {
          mediaStream: new MediaStream([this.audioTrack]),
        });
        this.msasn.connect(this.aw);
        return this;
      })
    );
  }
  async start() {
    await this.ac.resume();
    return this.audioTrack;
  }
  async stop() {
    this.audioTrack.stop();
    if (this.ac.state === "running") {
      this.msasn.disconnect();
      this.aw.disconnect();
      await this.ac.close();
      return this.promise;
    }
  }
}

export { MP3Recorder };

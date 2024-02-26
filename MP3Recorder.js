// https://www.iis.fraunhofer.de/en/ff/amm/consumer-electronics/mp3.html
// https://www.audioblog.iis.fraunhofer.com/mp3-software-patents-licenses
class MP3Recorder {
  constructor(audioTrack) {
    const { readable, writable } = new TransformStream({}, {}, {
      highWaterMark: Infinity,
    });
    Object.assign(this, {
      readable,
      writable,
      audioTrack,
    });
    this.writer = this.writable.getWriter();
    this.audioTrack.onended = (e) => this.stop(e);
    const processor = `
const channels = [
  [],
  []
];
class AudioWorkletStream extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const floats = inputs.flat();
    // Accumulate ~1 second of audio to decrease postMessage() calls
    if (channels[0].length < 128 * 344) {
      channels[0].push(...floats[0]);
      channels[1].push(...floats[1]);
      if (channels[0].length === 128 * 344) {
        this.port.postMessage(channels);
        channels[0].length = channels[1].length = 0;
      }
    }
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
      console.log(e.target.state);
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
        if (globalThis.gc) {
          gc();
        }
      }
    };
    return this.ac.suspend().then(async () => {
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

      this.mp3encoder = new lamejs.Mp3Encoder(2, 44100, 128);
      await this.ac.audioWorklet.addModule(this.worklet);
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
          rightChannel[i] = right[i] < 0 ? right[i] * 32768 : right[i] * 32767;
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
          } finally {
            if (globalThis.gc) {
              gc();
            }
          }
        }
      };
      this.msasn = new MediaStreamAudioSourceNode(this.ac, {
        mediaStream: new MediaStream([this.audioTrack]),
      });
      this.msasn.connect(this.aw);
      return this;
    });
  }
  async start() {
    await this.ac.resume();
    return this.audioTrack;
  }
  async stop(e) {
    if (e?.type === "ended" || this.audioTrack.readyState === "live") {
      this.audioTrack.stop();
      this.msasn.disconnect();
      this.aw.disconnect();
      this.aw.port.close();
      this.aw.port.onmessage = null;
      await this.ac.close();
    }
    return this.promise;
  }
}

export { MP3Recorder };

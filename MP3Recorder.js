// https://www.iis.fraunhofer.de/en/ff/amm/consumer-electronics/mp3.html
// https://www.audioblog.iis.fraunhofer.com/mp3-software-patents-licenses
class MP3Recorder {
  constructor(audioTrack) {
    this.audioTrack = audioTrack;
    this.writer = this.writable.getWriter();
    this.audioTrack.onended = this.stop.bind(this);

    this.ac = new AudioContext({
      latencyHint: .2,
      sampleRate: 44100,
      numberOfChannels: 2,
    });

    const {
      resolve,
      promise
    } = Promise.withResolvers();
    this.promise = promise;
    this.resolve = resolve;
    this.ac.onstatechange = async (e) => {
      console.log(e.target.state);
    };
    return this.ac.suspend().then(async () => {
      const dir = await navigator.storage.getDirectory();
      const entries = await Array.fromAsync(dir.keys());
      let handle;
      if (!entries.includes("lames.js")) {
        handle = await dir.getFileHandle("lame.js", {
          create: true,
        });
        await new Blob([await (await fetch("https://raw.githubusercontent.com/guest271314/captureSystemAudio/master/native_messaging/capture_system_audio/lame.min.js", )).arrayBuffer(), ], {
          type: "text/javascript",
        }).stream().pipeTo(await handle.createWritable());
      } else {
        handle = await dir.getFileHandle("lame.js", {
          create: false,
        });
      }
      const file = await handle.getFile();
      //const url = URL.createObjectURL(file);
      const lamejs = await file.text();
      // const {lamejs} = await import(url);
      const processor = `${lamejs}
class AudioWorkletStream extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.mp3encoder = new lamejs.Mp3Encoder(2, 44100, 128);
    this.done = false;
    this.transferred = false;
    this.controller = void 0;
    this.readable = new ReadableStream({
      start: (c) => {
        return this.controller = c;
      }
    });
    this.port.onmessage = (e) => {
      this.done = true;
    }
  }
  write(channels) {
    const [left, right] = channels;
    let leftChannel, rightChannel;
    // https://github.com/zhuker/lamejs/commit/e18447fefc4b581e33a89bd6a51a4fbf1b3e1660
    leftChannel = new Int32Array(left.length);
    rightChannel = new Int32Array(right.length);
    for (let i = 0; i < left.length; i++) {
      leftChannel[i] = left[i] < 0 ? left[i] * 32768 : left[i] * 32767;
      rightChannel[i] = right[i] < 0 ? right[i] * 32768 : right[i] * 32767;
    }
    const mp3buffer = this.mp3encoder.encodeBuffer(leftChannel, rightChannel);
    if (mp3buffer.length > 0) {
      this.controller.enqueue(new Uint8Array(mp3buffer));
    }
  }
  process(inputs, outputs) {
    if (this.done) {
      try {
      this.write(inputs.flat());
      const mp3buffer = this.mp3encoder.flush();
      if (mp3buffer.length > 0) {
        this.controller.enqueue(new Uint8Array(mp3buffer));
        this.controller.close();
        this.port.postMessage(this.readable, [this.readable]);
        this.port.close();
        return false;
      }
      } catch (e) {
        this.port.close();
        return false;
      }
    }
    this.write(inputs.flat());
    return true;
  }
};
registerProcessor(
  "audio-worklet-stream",
  AudioWorkletStream
)`;
      this.worklet = URL.createObjectURL(new Blob([processor], {
        type: "text/javascript",
      }));
      // this.mp3encoder = new lamejs.Mp3Encoder(2,44100,128);
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
        console.log(e.data);
        if (e.data instanceof ReadableStream) {
          const blob = new Blob([await new Response(e.data).arrayBuffer()], {
            type: "audio/mp3",
          });
          this.resolve(blob);
          console.log(blob);
          this.audioTrack.stop();
          this.msasn.disconnect();
          this.aw.disconnect();
          this.aw.port.close();
          this.aw.port.onmessage = null;
          await this.ac.close();
        }
      };
      this.msasn = new MediaStreamAudioSourceNode(this.ac, {
        mediaStream: new MediaStream([this.audioTrack]),
      })
      this.msasn.connect(this.aw);
      return this;
    }).catch(e => console.log(e));
  }
  async start() {
    return this.ac.resume().then(() => this.audioTrack).catch(e => console.log(e));
  }
  async stop(e) {
    this.aw.port.postMessage(null);
    return this.promise;
  }
}

export { MP3Recorder };

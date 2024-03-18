class MP3Recorder {
  constructor(track) {
    let controller;
    const readable = new ReadableStream({
      start(_) {
        return controller = _;
      }
    }).pipeThrough(new TransformStream({
      transform(value, c) {
        c.enqueue(value);
      },
      flush: ()=>{
        console.log("flush", this.controller.desiredSize);
      }
    }));
    Object.assign(this, {
      readable,
      controller,
      track,
    });
    this.track.onended = (e)=>console.log(e);
    this.processor = new MediaStreamTrackProcessor({
      track: this.track,
    });
    return (async()=>{
      const dir = await navigator.storage.getDirectory();
      const entries = await Array.fromAsync(dir.keys());
      let handle;
      if (!entries.includes("mp3.min.js")) {
        handle = await dir.getFileHandle("mp3.min.js", {
          create: true,
        });
        await new Blob([await (await fetch("https://raw.githubusercontent.com/guest271314/MP3Recorder/main/mp3.min.js", )).arrayBuffer(), ],{
          type: "application/wasm",
        }).stream().pipeTo(await handle.createWritable());
      } else {
        handle = await dir.getFileHandle("mp3.min.js", {
          create: false,
        });
      }
      const file = await handle.getFile();
      const url = URL.createObjectURL(file);
      const {instantiate} = await import(url);
      this.Encoder = await instantiate();
      this.encoder = this.Encoder.create({
        numChannels: 2,
        sampleRate: 44100,
        samples: 2048,
      });
      return this;
    }
    )();
  }
  async start() {
    try {
      this.processor.readable.pipeTo(new WritableStream({
        write: async(frame,controller)=>{
          const channels = Array.from({
            length: frame.numberOfChannels,
          }, (_,planeIndex)=>{
            const size = frame.allocationSize({
              planeIndex,
            });
            const buffer = new ArrayBuffer(size);
            frame.copyTo(buffer, {
              planeIndex,
            });
            return new Float32Array(buffer);
          }
          );
          this.controller.enqueue(this.encoder.encode(...channels));
        }
        ,
      }));
    } catch (e) {
      console.error(e);
    }

    return this.track;
  }
  async stop(e) {
    this.encoder.close();
    console.log(this.controller.desiredSize);
    this.controller.close();
    if (this.track.readyState === "live") {
      this.track.stop();
    }
    try {
      const blob = new Blob([await new Response(this.readable).arrayBuffer()],{
        type: "audio/mp3",
      });
      return blob;
    } catch (e) {
      throw e;
    }
  }
}

export { MP3Recorder };

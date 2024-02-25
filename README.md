### MP3Recorder
Record `MediaStreamTrack` to MP3 file in the browser

#### Usage

```
let recorder = await new MP3Recorder(mediaStream.getAudioTracks()[0]);
await recorder.start();
let blob = await recorder.stop();
```

#### Dependencies
[Ecmascript Module version](https://raw.githubusercontent.com/guest271314/captureSystemAudio/master/native_messaging/capture_system_audio/lame.min.js) of [lamejs](https://github.com/zhuker/lamejs/).

#### MP3 (license) references
- https://www.iis.fraunhofer.de/en/ff/amm/consumer-electronics/mp3.html
- https://www.audioblog.iis.fraunhofer.com/mp3-software-patents-licenses

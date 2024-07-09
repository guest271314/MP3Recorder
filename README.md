### MP3Recorder
Record `MediaStreamTrack` to MP3 file in the browser

#### Usage

```
let recorder = await new MP3Recorder(mediaStream.getAudioTracks()[0]);
await recorder.start();
let blob = await recorder.stop();
```

#### Dependencies
[mp3](https://github.com/etercast/mp3).

#### MP3 (license) references
- https://www.iis.fraunhofer.de/en/ff/amm/consumer-electronics/mp3.html
- https://www.audioblog.iis.fraunhofer.com/mp3-software-patents-licenses

#### License
Do What the Fuck You Want to Public License [WTFPLv2](http://www.wtfpl.net/about/)

### MP3Recorder
Record `MediaStreamTrack` to MP3 file in the browser

#### Usage

```
var stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 2,
    sampleRate: 44100,
    noiseSuppression: false,
    autoGainControl: false,
    echoCancellation: false,
  }
});
var [audioTrack] = stream.getAudioTracks();

var recorder = await new MP3Recorder(audioTrack);
var start = await recorder.start();
```
```
recorder.stop().then(async(blob) => {
  console.log(URL.createObjectURL(blob));
  var handle = await showSaveFilePicker({
    suggestedName: "download.mp3",
    startIn:'music'
  });
  blob.stream().pipeTo(await handle.createWritable())
}).catch(console.error);
```

#### Dependencies
[mp3](https://github.com/etercast/mp3).

#### MP3 (license) references
- https://www.iis.fraunhofer.de/en/ff/amm/consumer-electronics/mp3.html
- https://www.audioblog.iis.fraunhofer.com/mp3-software-patents-licenses

#### License
Do What the Fuck You Want to Public License [WTFPLv2](http://www.wtfpl.net/about/)

Stream Deck Browser
===

This is an Electron-based app that renders any webpage on an Elgato Stream Deck and treats button presses on the Stream Deck as mouse clicks in the center of the button. Should be compatible with all Stream Deck models.

```
stream-deck-browser [OPTIONS]

Options:
  -v, --version      output the version number
  -u, --url          Open URL in Stream Deck browser
  -l, --listDevices  List all Stream Deck devices
  -d, --device       Connect to a device with a given serial number
  --showWindow   Show rendering window
  --inspect          Show Developer Tools
  -h, --help         output usage information
```

Uses [node-elgato-stream-deck](https://github.com/Lange/node-elgato-stream-deck) to communicate with the StreamDeck devices.

Based on [ElectronReactTypescript boilerplate](https://github.com/iRath96/electron-react-typescript-boilerplate).
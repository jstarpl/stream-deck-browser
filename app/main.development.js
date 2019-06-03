const { app, BrowserWindow, Menu, shell, nativeImage, Tray } = require('electron');
const { getStreamDeckInfo, listStreamDecks, openStreamDeck } = require('elgato-stream-deck');
const commander = require('commander');
var path = require('path');

let menu;
let template;
let mainWindow = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support'); // eslint-disable-line
  sourceMapSupport.install();
}

if (process.env.NODE_ENV === 'development') {
  require('electron-debug')(); // eslint-disable-line global-require
  const path = require('path'); // eslint-disable-line
  const p = path.join(__dirname, '..', 'app', 'node_modules'); // eslint-disable-line
  require('module').globalPaths.push(p); // eslint-disable-line
}

commander
  .version('0.0.1', '-v, --version')
  .usage('[OPTIONS]...')
  .option('-u, --url', 'Open URL in Stream Deck browser')
  .option('-s, --showWindow', 'Show rendering window')
  .option('-l, --listDevices', 'List all Stream Deck devices')
  .option('-d, --device', 'Connect to a device with a given serial number')
  .option('--inspect', 'Show Developer Tools')

if (process.defaultApp != true) {
  process.argv.unshift(null)
}

commander.parse(process.argv)

const url = commander.url || 'http://news.google.com/';
const showWindow = !!commander.showWindow || false;
const inspect = !!commander.inspect || false;
const listDevices = !!commander.listDevices || false;
const deviceSerial = commander.device || undefined;

app.disableHardwareAcceleration();

app.once('ready', () => {
  const list = listStreamDecks();
  if (list.length === 0) {
    console.log('No StreamDeck found');
    app.quit();
  }
  if (listDevices) {
    console.log(JSON.stringify(list, undefined, 2))
    app.quit();
  }
  let devicePath = undefined;
  if (deviceSerial) {
    const device = list.find(i => i.serialNumber === deviceSerial)
    if (device) devicePath = device.path;
  }
  
  const deck = openStreamDeck(devicePath || list[0].path);

  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Quit', type: 'normal', click: () => {
      app.quit();
    } }
  ])
  tray.setToolTip(`Stream Deck Browser: ${deck.MODEL} ${deck.getSerialNumber()}`);
  tray.setContextMenu(contextMenu);
  
  console.error('Connected to StreamDeck')
  
  deck.clearAllKeys();
  
  const PANEL_HEIGHT = (deck.KEY_ROWS * deck.ICON_SIZE);
  const PANEL_WIDTH = (deck.KEY_COLUMNS * deck.ICON_SIZE);

  
  const STRIDE_BROWSER = 4
  const STRIDE_DECK = 3
  const frame = Buffer.alloc(PANEL_WIDTH * PANEL_HEIGHT * STRIDE_DECK);
  console.log('width', PANEL_WIDTH, 'height', PANEL_HEIGHT, PANEL_WIDTH * PANEL_HEIGHT * STRIDE_DECK)

  function copyBGRAtoRGB(source, target, targetStart, sourceStart, count) {
    let i = 0;
    for (i = 0; i < count; i++) {
      target[(targetStart + i) * STRIDE_DECK + 0] = source[(sourceStart + i) * STRIDE_BROWSER + 2]
      target[(targetStart + i) * STRIDE_DECK + 1] = source[(sourceStart + i) * STRIDE_BROWSER + 1]
      target[(targetStart + i) * STRIDE_DECK + 2] = source[(sourceStart + i) * STRIDE_BROWSER + 0]
    }
  }
  
  function updateBitmap(rect, image) {
    // console.log('Update');
    const bmp = image.getBitmap ? image.getBitmap() : image;
    // console.log(bmp.length)
    const maxHeight = Math.min(rect.height, (PANEL_HEIGHT - rect.y));
    const maxWidth = Math.min(rect.width, (PANEL_WIDTH - rect.x));
    for (let i = 0; i < maxHeight; i++) {
      const targetStart = ((rect.y + i) * PANEL_WIDTH + rect.x);
      const sourceStart = (i * rect.width);
      copyBGRAtoRGB(bmp, frame, targetStart, sourceStart, maxWidth);
    }
    deck.fillPanel(frame);
  }

  function keyIndexToXY(keyIndex) {
    const y = (Math.floor(keyIndex / deck.KEY_COLUMNS) + 0.5) * deck.ICON_SIZE 
    const x = (keyIndex % deck.KEY_COLUMNS + 0.5) * deck.ICON_SIZE
    return { x, y }
  }

  let window = new BrowserWindow({
    webPreferences: {
      resizable: false,
      enableRemoteModule: true,
      backgroundThrottling: false,
      nodeIntegration: true,
    },
    show: false,
    autoHideMenuBar: true,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    frame: false,
    titleBarStyle: 'customButtonsOnHover', 
  });

  window.loadURL(url);
  if (inspect) window.webContents.toggleDevTools();
  window.once('ready-to-show', () => {
    if (showWindow) window.show();
    console.log('Ready to Show');
    console.log(window.getSize());
    window.setSize(PANEL_WIDTH, PANEL_HEIGHT);
    console.log(window.getSize());
  })
  window.once('closed', () => {
    window = null;
    deck.resetToLogo();
  })
  window.webContents.setFrameRate(4);
  window.webContents.once('dom-ready', () => {
    const requestSize = { x: 0, y: 0, width: PANEL_WIDTH, height: PANEL_HEIGHT };
    
    window.webContents.capturePage(requestSize, (image) => {
      // console.log('Captured!');
      const imgSize = image.getSize();
      // console.log(imgSize)
      updateBitmap({ x: 0, y: 0, width: imgSize.width, height: imgSize.height }, image);
    });

    window.webContents.beginFrameSubscription(true, (image, dirtyRect) => {
      updateBitmap(dirtyRect, image);
    });

    deck.on('down', (keyIndex) => {
      const { x, y } = keyIndexToXY(keyIndex);
      window.webContents.sendInputEvent({
        type: 'mouseMove',
        x,
        y
      });
      window.webContents.sendInputEvent({
        type: 'mouseDown',
        x,
        y,
        button: 'left',
        clickCount: 1
      });
    });

    deck.on('up', (keyIndex) => {
      const { x, y } = keyIndexToXY(keyIndex);
      window.webContents.sendInputEvent({
        type: 'mouseUp',
        modifiers: ['isKeypad'],
        x,
        y,
        button: 'left',
        clickCount: 1
      });
    });
  });

  deck.on('error', error => {
    console.error(error);
  })
});

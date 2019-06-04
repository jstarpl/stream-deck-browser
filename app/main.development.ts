import { app, BrowserWindow, Menu, nativeImage, Tray, NativeImage } from "electron"
import { listStreamDecks, openStreamDeck } from 'elgato-stream-deck'
import * as commander from 'commander'
import * as path from 'path'

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support') // eslint-disable-line
  sourceMapSupport.install()
}

if (process.env.NODE_ENV === 'development') {
  require('electron-debug')() // eslint-disable-line global-require
  const path = require('path') // eslint-disable-line
  const p = path.join(__dirname, '..', 'app', 'node_modules') // eslint-disable-line
  require('module').globalPaths.push(p) // eslint-disable-line
}

commander
  .version('0.0.1', '-v, --version')
  .usage('[OPTIONS]...')
  .option('-u, --url <url>', 'Open URL in Stream Deck browser')
  .option('-l, --listDevices', 'List all Stream Deck devices')
  .option('-d, --device <device>', 'Connect to a device with a given serial number')
  .option('--showWindow', 'Show rendering window')
  .option('--inspect', 'Show Developer Tools')

if (process.defaultApp != true) {
  process.argv.unshift('')
}

commander.parse(process.argv)

const url = commander.url || 'http://jeromeetienne.github.io/fireworks.js/examples/cloud/cloud_cluster.html'
const showWindow = !!commander.showWindow || false
const inspect = !!commander.inspect || false
const listDevices = !!commander.listDevices || false
const deviceSerial = commander.device || undefined

app.disableHardwareAcceleration()

app.once('ready', () => {
  const list = listStreamDecks()
  if (list.length === 0) {
    console.log('No Stream Deck found')
    app.quit()
  }
  if (listDevices) {
    console.log(JSON.stringify(list, undefined, 2))
    app.quit()
  }
  let devicePath = undefined
  if (deviceSerial) {
    const device = list.find(i => i.serialNumber === deviceSerial)
    if (device) devicePath = device.path
  }
  
  const deck = openStreamDeck(devicePath || list[0].path)

  const tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')))
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Quit', type: 'normal', click: () => {
      app.quit()
    } }
  ])
  tray.setToolTip(`Stream Deck Browser: ${deck.MODEL} ${deck.getSerialNumber()}`);
  tray.setContextMenu(contextMenu)
  
  console.log(`Connected to Stream Deck, Model: ${deck.MODEL}, S/N: ${deck.getSerialNumber()}`)
  
  deck.clearAllKeys()
  
  const PANEL_HEIGHT = (deck.KEY_ROWS * deck.ICON_SIZE)
  const PANEL_WIDTH = (deck.KEY_COLUMNS * deck.ICON_SIZE)

  
  const STRIDE_BROWSER = 4
  const STRIDE_DECK = 3
  const frame = Buffer.alloc(PANEL_WIDTH * PANEL_HEIGHT * STRIDE_DECK)
  // console.log('width', PANEL_WIDTH, 'height', PANEL_HEIGHT, PANEL_WIDTH * PANEL_HEIGHT * STRIDE_DECK)

  function copyBGRAtoRGB(source: Buffer, target: Buffer, targetStart: number, sourceStart: number, count: number) {
    let i = 0;
    for (i = 0; i < count; i++) {
      target[(targetStart + i) * STRIDE_DECK + 0] = source[(sourceStart + i) * STRIDE_BROWSER + 2]
      target[(targetStart + i) * STRIDE_DECK + 1] = source[(sourceStart + i) * STRIDE_BROWSER + 1]
      target[(targetStart + i) * STRIDE_DECK + 2] = source[(sourceStart + i) * STRIDE_BROWSER + 0]
    }
  }
  
  function updateBitmap(rect: Electron.Rectangle, image: NativeImage | Buffer) {
    // console.log('Update');
    const bmp = (image as NativeImage).getBitmap ? (image as NativeImage).getBitmap() : (image as Buffer);
    // console.log(bmp.length)
    const maxHeight = Math.min(rect.height, (PANEL_HEIGHT - rect.y))
    const maxWidth = Math.min(rect.width, (PANEL_WIDTH - rect.x))
    for (let i = 0; i < maxHeight; i++) {
      const targetStart = ((rect.y + i) * PANEL_WIDTH + rect.x)
      const sourceStart = (i * rect.width)
      copyBGRAtoRGB(bmp, frame, targetStart, sourceStart, maxWidth)
    }
    deck.fillPanel(frame);
  }

  function keyIndexToXY (keyIndex: number) {
    const y = (Math.floor(keyIndex / deck.KEY_COLUMNS) + 0.5) * deck.ICON_SIZE 
    const x = (keyIndex % deck.KEY_COLUMNS + 0.5) * deck.ICON_SIZE
    return { x, y }
  }

  let window: BrowserWindow | undefined = new BrowserWindow({
    webPreferences: {
      enableRemoteModule: true,
      backgroundThrottling: false,
      nodeIntegration: true,
    },
    resizable: false,
    show: false,
    autoHideMenuBar: true,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    frame: false,
    titleBarStyle: 'customButtonsOnHover'
  });

  window.loadURL(url)
  if (inspect) window.webContents.toggleDevTools()
  window.once('ready-to-show', () => {
    if (!window) return
    if (showWindow) window.show()
    window.setSize(PANEL_WIDTH, PANEL_HEIGHT)
  })
  window.once('closed', () => {
    window = undefined
    deck.resetToLogo()
  })
  window.webContents.setFrameRate(4)
  window.webContents.once('dom-ready', () => {
    if (!window) return
    const requestSize = { x: 0, y: 0, width: PANEL_WIDTH, height: PANEL_HEIGHT }
    
    window.webContents.capturePage(requestSize, (image) => {
      // console.log('Captured!');
      const imgSize = image.getSize();
      // console.log(imgSize)
      updateBitmap({ x: 0, y: 0, width: imgSize.width, height: imgSize.height }, image)
    })

    window.webContents.beginFrameSubscription(true, (image, dirtyRect) => {
      updateBitmap(dirtyRect, image);
    })

    deck.on('down', (keyIndex) => {
      const { x, y } = keyIndexToXY(keyIndex);
      if (!window) return
      window.webContents.sendInputEvent({
        type: 'mouseMove',
        x,
        y
      } as any as Electron.Event)
      window.webContents.sendInputEvent({
        type: 'mouseDown',
        x,
        y,
        button: 'left',
        clickCount: 1
      } as any as Electron.Event)
    })

    deck.on('up', (keyIndex) => {
      const { x, y } = keyIndexToXY(keyIndex);
      if (!window) return
      window.webContents.sendInputEvent({
        type: 'mouseUp',
        x,
        y,
        button: 'left',
        clickCount: 1
      } as any as Electron.Event)
    })
  })

  deck.on('error', error => {
    console.error(error);
  })
});

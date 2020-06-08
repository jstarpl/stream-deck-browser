/// <reference path="./api/electron.d.ts" />

import { app, BrowserWindow, Menu, nativeImage, Tray, NativeImage, ipcMain, IpcAsyncMessageEvent, screen, Rectangle } from "electron"
import { listStreamDecks, openStreamDeck, StreamDeck, StreamDeckDeviceInfo } from 'elgato-stream-deck'
import { CommandMessage, CommandMessageType } from './api/CommandMessage'
import * as commander from 'commander'
import * as path from 'path'
import * as settings from 'electron-settings'
const packageInfo = require('./package.json')

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
	.version(packageInfo.version, '-v, --version')
	.usage('[OPTIONS]...')
	.option('-u, --url <url>', 'Open URL in Stream Deck browser')
	.option('-l, --listDevices', 'List all Stream Deck devices')
	.option('-d, --device <device>', 'Connect to a device with a given serial number')
	.option('--brightness <level>', 'Set brightness level to 0-100')
	.option('--showWindow', 'Show rendering window')
	.option('--inspect', 'Show Developer Tools')

if (process.defaultApp != true) {
	process.argv.unshift('')
}

commander.parse(process.argv)

let DEFAULT_URL = 'https://github.com/jstarpl/stream-deck-browser'
if (process.env.NODE_ENV === 'development') {
	DEFAULT_URL = 'about:blank'
}
const DEFAULT_BRIGHTNESS = 75
const APP_SETTINGS = path.join(__dirname, 'app.html')
const RECONNECT_INTERVAL = 3000

let url = commander.url || DEFAULT_URL
let currentUrl = url
let brightness = commander.brightness || DEFAULT_BRIGHTNESS
const showWindow = !!commander.showWindow || false
const inspect = !!commander.inspect || false
const listDevices = !!commander.listDevices || false
let deviceSerial = commander.device || undefined
let list: StreamDeckDeviceInfo[] = []

let aboutWindow: BrowserWindow | undefined
let tray: Tray

app.disableHardwareAcceleration()

function showAbout() {
	const point = screen.getCursorScreenPoint()
	const display = screen.getDisplayNearestPoint(point)

	const isDarwin = (process.platform === 'darwin')

	aboutWindow = new BrowserWindow({
		webPreferences: {
			enableRemoteModule: true,
			backgroundThrottling: true,
			nodeIntegration: true,
			devTools: true
		},
		resizable: false,
		show: false,
		width: 400,
		height: 550,
		x: display.bounds.x + display.workArea.x + display.workArea.width - 400,
		y: isDarwin ?
			display.bounds.y + display.workArea.y + 20 :
			display.bounds.y + display.workArea.y + display.workArea.height - 550,
		frame: false,
		titleBarStyle: 'customButtonsOnHover'
	})
	aboutWindow.loadFile(APP_SETTINGS)
	aboutWindow.once('ready-to-show', () => {
		aboutWindow!.show()

		if (inspect) {
			aboutWindow!.webContents.toggleDevTools()
		}
	})
	aboutWindow.on('close', () => {
		aboutWindow = undefined
	})
}

function reconnectToStreamDeck(deviceSerial?: string): StreamDeck | undefined {
	list = listStreamDecks()
	let devicePath = undefined
	if (deviceSerial) {
		const device = list.find(i => i.serialNumber === deviceSerial)
		if (device) {
			devicePath = device.path
		} else {
			return
		}
	}
	
	return openStreamDeck(devicePath || list[0].path)
}

app.once('ready', () => {
	url = commander.url || settings.get('url', DEFAULT_URL)
	currentUrl = url
	brightness = commander.brightness || settings.get('brightness', DEFAULT_BRIGHTNESS)

	list = listStreamDecks()
	if (list.length === 0) {
		console.log('No Stream Deck found.')
		app.quit()
	}
	if (listDevices) {
		console.log(JSON.stringify(list, undefined, 2))
		app.quit()
	}
	let devicePath = undefined
	if (deviceSerial) {
		const device = list.find(i => i.serialNumber === deviceSerial)
		if (device) {
			devicePath = device.path
		} else {
			console.error(`Could not find device with S/N: "${deviceSerial}".`)
			process.exitCode = 2
			app.quit()
		}
	}
	
	let deck: StreamDeck | undefined = openStreamDeck(devicePath || list[0].path)

	deck.setBrightness(brightness)
	deviceSerial = deck.getSerialNumber()

	tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')))
	const contextMenu = Menu.buildFromTemplate([
		{
			label: 'About', type: 'normal', click: () => {
				showAbout();
			}
		},
		{ label: 'Exit', type: 'normal', click: () => {
				app.quit()
			}
		}
	])
	tray.setToolTip(`Stream Deck Browser: ${deck.MODEL} ${deviceSerial}`);
	tray.setContextMenu(contextMenu)
	
	console.log(`Connected to Stream Deck, Model: ${deck.MODEL}, S/N: ${deviceSerial}`)
	
	deck.clearAllKeys()
	
	let PANEL_HEIGHT = (deck.KEY_ROWS * deck.ICON_SIZE)
	let PANEL_WIDTH = (deck.KEY_COLUMNS * deck.ICON_SIZE)

	
	const STRIDE_BROWSER = 4
	const STRIDE_DECK = 3
	let frame = Buffer.alloc(PANEL_WIDTH * PANEL_HEIGHT * STRIDE_DECK)
	// console.log('width', PANEL_WIDTH, 'height', PANEL_HEIGHT, PANEL_WIDTH * PANEL_HEIGHT * STRIDE_DECK)

	function rebuildPanelSettings(deck: StreamDeck) {
		PANEL_HEIGHT = (deck.KEY_ROWS * deck.ICON_SIZE)
		PANEL_WIDTH = (deck.KEY_COLUMNS * deck.ICON_SIZE)

		frame = Buffer.alloc(PANEL_WIDTH * PANEL_HEIGHT * STRIDE_DECK)
	}
	
	function updateBitmap(rect: Electron.Rectangle, image: NativeImage | Buffer) {
		// console.log('Update');
		const srcBmp = (image as NativeImage).getBitmap ? (image as NativeImage).getBitmap() : (image as Buffer)
		const targetBmp = frame
		// console.log(bmp.length)
		const maxHeight = Math.min(rect.height, (PANEL_HEIGHT - rect.y))
		const maxWidth = Math.min(rect.width, (PANEL_WIDTH - rect.x))

		// this is somewhat weird.
		rect.y = 0
		rect.x = 0

		for (let y = 0; y < maxHeight; y++) {
			for (let x = 0; x < maxWidth; x++) {
				targetBmp[((rect.y * rect.width) + rect.x + (y * rect.width) + x) * STRIDE_DECK + 0] = srcBmp[((y * rect.width) + x) * STRIDE_BROWSER + 2]
				targetBmp[((rect.y * rect.width) + rect.x + (y * rect.width) + x) * STRIDE_DECK + 1] = srcBmp[((y * rect.width) + x) * STRIDE_BROWSER + 1]
				targetBmp[((rect.y * rect.width) + rect.x + (y * rect.width) + x) * STRIDE_DECK + 2] = srcBmp[((y * rect.width) + x) * STRIDE_BROWSER + 0]
			}
		}

		try {
			if (deck) deck.fillPanel(frame)
		} catch (e) {
			deck = undefined
		}
	}

	function keyIndexToXY (keyIndex: number) {
		if (!deck) throw new Error('Stream Deck not connected!')
		const y = (Math.floor(keyIndex / deck.KEY_COLUMNS) + 0.5) * deck.ICON_SIZE 
		const x = (keyIndex % deck.KEY_COLUMNS + 0.5) * deck.ICON_SIZE
		return { x, y }
	}

	function openInDeck (url: string) {
		window!.loadURL(url)
	}

	function setBrightness (level: number) {
		if (!deck) throw new Error('Stream Deck not connected!')
		deck.setBrightness(Math.max(0, Math.min(100, level)))
	}

	function refreshFullDeck(requestSize: Rectangle) {
		if (window) {
			window.webContents.capturePage(requestSize, (image) => {
				const imgSize = image.getSize()
				updateBitmap({ x: 0, y: 0, width: imgSize.width, height: imgSize.height }, image)
			})
		}
	}

	function attachEvents(deck: StreamDeck, window: BrowserWindow) {
		deck.on('down', (keyIndex: number) => {
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

		deck.on('up', (keyIndex: number) => {
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
	}

	let window: BrowserWindow | undefined = new BrowserWindow({
		webPreferences: {
			enableRemoteModule: false,
			backgroundThrottling: false,
			nodeIntegration: false,
			allowRunningInsecureContent: true,
			contextIsolation: true
		},
		resizable: false,
		show: false,
		autoHideMenuBar: true,
		width: PANEL_WIDTH,
		height: PANEL_HEIGHT,
		frame: false
	});

	openInDeck(currentUrl)
	if (inspect) window.webContents.toggleDevTools()
	window.once('ready-to-show', () => {
		if (!window) return
		if (showWindow) window.show()
		window.setSize(PANEL_WIDTH, PANEL_HEIGHT)
	})
	window.once('closed', () => {
		window = undefined
		try {
			if (deck) deck.resetToLogo()
		} catch(e) {
			console.error(e)
		}
	})
	window.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
		if (isMainFrame) {
			currentUrl = url
		}

		if (aboutWindow) {
			aboutWindow.webContents.send('asynchronous-message', {
				type: CommandMessageType.SET_SETTINGS,
				settings: {
					currentUrl
				}
			})
		}
	})
	window.webContents.on('did-finish-load', () => {
		window!.webContents.insertCSS('html, body { overflow: hidden !important; }')
	})
	window.webContents.once('dom-ready', () => {
		if (!window) return
		const requestSize = { x: 0, y: 0, width: PANEL_WIDTH, height: PANEL_HEIGHT }
		
		refreshFullDeck(requestSize)

		window.webContents.on('paint', (e, dirtyRect, image) => {
			updateBitmap(dirtyRect, image)
		})

		window.webContents.beginFrameSubscription((image, dirtyRect) => {
			console.log(dirtyRect)
			updateBitmap(dirtyRect, image)
		})

		if (!deck) {
			app.quit()
			return;
		}

		attachEvents(deck, window)
	})

	let reconnecting = false
	function pollToReconnect() {
		if (!deck) {
			reconnecting = true
			console.log('Retrying...')
			deck = reconnectToStreamDeck(deviceSerial)
			if (!deck) {
				setTimeout(pollToReconnect, RECONNECT_INTERVAL)
			} else {
				console.log(`Reconnected to Stream Deck, Model: ${deck.MODEL}, S/N: ${deck.getSerialNumber()}`)
				rebuildPanelSettings(deck)
				const requestSize = { x: 0, y: 0, width: PANEL_WIDTH, height: PANEL_HEIGHT }
				refreshFullDeck(requestSize)
				if (window) attachEvents(deck, window)
				reconnecting = false
			}
		}
	}

	deck.on('error', (error: any) => {
		if (error && error.message.match(/could not read from HID device/i)) {
			console.log(`Connection to Stream Deck lost, polling in ${RECONNECT_INTERVAL/1000}s...`)
			deck = undefined
			if (!reconnecting) {
				setTimeout(pollToReconnect, RECONNECT_INTERVAL)
			}
		} else {
			console.error(error);
		}
	})

	ipcMain.on('asynchronous-message', (event: IpcAsyncMessageEvent, arg: CommandMessage) => {
		switch (arg.type) {
			case CommandMessageType.GET_HELP:
				commander.outputHelp((str) => {
					event.sender.send('asynchronous-message', {
						type: CommandMessageType.RETURN_HELP,
						help: str
					})
					return ''
				})
				break
			case CommandMessageType.GET_SETTINGS:
				event.sender.send('asynchronous-message', {
					type: CommandMessageType.SET_SETTINGS,
					settings: {
						url,
						currentUrl,
						showWindow,
						inspect,
						deviceSerial,
						brightness,
						deviceList: list
					}
				})
				break
			case CommandMessageType.SET_SETTINGS:
				if (arg.settings.currentUrl !== undefined && arg.settings.currentUrl !== currentUrl) {
					currentUrl = arg.settings.currentUrl
					settings.set('url', currentUrl)
					openInDeck(currentUrl)
				}
				if (arg.settings.brightness !== undefined && arg.settings.brightness !== brightness) {
					brightness = arg.settings.brightness
					settings.set('brightness', brightness)
					setBrightness(brightness)
				}
				event.sender.send('asynchronous-message', {
					type: CommandMessageType.ACK
				})
				break
		}
	})
})

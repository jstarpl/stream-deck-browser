declare module 'electron-titlebar-windows' {
	import { EventEmitter } from "electron"

	interface TitlebarOptions {
		darkMode?: string
		color?: string
		backgroundColor?: string
		draggable?: boolean
		fullscreen?: boolean
	}

	class ElectronTitlebarWindows extends EventEmitter {
		constructor(options?: TitlebarOptions)
		appendTo(el?: HTMLElement): void
		destroy(): void
		on(type: 'minimize', handler: (e: any) => void): this
		on(type: 'maximize', handler: (e: any) => void): this
		on(type: 'fullscreen', handler: (e: any) => void): this
		on(type: 'close', handler: (e: any) => void): this
	}

	export = ElectronTitlebarWindows
}
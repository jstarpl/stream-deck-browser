import { IpcMessageEvent } from 'electron'

declare module 'electron' {
	interface IpcAsyncMessageEvent extends IpcMessageEvent {
		reply(channel: 'asynchronous-reply', arg: any): void
	}
}
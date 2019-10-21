import { actionCreator } from "./helpers"

export interface ISettings {
	settings: any
}

export const setSettings = actionCreator<ISettings>('SET_SETTINGS')
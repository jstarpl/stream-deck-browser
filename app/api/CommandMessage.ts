export enum CommandMessageType {
	GET_SETTINGS = 'get_settings',
	SET_SETTINGS = 'set_settings',
	GET_HELP = 'get_help',
	RETURN_HELP = 'return_help',
	ACK = 'ack',
	NAK = 'nak'
}

export interface CommandMessage {
	type: CommandMessageType
	[key: string]: any
}
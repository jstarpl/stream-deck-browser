export enum CommandMessageType {
	GET_SETTINGS = 'get_settings',
	SET_SETTINGS = 'set_settings',
	ACK = 'ack',
	NAK = 'nak'
}

export interface CommandMessage {
	type: CommandMessageType
}
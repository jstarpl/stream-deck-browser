enum CommandMessageType {
	GET_SETTINGS = 'get_settings',
	SET_SETTINGS = 'set_settings',
	ACK = 'ack',
	NAK = 'nak'
}

interface CommandMessage {
	type: CommandMessageType
}
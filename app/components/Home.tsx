import { ipcRenderer } from 'electron'
import { CommandMessageType } from '../api/CommandMessage'
import * as React from 'react'

let styles = require('./Home.scss')

interface IState {
  url: string,
  settings: any
}

export default class Home extends React.Component<any, IState> {
  constructor (props: any) {
    super(props)

    this.state = {
      url: '',
      settings: {}
    }
  }

  onAsynchronousMessage = (event: Event, channel: string, e: any) => {
    console.log(event, channel, e)
    switch (e.type) {
      case CommandMessageType.SET_SETTINGS:
        this.setState({
          settings: e.settings
        })
        break
    }
  }
  
  componentDidMount () {
    ipcRenderer.on('asynchronous-message', this.onAsynchronousMessage)
    ipcRenderer.on('asynchronous-reply', this.onAsynchronousMessage)

    ipcRenderer.send('asynchronous-message', {
      type: CommandMessageType.GET_SETTINGS
    })
  }

  componentDidUpdate () {

  }

  onUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      url: e.currentTarget.value
    })
  }

  onUrlNavigate = () => {
    ipcRenderer.send('asynchronous-message', {
      type: CommandMessageType.SET_SETTINGS,
      settings: {
        currentUrl: this.state.url
      }
    })
  }

  render() {
    return (
      <div>
        <div className={styles.container} data-tid="container">
          <label>
            <span>Load URL</span>
            <input type="url" value={this.state.url} onChange={this.onUrlChange} />
            <button onClick={this.onUrlNavigate}>🡺</button>
          </label>
        </div>
      </div>
    )
  }
}

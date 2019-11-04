import { ipcRenderer } from 'electron'
import { CommandMessageType } from '../api/CommandMessage'
import * as React from 'react'

let styles = require('./Home.scss')

interface IState {
  url: string,
  brightness: number,
  settings: any,
  help: string
}

export default class Home extends React.Component<any, IState> {
  constructor (props: any) {
    super(props)

    this.state = {
      url: '',
      brightness: 0,
      settings: {},
      help: ''
    }
  }

  onAsynchronousMessage = (event: Event, e: any) => {
    switch (e.type) {
      case CommandMessageType.SET_SETTINGS:
        this.setState({
          settings: Object.assign({}, this.state.settings, e.settings),
          url: e.settings.currentUrl
        })
        break
      case CommandMessageType.RETURN_HELP:
        this.setState({
          help: e.help
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
    ipcRenderer.send('asynchronous-message', {
      type: CommandMessageType.GET_HELP
    })
  }

  componentDidUpdate (prevProps: any, prevState: IState) {
    if (this.state.settings.currentUrl !== prevState.settings.currentUrl) {
      this.setState({
        url: this.state.settings.currentUrl,
      })
    }
    if (this.state.settings.brightness !== prevState.settings.brightness) {
      this.setState({
        brightness: this.state.settings.brightness
      })
    }
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

  onUrlFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.select()
  }

  onBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      brightness: parseInt(e.currentTarget.value)
    }, () => {
      ipcRenderer.send('asynchronous-message', {
        type: CommandMessageType.SET_SETTINGS,
        settings: {
          brightness: this.state.brightness
        }
      })
    })
  }

  render() {
    return (
      <div>
        <div className={styles.container} data-tid="container">
          <div className={styles.usage}>
            {this.state.help}
          </div>
          <form onSubmit={(e) => e.preventDefault()}>
            <label>
              <span>URL</span>
              <input type="url" value={this.state.url} onChange={this.onUrlChange} onFocus={this.onUrlFocus} />
              <button type="submit" onClick={this.onUrlNavigate}>🡺</button>
            </label>
          </form>
          <label>
            <span>Brightness</span>
            <input type="range" value={this.state.brightness} onChange={this.onBrightnessChange} min={0} max={100} />
          </label>
          <label>
            <span>Stream Deck S/N</span>
            <input type="text" value={this.state.settings.deviceSerial} readOnly={true} />
          </label>
          <h2>Stream Deck devices</h2>
          <ul>{(this.state.settings.deviceList || []).map((d: any) => <li><dfn title={d.path}>{d.serialNumber}</dfn> ({d.model})</li>)}</ul>
        </div>
      </div>
    )
  }
}

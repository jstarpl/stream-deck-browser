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

  onAsynchronousMessage = (event: Event, e: any) => {
    switch (e.type) {
      case CommandMessageType.SET_SETTINGS:
        console.log(e)
        this.setState({
          settings: e.settings,
          url: e.settings.currentUrl
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

  componentDidUpdate (prevProps: any, prevState: IState) {
    if (this.state.settings.currentUrl !== this.state.settings.currentUrl) {
      this.setState({
        url: this.state.settings.currentUrl
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

  render() {
    return (
      <div>
        <div className={styles.container} data-tid="container">
          <form onSubmit={(e) => e.preventDefault()}>
            <label>
              <span>Load URL</span>
              <input type="url" value={this.state.url} onChange={this.onUrlChange} onFocus={this.onUrlFocus} />
              <button type="submit" onClick={this.onUrlNavigate}>🡺</button>
            </label>
          </form>
          <label>
            <span>Stream Deck S/N</span>
            <input type="text" value={this.state.settings.deviceSerial} readOnly={true} />
          </label>
          <h2>Stream Deck devices</h2>
          <ul>
            {(this.state.settings.deviceList || []).map((d: any) => <li>{d.model}: {d.serialNumber}</li>)}
          </ul>
        </div>
      </div>
    )
  }
}

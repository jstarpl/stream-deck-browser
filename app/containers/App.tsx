import * as React from 'react';
import ElectronTitlebarWindows = require('electron-titlebar-windows');

const titlebar = new ElectronTitlebarWindows({
  darkMode: 'dark',
  draggable: true
});
export default class App extends React.Component {
  componentDidMount () {
    titlebar.appendTo(document.getElementById('titlebar') || undefined)
    titlebar.on('close', (e) => {
      window.close()
    })

    document.body.classList.add(`platform-${process.platform}`)
  }
  render() {
    return (
      <div>
        <div id='titlebar'>Stream Deck Browser</div>
        {this.props.children}
      </div>
    );
  }
}

import * as React from 'react';

let styles = require('./Home.scss');

export default class Home extends React.Component {
  render() {
    return (
      <div>
        <div className={styles.container} data-tid="container">
          <label>
            Load URL
            <input type="url" value={""} />
          </label>
        </div>
      </div>
    );
  }
}

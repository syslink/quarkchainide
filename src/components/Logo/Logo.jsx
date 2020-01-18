import React, { PureComponent } from 'react';
import { Link } from 'react-router-dom';
import * as qcRpc from '../../utils/quarkchainRPC';
import { T } from '../../utils/lang';

export default class Logo extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      networkType: '主网',
    };
  }
  componentDidMount = () => {    
  }
  componentWillReceiveProps(nextProps) {
    this.setState({networkType: nextProps.networkType});
  }
  render() {
    return (
      <div className="logo" style={{}}>
        <Link to="/" className="logo-text">
          QuarkChain<font  size='3'>{this.state.networkType}</font>
        </Link>
      </div>
    );
  }
}

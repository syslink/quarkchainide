import React, { PureComponent } from 'react';
import { Link } from 'react-router-dom';
import * as qcRpc from '../../utils/quarkchainRPC';

export default class Logo extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      networkType: 'QuarkChain',
    };
  }
  componentDidMount = () => {
    qcRpc.getNetworkId().then(networkInfo => {
      let networkType = 'QuarkChain-测试网';
      if (networkInfo.networkId == 1) {
        networkType = 'QuarkChain-主网';
      }
      this.setState({networkType});
    })
  }
  render() {
    return (
      <div className="logo" style={{}}>
        <Link to="/" className="logo-text">
          {this.state.networkType}
        </Link>
      </div>
    );
  }
}

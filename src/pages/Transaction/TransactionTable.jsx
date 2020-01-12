/* eslint-disable react/no-unescaped-entities */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import React, { Component, useState } from 'react';
import { Search, Grid } from '@icedesign/base';
import { Message, Table, Button } from '@alifd/next';
import IceContainer from '@icedesign/container';
import ReactJson from 'react-json-view';
import BigNumber from 'bignumber.js';
import { T } from '../../utils/lang';
import * as qcRpc from '../../utils/quarkchainRPC';
import * as utils from '../../utils/utils';

const { Row, Col } = Grid;

export default class TransactionTable extends Component {
  static displayName = 'TransactionTable';

  constructor(props) {
    super(props);
    this.state = {
      txInfo: {},
      assetInfos: {},
      actions: [],
      txFrom: {},
      txRawData: {},
      txReceiptData: {},
      src: null,
      setSrc: null,
      accountShardsInfo: [],
      address: '',
    };
  }

  onSearch = async (value) => {
    const hashOrAddr = value.key;
    if (hashOrAddr.indexOf('0x') === 0) {
      if (hashOrAddr.length == 50) {
        this.state.address = hashOrAddr;
        qcRpc.getAccountData(this.state.address, null, true).then(accountData => {
          if (accountData.shards == null) {
            this.state.accountShardsInfo = [accountData.primary];
            this.setState({accountShardsInfo: this.state.accountShardsInfo});
          } else {
            this.state.accountShardsInfo = accountData.shards;
            this.setState({accountShardsInfo: this.state.accountShardsInfo});
          }
        }).catch(error => {
          Message.error('发生错误:' + error);
        });
      } else {
        const txHash = hashOrAddr;
        
        let txInfo = await qcRpc.getTransactionByHash(txHash);
        if (txInfo != null) {
          const txReceiptData = await qcRpc.getTransactionReceipt(txHash);//formatHighlight(await fractal.ft.getTransactionReceipt(hash), COLOR_OPTION);
          const txRawData = txInfo;//formatHighlight(txInfo, COLOR_OPTION);

          this.setState({
            txFrom: { txHashArr: [txHash] },
            txRawData,
            txReceiptData
          });
        } else {
          Message.error(T('无法获取到交易信息'));
        }
      }
    } else {
      Message.prompt(T('请输入十六进制的交易hash或账户地址'));
    }
  }

  // value为filter的值，obj为search的全量值
  onFilterChange = () => {
  }
  
  balancesRender = (balances) => {
    let newBalances = utils.deepClone(balances);
    newBalances = newBalances.map(balance => {
      balance.balance = new BigNumber(balance.balance).shiftedBy(-18) + ' ' + balance.tokenStr;
      return balance;
    });
    return <ReactJson src={newBalances}/>;
  }

  getTxsByAddr = () => {
    qcRpc.getTransactionsByAddress(this.state.address, '0x00', '0xff', '').then(txs => {
      console.log(txs);
    });
  }

  render() {
    return (
      <div>
        <IceContainer>
          <Row style={{ justifyContent: 'center' }}>
            <Col span="24" s="10" l="10">
              <Search
                size="large"
                autoWidth="true"
                onSearch={this.onSearch.bind(this)}
                placeholder={T("交易hash/账户地址，0x开头")}
                onFilterChange={this.onFilterChange.bind(this)}
              />
            </Col>
          </Row>
        </IceContainer>
        <br /><br />
        <IceContainer style={styles.container}>
          <h4 style={styles.title}>{T('交易原始信息')}</h4>
          <ReactJson
            src={this.state.txRawData}
          />
          {/* <div dangerouslySetInnerHTML={{__html: this.state.txRawData}} /> */}
        </IceContainer>
        <br />
        <IceContainer style={styles.container}>
          <h4 style={styles.title}>{T('交易Receipt信息')}</h4>
          <ReactJson
            src={this.state.txReceiptData}
          />
          {/* <div dangerouslySetInnerHTML={{__html: this.state.txReceiptData}} /> */}
        </IceContainer>
        <br /><br />
        <IceContainer style={styles.container}>
          <h4 style={styles.title}>{T('账户信息')}</h4>
          <Table dataSource={this.state.accountShardsInfo}>
            <Table.Column title="链Id" dataIndex="chainId" cell={chainId => parseInt(chainId)}/>
            <Table.Column title="分片Id" dataIndex="shardId" cell={shardId => parseInt(shardId)}/>
            <Table.Column title="资产" dataIndex="balances" cell={this.balancesRender} width={'50%'}/>
            <Table.Column title="总交易数" dataIndex="transactionCount" 
                          cell={count => <Button text onClick={() => {this.getTxsByAddr();}}>{parseInt(count)}</Button>}/>
            <Table.Column title="是否合约" dataIndex="isContract" cell={isContract => isContract ? '是' : '否'}/>
          </Table>
        </IceContainer>
      </div>
    );
  }
}

const styles = {
  container: {
    margin: '0',
    padding: '0',
  },
  title: {
    margin: '0',
    padding: '15px 20px',
    fonSize: '16px',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    color: 'rgba(0,0,0,.85)',
    fontWeight: '500',
    borderBottom: '1px solid #eee',
  },
  summary: {
    padding: '20px',
  },
  item: {
    height: '40px',
    lineHeight: '40px',
  },
  label: {
    display: 'inline-block',
    fontWeight: '500',
    minWidth: '74px',
    width: '150px',
  },
};
const COLOR_OPTION = {
  keyColor: 'red',
  numberColor: '#ff8c00',
  stringColor: 'green'
};
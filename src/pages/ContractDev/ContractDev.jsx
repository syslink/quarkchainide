import React, { Component } from 'react';
import { Select } from '@icedesign/base';
import { Button, Tab, Grid, Tree, Dialog, Collapse, Message, 
         Input, Card, Checkbox, Table, Icon, Balloon, Form } from '@alifd/next';
import Container from '@icedesign/container';
import IcePanel from '@icedesign/panel';
import * as hyperchain from 'hyperchain-web3';
import {AbiCoder as EthersAbiCoder} from 'ethers/utils/abi-coder';
import cookie from 'react-cookies';
import copy from 'copy-to-clipboard';
import ReactJson from 'react-json-view';
import IceEllipsis from '@icedesign/ellipsis';
import Web3 from 'web3';
import QuarkChain from 'quarkchain-web3';
import BigNumber from 'bignumber.js';
import * as abiUtil from 'ethereumjs-abi';
import CopyToClipboard from 'react-copy-to-clipboard';
import EthCrypto from 'eth-crypto';
import FoundationSymbol from '@icedesign/foundation-symbol';

import * as utils from '../../utils/utils';
import * as qcRpc from '../../utils/quarkchainRPC';
import * as Keystore from '../../utils/keystore';
import { T } from '../../utils/lang';
import * as Constant from '../../utils/constant';
import ContractEditor from './components/Editor';
import * as CompilerSrv from './CompilerSrv';
import './ContractDev.scss';

const { Row, Col } = Grid;
const FormItem = Form.Item;
const TreeNode = Tree.Node;
const Panel = Collapse.Panel;

var _axios = require('axios');

const TxReceiptResult = ({self, contractAddress, funcName}) => {
  return <div>
    <Button key='getTxInfo' type="primary" onClick={self.getTxInfo.bind(self, contractAddress, funcName)} style={{marginRight: '20px'}}>{T('查询交易')}</Button>
    <Button key='getReceiptInfo' type="primary" onClick={self.getReceiptInfo.bind(self, contractAddress, funcName)}>{T('查询Receipt')}</Button>
    <br /><br />
    {T('交易信息')}:<br />
    <ReactJson key='txInfoResult' id={contractAddress + funcName + 'TxInfo'}
      src={utils.isEmptyObj(self.state.result[contractAddress + funcName + 'TxInfo']) ? {} : self.state.result[contractAddress + funcName + 'TxInfo']}
    />
    <br />{T('Receipt信息')}:<br />
    <ReactJson key='receiptInfoResult' id={contractAddress + funcName + 'ReceiptInfo'}
      src={utils.isEmptyObj(self.state.result[contractAddress + funcName + 'ReceiptInfo']) ? {} : self.state.result[contractAddress + funcName + 'ReceiptInfo']}
    />
   
  </div>
}

// constructor use contract name, and other functions use contract address
const Parameters = ({self, contractAddress, funcName, parameterNames, parameterTypes, width}) => {
  return parameterNames.map((paraName, index) => (
    <div>
      <Input key={paraName} hasClear
        onChange={self.handleParaValueChange.bind(self, contractAddress, funcName, paraName)}
        style={{ width }}
        addonTextBefore={paraName}
        size="medium"
        placeholder={parameterTypes[index]}
        />
      <br /><br />
    </div>
  ))
}

const Transfer = ({self, contractAddress, funcName}) => {
  return <div>
    <Checkbox key='transferCheck'
      onChange={checked => {
        let transferTogether = utils.deepClone(self.state.transferTogether);
        transferTogether[contractAddress + funcName] = checked;
        let visibilityValue = utils.deepClone(self.state.visibilityValue);
        visibilityValue[contractAddress + funcName] = checked ? 'block' : 'none';
        self.setState({ transferTogether, visibilityValue });
      }}>{T('附带转账')}
    </Checkbox>
    <br /><br />
    <Container key='transferContainer' id={contractAddress + funcName + 'Container'} style={{display: self.state.visibilityValue[contractAddress + funcName], height:'50'}}>      
      <Input hasClear
        onChange={self.handleParaValueChange.bind(self, contractAddress, funcName, 'transferAssetValue')}
        style={{ width: 500 }}
        addonTextBefore={T('转账金额')}
        addonTextAfter={T('QKC')}
        size="medium"
      />
    </Container>
  </div>
}

const OneFunc = ({self, contractAddress, funcName, parameterTypes, parameterNames}) => {
  let callBtnName = T('查询结果');
  let callInvoke = true;
  if (!self.state.funcParaConstant[contractAddress][funcName]) {
    callBtnName = T('发起合约交易');
    callInvoke = false;
    const transferTogether = self.state.transferTogether[contractAddress + funcName];
    self.state.visibilityValue[contractAddress + funcName] = (transferTogether != null && transferTogether) ? 'block' : 'none';
  }
  return <Card style={{ width: 800, marginBottom: "20px" }} contentHeight="auto" title={funcName}>
          <Parameters self={self} contractAddress={contractAddress} funcName={funcName}  width='600px'
            parameterNames={parameterNames} parameterTypes={parameterTypes} />
          {
            self.state.funcPayable[contractAddress][funcName] ? 
              <Transfer self={self} contractAddress={contractAddress} funcName={funcName} /> : ''
          }
          <Button type="primary" onClick={self.callContractFunc.bind(self, contractAddress, funcName)}>{callBtnName}</Button>
          <br />
          <br />
          {
            callInvoke ? <ReactJson key='callResult' src={utils.isEmptyObj(self.state.result[contractAddress + funcName]) ? 
                                                            {} : self.state.result[contractAddress + funcName]}/>
                         :
                         <Input.TextArea autoHeight readOnly style={{ width: 600 }} 
                                    value={self.state.result[contractAddress + funcName]}
                                    addonTextBefore={T('结果')} size="medium"/>
          }
          <br />
          <br />
          {
            !self.state.funcParaConstant[contractAddress][funcName] ? 
              <TxReceiptResult self={self} contractAddress={contractAddress} funcName={funcName} /> : ''
          }
         </Card>;
}

const DisplayOneTypeFuncs = ({self, contract, abiInfos}) => {
  const {contractAddress} = contract;

  return (<Collapse rtl='ltr'>
          {abiInfos.map((interfaceInfo, index) => {
            if (interfaceInfo.type === 'function') {
              const funcName = interfaceInfo.name;
              const parameterTypes = [];
              const parameterNames = [];
              for (const input of interfaceInfo.inputs) {
                parameterTypes.push(input.type);
                parameterNames.push(input.name);
              }

              self.state.funcParaTypes[contractAddress][funcName] = parameterTypes;
              self.state.funcParaNames[contractAddress][funcName] = parameterNames;
              self.state.funcResultOutputs[contractAddress][funcName] = interfaceInfo.outputs;
              self.state.funcParaConstant[contractAddress][funcName] = interfaceInfo.constant;
              self.state.funcPayable[contractAddress][funcName] = interfaceInfo.payable;
              return <Panel key={index}  title={funcName}>
                      <OneFunc key={contractAddress + funcName} self={self} 
                        contractAddress={contractAddress}
                        funcName={funcName} parameterTypes={parameterTypes} parameterNames={parameterNames}/>
                    </Panel>;      
            }
          })}
        </Collapse>);
}

const ContractArea = ({ self, contract }) => {
  const {contractAddress} = contract;
  self.state.funcParaTypes[contractAddress] = {};
  self.state.funcParaNames[contractAddress] = {};
  self.state.funcResultOutputs[contractAddress] = {};
  self.state.funcParaConstant[contractAddress] = {};
  self.state.funcPayable[contractAddress] = {};
    
  const readonlyFuncs = [];
  const writableFuncs = [];
  const writablePayableFuncs = [];
  contract.contractAbi.map((interfaceInfo, index) => {
    if (interfaceInfo.type === 'function') {
      if (interfaceInfo.constant) {
        readonlyFuncs.push(interfaceInfo);
      } else if (interfaceInfo.payable) {
        writablePayableFuncs.push(interfaceInfo);
      } else {
        writableFuncs.push(interfaceInfo);
      }
    }
  }
  );

  return <div>
          {T('合约地址')}: {contractAddress}<br/><br/>
          {T('只读类接口')}:{readonlyFuncs.length == 0 ? '无' : ''}<br/>
          <DisplayOneTypeFuncs self={self} abiInfos={readonlyFuncs} contract={contract}/>
          <br/>{T('写入类接口')}:{writableFuncs.length == 0 ? '无' : ''}<br/>
          <DisplayOneTypeFuncs self={self} abiInfos={writableFuncs} contract={contract}/>
          <br/>{T('写入并可支付类接口')}:{writablePayableFuncs.length == 0 ? '无' : ''}<br/>
          <DisplayOneTypeFuncs self={self} abiInfos={writablePayableFuncs} contract={contract}/>
        </div>        
} 

const ContractCollapse = ({self, contractAccountInfo}) => {
  global.localStorage.setItem('contractAccountInfo', JSON.stringify(contractAccountInfo));
  return <Collapse rtl='ltr'>
            {contractAccountInfo.map((contract, index) => (
              <Panel key={index}  
                title={T('编号') + ':' + (index + 1) + '，' + T('合约地址') + ':' + contract.contractAddress 
                    + '，' + T('合约名') + '：' + contract.contractName + '，' + T('时间') + '：' + (contract.genTime != null ? contract.genTime : '')}>
                <ContractArea self={self} contract={contract}/>
              </Panel>
            ))}
         </Collapse>
}

const ActionType = { DeployContract: 0, InvokeContract: 1, UpdateContract: 2 }
const NetworkType = { TestNet: 0, Mainnet: 1, MetaMask: 2, LocalNode: 3, OtherNode: 4}

const addrPlaceholder = T("0x开头的私钥");

export default class ContractManager extends Component {
  static displayName = 'ContractManager';

  constructor(props) {
    super(props);
    let abiInfoStr = '';
    const abiInfo = global.localStorage.getItem('abiInfo');
    if (abiInfo != null) {
      abiInfoStr = JSON.stringify(abiInfo).replace(/\\"/g, '"');
      abiInfoStr = abiInfoStr.substring(1, abiInfoStr.length - 1);
    }
    const abiContractName = cookie.load('abiContractName');

    this.state = {
      fullShardKey: '00000000',
      networkId: '0xff',
      qkcTokenId: '0x8bb0',
      password: '',
      httpReg: new RegExp('^(?=^.{3,255}$)(http(s)?:\/\/)?(www\.)?[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+(:\d+)*(\/\w+\.\w+)*$'),
      networks:[{label: T('通过MetaMask连接夸克'), value: NetworkType.MetaMask}, {label: T('本地节点'), value: NetworkType.LocalNode}, {label: T('自定义节点'), value: NetworkType.OtherNode}],
      //networks:[{label: '测试网节点', value: 0}, {label: '主网节点', value: 1}, {label: 'MetaMask通道', value: 2}, {label: '本地节点', value: 3}, {label: '自定义节点', value: 4}],
      networksWithoutMetaMask :[{label: T('测试网节点'), value: 0}, {label: T('主网节点'), value: 1}, {label: T('本地节点'), value: 3}, {label: T('自定义节点'), value: 4}],
      currentProvider: '',
      networkName: '',
      web3: null,
      unMateMaskAddresses: [],
      addresses: [],      
      contractFuncInfo: [],
      abiInfos: [],
      contractAccountInfo: [],
      accountsOfShareCode: ['0x4d93a58912ba194cfe0135f33c58097bc5893068'],
      addBtnEnable: true,
      abiInfo: abiInfoStr,
      paraValue: {},
      funcParaTypes: {},
      funcParaNames: {},
      funcResultOutputs: {},
      funcParaConstant: {},
      funcResultOutputs: {},
      funcPayable: {},
      result: {},
      txInfo: {},
      defaultAccountName: '',
      contractName: abiContractName,
      contractAccount: abiContractName,
      selectedAccount: null,
      selectedAccountAddress: '',
      transferTogether: {},
      visibilityValue: {},
      curContractAddress: '',
      curContractName: '',
      curCallFuncName: '',
      curTxResult: {},
      resultDetailInfo: '',
      solFileList: ['sample.sol'],
      tabFileList: ['sample.sol'],
      libFileList: [],
      smapleFileList: [],
      fileContractMap: {},
      contractList: [],
      contractAccountAbiMap: {},
      activeKey: '',
      compilerVersionSettingVisible: false,
      nodeAddrSettingVisible: false,
      addNewContractFileVisible: false,
      deployContractVisible: false,
      contractInfoVisible: false,
      displayAbiVisible: false,
      displayBinVisible: false,
      accountInfoDialogVisible: false,
      addNewAddrDialogVisible: false,
      txConfirmVisible: false,
      accountTxsVisible: false,
      accountTxsInfo: [],
      curAbi: null,
      curBin: null,
      loadedContractAddress: '',
      qcRpcSrv: Constant.testNetRPCAddr,
      compileSrv: 'http://52.194.255.222:8081',
      selectContactFile: '',
      selectedFileToCompile: null,
      selectedContractToDeploy: null,
      resultInfo: T('日志输出') + ':\n',
      newContractAccountName: '',
      keystoreInfo: {},
      suggestionPrice: 1,
      gasLimit: 1000000,
      ftAmount: 1,      
      method: null,
      constructorParaNames: [],
      constructorParaTypes: [],
      ethersAbiCoder: new EthersAbiCoder(),
      allCompilerVersionList: [],
      commitCompilerVersionList: [],
      compilerVersionList: [],
      compilerVersion: '0.5.11+commit.22be8592',

      chainShardsInfo: {},
      chainIds: [],
      shardIds: [],
      selectedChainId: 'ChainID:0',
      selectedShardId: 'ShardId:0',
      queryedAddress: '',

      accountShardsInfo: [],
      assetListFooter: (<view>
                          <Button type='primary' onClick={this.queryAccount.bind(this)}>{T('刷新')}</Button>
                          <Button type='normal' onClick={this.onAccountInfoClose.bind(this)}>{T('取消')}</Button>
                        </view>),
      transferableAssets: [],    
      assetAmountTip: '',
      selecteAssetInfo: null,                    
     };
      
    const solFileList = global.localStorage.getItem('solFileList');
    if (solFileList != null) {
      this.state.solFileList = solFileList.split(',');
    }
    if (this.state.solFileList.length > 0) {
    this.state.tabFileList = [this.state.solFileList[0]];
    this.state.activeKey = this.state.tabFileList[0];
    }

    const contractAccountInfo = global.localStorage.getItem('contractAccountInfo');
    if (contractAccountInfo != null) {
      this.state.contractAccountInfo = JSON.parse(contractAccountInfo);
    }   
    
    const contractList = global.localStorage.getItem('contractList');
    if (contractList != null) {
     this.state.contractList = JSON.parse(contractList);
    }

    const fileContractMap = global.localStorage.getItem('fileContractMap');
    if (fileContractMap != null) {
      this.state.fileContractMap = JSON.parse(fileContractMap);
    }
          
    if (!window.ethereum && !window.web3) { //用来判断你是否安装了metamask
      this.state.networks = this.state.networksWithoutMetaMask;
    }

    const nodeInfo = cookie.load('nodeInfo');
    if (!utils.isEmptyObj(nodeInfo)) {
      this.state.qcRpcSrv = nodeInfo;
      qcRpc.setProvider(nodeInfo);
    }

    if (window.web3) {
      this.state.web3 = new Web3(window.web3);
      QuarkChain.injectWeb3(this.state.web3, this.state.qcRpcSrv);      
    }    
  }

  componentDidMount = async () => {
    await this.initAddresses();

    qcRpc.getNetworkId().then(networkInfo => {
      this.state.networkId = networkInfo.networkId;
      // {"chainSize":"0x2","mining":true,"networkId":"0xee5","shardServerCount":2,"shardSizes":["0x1","0x1"],"syncing":false}
      this.state.chainIds = [];      
      for (let i = 0; i < networkInfo.chainSize; i++) {
        const chainIdName = 'ChainId:' + i;
        this.state.chainIds.push(chainIdName);
        const shardIds = [];
        for (let j = 0; j < networkInfo.shardSizes[i]; j++) {
          shardIds.push('ShardId:' + j);
        }
        this.state.chainShardsInfo[chainIdName] = shardIds;
      }
      this.setState({chainIds: this.state.chainIds});
    });

    hyperchain.utils.setProvider(this.state.compileSrv);      
    this.syncSolFileToSrv();  

    CompilerSrv.getLibSolFile().then(libFiles => {
      for(var fileName in libFiles) {
        this.state.libFileList.push(fileName);
        global.localStorage.setItem('sol:' + fileName, libFiles[fileName]);
      }
    });
    
    CompilerSrv.getSampleSolFile().then(sampleFiles => {
      for(var fileName in sampleFiles) {
        this.state.smapleFileList.push(fileName);
        global.localStorage.setItem('sol:' + fileName, sampleFiles[fileName]);
      }  
    });

    this.setState({libFileList: this.state.libFileList, smapleFileList: this.state.smapleFileList,
                   addresses: this.state.addresses, selectedAccountAddress: this.state.addresses.length > 0 ? this.state.addresses[0] : ''});
  }

  initAddresses = async () => {
    let accounts = await this.state.web3.eth.getAccounts();
    this.state.addresses = accounts;

    const keystoreList = utils.loadKeystoreFromLS();    
    if (keystoreList.length == 0) {
      for (let i = 0; i < 5; i++) {
        const key = Keystore.generateKey();
        keystoreList.push(key);
      }
      utils.storeDataToFile(Constant.KeyStoreFile, keystoreList);
    }
    for (const keystore of keystoreList) {
      const address = keystore.address;
      this.state.keystoreInfo[address] = keystore;
      this.state.unMateMaskAddresses.push({label: address, value: address});
    }
    this.state.addresses.push(...this.state.unMateMaskAddresses);
    this.state.selectedAccountAddress = this.state.addresses.length > 0 ? this.state.addresses[0].value : '';
    this.setState({addresses: this.state.addresses, selectedAccountAddress: this.state.addresses.length > 0 ? this.state.addresses[0] : ''});
  }

  initMetamaskNetwork = async () => {
    if (!window.ethereum && !window.web3) { //用来判断你是否安装了metamask
      Message.error(T('未安装Metamask，合约开发功能无法使用'));
    } else {
      let web3Provider = '';
      if (window.ethereum) {
        try {
          // 请求用户授权
          await window.ethereum.enable();
        } catch (error) {
          // 用户不授权时
          Message.error(T("授权失败，无法使用MetaMask服务"));
          return;
        }        
        web3Provider = window.ethereum;
      } else if (window.web3) {
        web3Provider = window.web3;
      }      
      if (web3Provider != '') {
        this.state.web3 = new Web3(web3Provider);
        QuarkChain.injectWeb3(this.state.web3, this.state.qcRpcSrv);

        this.state.web3.eth.getAccounts((error, accounts) => {
          if (!error) {
            this.setState({addBtnEnable: false, addresses: accounts, selectedAccountAddress: accounts.length > 0 ? accounts[0] : ''});
          }
        });        
      }
    }
  }

  handleContractAccountChange = (value) => {
    this.state.contractAccount = value;
  }

  saveContractName = (value) => {
    this.state.contractName = value.currentTarget.defaultValue;
    cookie.save('abiContractName', this.state.contractName);
  }

  handleABIInfoChange = (value) => {
    this.setState({ abiInfo: value });
  }

  checkABI = (abiInfo) => {
    if (utils.isEmptyObj(abiInfo) 
    || (!utils.isEmptyObj(abiInfo) && !hyperchain.utils.isValidABI(abiInfo))) {
      Message.error(T('ABI信息不符合规范，请检查后重新输入'));
      return false;
    }
    return true;
  }

  handleParaValueChange = (contractAddress, funcName, paraName, value) => {
    this.state.paraValue[contractAddress + '-' + funcName + '-' + paraName] = value;
  }

  onChangeNetwork = async (network) => {
    this.state.addresses = this.state.unMateMaskAddresses;
    var web3Provider = null;
    var addBtnEnable = true;
    let networkName = '';
    switch(network) {
      case NetworkType.TestNet:  // 测试网
        web3Provider = 'https://ropsten.infura.io/v3/e878131f944440759914c7423b17740c';
        break;
      case NetworkType.Mainnet:  // 主网
        web3Provider = 'https://mainnet.infura.io/v3/e878131f944440759914c7423b17740c';
        web3Provider = '';
        break;
      case NetworkType.MetaMask:  // 选择metamask，需要导入metamask当前连接的网络和地址列表，当MetaMask切换网络时，也需要同步更新
        var web3 = this.state.web3;
        if (window.ethereum) {
          try {
            // 请求用户授权
            await window.ethereum.enable();
          } catch (error) {
            // 用户不授权时
            Message.error(T("授权失败，无法使用MetaMask服务"));
            return;
          }        
          web3Provider = window.ethereum;
        } else if (window.web3) {
          web3Provider = window.web3;
        }      
        addBtnEnable = false;
        break;
      case NetworkType.LocalNode:  // local node
        web3Provider = 'http://127.0.0.1:38391';
        networkName = web3Provider;
        break;
      case NetworkType.OtherNode:  // other node
        this.setState({nodeAddrSettingVisible: true});
        return;
    }
    
    if (web3Provider != null && (web3 == null || this.state.currentProvider != web3Provider)) {
      web3 = new Web3(web3Provider);
      this.state.web3 = web3;
      QuarkChain.injectWeb3(this.state.web3, this.state.qcRpcSrv);
    }
    const provider = await web3.currentProvider;
    if (provider) {
      const id = provider.networkVersion;
      if (id === '1') networkName = T('主网(PoW共识，慢)')
      else if (id === '2') networkName = T('Morden (deprecated)')
      else if (id === '3') networkName = T('Ropsten测试网(PoW共识，慢)')
      else if (id === '4') networkName = T('Rinkeby测试网(PoA共识，快)')
      else if (id === '5') networkName = T('Goerli测试网')
      else if (id === '42') networkName = T('Kovan测试网');
    }

    web3.eth.getAccounts((error, accounts) => {
      if (!error) {
        this.setState({addresses: accounts});
      }
    });
    const networkInfoObj = {selectedNetwork: network, networkName};
    global.localStorage.setItem('networkInfo', JSON.stringify(networkInfoObj));
    this.setState({addBtnEnable, currentProvider: web3Provider, networkName, selectedNetwork: network});
  }

  onChangeChainId = (v) => {
    this.state.selectedChainId = v;
    this.state.shardIds = this.state.chainShardsInfo[v];
    this.state.fullShardKey = '000' + v.split(':')[1] + '000' + this.state.shardIds[0].split(':')[1];
    this.setState({ selectedChainId: v, shardIds: this.state.shardIds });
  }

  onChangeShardId = (v) => {
    this.state.selectedShardId = v;
    this.state.fullShardKey = '000' + this.state.selectedChainId.split(':')[1] + '000' + v.split(':')[1];
    this.setState({ selectedShardId: v });
  }

  onChangeAddress = (accountAddress, item) => {
    this.state.selectedAccountAddress = accountAddress;
    this.setState({ selectedAccountAddress: accountAddress });
    this.syncSolFileToSrv();
    if (this.state.web3) {
      const result = this.state.web3.qkc.getBalance(accountAddress).toString(10);
      if (result == 0) {
        Message.notice(T('本账号余额为0，无法发起交易，仅可以对链做查询操作'))
      }     
    }
  }

  
  changeLog = (v) => {
    this.state.resultInfo = v;
    this.setState({resultInfo: this.state.resultInfo});
  }

  handleContractNoChange = (v) => {
    this.state.contractIndex = v;
  }

  removeContractCall = () => {
    if (utils.isEmptyObj(this.state.contractIndex)) {
      Message.error(T('请输入待删除合约界面的编号'));
      return;
    }
    const index = parseInt(this.state.contractIndex);
    if (index > this.state.contractAccountInfo.length || index < 1) {
      Message.error(T('当前编号必须大于0，小于等于') + this.state.contractAccountInfo.length);
      return;
    }
    this.state.contractAccountInfo.splice(index - 1, 1);
    this.setState({contractAccountInfo: this.state.contractAccountInfo});
  }

  onChangeContractFile = (fileToCompile) => {
    this.setState({ selectedFileToCompile: fileToCompile });
  }

  onChangeContract = (contractToDeploy) => {
    const oneContractABI = this.getContractABI(contractToDeploy);
    if (oneContractABI != null) {
      this.parseConstructorInputs(oneContractABI);
    }
    this.state.curContractName = contractToDeploy.split(':')[1];
    this.setState({ selectedContractToDeploy: contractToDeploy, curContractName: this.state.curContractName });
  }

  handleLoadedContractAddressChange = (v) => {
    this.setState({ loadedContractAddress: v });
  }

  loadContract = () => {
    if (utils.isEmptyObj(this.state.loadedContractAddress)) {
      Message.error(T('请输入合约地址'));
      return;
    }
    const contractAbi = utils.getContractABI(this.state.loadedContractAddress);
    if (!utils.isEmptyObj(contractAbi)) {
      const contractName = this.getContractName(this.state.loadedContractAddress);
      this.displayContractFunc(this.state.loadedContractAddress, 
                                utils.isEmptyObj(contractName) ? 'tmpName-' + utils.getRandomInt(10000) : contractName , 
                                contractAbi);
      return;
    } else {
      Message.error(T('无此地址的ABI信息，因此无法加载'));
      return;
    }
  }
  addLog = (logInfo) => {
    let date = new Date().toLocaleString();
    logInfo = date + ':' + logInfo + '\n\n';
    this.setState({resultInfo: this.state.resultInfo + logInfo});
  }

  addRawLog = (logInfo) => {
    this.setState({resultInfo: this.state.resultInfo + logInfo});
  }

  copyAddress = () => {
    if (utils.isEmptyObj(this.state.selectedAccountAddress)) {
      Message.error(T('请选择需要拷贝的地址'));
      return;
    }
    
    copy(this.state.selectedAccountAddress + this.state.fullShardKey);
    Message.success(T('地址已复制到粘贴板'));
  }

  addNewAddress = () => {
    this.setState({addNewAddrDialogVisible: true});
  }

  getAccountData = () => {
    if (utils.isEmptyObj(this.state.selectedAccountAddress)) {
      Message.error(T('请选择需要拷贝的地址'));
      return;
    }

    qcRpc.getAccountData(this.state.selectedAccountAddress + this.state.fullShardKey, null, true).then(accountData => {
      this.setState({accountInfoDialogVisible: true, accountShardsInfo: accountData.shards, queryedAddress: this.state.selectedAccountAddress});
    });
  }

  getFullShardKeyInfo = (fullShardKey) => {
    const fullShardKeyValue = parseInt(fullShardKey);
    const chainId = fullShardKeyValue >> 16;
    const shardId = fullShardKeyValue & (this.state.chainShardsInfo['ChainId:' + chainId] - 1);
    return {chainId, shardId};
  }

  compareFullShardKey = (firstFullShardKeyInfo, secondFullShardKeyInfo) => {
    return (firstFullShardKeyInfo.chainId == secondFullShardKeyInfo.chainId) 
        && (firstFullShardKeyInfo.shardId == secondFullShardKeyInfo.shardId);
  }

  transferAsset = async () => {
    this.state.transferableAssets = [];
    const fullShardKeyInfo1 = this.getFullShardKeyInfo('0x' + this.state.fullShardKey);
    const accountData = await qcRpc.getAccountData(this.state.selectedAccountAddress + this.state.fullShardKey, null, true);
    if (accountData.shards == null) {
      const fullShardKeyInfo2 = this.getFullShardKeyInfo(accountData.primary.fullShardId);
      if (!this.compareFullShardKey(fullShardKeyInfo1, fullShardKeyInfo2)) {
        Message.error(T('对不起，您未拥有任何资产，因此不可进行转账'));
        return;
      }
      accountData.primary.label = accountData.primary.tokenStr;
      accountData.primary.value = accountData.primary.tokenId;
      this.state.transferableAssets = [accountData.primary];
    } else {
      for (let i = 0; i < accountData.shards.length; i++) {
        const shard = accountData.shards[i];
        const fullShardKeyInfo2 = this.getFullShardKeyInfo(shard.fullShardId);
        if (!this.compareFullShardKey(fullShardKeyInfo1, fullShardKeyInfo2)) {
          continue;
        }
        for (let j = 0; j < shard.balances.length; j++) {
          const wrapperedToken = utils.deepClone(shard.balances[j]);
          wrapperedToken.label = wrapperedToken.tokenStr;
          wrapperedToken.value = wrapperedToken.tokenId;
          this.state.transferableAssets.push(wrapperedToken);
        }
      }
    }
    if (this.state.transferableAssets.length == 0) {
      Message.error(T('对不起，您未拥有任何资产，因此不可进行转账'));
      return;
    }
    let assetAmount;
    let selecteAssetInfo;
    this.state.transferableAssets.map(assetInfo => {
      if (assetInfo.value == this.state.qkcTokenId) {
        assetAmount = new BigNumber(assetInfo.balance).shiftedBy(-18) + ' ' + assetInfo.tokenStr;
        selecteAssetInfo = assetInfo;
      }
    });

    this.setState({txConfirmVisible: true, transferableAssets: this.state.transferableAssets,
                   assetAmountTip: T('当前余额:') + assetAmount, selecteAssetInfo});
  }

  findImports = (path) => {
    for (const solFile of this.state.solFileList) {
      if (solFile == path) {
        const solCode = global.localStorage.getItem('sol:' + solFile);
        if (solCode != null) {
          return {constents: solCode};
        } 
        return {error: 'File not found'};
      }
     }

     for (const solFile of this.state.libFileList) {
      if ('/Lib/' + solFile == path) {
        const solCode = global.localStorage.getItem('sol:' + solFile);
        if (solCode != null) {
          return {constents: solCode};
        } 
        return {error: 'File not found'};
      }
     }
     return {error: 'File not found'};
  }

  compileContract = async () => {
    if (utils.isEmptyObj(this.state.selectedFileToCompile)) {
      Message.error(T('请选择待编译的文件'));
      return;
    }
    this.addLog(T("开始编译"));
    const compileResult = await CompilerSrv.compileSol(this.state.selectedAccountAddress, this.state.selectedFileToCompile);
    if (compileResult.err != null) {
      Message.error(T("编译失败"));
      this.addLog(compileResult.err);
      return;
    }
    Message.success(T("编译成功"));
    this.addLog(T('编译成功，结果') + ':\n' + JSON.stringify(compileResult));

    this.state.fileContractMap[this.state.selectedFileToCompile] = compileResult;
    this.state.contractList = [];
    for (var contractFile in this.state.fileContractMap) {
      const compiledInfo = this.state.fileContractMap[contractFile];
      for (var contractName in compiledInfo) {
        this.state.contractList.push(contractFile + ":" + contractName);
        this.addLog(T("合约") + contractName + T("编译结果") + "\n" + compiledInfo[contractName].abi);
      }
    }
    global.localStorage.setItem("contractList", JSON.stringify(this.state.contractList));
    global.localStorage.setItem("fileContractMap", JSON.stringify(this.state.fileContractMap));
    if (this.state.selectedContractToDeploy != null 
      && this.state.selectedContractToDeploy.indexOf(this.state.selectedFileToCompile) > -1) {
        this.state.selectedContractToDeploy = "";
        this.state.constructorParaNames = [];
        this.state.constructorParaTypes = [];
    }
    this.setState({contractList: this.state.contractList, selectedContractToDeploy: this.state.selectedContractToDeploy});
  }

  syncSolFileToSrv = () => {
    for (const solFile of this.state.solFileList) {
     const solCode = global.localStorage.getItem('sol:' + solFile);
     CompilerSrv.updateSol(this.state.selectedAccountAddress, solFile, solCode);
    }
  }

  setCompilerVersion = () => {
    this.setState({compilerVersionSettingVisible: true});
  }

  getContractABI = (contractInfos) => {
    const contractInfoElements = contractInfos.split(":");
    const contractFileName = contractInfoElements[0];
    const contractName = contractInfoElements[1];
    const compiledFileInfo = this.state.fileContractMap[contractFileName];
    for (let compiledContractName in compiledFileInfo) {
      if (compiledContractName == contractName) {
        return JSON.parse(compiledFileInfo[contractName].abi);
      }
    }
    return null;
  }

  parseConstructorInputs = (contractAbi) => {
    this.state.constructorParaNames = [];
    this.state.constructorParaTypes = [];
    for (let interfaceInfo of contractAbi) {
      if (interfaceInfo.type == 'constructor') {
        for (let input of interfaceInfo.inputs) {
          this.state.constructorParaNames.push(input.name);
          this.state.constructorParaTypes.push(input.type);
        }
        return;
      }
    }
  }
  getCompileInfo = (isAbi) => {
    if (this.state.selectedContractToDeploy == null) {
      Message.error(T('请选择需要获取其ABI/BIN信息的合约'));
      return;
    }
    const contractInfos = this.state.selectedContractToDeploy.split(":");
    const fileName = contractInfos[0];
    const compileResult = this.state.fileContractMap[fileName];
    for (let contractName in compileResult) {
      if (contractName == contractInfos[1]) {
        if (isAbi) {
          this.setState({curAbi: JSON.parse(compileResult[contractName].abi), displayAbiVisible: true});
        } else {
          this.setState({curBin: compileResult[contractName].bin, displayBinVisible: true});
        }
      }
    }
  }
  getAbi = () => {
    this.getCompileInfo(true);
  }
  getBin = () => {
    this.getCompileInfo(false);
  }
  
  onDisplayABIOK = () => {
    copy(JSON.stringify(this.state.curAbi));
    Message.success(T('ABI信息已拷贝到粘贴板'));
  }

  onDisplayABIClose = () => {
    this.setState({ displayAbiVisible: false });
  }

  onDisplayBINOK = () => {
    copy(this.state.curBin);
    Message.success(T('BIN信息已拷贝到粘贴板'));
  }

  onDisplayBINClose = () => {
    this.setState({ displayBinVisible: false });
  }
  // 部署合约
  deployContract = () => {
    try {
      if (utils.isEmptyObj(this.state.selectedAccountAddress)) {
        Message.error(T('请选择发起合约部署操作的账号'));
        return;
      }
      if (this.state.selectedContractToDeploy == null) {
        Message.error(T('请选择需要部署的合约'));
        return;
      }
      const contractInfos = this.state.selectedContractToDeploy.split(":");
      const compiledFileInfo = this.state.fileContractMap[contractInfos[0]];
      let contractBin = '';
      for (let contractName in compiledFileInfo) {
        if (contractName == contractInfos[1]) {
          contractBin = compiledFileInfo[contractName].bin;
          this.state.curContractABI = JSON.parse(compiledFileInfo[contractName].abi);
          this.state.curContractName = contractName;
        }
      }
      if (contractBin.length == 0) {
        Message.error(T('无合约bin信息'));
        return;
      }
      const values = [];
      let index = 0;
      for (let paraName of this.state.constructorParaNames) {
        let value = this.state.paraValue[this.state.curContractName + '-constructor-' + paraName];
        if (value == null) {
          Message.error(T('参数') + paraName + T('尚未输入值'));
          return;
        }
        const type = this.state.constructorParaTypes[index];
        if (type == 'bool') {
          value = ((value == 'false' || value == 0) ? false : true);
        }else if (type.lastIndexOf(']') === type.length - 1) {
          if (value.indexOf('[') != 0 || value.lastIndexOf(']') != value.length - 1) {
            Message.error(T('数组类型的值请按如下格式填写') + '：[a,b,c]');
            return;
          }          
          values.push(value.substr(1, value.length - 2).split(','));
        } else {
          values.push(value);
        }
        index++;
      }
      const constructorPayload = abiUtil.rawEncode(this.state.constructorParaTypes, values).toString('hex');
      const txParams = {
        to: '',
        gasPrice: '0x3b9aca00',
        gasLimit: '0xf4240',
        value: '0x0',
        data: '0x' + contractBin + constructorPayload,
        fromFullShardKey: '0x' + this.state.fullShardKey,
        toFullShardKey: '0x' + this.state.fullShardKey,
        networkId: this.state.networkId,
      }

      if (this.state.keystoreInfo[this.state.selectedAccountAddress] != null) {
        this.state.web3.qkc.setPrivateKey(this.state.keystoreInfo[this.state.selectedAccountAddress].privateKey);
      }
      // qcRpc.getTransactionCount(this.state.selectedAccountAddress + this.state.fullShardKey).then(result => {
      //   console.log(this.state.selectedAccountAddress + ':' + result);
      // });
      Message.success(T('开始部署合约'));
      this.state.web3.qkc.sendTransaction(txParams).then((transactionId) => {
        if (transactionId.startsWith('0x0000000000000000')) {
          Message.error(T('合约部署失败，请检查原因'));
          return;
        } 
        Message.success(T('部署合约的交易发送成功，等待区块生成'));
        this.addLog(T('交易发送成功') + '，ID = ' + transactionId + ' ，' + T('等待被矿工打包')); 
        
        const self = this;
        this.checkReceipt(T('部署合约'), transactionId, (receipt) => {
          Message.success(T('合约部署成功'));
          self.addLog(T('合约地址') + '：' + receipt.contractAddress);
          this.processContractDepolyed(receipt.contractAddress, this.state.curContractName, this.state.curContractABI);
        });
      });
    } catch (error) {
      Message.error(error.message || error);
      this.addLog(error.message);
    }
  }

  checkReceipt = (actionName, txHash, cbFunc) => {
    let count = 0;
    const self = this;
    const intervalId = setInterval(async () => {
      const receipt = await qcRpc.getTransactionReceipt(txHash);
      if (receipt == null || receipt.blockHeight == 0) {
        count++;
        self.addRawLog(count + 's...');
        if (count == 60) {
          self.addRawLog('\n\n');
          self.addLog(T('receipt生成超时，请检查链是否正常'));
          clearInterval(intervalId);
        }
      } else {
        self.addRawLog('\n\n');
        self.addLog(T('receipt已生成') + ':\n' + JSON.stringify(receipt));
        clearInterval(intervalId);
        const status = receipt.status;
        if (status == 0) {
          Message.error(actionName + T('交易执行失败'));
        } else if (cbFunc != null) {
          cbFunc(receipt);
        }
      }
    }, 1000);
  }

  processContractDepolyed = (contractAddress, contractName, contractAbi) => {
    if (this.checkABI(contractAbi)) {
      this.displayContractFunc(contractAddress, contractName, contractAbi);
      this.storeContractName(contractAddress, contractName);
      utils.storeContractABI(contractAddress, contractAbi);
    }
  }

  callContractFunc = (contractAddress, funcName) => {
    if (utils.isEmptyObj(this.state.selectedAccountAddress)) {
      Message.error(T('请选择发起合约调用的账号'));
      return;
    }

    if (utils.isEmptyObj(contractAddress)) {
      Message.error(T('请输入合约地址'));
      return;
    }
    const paraNames = this.state.funcParaNames[contractAddress][funcName];
    const values = [];
    let index = 0;
    for (const paraName of paraNames) {
      const value = this.state.paraValue[contractAddress + '-' + funcName + '-' + paraName];
      if (value == null) {
        Message.error(T('参数') + paraName + T('尚未输入值'));
        return;
      }
      const type = this.state.funcParaTypes[contractAddress][funcName][index];
      if (type.lastIndexOf(']') === type.length - 1) {
        if (value.indexOf('[') != 0 || value.lastIndexOf(']') != value.length - 1) {
          Message.error(T('数组类型的值请按如下格式填写') + '：[a,b,c]');
          return;
        }          
        values.push(value.substr(1, value.length - 2).split(','));
      } else {
        values.push(value);
      }
      index++;
    }
    const contractAbi = utils.getContractABI(contractAddress);
    if (contractAbi == null) {
      Message.error(T('合约ABI信息不存在，无法调用合约信息'));
      return;
    }

    const self = this;
    var myContract = this.state.web3.qkc.contract(contractAbi);
    myContract = myContract.at(contractAddress);
    //const contractFunc = myContract.methods[funcName];
    const simulate = this.state.funcParaConstant[contractAddress][funcName];
    const payload = this.getContractPayload(funcName, this.state.funcParaTypes[contractAddress][funcName], values);
    const txParams = {
      from: this.state.selectedAccountAddress + this.state.fullShardKey,
      to: contractAddress,
      gasPrice: '0x3b9aca00',
      gas: '0xf4240',
      value: '0x0',
      data: payload,
      gasTokenId: '0x8bb0',
      transferTokenId: '0x8bb0',
      networkId: this.state.networkId,
    }
    if (simulate) {
      qcRpc.call(txParams, 'latest').then(ret => {
        ret = utils.parseResult(self.state.funcResultOutputs[contractAddress][funcName], ret);
        this.addLog(T("调用函数") + funcName + T("获得的结果") + '：' + ret);
        self.state.result[contractAddress + funcName] = T('结果') + '：' + ret;
        self.setState({result: self.state.result});
      });
    } else {
      let transferAmount = this.state.transferTogether[contractAddress + funcName] ? 
                    new BigNumber(this.state.paraValue[contractAddress + '-' + funcName + '-transferAssetValue']) : new BigNumber(0);
      if (transferAmount.gt(new BigNumber(0))) {
        transferAmount = new BigNumber(transferAmount).shiftedBy(18);
        txParams.value = '0x' + transferAmount.toString(16);
      }  
      
      txParams.fromFullShardKey = '0x' + this.state.fullShardKey;
      txParams.toFullShardKey = '0x' + this.state.fullShardKey;

      if (this.state.keystoreInfo[this.state.selectedAccountAddress] != null) {
        this.state.web3.qkc.setPrivateKey(this.state.keystoreInfo[this.state.selectedAccountAddress].privateKey);
      }

      const self = this;
      this.state.web3.qkc.sendTransaction(txParams).then((transactionId) => {
        if (transactionId.startsWith('0x0000000000000000')) {
          Message.error(T('合约调用失败，请检查原因'));
          return;
        } 
        Message.success(T('调用合约的交易发送成功，等待区块生成'));
        self.addLog(T('交易发送成功') + '，ID = ' + transactionId + ' ，' + T('等待被矿工打包')); 
        self.state.result[contractAddress + funcName] = transactionId;
        qcRpc.getTransactionByHash(transactionId).then(txInfo => {
          self.state.result[contractAddress + funcName + 'TxInfo'] = txInfo;
          self.setState({result: self.state.result});
        })
        
        self.checkReceipt(T('合约方法调用'), transactionId, async (receipt) => {
          Message.success(T('合约方法调用成功'));
          self.state.result[contractAddress + funcName + 'TxInfo'] = await qcRpc.getTransactionByHash(transactionId);
          self.state.result[contractAddress + funcName + 'ReceiptInfo'] = receipt;
          self.setState({result: self.state.result});
        });
      });
    }
  }

  getContractPayload = (funcName, parameterTypes, parameterValues) => {
    return '0x' + abiUtil.methodID(funcName, parameterTypes).toString('hex') + abiUtil.rawEncode(parameterTypes, parameterValues).toString('hex');
  }

  getTxInfo = (contractAddress, funcName) => {
    const txHash = this.state.result[contractAddress + funcName];
    if (txHash != null) {
      if (txHash.indexOf('0x') != 0) {
        Message.error(T('非交易hash，无法查询'));
        return;
      }
      
      qcRpc.getTransactionByHash(txHash).then(txInfo => {        
        this.addLog(T("交易信息") + "\n" + JSON.stringify(txInfo));
        this.state.result[contractAddress + funcName + 'TxInfo'] = txInfo;
        this.setState({result: this.state.result});
      });
    }
  }

  getReceiptInfo = (contractAddress, funcName) => {
    const txHash = this.state.result[contractAddress + funcName];
    if (txHash != null) {
      if (txHash.indexOf('0x') != 0) {
        Message.error(T('非交易hash，无法查询'));
        return;
      }
      qcRpc.getTransactionReceipt(txHash).then(receipt => {
        if (receipt == null) {
          Message.error(T('区块尚未被打包，receipt尚未生成'));
          return;
        }
        this.addLog("receipt\n" + JSON.stringify(receipt));
        this.state.result[contractAddress + funcName + 'ReceiptInfo'] = receipt;
        this.setState({result: this.state.result});
        
        if (!receipt.status) {
          Message.error(T('Receipt表明本次交易执行失败，原因:'));
        } else {
          Message.success(T('Receipt表明本次交易执行成功'));
        }
      });
    }
  }

  getTxResult = (result) => {
    this.addLog(T("调用函数") + this.state.curCallFuncName + T("获取的结果") + ":" + result);
    this.state.result[this.state.curContractName + this.state.curCallFuncName] = result;
    this.setState({result: this.state.result});
    this.state.curTxResult[this.state.curContractName] = {};
    this.state.curTxResult[this.state.curContractName][this.state.curCallFuncName] = result;
  }

  selectTab = (key) => {
    this.setState({activeKey: key});
  }

  addSolTab = (fileName) => {
    if (fileName == null) {
      return;
    }
    let exist = false;
    this.state.tabFileList.map(tabFileName => {
      if (fileName == tabFileName) {
        exist = true;
      }
    });
    if (exist) {
      this.setState({activeKey: fileName});
    } else {
      this.state.tabFileList.push(fileName);
      this.setState({activeKey: fileName, tabFileList: this.state.tabFileList});
    }
  }

  delSolTab = (fileName) => {
    let index = this.state.tabFileList.indexOf(fileName);
    if (index > -1) {
      this.state.tabFileList.splice(index, 1);
    }
    if (index >= this.state.tabFileList.length) {
      index = this.state.tabFileList.length - 1;
    }
    this.setState({tabFileList: this.state.tabFileList, activeKey: index >= 0 ? this.state.tabFileList[index] : ''});
  }

  updateSolTab = (oldFileName, newFileName) => {
    const index = this.state.tabFileList.indexOf(oldFileName);
    if (index > -1) {
      this.state.tabFileList.splice(index, 1, newFileName);
    }
    let activeLabKey = this.state.activeKey;
    if (activeLabKey == oldFileName) {
      activeLabKey = newFileName;
    }

    const solCode = global.localStorage.getItem('sol:' + oldFileName);
    global.localStorage.setItem('sol:' + newFileName, solCode);
    global.localStorage.removeItem('sol:' + oldFileName);

    this.setState({activeKey: activeLabKey, tabFileList: this.state.tabFileList});
  }

  onClose = (targetKey) => {
    this.delSolTab(targetKey);
  }

  onEditFinish(key, label, node) {
    this.state.solFileList.map((solFileName, index) => {
      if (solFileName == key) {        
        this.state.solFileList[index] = label;
      }
    });
    if (this.state.selectedFileToCompile == key) {
      this.state.selectedFileToCompile = label;
    }
    this.state.contractList.map((contractFile, index) => {
      const contractInfos = contractFile.split(":");
      if (contractInfos[0] == key) {        
        this.state.contractList[index] = label + ":" + contractInfos[1];
      }
    });
    if (this.state.selectedContractToDeploy != null && this.state.selectedContractToDeploy.split(":")[0] == key) {
      this.state.selectedContractToDeploy = label + ":" + this.state.selectedContractToDeploy.split(":")[1];
    }

    this.setState({solFileList: this.state.solFileList, contractFile: this.state.contractList});
    this.updateSolTab(key, label);
    CompilerSrv.renameSol(this.state.selectedAccountAddress, key, label);
  }

  onSelectSolFile = (selectedKeys) => {
    console.log('onSelectSolFile', selectedKeys);
    this.state.selectContactFile = selectedKeys[0];
    this.addSolTab(this.state.selectContactFile);
  }
  addSolFile = () => {
    this.setState({addNewContractFileVisible: true});
  }

  saveSolFile = () => {
    if (this.state.selectContactFile.length > 0) {
      const index = this.state.solFileList.indexOf(this.state.selectContactFile);
      if (index > -1) {
        const fileName = this.state.selectContactFile;
        const fileContent = global.localStorage.getItem('sol:' + fileName);
        utils.doSave(fileContent, 'text/latex', fileName);
      }
    } else {
      Message.error(T('请先选中需保存到本地的合约文件'));
    }
  }

  handleContractNameChange = (value) => {
    this.state.newContractFileName = value;
  }

  handleContractAccountNameChange = (value) => {
    this.setState({newContractAccountName: value});
  }

  handleContractPublicKeyChange = (value) => {
    this.setState({newContractPublicKey: value});
  }

  handleFTAmountChange = (value) => {
    this.setState({ftAmount: value});
  }

  handleNewAddrChange = (v) => {
    this.state.privateKey = v;
    if (v.length == 66) {
      const pubKey = EthCrypto.publicKeyByPrivateKey(this.state.privateKey);
      const address = EthCrypto.publicKey.toAddress(pubKey);
      this.setState({privateKey: this.state.privateKey, newAddr: address});
    } else {
      this.setState({privateKey: this.state.privateKey});
    }
  }

  queryAccount = () => {
    if (utils.isEmptyObj(this.state.queryedAddress)) {
      this.state.queryedAddress = this.state.selectedAccountAddress;
      if (utils.isEmptyObj(this.state.queryedAddress)) {
        Message.error(T('请输入待查询账号'));
        return;
      }
    }
    if (!this.state.queryedAddress.startsWith('0x')) {
      this.state.queryedAddress = '0x' + this.state.queryedAddress;
    }
    if (this.state.queryedAddress.length == 42) {
      this.state.queryedAddress += this.state.fullShardKey;
    }
    if (this.state.queryedAddress.length != 50) {
      Message.error(T('账号格式错误，请修改后再查询'));
      return;
    }
    const self = this;
    qcRpc.getAccountData(this.state.queryedAddress, null, true).then(accountData => {
      if (accountData.shards == null) {
        self.state.accountShardsInfo = [accountData.primary];
        self.setState({accountShardsInfo: self.state.accountShardsInfo});
      } else {
        this.state.accountShardsInfo = accountData.shards;
        self.setState({accountShardsInfo: self.state.accountShardsInfo});
      }
    }).catch(error => {
      Message.error(T('发生错误') + ':' + error);
    });
  }

  getTxsByAddr = (address) => {
    this.setState({accountTxsVisible: true});
    this.state.accountTxsInfo = [];    
    this.iterAccountTxs(address, '');
  }

  iterAccountTxs = (address, next) => {
    qcRpc.getTransactionsByAddress(address, next, '', this.state.qkcTokenId).then(result => {
      this.state.accountTxsInfo.push(result.txList.map(tx => {
        tx.blockHeight = parseInt(tx.blockHeight);
        tx.value = new BigNumber(tx.value).shiftedBy(-18).toString(10) + ' ' + tx.transferTokenStr;
        const date = new Date();
        date.setTime(parseInt(tx.timestamp) * 1000);
        tx.timestamp = date.toLocaleString();
        return tx;
      }));
      this.setState({accountTxsInfo: this.state.accountTxsInfo});
      if (result.txList.length == 20) {
        this.iterAccountTxs(address, result.next);
      }
    });
  }

  onAddNewContractFileOK = () => {
    if (!this.state.newContractFileName.endsWith('.sol')) {
      this.state.newContractFileName = this.state.newContractFileName + '.sol';
    }
    let exist = false;
    this.state.solFileList.map(contractFileName => {
      if (this.state.newContractFileName == contractFileName) {
        exist = true;
      }
    });
    if (exist) {
      Message.error(T('文件已存在'));
      return;
    }

    this.state.solFileList.push(this.state.newContractFileName);
    this.setState({solFileList: this.state.solFileList, activeKey: this.state.newContractFileName, addNewContractFileVisible: false});
    this.addSolTab(this.state.newContractFileName);
    CompilerSrv.addSol(this.state.selectedAccountAddress, this.state.newContractFileName);
  }

  onAddNewContractFileClose = () => {
    this.setState({addNewContractFileVisible: false});
  }

  handleCompileSrvChange = (v) => {
    this.state.compileSrv = v;
  }

  onSetNodeAddrOK = () => {
    if (this.state.nodeAddr == null) {
      Message.error(T('请输入自定义节点地址'));
      return;
    }
    if (!this.state.httpReg.test(this.state.nodeAddr)) {
      Message.error(T('节点地址信息错误'));
      return;
    }
    this.state.web3 = new Web3(this.state.nodeAddr);

    const networkName = this.state.nodeAddr;
    const networkInfoObj = {selectedNetwork: 4, networkName};
    global.localStorage.setItem('networkInfo', JSON.stringify(networkInfoObj));
    this.setState({addBtnEnable: true, currentProvider: networkName, networkName, nodeAddrSettingVisible: false, selectedNetwork: 4});
  }

  onSetNodeAddrClose = () => {
    this.setState({nodeAddrSettingVisible: false, selectedNetwork: this.state.selectedNetwork});
  }

  handleNodeAddrChange = (v) => {
    this.state.nodeAddr = (v.indexOf('http://') == 0 || v.indexOf('https://') == 0)? v : 'http://' + v;
  }
  onChangeCompilerVersion = (v) => {
    this.state.compilerVersion = v;
  }
  onSetCompilerVersionOK = () => {
    if (utils.isEmptyObj(this.state.compilerVersion)) {
      Message.error(T('请选择Solidity编译器版本'));
      return;
    }
    global.localStorage.setItem('compilerVersion', this.state.compilerVersion);
    this.setState({compilerVersionSettingVisible: false});
    CompilerSrv.loadCompiler(this.state.compilerVersion);
  }

  onSetCompilerVersionClose = () => {
    this.setState({compileSrvSettingVisible: false});
  }  

  onAddContractABIOK = () => {
    if (!utils.isEmptyObj(this.state.contractABI) && !hyperchain.utils.isValidABI(this.state.contractABI)) {
      Message.error(T('ABI信息不符合规范，请检查后重新输入'));
      return;
    }
    utils.storeContractABI(this.state.loadedContractAddress, JSON.parse(this.state.contractABI));
    const contractName = this.getContractName(this.state.loadedContractAddress);
    this.displayContractFunc(this.state.loadedContractAddress, utils.isEmptyObj(contractName) ? 'tmpName-' + utils.getRandomInt(10000) : contractName , JSON.parse(this.state.contractABI));
    this.setState({ contractInfoVisible: false });
  }

  onAddContractABIClose = () => {
    this.setState({ contractInfoVisible: false });
  }

  handleContractABIChange = (value) => {
    this.state.contractABI = value;
  }

  storeContractName = (contractAddress, contractName) => {
    let storedName = utils.getDataFromFile(Constant.ContractNameFile);
    if (storedName != null) {
      storedName[contractAddress] = contractName;
    } else {
      storedName = {};
      storedName[contractAddress] = contractName;
    }
    utils.storeDataToFile(Constant.ContractNameFile, storedName);
  }
  
  getContractName = (contractAddress) => {
    let storedName = utils.getDataFromFile(Constant.ContractNameFile);
    if (storedName != null) {
      return storedName[contractAddress];
    }
    return null;
  }

  processContractDepolyed = (contractAddress, contractName, contractAbi) => {
    if (this.checkABI(contractAbi)) {
      this.displayContractFunc(contractAddress, contractName, contractAbi);
      this.storeContractName(contractAddress, contractName);
      utils.storeContractABI(contractAddress, contractAbi);
    }
  }

  displayContractFunc = (contractAddress, contractName, contractAbi) => {
    this.state.contractAccountInfo = [{contractAddress, contractName, contractAbi, genTime:new Date().toLocaleString()}, ...this.state.contractAccountInfo];
    this.setState({contractAccountInfo: this.state.contractAccountInfo});
  }
  
  processContractUpdated = (contractAddress, contractName, contractAbi) => {
    if (this.checkABI(contractAbi)) {
      this.replaceContractFunc(contractAddress, contractName, contractAbi);
      this.storeContractName(contractAddress, contractName);
      utils.storeContractABI(contractAddress, contractAbi);
    }
  }

  replaceContractFunc = (contractAddress, contractName, contractAbi) => {
    this.state.contractAccountInfo = this.state.contractAccountInfo.filter((item, index) => item.contractAddress != contractAddress);
    this.state.contractAccountInfo = [{contractAddress, contractName, contractAbi, genTime:new Date().toLocaleString()}, ...this.state.contractAccountInfo];    
    contractAbi.map(interfaceInfo => {
      if (interfaceInfo.type === 'function') {
        const funcName = interfaceInfo.name;
        this.state.result[contractAddress + funcName] = '';
        if (!interfaceInfo.constant) {
          this.state.result[contractAddress + funcName + 'TxReceipt'] = '';
        }
      }
    });
    
    this.setState({contractAccountInfo: this.state.contractAccountInfo});
  }

  onDeployContractClose = () => {
    this.setState({deployContractVisible: false});
  }
  delSolFile = () => {
    if (this.state.selectContactFile.length > 0) {
      const index = this.state.solFileList.indexOf(this.state.selectContactFile);
      if (index > -1) {
        this.state.solFileList.splice(index, 1);
        this.setState({solFileList: this.state.solFileList});
        this.delSolTab(this.state.selectContactFile);
        CompilerSrv.delSol(this.state.selectedAccountAddress, this.state.selectContactFile);
      }
    }
  }

  shareCode = () => {
    Dialog.confirm({
      title: T('分享您的合约代码'),
      content: T('确认分享后，您在本IDE中的编码将通过类似直播的方式被分享出去。'),
      messageProps:{
          type: 'success'
      },
      okProps: {children: T('分享代码'), className: 'unknown'},
      cancelProps: {children: T('取消'), className: 'unknown'},
      onOk: () => {this.shareCodeTx();},
      onCancel: () => { }
    });
  }

  shareCodeTx = () => {
    Message.success(T('即将上线，敬请期待'));
  }

  selectShareCodeAccount = (v) => {
    this.state.selectedSharedAddress = v;
  }

  syncContracts = () => {
    if (utils.isEmptyObj(this.state.selectedSharedAddress)) {
      Message.error(T('请先选择需要同步的合约地址'));
      return;
    }
  }

  onRightClick(info) {
    console.log('onRightClick', info);
  }

  
  onAccountInfoOK = () => { 
    this.onAccountInfoClose();
  }

  onAccountInfoClose = () => {
    this.setState({
      accountInfoDialogVisible: false,
    });
  };  

  generateNewKey = () => { 
    const key = Keystore.generateKey();
    this.setState({privateKey: key.privateKey, newAddr: key.address});
  }

  handleAddressChange = (v) => {
    this.state.queryedAddress = v;    
    this.setState({queryedAddress: v});
  }

  onAddNewAddrOK = () => {
    if (utils.isEmptyObj(this.state.privateKey)) {
      Message.error(T('请输入私钥'));
      return;
    }
    if (this.state.privateKey.length != 66) {
      Message.error(T('请输入合法的私钥'));
      return;
    }
    const pubKey = EthCrypto.publicKeyByPrivateKey(this.state.privateKey);
    const address = EthCrypto.publicKey.toAddress(pubKey);
    const key = {privateKey: this.state.privateKey, publicKey: pubKey, address};
    this.state.keystoreInfo[address] = key;
    this.state.addresses.push({label: address, value: address});
    
    const keystoreList = utils.loadKeystoreFromLS();    
    keystoreList.push(key);
    utils.storeDataToFile(Constant.KeyStoreFile, keystoreList);
    this.setState({addresses: this.state.addresses, addNewAddrDialogVisible: false});
    Message.success(T('地址添加成功'));
  }
  
  onAddNewAddrClose = () => {
    this.setState({
      addNewAddrDialogVisible: false,
    });
  }

  balancesRender = (balances) => {
    let newBalances = utils.deepClone(balances);
    newBalances = newBalances.map(balance => {
      balance.balance = new BigNumber(balance.balance).shiftedBy(-18) + ' ' + balance.tokenStr;
      return balance;
    });
    return <ReactJson src={newBalances}/>;
  }  

  txsRender = (v, index) => {
    const shardInfo = this.state.accountShardsInfo[index];
    const fullShardKey = '000' + parseInt(shardInfo.chainId) + '000' + parseInt(shardInfo.shardId);
    return <Button text onClick={() => {this.getTxsByAddr(this.state.queryedAddress + fullShardKey);}}>{parseInt(v)}({T('点击查看')})</Button>
  }

  handleReceiverChange (v) {
    this.state.receiver = v;
  }
  
  handleAssetAmountChange(v) {
    this.state.assetAmount = v;
  }

  handleGasPriceChange(v) {
    this.state.gasPrice = v;
  }

  handleGasLimitChange(v) {
    this.state.gasLimit = v;
  }

  handleRemarkChange(v) {
    this.state.remark = v;
  }

  onTxConfirmOK = (values) => {
    values.value = '0x' + new BigNumber(values.value).shiftedBy(18).toString(16);
    values.gas = '0x' + new BigNumber(values.gas).toString(16);
    values.gasPrice = '0x' + new BigNumber(values.gasPrice).shiftedBy(9).toString(16);

    values.gasTokenId = this.state.qkcTokenId;
    values.transferTokenId = this.state.selecteAssetInfo.tokenId;
    values.networkId = this.state.networkId;
    values.fromFullShardKey = '0x' + values.from.substr(values.from.length - 8);
    values.toFullShardKey = '0x' + values.to.substr(values.to.length - 8);

    console.log(values);

    if (this.state.keystoreInfo[values.from] != null) {
      this.state.web3.qkc.setPrivateKey(this.state.keystoreInfo[values.from].privateKey);
    }

    Message.success(T('开始发送转账交易'));
    const self = this;
    const txParams = values;
    this.state.web3.qkc.sendTransaction(txParams).then((transactionId) => {
      if (transactionId.startsWith('0x0000000000000000')) {
        Message.error(T('交易提交失败，请检查原因'));
        return;
      } 
      Message.success(T('交易提交成功，等待区块生成'));
      self.addLog(T('交易发送成功') + '，ID = ' + transactionId + ' ，' + T('等待被矿工打包'));
      self.onTxConfirmClose();
      
      self.checkReceipt(T('转账'), transactionId, async (receipt) => {
        Message.success(T('转账成功'));  
      });
    });
  }

  onTxConfirmClose = () => {
    this.setState({txConfirmVisible: false});
  }

  selectAssetType = (v) => {
    this.state.transferableAssets.map(assetInfo => {
      if (assetInfo.value == v) {
        const assetAmount = new BigNumber(assetInfo.balance).shiftedBy(-18) + ' ' + assetInfo.tokenStr;
        this.setState({assetAmountTip: T('当前余额') + ':' + assetAmount, selecteAssetInfo: assetInfo});
      }
    });
  }

  render() {
    global.localStorage.setItem("solFileList", this.state.solFileList);
    const triggerBtn = <Button text iconSize='large' style={{marginBottom: "5px"}} onClick={() => this.setState({resultInfo: T('日志输出') + ':\n'})}><Icon type="ashbin" size='large'/></Button>;    
    
    const copyAccountBtn = <Button text iconSize='medium' onClick={this.copyAddress.bind(this)}> <FoundationSymbol size="large" type='copy' /> </Button>
    const addAccountBtn = <Button text iconSize='medium' onClick={this.addNewAddress.bind(this)}> <Icon size='large' type="add"/> </Button>
    const searchAccountBtn = <Button text iconSize='medium' onClick={this.getAccountData.bind(this)}> <FoundationSymbol size="large" type='search' /> </Button>
    const transferBtn = <Button text iconSize='medium' onClick={this.transferAsset.bind(this)}> <FoundationSymbol size="large" type='redpacket' /> </Button>        
    const compilerLink = <a href='https://solidity.readthedocs.io/en/v0.5.11/' target='_blank'>v0.5.11</a>
    const formItemLayout = {
      labelCol: {
          fixedSpan: 4
      },
      wrapperCol: {
          span: 20
      }
    };                                
    const self = this;
    return (
      <div>
        <Row className="custom-row">
            <Col fixedSpan="12" className="custom-col-left-sidebar">
              <br />
              <Row justify='space-between'>
                <Button type="primary" onClick={this.addSolFile}>{T('添加')}</Button>
                <Button type="primary" onClick={this.delSolFile}>{T('删除')}</Button>
                <Button type="primary" onClick={this.saveSolFile}>{T('保存')}</Button>
                <Button type="primary" onClick={this.shareCode.bind(this)}>{T("分享")}</Button>
              </Row>
              <br />
              <Tree editable showLine draggable selectable
                  defaultExpandedKeys={['0', '1', '2']}
                  onEditFinish={this.onEditFinish.bind(this)}
                  onRightClick={this.onRightClick}
                  onSelect={this.onSelectSolFile}>
                  <TreeNode key="0" label={T("我的合约")} selectable={false}>
                    {
                      this.state.solFileList.map(solFile => <TreeNode key={solFile} label={solFile}/>)
                    }
                  </TreeNode>
                  
                  <TreeNode key="1" label={T("公共库(可直接调用)")} selectable={false}>
                    {
                      this.state.libFileList.map(solFile => <TreeNode key={solFile} label={solFile}/>)
                    }
                  </TreeNode>
                  
                  <TreeNode key="2" label={T("示例(仅供参考)")} selectable={false}>
                    {
                      this.state.smapleFileList.map(solFile => <TreeNode key={solFile} label={solFile}/>)
                    }
                  </TreeNode>
              </Tree>
              <br /><br />
              <Select
                  style={{ width: '90%' }}
                  placeholder={T("分享合约的地址列表")}
                  onChange={this.selectShareCodeAccount.bind(this)}
                  dataSource={this.state.accountsOfShareCode}
                />
              <br /><br />
              <Button type="primary" onClick={this.syncContracts.bind(this)}>{T("同步合约")}</Button>
              <Tree editable showLine draggable selectable
                  defaultExpandedKeys={['0']}
                  onRightClick={this.onRightClick}
                  onSelect={this.onSelectSolFile}>
                  <TreeNode key="0" label={T("xxx分享的合约")} selectable={false}>
                    {
                      this.state.solFileList.map(solFile => <TreeNode key={solFile} label={solFile}/>)
                    }
                  </TreeNode>
              </Tree>
            </Col>
            <Col className="custom-col-content">
              <Tab activeKey={this.state.activeKey} excessMode="slide" onClose={this.onClose.bind(this)} onClick={this.selectTab}>
                {
                  this.state.tabFileList.map(fileName =>
                          <Tab.Item closeable={true} key={fileName} title={fileName} tabStyle={{ height:'20px',opacity:0.2}}>
                            <ContractEditor fileName={fileName} accountName={this.state.selectedAccountAddress}/>
                          </Tab.Item>
                  )
                }
              </Tab>
              
              <br />
              <Row justify='end'>
                <Balloon trigger={triggerBtn} closable={false}>
                    {T('清空日志')}
                </Balloon>
              </Row>
              <Input.TextArea hasClear
                autoHeight={{ minRows: 20, maxRows: 20 }} 
                value={this.state.resultInfo}
                size="medium"
                onChange={this.changeLog.bind(this)}
              />
              <br />
              <br />  
              <Input hasClear
                  onChange={this.handleContractNoChange.bind(this)}
                  style={{ width: 220 }}
                  addonTextBefore={T("编号")}
                  size="medium"
                />
              &nbsp;&nbsp;&nbsp;
              <Button type="primary" onClick={this.removeContractCall.bind(this)}>{T("删除")}</Button>
              <br />  
              <br />     
              <ContractCollapse self={self} contractAccountInfo={this.state.contractAccountInfo}/>
            </Col>
            <Col fixedSpan="15" className="custom-col-right-sidebar">
              <Row style={{width: '100%'}}>
                <Select
                  style={{ width: 150 }}
                  placeholder={T("选择Chain ID")}
                  value={this.state.selectedChainId}
                  onChange={this.onChangeChainId.bind(this)}
                  dataSource={this.state.chainIds}
                />
                &nbsp;&nbsp;
                <Select
                  style={{ width: 150 }}
                  placeholder={T("选择Shard ID")}
                  value={this.state.selectedShardId}
                  onChange={this.onChangeShardId.bind(this)}
                  dataSource={this.state.shardIds}
                />
              </Row>
              <Row style={{width: '100%', color: '#fff'}}>
                {this.state.networkName ? 'Network: ' + this.state.networkName : ''}
              </Row>
              <br/>
              <Row style={{width: '100%'}} justify="space-between">
                <Select
                  style={{ width: '65%' }}
                  placeholder={T("选择账号")}
                  onChange={this.onChangeAddress.bind(this)}
                  // defaultValue={this.state.addresses.length > 0 ? this.state.addresses[0] : ''}
                  dataSource={this.state.addresses}
                />
                <Balloon trigger={copyAccountBtn} closable={false}>
                    {T('复制账号')}
                </Balloon>
                <Balloon trigger={addAccountBtn} closable={false}>
                    {T('添加账号')}
                </Balloon>
                <Balloon trigger={searchAccountBtn} closable={false}>
                    {T('查询账号')}
                </Balloon>
                <Balloon trigger={transferBtn} closable={false}>
                    {T('转账')}
                </Balloon>
              </Row>
              <br/>
              <Row style={{width: '100%'}}>
                <Select
                  style={{ width: 240 }}
                  placeholder={T("请选择待编译文件")}
                  onChange={this.onChangeContractFile.bind(this)}
                  value={this.state.selectedFileToCompile}
                  dataSource={this.state.solFileList}
                />
                &nbsp;&nbsp;&nbsp;
                <Button type="primary" onClick={this.compileContract.bind(this)}>{T("编译")}</Button>
                {/* &nbsp;&nbsp;&nbsp;
                <Button type="primary" onClick={this.setCompilerVersion.bind(this)}>{T("配置")}</Button> */}
              </Row>
              
              <Row style={{width: '100%', color: '#fff'}}>
                {this.state.compilerVersion ? 'Solidity' + T('编译器版本') + ':' : ''}{compilerLink}
              </Row>
              
              <br/><br/>
              <Row style={{width:'100%'}}>
                <Select
                  style={{ width: 240 }}
                  placeholder={T("请选择合约")}
                  onChange={this.onChangeContract.bind(this)}
                  dataSource={this.state.contractList}
                />
                &nbsp;&nbsp;&nbsp;
                <Button type="primary" onClick={this.deployContract.bind(this)}>{T("部署")}</Button>
              </Row>
              <br/>
              <Row style={{width:'100%'}}>
                <Button type="primary" onClick={this.getAbi.bind(this)}>{T("查看ABI")}</Button>
                &nbsp;&nbsp;
                <Button type="primary" onClick={this.getBin.bind(this)}>{T("查看BIN")}</Button>
              </Row>
              <br/>
              <Row style={{width:'100%'}}>
                <Input hasClear
                  onChange={this.handleLoadedContractAddressChange.bind(this)}
                  value={this.state.loadedContractAddress}
                  style={{ width: 240 }}
                  addonTextBefore={T("合约地址")}
                  size="medium"
                />
                &nbsp;&nbsp;&nbsp;
                <Button type="primary" onClick={this.loadContract.bind(this)}>{T("加载")}</Button>
              </Row>
              <br/>
              {
                this.state.constructorParaNames.length > 0 ? 
                <Card style={{ width: '100%', marginBottom: "10px" }} bodyHeight="auto" title={T("构造函数")}>
                  <Parameters self={this} width='100%' contractAddress={this.state.curContractName} funcName='constructor' 
                    parameterNames={this.state.constructorParaNames} parameterTypes={this.state.constructorParaTypes} />
                </Card> : ''
              }
             
            </Col>
        </Row>
        
        <br />
        <br />
        <Dialog
          visible={this.state.addNewContractFileVisible}
          title={T("请输入合约文件名称")}
          closeable="true"
          footerAlign="center"
          onOk={this.onAddNewContractFileOK.bind(this)}
          onCancel={this.onAddNewContractFileClose.bind(this)}
          onClose={this.onAddNewContractFileClose.bind(this)}
        >
          <Input hasClear
            onChange={this.handleContractNameChange.bind(this)}
            onPressEnter={this.onAddNewContractFileOK.bind(this)}
            style={{ width: 200 }}
            addonTextBefore={T("合约文件名")}
            size="medium"
          />
        </Dialog>
        
        <Dialog closeable='close,esc,mask'
          visible={this.state.compilerVersionSettingVisible}
          title={T("请选择Solidity编译器版本")}
          closeable="true"
          footerAlign="center"
          onOk={this.onSetCompilerVersionOK.bind(this)}
          onCancel={this.onSetCompilerVersionClose.bind(this)}
          onClose={this.onSetCompilerVersionClose.bind(this)}
        >
          <Select showSearch placeholder={T("编译器版本")}
            style={{ width: 350 }}
            onChange={this.onChangeCompilerVersion.bind(this)}
            dataSource={this.state.compilerVersionList}
          />
          <br/>
          <Checkbox onChange={checked => {
            this.setState({compilerVersionList: checked ? this.state.allCompilerVersionList : this.state.commitCompilerVersionList})}}>
            Include nightly builds
          </Checkbox>
        </Dialog>
        
        <Dialog closeable='close,esc,mask'
          visible={this.state.nodeAddrSettingVisible}
          title={T("请输入自定义节点地址")}
          closeable="true"
          footerAlign="center"
          onOk={this.onSetNodeAddrOK.bind(this)}
          onCancel={this.onSetNodeAddrClose.bind(this)}
          onClose={this.onSetNodeAddrClose.bind(this)}
        >
          <Input hasClear
            onChange={this.handleNodeAddrChange.bind(this)}
            style={{ width: 350 }}
            addonTextBefore={T("节点地址")}
            size="medium"
          />
        </Dialog>

        <Dialog closeable='close,esc,mask'
          visible={this.state.contractInfoVisible}
          title={T("本地添加合约ABI信息")}
          footerAlign="center"
          onOk={this.onAddContractABIOK.bind(this)}
          onCancel={this.onAddContractABIClose.bind(this)}
          onClose={this.onAddContractABIClose.bind(this)}
        >
          <Input hasClear multiple
            onChange={this.handleContractABIChange.bind(this)}
            style={{ width: 400 }}
            addonTextBefore={T("ABI信息")}
            size="medium"
            defaultValue={this.state.originalABI}
            hasLimitHint
          />
        </Dialog>
        <Dialog closeable='close,esc,mask'
          visible={this.state.displayAbiVisible}
          title={T("合约ABI信息")}
          footerAlign="center"
          onOk={this.onDisplayABIOK.bind(this)}
          onCancel={this.onDisplayABIClose.bind(this)}
          onClose={this.onDisplayABIClose.bind(this)}
          okProps={{children: T('复制ABI')}}
        >
          <ReactJson src={this.state.curAbi}/>
        </Dialog>

        <Dialog closeable='close,esc,mask'
          style={{ width: '500px' }}
          visible={this.state.displayBinVisible}
          title={T("合约BIN信息")}
          footerAlign="center"
          onOk={this.onDisplayBINOK.bind(this)}
          onCancel={this.onDisplayBINClose.bind(this)}
          onClose={this.onDisplayBINClose.bind(this)}
          okProps={{children: T('复制BIN')}}
        >
          <IceEllipsis lineNumber={10} text= {this.state.curBin} />
        </Dialog>
        <Dialog
          visible={this.state.addNewAddrDialogVisible}
          onOk={this.onAddNewAddrOK.bind(this)}
          onCancel={this.onAddNewAddrClose}
          onClose={this.onAddNewAddrClose}
          title={T("新账号")}
          footerAlign="center"
        >
          <Input hasClear
            onChange={this.handleNewAddrChange.bind(this)}
            style={{ width: 400 }}
            addonTextBefore={T("账户私钥")}
            placeholder={addrPlaceholder}
            size="medium"
            value={this.state.privateKey}
            maxLength={66}
            hasLimitHint
            onPressEnter={this.onAddNewAddrOK.bind(this)}
          />
          &nbsp;&nbsp;
          <Button type="primary" onClick={this.generateNewKey.bind(this)}>{T("自动生成")}</Button>
          <br/><br/>
          <Input hasClear readOnly
            style={{ width: 400 }}
            addonTextBefore={T("账户地址")}
            size="medium"
            value={this.state.newAddr}
          />
        </Dialog>
        <Dialog style={{ width: "50%" }}
          visible={this.state.accountInfoDialogVisible}
          onOk={this.onAccountInfoClose.bind(this)}
          onCancel={this.onAccountInfoClose}
          onClose={this.onAccountInfoClose}
          title={T("账户资产信息")}
          footerAlign="center"
          footerActions="ok"
          footer={this.state.assetListFooter}
        >
          <Input hasClear
            onChange={this.handleAddressChange.bind(this)}
            style={{ width: "70%" }}
            addonTextBefore={T("当前账号")}
            size="medium"
            value={this.state.queryedAddress}
            hasLimitHint
            onPressEnter={this.queryAccount.bind(this)}
          />
          <br/>
          <br/>
          <Table dataSource={this.state.accountShardsInfo}>
            <Table.Column title={T("链Id")} dataIndex="chainId" cell={chainId => parseInt(chainId)}/>
            <Table.Column title={T("分片Id")} dataIndex="shardId" cell={shardId => parseInt(shardId)}/>
            <Table.Column title={T("资产")} dataIndex="balances" cell={this.balancesRender} width={'50%'}/>
            <Table.Column title={T("总交易数")} dataIndex="transactionCount" cell={this.txsRender.bind(this)}/>
            <Table.Column title={T("是否合约")} dataIndex="isContract" cell={isContract => isContract ? T('是') : T('否')}/>
          </Table>
        </Dialog>
        <Dialog style={{ width: "50%" }}
          visible={this.state.accountTxsVisible}
          closeable="close,esc,mask"
          onOk={() => this.setState({accountTxsVisible: false})}
          onCancel={() => this.setState({accountTxsVisible: false})}
          onClose={() => this.setState({accountTxsVisible: false})}
          title={T("交易信息")}
          footerAlign="center"
          shouldUpdatePosition={true}
          isFullScreen={true}
        >
          <ReactJson src={this.state.accountTxsInfo}/>
        </Dialog>
        <Dialog style={{ width: "30%" }}
          visible={this.state.txConfirmVisible}
          title={T("转账交易")}
          closeable="close,esc,mask"
          footer={false}
          onOk={this.onTxConfirmOK.bind(this)}
          onCancel={this.onTxConfirmClose.bind(this)}
          onClose={this.onTxConfirmClose.bind(this)}
        >
          <Form style={{width: '100%'}} {...formItemLayout} >
            <FormItem label={T("付款方")}>
                <Input name="from" readonly defaultValue={this.state.selectedAccountAddress + this.state.fullShardKey} />
            </FormItem>
            <FormItem label={T("收款方")} required asterisk autoValidate length={50}>
                <Input name="to" hasClear autoFocus hasLimitHint/>
            </FormItem>
            <FormItem label={T("付款金额")} required asterisk autoValidate format='number' help={this.state.assetAmountTip}>
                <Input name="value" hasClear hasLimitHint 
                addonAfter={<Select defaultValue={this.state.qkcTokenId} 
                                    dataSource={this.state.transferableAssets} 
                                    onChange={this.selectAssetType.bind(this)}/>}
                                    />
            </FormItem>
            <FormItem label={T("GAS单价")} required asterisk autoValidate format='number'>
                <Input name="gasPrice" hasClear hasLimitHint addonAfter='Gwei' defaultValue='10'/>
            </FormItem>
            <FormItem label={T("GAS上限")} required asterisk autoValidate format='number'>
                <Input name="gas" hasClear hasLimitHint defaultValue='30000'/>
            </FormItem>
            <FormItem label={T("备注")}>
                <Input.TextArea name="data" hasClear hasLimitHint maxLength={1024}/>
            </FormItem>
            
            <Row>
                <Col style={{ textAlign: 'right' }}>
                  <Form.Submit type="primary" onClick={this.onTxConfirmOK}>{T("确认")}</Form.Submit>
                  &nbsp;&nbsp;
                  <Form.Submit onClick={this.onTxConfirmClose}>{T("取消")}</Form.Submit>
                </Col>
            </Row>
          </Form>
        </Dialog>

      </div>
    );
  }
}

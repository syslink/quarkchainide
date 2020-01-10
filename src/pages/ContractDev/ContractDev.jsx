import React, { Component } from 'react';
import { Select } from '@icedesign/base';
import { Button, Tab, Grid, Tree, Dialog, Collapse, Message, Input, Card, Checkbox } from '@alifd/next';
import Container from '@icedesign/container';
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

import * as utils from '../../utils/utils';
import * as qcRpc from '../../utils/quarkchainRPC';
import * as Keystore from '../../utils/keystore';
import { T } from '../../utils/lang';
import * as Constant from '../../utils/constant';
import ContractEditor from './components/Editor';
import * as CompilerSrv from './CompilerSrv';
import './ContractDev.scss';

const { Row, Col } = Grid;
const TreeNode = Tree.Node;
const Panel = Collapse.Panel;

var _axios = require('axios');

const TxReceiptResult = ({self, contractAddress, funcName}) => {
  return <div>
    <Button key='getTxInfo' type="primary" onClick={self.getTxInfo.bind(self, contractAddress, funcName)} style={{marginRight: '20px'}}>{T('查询交易')}</Button>
    <Button key='getReceiptInfo' type="primary" onClick={self.getReceiptInfo.bind(self, contractAddress, funcName)}>{T('查询Receipt')}</Button>
    <br /><br />
    交易信息:<br />
    <ReactJson key='txInfoResult' id={contractAddress + funcName + 'TxInfo'}
      src={utils.isEmptyObj(self.state.result[contractAddress + funcName + 'TxInfo']) ? {} : JSON.parse(self.state.result[contractAddress + funcName + 'TxInfo'])}
    />
    <br />Receipt信息:<br />
    <ReactJson key='receiptInfoResult' id={contractAddress + funcName + 'ReceiptInfo'}
      src={utils.isEmptyObj(self.state.result[contractAddress + funcName + 'ReceiptInfo']) ? {} : JSON.parse(self.state.result[contractAddress + funcName + 'ReceiptInfo'])}
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
        addonTextAfter={T('ETH')}
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
                                                            {} : JSON.parse(self.state.result[contractAddress + funcName])}/>
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
          合约地址: {contractAddress}<br/><br/>
          只读类接口:{readonlyFuncs.length == 0 ? '无' : ''}<br/>
          <DisplayOneTypeFuncs self={self} abiInfos={readonlyFuncs} contract={contract}/>
          <br/>写入类接口:{writableFuncs.length == 0 ? '无' : ''}<br/>
          <DisplayOneTypeFuncs self={self} abiInfos={writableFuncs} contract={contract}/>
          <br/>写入并可支付类接口:{writablePayableFuncs.length == 0 ? '无' : ''}<br/>
          <DisplayOneTypeFuncs self={self} abiInfos={writablePayableFuncs} contract={contract}/>
        </div>        
} 

const ContractCollapse = ({self, contractAccountInfo}) => {
  global.localStorage.setItem('contractAccountInfo', JSON.stringify(contractAccountInfo));
  return <Collapse rtl='ltr'>
            {contractAccountInfo.map((contract, index) => (
              <Panel key={index}  
                title={'编号：' + (index + 1) + '，合约地址:' + contract.contractAddress 
                    + '，合约名：' + contract.contractName + '，时间：' + (contract.genTime != null ? contract.genTime : '')}>
                <ContractArea self={self} contract={contract}/>
              </Panel>
            ))}
         </Collapse>
}

const ActionType = { DeployContract: 0, InvokeContract: 1, UpdateContract: 2 }
const NetworkType = { TestNet: 0, Mainnet: 1, MetaMask: 2, LocalNode: 3, OtherNode: 4}

const pwdPlaceholder = T("钱包密码，由数字加字母组成，不少于8位");

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
      fullShardKey: '000015C0',
      password: '',
      httpReg: new RegExp('^(?=^.{3,255}$)(http(s)?:\/\/)?(www\.)?[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+(:\d+)*(\/\w+\.\w+)*$'),
      networks:[{label: '通过MetaMask连接夸克', value: NetworkType.MetaMask}, {label: '本地节点', value: NetworkType.LocalNode}, {label: '自定义节点', value: NetworkType.OtherNode}],
      //networks:[{label: '测试网节点', value: 0}, {label: '主网节点', value: 1}, {label: 'MetaMask通道', value: 2}, {label: '本地节点', value: 3}, {label: '自定义节点', value: 4}],
      networksWithoutMetaMask :[{label: '测试网节点', value: 0}, {label: '主网节点', value: 1}, {label: '本地节点', value: 3}, {label: '自定义节点', value: 4}],
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
      curAbi: null,
      curBin: null,
      loadedContractAddress: '',
      qcRpcSrv: 'http://qcrpc.xchainunion.com',
      compileSrv: 'http://52.194.255.222:8081',
      selectContactFile: '',
      selectedFileToCompile: null,
      selectedContractToDeploy: null,
      resultInfo: '日志输出:\n',
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

      selectedChainId: 'ChainID:0',
      selectedShardId: "ShardID:0",
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

    if (window.web3) {
      this.state.web3 = new Web3(window.web3);
      QuarkChain.injectWeb3(this.state.web3, this.state.qcRpcSrv);      
    }    
  }

  componentDidMount = async () => {
    await this.initAddresses();

    hyperchain.utils.setProvider(this.state.compileSrv);      
    this.syncSolFileToSrv();  

    const libFiles = await CompilerSrv.getLibSolFile();
    for(var fileName in libFiles) {
      this.state.libFileList.push(fileName);
      global.localStorage.setItem('sol:' + fileName, libFiles[fileName]);
    }
    
    const sampleFiles = await CompilerSrv.getSampleSolFile();
    for(var fileName in sampleFiles) {
      this.state.smapleFileList.push(fileName);
      global.localStorage.setItem('sol:' + fileName, sampleFiles[fileName]);
    }  

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
      Message.error('未安装Metamask，合约开发功能无法使用');
    } else {
      let web3Provider = '';
      if (window.ethereum) {
        try {
          // 请求用户授权
          await window.ethereum.enable();
        } catch (error) {
          // 用户不授权时
          Message.error("授权失败，无法使用MetaMask服务");
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
            Message.error("授权失败，无法使用MetaMask服务");
            return;
          }        
          web3Provider = window.ethereum;
        } else if (window.web3) {
          web3Provider = window.web3;
        }      
        addBtnEnable = false;
        break;
      case NetworkType.LocalNode:  // local node
        web3Provider = 'http://127.0.0.1:8545';
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
      if (id === '1') networkName = '主网(PoW共识，慢)'
      else if (id === '2') networkName = 'Morden (deprecated)'
      else if (id === '3') networkName = 'Ropsten测试网(PoW共识，慢)'
      else if (id === '4') networkName = 'Rinkeby测试网(PoA共识，快)'
      else if (id === '5') networkName = 'Goerli测试网'
      else if (id === '42') networkName = 'Kovan测试网';
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
    this.state.fullShardKey = '000' + v.split(':')[1] + '15C0';
    this.setState({ selectedChainId: v });
  }

  onChangeShardId = (v) => {
    this.state.selectedShardId = v;
    this.setState({ selectedShardId: v });
  }

  onChangeAddress = (accountAddress, item) => {
    this.state.selectedAccountAddress = accountAddress;
    this.setState({ selectedAccountAddress: accountAddress });
    this.syncSolFileToSrv();
    if (this.state.web3) {
      const result = this.state.web3.qkc.getBalance(accountAddress).toString(10);
      if (result == 0) {
        Message.notice('本账号余额为0，无法发起交易，仅可以对链做查询操作')
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
      Message.error('当前编号必须大于0，小于等于' + this.state.contractAccountInfo.length);
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
    
    copy(this.state.selectedAccountAddress);
    Message.success(T('地址已复制到粘贴板'));
  }

  addAddress = () => {
    const keystoreList = utils.loadKeystoreFromLS();    
    const key = Keystore.generateKey();
    key.address = key.address;
    this.state.keystoreInfo[key.address] = key;
    this.state.addresses.push({label: key.address, value: key.address});
    keystoreList.push(key);
    utils.storeDataToFile(Constant.KeyStoreFile, keystoreList);
    this.setState({addresses: this.state.addresses});
    Message.success(T('地址添加成功'));
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
      Feedback.toast.error(T('请选择待编译的文件'));
      return;
    }
    this.addLog("开始编译");
    const compileResult = await CompilerSrv.compileSol(this.state.selectedAccountAddress, this.state.selectedFileToCompile);
    if (compileResult.err != null) {
      Message.error("编译失败");
      this.addLog(compileResult.err);
      return;
    }
    Message.success("编译成功");
    this.addLog("编译成功，结果:\n" + JSON.stringify(compileResult));

    this.state.fileContractMap[this.state.selectedFileToCompile] = compileResult;
    this.state.contractList = [];
    for (var contractFile in this.state.fileContractMap) {
      const compiledInfo = this.state.fileContractMap[contractFile];
      for (var contractName in compiledInfo) {
        this.state.contractList.push(contractFile + ":" + contractName);
        this.addLog("合约" + contractName + "编译结果\n" + compiledInfo[contractName].abi);
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
      Message.error(T('请选择需要获取其ABI信息的合约'));
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
        Message.error('无合约bin信息');
        return;
      }
      const values = [];
      let index = 0;
      for (let paraName of this.state.constructorParaNames) {
        let value = this.state.paraValue[this.state.curContractName + '-constructor-' + paraName];
        if (value == null) {
          Message.error('参数' + paraName + '尚未输入值');
          return;
        }
        const type = this.state.constructorParaTypes[index];
        if (type == 'bool') {
          value = ((value == 'false' || value == 0) ? false : true);
        }else if (type.lastIndexOf(']') === type.length - 1) {
          if (value.indexOf('[') != 0 || value.lastIndexOf(']') != value.length - 1) {
            Message.error('数组类型的值请按如下格式填写：[a,b,c]');
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
      }

      if (this.state.keystoreInfo[this.state.selectedAccountAddress] != null) {
        this.state.web3.qkc.setPrivateKey(this.state.keystoreInfo[this.state.selectedAccountAddress].privateKey);
      }
      qcRpc.getTransactionCount(this.state.selectedAccountAddress + this.state.fullShardKey).then(result => {
        console.log(this.state.selectedAccountAddress + ':' + result);
      });
      Message.success('开始部署合约');
      this.state.web3.qkc.sendTransaction(txParams).then((transactionId) => {
        if (transactionId.startsWith('0x0000000000000000')) {
          Message.error('合约部署失败，请检查原因');
          return;
        } 
        Message.success('部署合约的交易发送成功，等待区块生成');
        this.addLog('交易发送成功，ID = ' + transactionId + ' ，等待被矿工打包'); 
        
        const self = this;
        this.checkReceipt('部署合约', transactionId, (receipt) => {
          Message.success('合约部署成功');
          self.addLog('合约地址：' + receipt.contractAddress);
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
      const receipt = await self.state.web3.eth.getTransactionReceipt(txHash);
      if (receipt == null) {
        count++;
        self.addRawLog(count + 's...');
        if (count == 60) {
          self.addRawLog('\n\n');
          self.addLog('receipt生成超时，请检查链是否正常');
          clearInterval(intervalId);
        }
      } else {
        self.addRawLog('\n\n');
        self.addLog('receipt已生成:\n' + JSON.stringify(receipt));
        clearInterval(intervalId);
        const status = receipt.status;
        if (status == 0) {
          Feedback.toast.error(actionName + T('交易执行失败'));
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
          Message.error('数组类型的值请按如下格式填写：[a,b,c]');
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
      Message.error('合约ABI信息不存在，无法调用合约信息');
      return;
    }

    const self = this;
    var myContract = this.state.web3.qkc.contract(contractAbi);
    myContract = myContract.at(contractAddress);
    //const contractFunc = myContract.methods[funcName];
    const simulate = this.state.funcParaConstant[contractAddress][funcName];
    if (simulate) {
      const payload = this.getContractPayload(funcName, this.state.funcParaTypes[contractAddress][funcName], values);
      const txParams = {
        from: this.state.selectedAccountAddress + this.state.fullShardKey,
        to: contractAddress,
        gasPrice: '0x3b9aca00',
        gas: '0xf4240',
        value: '0x0',
        data: payload,
        gasTokenId: '0x8bb0',
        transferTokenId: '0x8bb0'
      }
      qcRpc.call(txParams, 'latest').then(result => {
        self.state.result[contractAddress + funcName] = JSON.stringify(result);
        self.setState({result: self.state.result});
      });
    } else {
      let waitTxLogId;
      let value = this.state.transferTogether[contractAddress + funcName] ? 
                    new BigNumber(this.state.paraValue[contractAddress + '-' + funcName + '-transferAssetValue']) : new BigNumber(0);
      const option = {from: this.state.selectedAccountAddress};           
      if (value.gt(new BigNumber(0))) {
        value = new BigNumber(value).shiftedBy(18);
        option.value = value;
      }           
      contractFunc(...values).send(option)
      .on('transactionHash', function(txHash) {
        self.state.result[contractAddress + funcName] = txHash;
        self.setState({result: self.state.result});
        self.addLog('交易hash:' + txHash + '，等待被打包')
        waitTxLogId = setInterval(() => { 
          self.addRawLog('>>');
        }, 1000);
      })
      .on('receipt', function(receipt) {
        clearTimeout(waitTxLogId);
        self.addRawLog('\n\n');
        self.addLog('交易receipt:' + JSON.stringify(receipt));
      })
      .on('confirmation', function(confirmationNumber, receipt) {
        if (confirmationNumber == 6) {
          self.addLog('确认区块数已达到：'  + confirmationNumber + '个'); 
        }
      })
      .on('error', error => self.addLog('发生错误：' + JSON.stringify(error)));
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
      
      this.state.web3.eth.getTransaction(txHash).then(txInfo => {        
        this.addLog("交易信息\n" + JSON.stringify(txInfo));
        this.state.result[contractAddress + funcName + 'TxInfo'] = JSON.stringify(txInfo);
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
      this.state.web3.eth.getTransactionReceipt(txHash).then(receipt => {        
        if (receipt == null) {
          Message.error(T('区块尚未被打包，receipt尚未生成'));
          return;
        }
        this.addLog("receipt\n" + JSON.stringify(receipt));
        this.state.result[contractAddress + funcName + 'ReceiptInfo'] = JSON.stringify(receipt);
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
    this.addLog("调用函数" + this.state.curCallFuncName + "获取的结果:" + result);
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
      Message.error('请先选中需保存到本地的合约文件');
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
  handlePasswordChange = (v) => {
    this.state.password = v;
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
      Message.error('文件已存在！');
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
      Message.error('请输入自定义节点地址');
      return;
    }
    if (!this.state.httpReg.test(this.state.nodeAddr)) {
      Feedback.toast.error(T('节点地址信息错误'));
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
      Message.error('请选择Solidity编译器版本');
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
      title: '分享您的合约代码',
      content: '确认分享后，您在本IDE中的编码将通过类似直播的方式被分享出去。',
      messageProps:{
          type: 'success'
      },
      okProps: {children: '分享代码', className: 'unknown'},
      onOk: () => {this.shareCodeTx();},
      onCancel: () => { }
    });
  }

  shareCodeTx = () => {

  }

  selectShareCodeAccount = (v) => {
    this.state.selectedSharedAddress = v;
  }

  syncContracts = () => {
    if (utils.isEmptyObj(this.state.selectedSharedAddress)) {
      Message.error('请先选择需要同步的合约地址');
      return;
    }
  }

  onRightClick(info) {
    console.log('onRightClick', info);
  }

  signTxAndSend = (txInfo) => {
    const ethersKSInfo = this.state.keystoreInfo[txInfo.from];
    const privateKey = ethersKSInfo.privateKey;
    Message.success('正在发起交易');
    
    if (this.state.method === ActionType.DeployContract) {
      hyperchain.contract.deployContract(txInfo, privateKey).then(txHash => {
        this.addLog('交易hash:' + txHash);
        const syncTxTimeoutId = setTimeout(() => { 
          hyperchain.transaction.getTransactionReceipt(txHash).then(receipt => {
            clearTimeout(syncTxTimeoutId);
            this.addLog('交易receipt:' + JSON.stringify(receipt));
            const contractAddr = receipt.contractAddress;
            const success = receipt.valid;
            if (success) {
              Message.success('合约部署成功');
              this.addLog('合约部署成功');
              this.processContractDepolyed(contractAddr, this.state.curContractName, this.state.curContractABI)
            } else {
              Message.error('合约部署失败:' + receipt.errorMsg); 
              this.addLog('合约部署失败:' + receipt.errorMsg); 
            }
          }).catch (error => { 
            Message.error(error); 
            this.addLog(error);
          });
        }, 1000);
      }).catch (error => { 
        Message.error(error); 
        this.addLog(error);
      });
      
    } else if (this.state.method === ActionType.InvokeContract) {
      hyperchain.contract.invokeContract(txInfo, privateKey).then(result => {
        if (txInfo.simulate) {
          this.addLog('结果:' + JSON.stringify(result));
          const ret = utils.parseResult(this.state.funcResultOutputs[this.state.curContractAddress][this.state.curCallFuncName], result.ret);
          this.state.result[this.state.curContractAddress + this.state.curCallFuncName] = JSON.stringify(ret);
          this.setState({result: this.state.result});
          return;
        };
        this.addLog('交易hash:' + result);
        this.state.result[this.state.curContractAddress + this.state.curCallFuncName] = result;
        this.setState({result: this.state.result});
        const syncTxTimeoutId = setTimeout(() => { 
          hyperchain.transaction.getTransactionReceipt(result).then(receipt => {
            clearTimeout(syncTxTimeoutId);
            this.addLog('交易receipt:' + JSON.stringify(receipt));
            this.state.result[this.state.curContractAddress + this.state.curCallFuncName + 'TxReceipt'] = JSON.stringify(receipt);
            this.setState({result: this.state.result});
          }).catch (error => { 
            Message.error(error); 
            this.addLog(error);
          });
        }, 1000);
      }).catch (error => { 
        Message.error(error); 
        this.addLog(error);
      });
    } else if (this.state.method === ActionType.UpdateContract) {
      hyperchain.contract.maintainContract(txInfo, privateKey).then(txHash => {            
        this.addLog('交易hash:' + txHash);
        const syncTxTimeoutId = setTimeout(() => { 
          hyperchain.transaction.getTransactionReceipt(txHash).then(receipt => {
            clearTimeout(syncTxTimeoutId);
            this.addLog('交易receipt:' + JSON.stringify(receipt));
            const success = receipt.valid;
            if (success) {
              Message.success('合约更新成功');
              this.addLog('合约更新成功');
              this.processContractUpdated(txInfo.to, this.state.curContractName, this.state.curContractABI)
            } else {
              Message.error('合约更新失败:' + receipt.errorMsg); 
              this.addLog('合约更新失败:' + receipt.errorMsg);
            }
          }).catch (error => { 
            Message.error(error); 
            this.addLog(error);
          });
        }, 1000);
      }).catch (error => { 
        Message.error(error); 
        this.addLog(error);
      });
    }
  }

  onPwdOK = () => {
    if(!utils.checkPassword(this.state.password)) {
      Message.error(T('密码格式无效！'));
      return;
    }
    this.signTxAndSend(this.state.txInfo);    
    this.onPwdClose();
  }

  onPwdClose = () => {
    this.setState({
      pwdDialogVisible: false,
    });
  };

  render() {
    global.localStorage.setItem("solFileList", this.state.solFileList);
    const self = this;
    return (
      <div>
        <Row className="custom-row">
            <Col fixedSpan="11" className="custom-col-left-sidebar">
              <br />
              <Button type="primary" onClick={this.addSolFile}>添加合约</Button>
              &nbsp;&nbsp;
              <Button type="primary" onClick={this.delSolFile}>删除选中合约</Button>
              <br /><br />
              <Button type="primary" onClick={this.saveSolFile}>保存合约</Button>
              &nbsp;&nbsp;
              <Button type="primary" onClick={this.shareCode.bind(this)}>{T("直播写代码")}</Button>
              <Tree editable showLine draggable selectable
                  defaultExpandedKeys={['0', '1', '2']}
                  onEditFinish={this.onEditFinish.bind(this)}
                  onRightClick={this.onRightClick}
                  onSelect={this.onSelectSolFile}>
                  <TreeNode key="0" label="我的合约" selectable={false}>
                    {
                      this.state.solFileList.map(solFile => <TreeNode key={solFile} label={solFile}/>)
                    }
                  </TreeNode>
                  
                  <TreeNode key="1" label="公共库(可直接调用)" selectable={false}>
                    {
                      this.state.libFileList.map(solFile => <TreeNode key={solFile} label={solFile}/>)
                    }
                  </TreeNode>
                  
                  <TreeNode key="2" label="示例(仅供参考)" selectable={false}>
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
                  <TreeNode key="0" label="xxx分享的合约" selectable={false}>
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
              <br />
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
                  dataSource={['ChainId:0', 'ChainId:1', 'ChainId:2', 'ChainId:3', 'ChainId:4', 'ChainId:5', 'ChainId:6', 'ChainId:7']}
                />
                &nbsp;&nbsp;
                <Select
                  style={{ width: 150 }}
                  placeholder={T("选择Shard ID")}
                  value={this.state.selectedShardId}
                  onChange={this.onChangeShardId.bind(this)}
                  dataSource={['ShardId:0']}
                />
              </Row>
              <Row style={{width: '100%', color: '#fff'}}>
                {this.state.networkName ? 'Network: ' + this.state.networkName : ''}
              </Row>
              <br/>
              <Row style={{width: '100%'}}>
                <Select
                  style={{ width: '100%' }}
                  placeholder={T("选择账号")}
                  onChange={this.onChangeAddress.bind(this)}
                  // defaultValue={this.state.addresses.length > 0 ? this.state.addresses[0] : ''}
                  dataSource={this.state.addresses}
                />
              </Row>
              <br/>
              <Row style={{width: '100%'}}>
                <Button type="primary" onClick={this.copyAddress.bind(this)}>{T("复制账号")}</Button>
                &nbsp;&nbsp;&nbsp;
                <Button type="primary" onClick={this.addAddress.bind(this)}>{T("添加新账号")}</Button>
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
                {this.state.compilerVersion ? '编译器版本:' + this.state.compilerVersion : ''}
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
                <Card style={{ width: '100%', marginBottom: "10px" }} bodyHeight="auto" title="构造函数">
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
          <Select showSearch placeholder="编译器版本"
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
          okProps={{children: '复制ABI'}}
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
          okProps={{children: '复制BIN'}}
        >
          <IceEllipsis lineNumber={10} text= {this.state.curBin} />
        </Dialog>
        <Dialog
          visible={this.state.pwdDialogVisible}
          onOk={this.onPwdOK.bind(this)}
          onCancel={this.onPwdClose}
          onClose={this.onPwdClose}
          title={T("输入密码")}
          footerAlign="center"
        >
          <Input hasClear
            htmlType="password"
            onChange={this.handlePasswordChange.bind(this)}
            style={{ width: 400 }}
            addonTextBefore={T("密码")}
            placeholder={T(pwdPlaceholder)}
            size="medium"
            defaultValue=""
            maxLength={20}
            hasLimitHint
            onPressEnter={this.onPwdOK.bind(this)}
          />
          <br/>
          <br/>
          注意:刷新/切换/关闭本页面后，需重新输入密码
        </Dialog>
      </div>
    );
  }
}

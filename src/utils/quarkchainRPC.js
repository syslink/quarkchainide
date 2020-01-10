import axios from 'axios';

var provider = 'http://qcrpc.xchainunion.com';

function setProvider(newProvider) {
  provider = newProvider;
}

async function call(callInfo, blockNum) {
  const dataToSrv = JSON.stringify({ jsonrpc: '2.0',
    method: 'call',
    params: [callInfo, blockNum],
    id: 1 });
  return postToNode({
    data: dataToSrv,
  });
}

async function getTransactionCount(address) {
  const dataToSrv = { jsonrpc: '2.0',
    method: 'getTransactionCount',
    params: [address],
    id: 1 };
  return axios.post(provider, dataToSrv);
}

async function getTransactionByHash(txHash) {        
  const dataToSrv = JSON.stringify({ jsonrpc: '2.0',
    method: 'getTransactionByHash',
    params: [txHash],
    id: 1 });
  return postToNode({
    data: dataToSrv,
  });
};

async function postToNode(dataToNode) {
  const resp = await fetch(provider, {headers: { "Content-Type": "application/json;charset=UTF-8" }, method: 'POST', body: dataToNode.data});
  if (resp == null) {
    throw 'RPC调用失败：' + dataToNode.data;
  }
  const response = await resp.json();
  if (response.error != null) {
    throw response.error.message;
  }
  return response.result;
}

export { setProvider, call, getTransactionCount, getTransactionByHash }
var provider = 'http://qkcTestnet.xchainunion.com';

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

async function getNetworkId() {
  const dataToSrv = JSON.stringify({ jsonrpc: '2.0',
    method: 'networkInfo',
    params: [],
    id: 1 });
  return postToNode({
    data: dataToSrv,
  });
}

async function getTransactionCount(address) {
  const dataToSrv = JSON.stringify({ jsonrpc: '2.0',
    method: 'getTransactionCount',
    params: [address],
    id: 1 });
  return postToNode({
    data: dataToSrv,
  });
}

async function getTransactionByHash(txHash) {        
  const dataToSrv = JSON.stringify({ jsonrpc: '2.0',
    method: 'getTransactionById',
    params: [txHash],
    id: 1 });
  return postToNode({
    data: dataToSrv,
  });
};

async function getAccountData(accountAddr, blockNum, includeOtherShards) {        
  const dataToSrv = JSON.stringify({ jsonrpc: '2.0',
    method: 'getAccountData',
    params: [accountAddr, blockNum, includeOtherShards],
    id: 1 });
  return postToNode({
    data: dataToSrv,
  });
};

async function getTransactionReceipt(txHash) {        
  const dataToSrv = JSON.stringify({ jsonrpc: '2.0',
    method: 'getTransactionReceipt',
    params: [txHash],
    id: 1 });
  return postToNode({
    data: dataToSrv,
  });
};

async function getTransactionsByAddress(address, start, limit, transferTokenId) {        
  const dataToSrv = JSON.stringify({ jsonrpc: '2.0',
    method: 'getTransactionsByAddress',
    params: [address, start, limit, transferTokenId],
    id: 1 });
  return postToNode({
    data: dataToSrv,
  });
};


async function getAllTransaction(fullShardKey, start, limit) {        
  const dataToSrv = JSON.stringify({ jsonrpc: '2.0',
    method: 'getAllTransaction',
    params: [fullShardKey, start, limit],
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

export { setProvider, call, getTransactionCount, getTransactionByHash, 
         getAccountData, getTransactionReceipt, getNetworkId, getTransactionsByAddress, getAllTransaction }
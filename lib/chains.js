// ============================================================
// CHAIN DEFINITIONS
// ============================================================

export const EVM_METHODS = [
  {
    name: 'eth_blockNumber',
    category: 'light',
    weight: 25,
    build: () => ({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
    isSyncCheck: true,
    parseSyncBlock: (result) => parseInt(result, 16),
  },
  {
    name: 'eth_getBalance',
    category: 'light',
    weight: 20,
    build: (ctx) => ({
      jsonrpc: '2.0', method: 'eth_getBalance',
      params: [ctx.address, 'latest'], id: 1,
    }),
  },
  {
    name: 'eth_getBlockByNumber',
    category: 'medium',
    weight: 20,
    build: (ctx) => ({
      jsonrpc: '2.0', method: 'eth_getBlockByNumber',
      params: [ctx.latestBlock || 'latest', false], id: 1,
    }),
  },
  {
    name: 'eth_call',
    category: 'medium',
    weight: 15,
    build: () => ({
      jsonrpc: '2.0', method: 'eth_call',
      params: [{ to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', data: '0x18160ddd' }, 'latest'],
      id: 1,
    }),
  },
  {
    name: 'eth_getTransactionCount',
    category: 'light',
    weight: 10,
    build: (ctx) => ({
      jsonrpc: '2.0', method: 'eth_getTransactionCount',
      params: [ctx.address, 'latest'], id: 1,
    }),
  },
  {
    name: 'eth_getLogs',
    category: 'heavy',
    weight: 10,
    build: (ctx) => ({
      jsonrpc: '2.0', method: 'eth_getLogs',
      params: [{
        fromBlock: ctx.latestBlock || 'latest',
        toBlock: ctx.latestBlock || 'latest',
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      }], id: 1,
    }),
  },
];

export const CHAINS = {
  ethereum: {
    id: 'ethereum', name: 'Ethereum', color: '#627EEA', type: 'evm',
    defaultEndpoint: 'https://eth.llamarpc.com',
    seedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    methods: EVM_METHODS,
    blockTime: 12,
  },
  monad: {
    id: 'monad', name: 'Monad', color: '#836EF9', type: 'evm',
    defaultEndpoint: 'https://testnet-rpc.monad.xyz',
    seedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    methods: EVM_METHODS,
    blockTime: 1,
  },
  base: {
    id: 'base', name: 'Base', color: '#0052FF', type: 'evm',
    defaultEndpoint: 'https://mainnet.base.org',
    seedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    methods: EVM_METHODS,
    blockTime: 2,
  },
  arbitrum: {
    id: 'arbitrum', name: 'Arbitrum', color: '#28A0F0', type: 'evm',
    defaultEndpoint: 'https://arb1.arbitrum.io/rpc',
    seedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    methods: EVM_METHODS,
    blockTime: 0.25,
  },
  avalanche: {
    id: 'avalanche', name: 'Avalanche', color: '#E84142', type: 'evm',
    defaultEndpoint: 'https://api.avax.network/ext/bc/C/rpc',
    seedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    methods: EVM_METHODS,
    blockTime: 2,
  },
  bitcoin: {
    id: 'bitcoin', name: 'Bitcoin', color: '#F7931A', type: 'bitcoin',
    defaultEndpoint: 'http://user:pass@localhost:8332',
    blockTime: 600,
    methods: [
      {
        name: 'getblockcount',
        category: 'light', weight: 30,
        build: () => ({ jsonrpc: '1.0', method: 'getblockcount', params: [], id: 1 }),
        isSyncCheck: true, parseSyncBlock: (r) => r,
      },
      {
        name: 'getblockchaininfo',
        category: 'medium', weight: 25,
        build: () => ({ jsonrpc: '1.0', method: 'getblockchaininfo', params: [], id: 1 }),
      },
      {
        name: 'getrawmempool',
        category: 'heavy', weight: 20,
        build: () => ({ jsonrpc: '1.0', method: 'getrawmempool', params: [false], id: 1 }),
      },
      {
        name: 'getblockhash',
        category: 'light', weight: 15,
        build: (ctx) => ({ jsonrpc: '1.0', method: 'getblockhash', params: [ctx.latestBlock || 800000], id: 1 }),
      },
      {
        name: 'getnetworkinfo',
        category: 'light', weight: 10,
        build: () => ({ jsonrpc: '1.0', method: 'getnetworkinfo', params: [], id: 1 }),
      },
    ],
  },
  sui: {
    id: 'sui', name: 'Sui', color: '#4DA2FF', type: 'sui',
    defaultEndpoint: 'https://fullnode.mainnet.sui.io',
    blockTime: 0.5,
    methods: [
      {
        name: 'sui_getLatestCheckpointSequenceNumber',
        category: 'light', weight: 30,
        build: () => ({ jsonrpc: '2.0', method: 'sui_getLatestCheckpointSequenceNumber', params: [], id: 1 }),
        isSyncCheck: true, parseSyncBlock: (r) => parseInt(r),
      },
      {
        name: 'sui_getObject',
        category: 'medium', weight: 25,
        build: () => ({
          jsonrpc: '2.0', method: 'sui_getObject',
          params: ['0x0000000000000000000000000000000000000000000000000000000000000002',
            { showType: true, showOwner: true, showContent: false }], id: 1,
        }),
      },
      {
        name: 'sui_getTotalTransactionBlocks',
        category: 'light', weight: 20,
        build: () => ({ jsonrpc: '2.0', method: 'sui_getTotalTransactionBlocks', params: [], id: 1 }),
      },
      {
        name: 'suix_getBalance',
        category: 'light', weight: 15,
        build: () => ({
          jsonrpc: '2.0', method: 'suix_getBalance',
          params: ['0x94f1a597b4e8f709a396f7f6b1482bdcd65a673d111e49286c527fab7c2d0961', '0x2::sui::SUI'],
          id: 1,
        }),
      },
      {
        name: 'sui_getCheckpoint',
        category: 'medium', weight: 10,
        build: (ctx) => ({
          jsonrpc: '2.0', method: 'sui_getCheckpoint',
          params: [String(ctx.latestBlock || '1')], id: 1,
        }),
      },
    ],
  },
  aptos: {
    id: 'aptos', name: 'Aptos', color: '#00D4AA', type: 'aptos',
    defaultEndpoint: 'https://fullnode.mainnet.aptoslabs.com',
    blockTime: 1,
    methods: [
      {
        name: 'GET /v1/blocks/by_height/{height}',
        category: 'medium', weight: 25,
        build: (ctx) => ({ path: `/v1/blocks/by_height/${ctx.latestBlock || 1}`, method: 'GET' }),
        isSyncCheck: true,
      },
      {
        name: 'GET /v1/accounts/0x1/resources',
        category: 'medium', weight: 25,
        build: () => ({ path: '/v1/accounts/0x1/resources', method: 'GET' }),
      },
      {
        name: 'GET /v1/ledger/info',
        category: 'light', weight: 25,
        build: () => ({ path: '/', method: 'GET' }),
      },
      {
        name: 'GET /v1/accounts/0x1',
        category: 'light', weight: 15,
        build: () => ({ path: '/v1/accounts/0x1', method: 'GET' }),
      },
      {
        name: 'GET /v1/transactions',
        category: 'heavy', weight: 10,
        build: () => ({ path: '/v1/transactions?limit=25', method: 'GET' }),
      },
    ],
  },
  ton: {
    id: 'ton', name: 'TON', color: '#0088CC', type: 'ton',
    defaultEndpoint: 'https://toncenter.com/api/v2',
    blockTime: 5,
    methods: [
      {
        name: 'getMasterchainInfo',
        category: 'light', weight: 30,
        build: () => ({ jsonrpc: '2.0', method: 'getMasterchainInfo', params: {}, id: 1 }),
        isSyncCheck: true, parseSyncBlock: (r) => r?.last?.seqno,
      },
      {
        name: 'getConsensusBlock',
        category: 'light', weight: 25,
        build: () => ({ jsonrpc: '2.0', method: 'getConsensusBlock', params: {}, id: 1 }),
      },
      {
        name: 'getAddressInformation',
        category: 'medium', weight: 25,
        build: () => ({
          jsonrpc: '2.0', method: 'getAddressInformation',
          params: { address: 'EQCjk1hh952vWaE9bRguFkAt3zdwWein2a0A3cWX2TIi-TWF' }, id: 1,
        }),
      },
      {
        name: 'getBlockHeader',
        category: 'medium', weight: 20,
        build: (ctx) => ({
          jsonrpc: '2.0', method: 'getBlockHeader',
          params: { workchain: -1, shard: '-9223372036854775808', seqno: ctx.latestBlock || 1 },
          id: 1,
        }),
      },
    ],
  },
  tron: {
    id: 'tron', name: 'TRON', color: '#EF0027', type: 'tron',
    defaultEndpoint: 'https://api.trongrid.io',
    blockTime: 3,
    methods: [
      {
        name: 'wallet/getnowblock',
        category: 'light', weight: 35,
        build: () => ({ path: '/wallet/getnowblock', method: 'POST', body: {} }),
        isSyncCheck: true,
      },
      {
        name: 'wallet/getblockbynum',
        category: 'medium', weight: 25,
        build: (ctx) => ({ path: '/wallet/getblockbynum', method: 'POST', body: { num: ctx.latestBlock || 1 } }),
      },
      {
        name: 'wallet/getaccount',
        category: 'medium', weight: 20,
        build: () => ({
          path: '/wallet/getaccount', method: 'POST',
          body: { address: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7', visible: true },
        }),
      },
      {
        name: 'wallet/getchainparameters',
        category: 'light', weight: 20,
        build: () => ({ path: '/wallet/getchainparameters', method: 'GET' }),
      },
    ],
  },
  cardano: {
    id: 'cardano', name: 'Cardano', color: '#0033AD', type: 'cardano',
    defaultEndpoint: 'https://cardano-mainnet.blockfrost.io/api/v0',
    extraHeaders: { 'project_id': 'YOUR_BLOCKFROST_KEY' },
    blockTime: 20,
    methods: [
      {
        name: 'GET /blocks/latest',
        category: 'light', weight: 35,
        build: () => ({ path: '/blocks/latest', method: 'GET' }),
        isSyncCheck: true,
      },
      {
        name: 'GET /epochs/latest',
        category: 'light', weight: 25,
        build: () => ({ path: '/epochs/latest', method: 'GET' }),
      },
      {
        name: 'GET /genesis',
        category: 'light', weight: 20,
        build: () => ({ path: '/genesis', method: 'GET' }),
      },
      {
        name: 'GET /addresses/{addr}/utxos',
        category: 'heavy', weight: 20,
        build: () => ({
          path: '/addresses/addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x/utxos',
          method: 'GET',
        }),
      },
    ],
  },
  ripple: {
    id: 'ripple', name: 'Ripple (XRP)', color: '#00AAE4', type: 'xrp',
    defaultEndpoint: 'https://xrplcluster.com',
    blockTime: 4,
    methods: [
      {
        name: 'server_info',
        category: 'light', weight: 30,
        build: () => ({ jsonrpc: '2.0', method: 'server_info', params: [{}], id: 1 }),
        isSyncCheck: true, parseSyncBlock: (r) => r?.info?.validated_ledger?.seq,
      },
      {
        name: 'ledger',
        category: 'medium', weight: 25,
        build: () => ({
          jsonrpc: '2.0', method: 'ledger',
          params: [{ ledger_index: 'validated', transactions: false, expand: false }], id: 1,
        }),
      },
      {
        name: 'account_info',
        category: 'medium', weight: 25,
        build: () => ({
          jsonrpc: '2.0', method: 'account_info',
          params: [{ account: 'r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59', ledger_index: 'validated' }],
          id: 1,
        }),
      },
      {
        name: 'ledger_closed',
        category: 'light', weight: 20,
        build: () => ({ jsonrpc: '2.0', method: 'ledger_closed', params: [], id: 1 }),
      },
    ],
  },
};

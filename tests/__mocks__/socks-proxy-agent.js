// Mock for socks-proxy-agent to avoid ESM import issues in Jest
class SocksProxyAgent {
  constructor(options) {
    this.options = options;
  }
}

module.exports = { SocksProxyAgent };

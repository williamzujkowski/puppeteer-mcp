// Mock for https-proxy-agent to avoid ESM import issues in Jest
class HttpsProxyAgent {
  constructor(options) {
    this.options = options;
  }
}

module.exports = { HttpsProxyAgent };

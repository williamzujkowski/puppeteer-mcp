// Mock for node-fetch to avoid ESM import issues in Jest
module.exports = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map(),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    clone: jest.fn(),
  }),
);

module.exports.Headers = Map;
module.exports.Request = class MockRequest {};
module.exports.Response = class MockResponse {};

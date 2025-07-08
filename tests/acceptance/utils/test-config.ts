/**
 * Acceptance test configuration
 * @module tests/acceptance/utils/test-config
 */

export interface TestConfig {
  timeout: number;
  retries: number;
  headless: boolean;
  slowMo: number;
  viewport: {
    width: number;
    height: number;
  };
}

export interface TestTargets {
  ecommerce: {
    sauceDemo: string;
    automationPractice: string;
  };
  apis: {
    httpbin: string;
    jsonplaceholder: string;
    reqres: string;
    worldbank: string;
  };
  testing: {
    theInternet: string;
    uiPlayground: string;
    testPages: string;
    demoQA: string;
  };
  realWorld: {
    hackerNews: string;
    reactDemo: string;
    angularDemo: string;
  };
}

export const TEST_CONFIG: TestConfig = {
  timeout: Number(process.env.ACCEPTANCE_TEST_TIMEOUT) || 30000,
  retries: Number(process.env.ACCEPTANCE_TEST_RETRIES) || 2,
  headless: process.env.ACCEPTANCE_TEST_HEADLESS !== 'false',
  slowMo: Number(process.env.ACCEPTANCE_TEST_SLOW_MO) || 0,
  viewport: {
    width: 1920,
    height: 1080,
  },
};

export const TEST_TARGETS: TestTargets = {
  ecommerce: {
    sauceDemo: 'https://www.saucedemo.com/',
    automationPractice: 'http://automationpractice.com/',
  },
  apis: {
    httpbin: 'https://httpbin.org/',
    jsonplaceholder: 'https://jsonplaceholder.typicode.com/',
    reqres: 'https://reqres.in/',
    worldbank: 'https://api.worldbank.org/v2/',
  },
  testing: {
    theInternet: 'https://the-internet.herokuapp.com/',
    uiPlayground: 'http://uitestingplayground.com/',
    testPages: 'https://testpages.herokuapp.com/',
    demoQA: 'https://demoqa.com/',
  },
  realWorld: {
    hackerNews: 'https://news.ycombinator.com/',
    reactDemo: 'https://react-shopping-cart-67954.firebaseapp.com/',
    angularDemo: 'https://www.globalsqa.com/angularJs-protractor/BankingProject/',
  },
};

// Test credentials for sites that provide them
export const TEST_CREDENTIALS = {
  sauceDemo: {
    standard: { username: 'standard_user', password: 'secret_sauce' },
    locked: { username: 'locked_out_user', password: 'secret_sauce' },
    problem: { username: 'problem_user', password: 'secret_sauce' },
    performance: { username: 'performance_glitch_user', password: 'secret_sauce' },
  },
};

// User agents for different scenarios
export const TEST_USER_AGENTS = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  testing: 'puppeteer-mcp-acceptance-test/1.0.14',
};
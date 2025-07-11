/**
 * Alternative test configuration with more reliable test targets
 * @module tests/acceptance/utils/alternative-test-config
 */

export interface AlternativeTestTargets {
  uiPlayground: {
    base: string;
    textInput: string;
    ajax: string;
    clientDelay: string;
    visibility: string;
    hiddenLayers: string;
    progressBar: string;
    dynamicTable: string;
    click: string;
    classAttr: string;
    dynamicId: string;
    sampleApp: string;
    mouseOver: string;
    nonBreakingSpace: string;
    overlappedElement: string;
    shadowDOM: string;
    alerts: string;
    fileUpload: string;
    animatedButton: string;
  };
  automationExercise: {
    base: string;
    home: string;
    products: string;
    cart: string;
    signup: string;
    login: string;
    contactUs: string;
    testCases: string;
    productDetails: string;
    checkout: string;
  };
  practiceAutomation: {
    base: string;
    myAccount: string;
    shop: string;
    basket: string;
    checkout: string;
    product: string;
  };
  parabank: {
    base: string;
    register: string;
    login: string;
    accounts: string;
    transfer: string;
    billPay: string;
  };
  opencart: {
    base: string;
    register: string;
    login: string;
    search: string;
    cart: string;
    checkout: string;
  };
}

export const ALTERNATIVE_TEST_TARGETS: AlternativeTestTargets = {
  // UI Testing Playground - Purpose-built for automation testing
  uiPlayground: {
    base: 'https://uitestingplayground.com',
    textInput: 'https://uitestingplayground.com/textinput',
    ajax: 'https://uitestingplayground.com/ajax',
    clientDelay: 'https://uitestingplayground.com/clientdelay',
    visibility: 'https://uitestingplayground.com/visibility',
    hiddenLayers: 'https://uitestingplayground.com/hiddenlayers',
    progressBar: 'https://uitestingplayground.com/progressbar',
    dynamicTable: 'https://uitestingplayground.com/dynamictable',
    click: 'https://uitestingplayground.com/click',
    classAttr: 'https://uitestingplayground.com/classattr',
    dynamicId: 'https://uitestingplayground.com/dynamicid',
    sampleApp: 'https://uitestingplayground.com/sampleapp',
    mouseOver: 'https://uitestingplayground.com/mouseover',
    nonBreakingSpace: 'https://uitestingplayground.com/nbsp',
    overlappedElement: 'https://uitestingplayground.com/overlapped',
    shadowDOM: 'https://uitestingplayground.com/shadowdom',
    alerts: 'https://uitestingplayground.com/alerts',
    fileUpload: 'https://uitestingplayground.com/upload',
    animatedButton: 'https://uitestingplayground.com/animatedbutton',
  },

  // Automation Exercise - Modern e-commerce test site
  automationExercise: {
    base: 'https://automationexercise.com',
    home: 'https://automationexercise.com/',
    products: 'https://automationexercise.com/products',
    cart: 'https://automationexercise.com/view_cart',
    signup: 'https://automationexercise.com/signup',
    login: 'https://automationexercise.com/login',
    contactUs: 'https://automationexercise.com/contact_us',
    testCases: 'https://automationexercise.com/test_cases',
    productDetails: 'https://automationexercise.com/product_details/1',
    checkout: 'https://automationexercise.com/checkout',
  },

  // Practice Automation Testing - WordPress/WooCommerce based
  practiceAutomation: {
    base: 'https://practice.automationtesting.in',
    myAccount: 'https://practice.automationtesting.in/my-account/',
    shop: 'https://practice.automationtesting.in/shop/',
    basket: 'https://practice.automationtesting.in/basket/',
    checkout: 'https://practice.automationtesting.in/checkout/',
    product: 'https://practice.automationtesting.in/product/mastering-javascript/',
  },

  // Parabank - Banking application for testing
  parabank: {
    base: 'https://parabank.parasoft.com',
    register: 'https://parabank.parasoft.com/parabank/register.htm',
    login: 'https://parabank.parasoft.com/parabank/index.htm',
    accounts: 'https://parabank.parasoft.com/parabank/overview.htm',
    transfer: 'https://parabank.parasoft.com/parabank/transfer.htm',
    billPay: 'https://parabank.parasoft.com/parabank/billpay.htm',
  },

  // OpenCart Demo - E-commerce platform
  opencart: {
    base: 'https://demo.opencart.com',
    register: 'https://demo.opencart.com/index.php?route=account/register',
    login: 'https://demo.opencart.com/index.php?route=account/login',
    search: 'https://demo.opencart.com/index.php?route=product/search',
    cart: 'https://demo.opencart.com/index.php?route=checkout/cart',
    checkout: 'https://demo.opencart.com/index.php?route=checkout/checkout',
  },
};

// Test data generators for alternative sites
export const ALTERNATIVE_TEST_DATA = {
  // UI Testing Playground sample app credentials
  uiPlayground: {
    sampleApp: {
      username: 'testuser',
      password: 'pwd123',
    },
  },

  // Automation Exercise test data
  automationExercise: {
    signup: {
      generateUser: () => ({
        name: `Test User ${Date.now()}`,
        email: `testuser${Date.now()}@example.com`,
        password: 'Test@123',
        firstName: 'Test',
        lastName: 'User',
        company: 'Test Company',
        address: '123 Test Street',
        address2: 'Apt 4B',
        country: 'United States',
        state: 'California',
        city: 'Los Angeles',
        zipcode: '90001',
        mobileNumber: '555-0123',
      }),
    },
    validLogin: {
      email: 'testuser@example.com',
      password: 'Test@123',
    },
  },

  // Practice Automation test data
  practiceAutomation: {
    registration: {
      generateUser: () => ({
        email: `testuser${Date.now()}@example.com`,
        password: 'Test@123!',
      }),
    },
    validLogin: {
      username: 'testuser@practice.com',
      password: 'Test@123!',
    },
  },

  // Parabank test data
  parabank: {
    registration: {
      generateUser: () => ({
        firstName: 'Test',
        lastName: `User${Date.now()}`,
        address: '123 Test St',
        city: 'Test City',
        state: 'CA',
        zipCode: '12345',
        phone: '555-0123',
        ssn: '123-45-6789',
        username: `testuser${Date.now()}`,
        password: 'Test@123',
      }),
    },
  },
};

// Selector patterns for alternative sites
export const ALTERNATIVE_SELECTORS = {
  uiPlayground: {
    // Consistent and stable selectors
    textInput: {
      input: '#newButtonName',
      button: '#updatingButton',
    },
    ajax: {
      button: '#ajaxButton',
      content: '.bg-success',
    },
    visibility: {
      hideButton: '#hideButton',
      removedButton: '#removedButton',
      zeroWidthButton: '#zeroWidthButton',
      overlappedButton: '#overlappedButton',
      transparentButton: '#transparentButton',
      invisibleButton: '#invisibleButton',
      notdisplayedButton: '#notdisplayedButton',
      offscreenButton: '#offscreenButton',
    },
    sampleApp: {
      username: 'input[name="UserName"]',
      password: 'input[name="Password"]',
      loginButton: '#login',
      statusLabel: '#loginstatus',
    },
  },

  automationExercise: {
    // Well-structured selectors
    signup: {
      nameInput: 'input[data-qa="signup-name"]',
      emailInput: 'input[data-qa="signup-email"]',
      signupButton: 'button[data-qa="signup-button"]',
    },
    login: {
      emailInput: 'input[data-qa="login-email"]',
      passwordInput: 'input[data-qa="login-password"]',
      loginButton: 'button[data-qa="login-button"]',
    },
    accountForm: {
      genderMale: '#id_gender1',
      genderFemale: '#id_gender2',
      password: '#password',
      days: '#days',
      months: '#months',
      years: '#years',
      newsletter: '#newsletter',
      offers: '#optin',
      firstName: '#first_name',
      lastName: '#last_name',
      company: '#company',
      address1: '#address1',
      address2: '#address2',
      country: '#country',
      state: '#state',
      city: '#city',
      zipcode: '#zipcode',
      mobileNumber: '#mobile_number',
      createAccountButton: 'button[data-qa="create-account"]',
    },
  },
};

// Helper function to check site availability
export async function checkAlternativeSiteAvailability(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn(`Site ${url} is not available:`, error);
    return false;
  }
}

// Test site health check
export async function getHealthyTestSites(): Promise<string[]> {
  const sitesToCheck = [
    ALTERNATIVE_TEST_TARGETS.uiPlayground.base,
    ALTERNATIVE_TEST_TARGETS.automationExercise.base,
    ALTERNATIVE_TEST_TARGETS.practiceAutomation.base,
    ALTERNATIVE_TEST_TARGETS.parabank.base,
    ALTERNATIVE_TEST_TARGETS.opencart.base,
  ];

  const healthyPromises = sitesToCheck.map(async (site) => {
    const isHealthy = await checkAlternativeSiteAvailability(site);
    return isHealthy ? site : null;
  });

  const results = await Promise.all(healthyPromises);
  return results.filter((site): site is string => site !== null);
}

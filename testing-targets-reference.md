# Puppeteer Testing Targets Reference

A comprehensive guide to publicly available, stable, and testing-friendly websites, APIs, and services suitable for automated testing with Puppeteer.

## 1. Public Testing Websites

### Purpose-Built Testing Playgrounds

#### UI Test Automation Playground
- **URL**: http://uitestingplayground.com/
- **Good for**: Testing common UI automation pitfalls and edge cases
- **Features**: Dynamic IDs, AJAX data, client-side delays, hidden layers
- **Stability**: Excellent - specifically maintained for testing
- **Limitations**: None - designed for automation

#### The Internet (Heroku App)
- **URL**: https://the-internet.herokuapp.com/
- **Good for**: Various testing scenarios including authentication, dynamic content
- **Features**: A/B testing, drag & drop, file uploads, broken images, challenging DOM
- **Stability**: Very stable - maintained by Heroku
- **Limitations**: May have occasional Heroku free-tier downtimes

#### TestPages Herokuapp
- **URL**: https://testpages.herokuapp.com/
- **Good for**: JavaScript interactions, forms, AJAX
- **Features**: Styled pages, JavaScript games, HTML5 features
- **Stability**: Good - actively maintained
- **Limitations**: Heroku free-tier limitations

### E-Commerce Demo Sites

#### Sauce Demo (Swag Labs)
- **URL**: https://www.saucedemo.com/
- **Good for**: Complete e-commerce flow testing
- **Features**: Multiple user types, shopping cart, checkout process
- **Test Credentials**: 
  - standard_user / secret_sauce
  - locked_out_user / secret_sauce
  - problem_user / secret_sauce
  - performance_glitch_user / secret_sauce
- **Stability**: Excellent - maintained by SauceLabs
- **Limitations**: None - designed for testing

#### Automation Practice
- **URL**: http://automationpractice.com/
- **Good for**: Full e-commerce workflow automation
- **Features**: User registration, product search, cart, payment flow
- **Stability**: Good - popular testing site
- **Limitations**: Occasional maintenance windows

#### Demo OpenCart
- **URL**: https://demo.opencart.com/
- **Good for**: Enterprise e-commerce testing
- **Features**: Admin panel, product management, multi-store
- **Stability**: Good - official demo site
- **Limitations**: Data resets periodically

#### nopCommerce Demo
- **URL**: https://frontend.nopcommerce.com/
- **Good for**: Large-scale e-commerce testing
- **Features**: Multilingual, advanced search, user reviews
- **Stability**: Excellent - official demo
- **Limitations**: None significant

## 2. Stable Public APIs

### Testing-Specific APIs

#### HTTPBin
- **URL**: https://httpbin.org/
- **Good for**: HTTP request/response testing
- **Features**: All HTTP methods, authentication, status codes, cookies
- **Stability**: Excellent - industry standard
- **Rate Limits**: None for reasonable usage
- **Example**: `GET https://httpbin.org/get`

#### JSONPlaceholder
- **URL**: https://jsonplaceholder.typicode.com/
- **Good for**: REST API testing with fake data
- **Features**: Posts, comments, users, todos
- **Stability**: Excellent - very popular
- **Rate Limits**: None
- **Example**: `GET https://jsonplaceholder.typicode.com/posts`

#### ReqRes
- **URL**: https://reqres.in/
- **Good for**: Testing CRUD operations
- **Features**: User data, delayed responses, various HTTP methods
- **Stability**: Excellent
- **Rate Limits**: None
- **Example**: `GET https://reqres.in/api/users?page=2`

### Data APIs (No Auth Required)

#### Random User Generator
- **URL**: https://randomuser.me/api/
- **Good for**: User data generation
- **Features**: Configurable user profiles, multiple nationalities
- **Stability**: Excellent
- **Rate Limits**: Reasonable usage allowed
- **Example**: `GET https://randomuser.me/api/?results=10`

#### Open-Meteo Weather API
- **URL**: https://api.open-meteo.com/v1/forecast
- **Good for**: Weather data testing
- **Features**: No auth required, global coverage
- **Stability**: Excellent
- **Rate Limits**: Very generous for free tier
- **Example**: `GET https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true`

#### REST Countries
- **URL**: https://restcountries.com/v3.1/all
- **Good for**: Country data testing
- **Features**: Comprehensive country information
- **Stability**: Good
- **Rate Limits**: None for reasonable usage

## 3. Government/Public Data Sources

### United States

#### api.data.gov
- **URL**: https://api.data.gov/
- **Good for**: Various government datasets
- **Features**: 450+ APIs from 25 agencies
- **Stability**: Excellent - government maintained
- **Auth**: API key required but free
- **Limitations**: Some endpoints require registration

#### NASA APIs
- **URL**: https://api.nasa.gov/
- **Good for**: Space data, images
- **Features**: APOD, Mars Rover photos, asteroids
- **Stability**: Excellent
- **Auth**: Free API key (DEMO_KEY available for testing)

### India

#### APISetu
- **URL**: https://apisetu.gov.in/
- **Good for**: Indian government services
- **Features**: KYC, university data, employment info
- **Stability**: Excellent - government maintained
- **Auth**: Some APIs require registration

### International

#### World Bank API
- **URL**: https://api.worldbank.org/v2/
- **Good for**: Economic and development data
- **Features**: Country indicators, projects, climate data
- **Stability**: Excellent
- **Auth**: None required
- **Example**: `GET https://api.worldbank.org/v2/country?format=json`

## 4. Common Website Patterns

### Forms and Validation

#### ToolsQA Practice Form
- **URL**: https://demoqa.com/automation-practice-form
- **Good for**: Complex form interactions
- **Features**: Various input types, file uploads, date pickers
- **Stability**: Good
- **Limitations**: May have ads

### Single Page Applications (SPAs)

#### React Shopping Cart Demo
- **URL**: https://react-shopping-cart-67954.firebaseapp.com/
- **Good for**: React SPA testing
- **Features**: Dynamic content, state management
- **Stability**: Good
- **Limitations**: May change without notice

#### Angular Demo (XYZ Bank)
- **URL**: https://www.globalsqa.com/angularJs-protractor/BankingProject/
- **Good for**: Angular application testing
- **Features**: Banking operations, transactions
- **Stability**: Good
- **Limitations**: None significant

### News/Content Sites

#### Hacker News
- **URL**: https://news.ycombinator.com/
- **Good for**: Content scraping, pagination
- **Features**: Consistent structure, API available
- **Stability**: Excellent
- **Rate Limits**: Be respectful - use API when possible
- **API**: https://github.com/HackerNews/API

## 5. Best Practices for CI/CD Integration

### Recommended Targets for CI

1. **Most Stable**: HTTPBin, JSONPlaceholder, ReqRes
2. **E-commerce**: Sauce Demo (designed for CI)
3. **Government**: World Bank API (no auth needed)
4. **Weather**: Open-Meteo (reliable, no auth)

### Rate Limiting Considerations

- Add delays between requests (1-2 seconds)
- Use environment variables for API endpoints
- Implement retry logic with exponential backoff
- Monitor for 429 (Too Many Requests) responses

### Handling Instability

```javascript
// Example retry logic for Puppeteer
async function retryOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### Environment-Specific Configuration

```javascript
const TEST_TARGETS = {
  development: {
    ecommerce: 'https://www.saucedemo.com/',
    api: 'https://jsonplaceholder.typicode.com/'
  },
  ci: {
    ecommerce: 'https://www.saucedemo.com/',
    api: 'https://httpbin.org/'
  }
};
```

## 6. Testing Scenarios by Category

### Authentication Testing
- The Internet: Basic Auth, Form Auth
- Sauce Demo: Multiple user types
- ReqRes: Token-based auth simulation

### Form Testing
- UI Test Automation Playground: Various form challenges
- ToolsQA: Complex form elements
- TestPages: Form validation scenarios

### E-commerce Testing
- Sauce Demo: Complete purchase flow
- Automation Practice: User registration to checkout
- Demo OpenCart: Admin and customer flows

### API Testing
- HTTPBin: All HTTP scenarios
- JSONPlaceholder: CRUD operations
- ReqRes: RESTful patterns

### Performance Testing
- Sauce Demo: performance_glitch_user
- UI Test Automation Playground: Client-side delays
- HTTPBin: Delayed responses endpoint

## Notes

- Always check robots.txt before automated testing
- Respect rate limits even when not enforced
- Use test data only - never real user information
- Consider setting custom User-Agent for test traffic
- Monitor target availability and have fallbacks ready

Last Updated: January 2025
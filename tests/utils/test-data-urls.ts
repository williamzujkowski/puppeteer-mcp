/**
 * Test Data URL Generator
 * Provides data URLs for common test scenarios to avoid external dependencies
 */

export const TestDataUrls = {
  /**
   * Basic HTML page with common elements
   */
  basicPage: (title = 'Test Page') => 
    `data:text/html,<!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        button { padding: 10px 20px; margin: 5px; }
        input { padding: 8px; margin: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${title}</h1>
        <p id="description">This is a test page for automated testing.</p>
        <button id="test-button">Click Me</button>
        <input type="text" id="test-input" placeholder="Enter text">
        <div id="output"></div>
      </div>
    </body>
    </html>`,

  /**
   * Login form page
   */
  loginPage: () => 
    `data:text/html,<!DOCTYPE html>
    <html>
    <head>
      <title>Login Page</title>
      <style>
        .login-form { max-width: 300px; margin: 50px auto; padding: 20px; border: 1px solid #ccc; }
        input { display: block; width: 100%; margin: 10px 0; padding: 8px; }
        button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; }
      </style>
    </head>
    <body>
      <div class="login-form">
        <h2>Login</h2>
        <form id="login-form">
          <input type="text" id="username" name="username" placeholder="Username" required>
          <input type="password" id="password" name="password" placeholder="Password" required>
          <button type="submit" id="login-button">Login</button>
        </form>
        <div id="message"></div>
      </div>
      <script>
        document.getElementById('login-form').addEventListener('submit', (e) => {
          e.preventDefault();
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          const message = document.getElementById('message');
          
          if (username === 'standard_user' && password === 'secret_sauce') {
            message.textContent = 'Login successful!';
            message.style.color = 'green';
          } else {
            message.textContent = 'Invalid credentials';
            message.style.color = 'red';
          }
        });
      </script>
    </body>
    </html>`,

  /**
   * E-commerce product page
   */
  productPage: () => 
    `data:text/html,<!DOCTYPE html>
    <html>
    <head>
      <title>Product Page</title>
      <style>
        .product { display: flex; gap: 20px; margin: 20px; }
        .product-image { width: 300px; height: 300px; background: #f0f0f0; }
        .product-details { flex: 1; }
        .price { font-size: 24px; color: #007bff; margin: 10px 0; }
        button { padding: 10px 20px; background: #28a745; color: white; border: none; }
      </style>
    </head>
    <body>
      <div class="product">
        <div class="product-image">Product Image</div>
        <div class="product-details">
          <h1>Test Product</h1>
          <p class="price">$29.99</p>
          <p>This is a test product for automated testing.</p>
          <button id="add-to-cart">Add to Cart</button>
          <div id="cart-message"></div>
        </div>
      </div>
      <script>
        document.getElementById('add-to-cart').addEventListener('click', () => {
          document.getElementById('cart-message').textContent = 'Product added to cart!';
        });
      </script>
    </body>
    </html>`,

  /**
   * Dynamic content page with AJAX simulation
   */
  dynamicPage: () => 
    `data:text/html,<!DOCTYPE html>
    <html>
    <head>
      <title>Dynamic Content</title>
      <style>
        .loading { color: #666; font-style: italic; }
        .content { margin: 20px 0; padding: 20px; background: #f8f9fa; }
      </style>
    </head>
    <body>
      <h1>Dynamic Content Test</h1>
      <button id="load-content">Load Content</button>
      <div id="dynamic-content" class="content">
        <p class="loading">Click button to load content...</p>
      </div>
      <script>
        document.getElementById('load-content').addEventListener('click', () => {
          const content = document.getElementById('dynamic-content');
          content.innerHTML = '<p class="loading">Loading...</p>';
          
          setTimeout(() => {
            content.innerHTML = '<h2>Loaded Content</h2><p>This content was loaded dynamically!</p>';
          }, 1000);
        });
      </script>
    </body>
    </html>`,

  /**
   * Form with various input types
   */
  formPage: () => 
    `data:text/html,<!DOCTYPE html>
    <html>
    <head>
      <title>Form Test Page</title>
      <style>
        form { max-width: 500px; margin: 20px; }
        label { display: block; margin-top: 10px; }
        input, select, textarea { width: 100%; padding: 8px; margin: 5px 0; }
        button { padding: 10px 20px; margin-top: 10px; }
      </style>
    </head>
    <body>
      <h1>Test Form</h1>
      <form id="test-form">
        <label>Name: <input type="text" id="name" name="name"></label>
        <label>Email: <input type="email" id="email" name="email"></label>
        <label>Age: <input type="number" id="age" name="age" min="1" max="120"></label>
        <label>Country: 
          <select id="country" name="country">
            <option value="">Select...</option>
            <option value="us">United States</option>
            <option value="uk">United Kingdom</option>
            <option value="ca">Canada</option>
          </select>
        </label>
        <label>Comments: <textarea id="comments" name="comments" rows="4"></textarea></label>
        <label><input type="checkbox" id="agree" name="agree"> I agree to terms</label>
        <button type="submit">Submit</button>
      </form>
      <div id="form-result"></div>
      <script>
        document.getElementById('test-form').addEventListener('submit', (e) => {
          e.preventDefault();
          document.getElementById('form-result').textContent = 'Form submitted successfully!';
        });
      </script>
    </body>
    </html>`,

  /**
   * Table with sortable data
   */
  tablePage: () => 
    `data:text/html,<!DOCTYPE html>
    <html>
    <head>
      <title>Data Table</title>
      <style>
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        th { background: #f8f9fa; cursor: pointer; }
        th:hover { background: #e9ecef; }
      </style>
    </head>
    <body>
      <h1>Test Data Table</h1>
      <table id="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>John Doe</td><td>john@example.com</td><td>Active</td></tr>
          <tr><td>2</td><td>Jane Smith</td><td>jane@example.com</td><td>Inactive</td></tr>
          <tr><td>3</td><td>Bob Johnson</td><td>bob@example.com</td><td>Active</td></tr>
        </tbody>
      </table>
    </body>
    </html>`,

  /**
   * Modal dialog test page
   */
  modalPage: () => 
    `data:text/html,<!DOCTYPE html>
    <html>
    <head>
      <title>Modal Test</title>
      <style>
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); }
        .modal.show { display: flex; align-items: center; justify-content: center; }
        .modal-content { background: white; padding: 20px; border-radius: 5px; max-width: 500px; }
        button { padding: 10px 20px; margin: 5px; }
      </style>
    </head>
    <body>
      <h1>Modal Dialog Test</h1>
      <button id="open-modal">Open Modal</button>
      
      <div id="test-modal" class="modal">
        <div class="modal-content">
          <h2>Test Modal</h2>
          <p>This is a test modal dialog.</p>
          <button id="close-modal">Close</button>
          <button id="confirm-modal">Confirm</button>
        </div>
      </div>
      
      <div id="modal-result"></div>
      
      <script>
        const modal = document.getElementById('test-modal');
        document.getElementById('open-modal').addEventListener('click', () => {
          modal.classList.add('show');
        });
        document.getElementById('close-modal').addEventListener('click', () => {
          modal.classList.remove('show');
          document.getElementById('modal-result').textContent = 'Modal closed';
        });
        document.getElementById('confirm-modal').addEventListener('click', () => {
          modal.classList.remove('show');
          document.getElementById('modal-result').textContent = 'Modal confirmed';
        });
      </script>
    </body>
    </html>`,

  /**
   * Image gallery for screenshot tests
   */
  galleryPage: () => 
    `data:text/html,<!DOCTYPE html>
    <html>
    <head>
      <title>Image Gallery</title>
      <style>
        .gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px; }
        .image { background: #f0f0f0; height: 200px; display: flex; align-items: center; justify-content: center; }
        .selected { border: 3px solid #007bff; }
      </style>
    </head>
    <body>
      <h1>Test Image Gallery</h1>
      <div class="gallery" id="gallery">
        <div class="image" data-id="1">Image 1</div>
        <div class="image" data-id="2">Image 2</div>
        <div class="image" data-id="3">Image 3</div>
        <div class="image" data-id="4">Image 4</div>
        <div class="image" data-id="5">Image 5</div>
        <div class="image" data-id="6">Image 6</div>
      </div>
      <script>
        document.querySelectorAll('.image').forEach(img => {
          img.addEventListener('click', (e) => {
            document.querySelectorAll('.image').forEach(i => i.classList.remove('selected'));
            e.target.classList.add('selected');
          });
        });
      </script>
    </body>
    </html>`,
};

/**
 * Get a test page URL by name
 */
export function getTestDataUrl(pageName: keyof typeof TestDataUrls): string {
  const pageGenerator = TestDataUrls[pageName];
  if (!pageGenerator) {
    throw new Error(`Unknown test page: ${pageName}`);
  }
  return pageGenerator();
}

/**
 * Create a custom data URL from HTML content
 */
export function createDataUrl(html: string): string {
  return `data:text/html,${encodeURIComponent(html)}`;
}

/**
 * Create a base64 encoded data URL
 */
export function createBase64DataUrl(html: string): string {
  const base64 = Buffer.from(html).toString('base64');
  return `data:text/html;base64,${base64}`;
}
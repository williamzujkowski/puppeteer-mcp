/**
 * Form Automation Example
 * 
 * This example demonstrates how to:
 * - Fill out form fields
 * - Select dropdown options
 * - Check/uncheck checkboxes
 * - Submit forms
 * - Handle form validation
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const API_KEY = process.env.API_KEY || 'your-api-key';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  newsletter: boolean;
}

class FormAutomation {
  private sessionId: string | null = null;
  private apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  async createSession(): Promise<void> {
    const response = await this.apiClient.post('/sessions', {
      capabilities: {
        acceptInsecureCerts: true,
        browserName: 'chrome'
      }
    });
    
    this.sessionId = response.data.data.id;
    console.log(`Session created: ${this.sessionId}`);
  }

  async navigate(url: string): Promise<void> {
    await this.execute('goto', [url]);
    console.log(`Navigated to: ${url}`);
  }

  async fillTextField(selector: string, value: string): Promise<void> {
    // Clear existing value
    await this.execute('evaluate', [`
      document.querySelector('${selector}').value = '';
    `]);
    
    // Type new value
    await this.execute('type', [selector, value]);
    console.log(`Filled ${selector} with: ${value}`);
  }

  async selectDropdown(selector: string, value: string): Promise<void> {
    await this.execute('select', [selector, value]);
    console.log(`Selected ${value} in ${selector}`);
  }

  async toggleCheckbox(selector: string, checked: boolean): Promise<void> {
    const isChecked = await this.execute('evaluate', [`
      document.querySelector('${selector}').checked
    `]);
    
    if (isChecked !== checked) {
      await this.execute('click', [selector]);
    }
    console.log(`Checkbox ${selector} is now: ${checked ? 'checked' : 'unchecked'}`);
  }

  async submitForm(selector: string): Promise<void> {
    await this.execute('click', [selector]);
    console.log('Form submitted');
  }

  async waitForElement(selector: string, options = {}): Promise<void> {
    await this.execute('waitForSelector', [selector, options]);
    console.log(`Element ${selector} is visible`);
  }

  async getFormValidationErrors(): Promise<string[]> {
    const errors = await this.execute('evaluate', [`
      Array.from(document.querySelectorAll('.error-message'))
        .map(el => el.textContent.trim())
    `]);
    return errors as string[];
  }

  private async execute(script: string, args: any[] = []): Promise<any> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const response = await this.apiClient.post(
      `/sessions/${this.sessionId}/execute`,
      { script, args, context: {} }
    );

    return response.data.data.result;
  }

  async cleanup(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.apiClient.delete(`/sessions/${this.sessionId}`);
        console.log('Session cleaned up');
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
  }
}

async function runFormAutomationExample() {
  const automation = new FormAutomation();
  
  try {
    // Create session and navigate to form
    await automation.createSession();
    await automation.navigate('https://example-forms.com/contact');
    
    // Wait for form to load
    await automation.waitForElement('#contact-form');
    
    // Fill out the form
    const formData: FormData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      country: 'USA',
      newsletter: true
    };
    
    // Fill text fields
    await automation.fillTextField('#firstName', formData.firstName);
    await automation.fillTextField('#lastName', formData.lastName);
    await automation.fillTextField('#email', formData.email);
    
    // Select country from dropdown
    await automation.selectDropdown('#country', formData.country);
    
    // Check newsletter subscription
    await automation.toggleCheckbox('#newsletter', formData.newsletter);
    
    // Submit the form
    await automation.submitForm('#submit-button');
    
    // Wait for response
    await automation.waitForElement('.success-message', { timeout: 5000 });
    
    console.log('Form submitted successfully!');
    
    // Check for any validation errors
    const errors = await automation.getFormValidationErrors();
    if (errors.length > 0) {
      console.error('Validation errors:', errors);
    }
    
  } catch (error) {
    console.error('Form automation failed:', error);
  } finally {
    await automation.cleanup();
  }
}

// Advanced form handling with retry logic
async function fillFormWithRetry(
  automation: FormAutomation,
  formData: FormData,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries}`);
      
      // Fill form fields
      await automation.fillTextField('#firstName', formData.firstName);
      await automation.fillTextField('#lastName', formData.lastName);
      await automation.fillTextField('#email', formData.email);
      
      // Validate email format before submission
      const emailValid = await automation.execute('evaluate', [`
        document.querySelector('#email').checkValidity()
      `]);
      
      if (!emailValid) {
        throw new Error('Invalid email format');
      }
      
      // Submit form
      await automation.submitForm('#submit-button');
      
      // Check for success
      await automation.waitForElement('.success-message', { timeout: 3000 });
      console.log('Form submitted successfully');
      return;
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Run the example
if (require.main === module) {
  runFormAutomationExample()
    .then(() => console.log('Example completed'))
    .catch(error => console.error('Example failed:', error));
}
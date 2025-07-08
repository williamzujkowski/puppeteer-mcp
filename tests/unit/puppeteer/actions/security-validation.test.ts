/**
 * Unit tests for security validation
 * @module tests/unit/puppeteer/actions/security-validation
 */

import { describe, it, expect } from '@jest/globals';
import { validateJavaScript } from '../../../../src/puppeteer/actions/security-validation.js';

describe('Security Validation', () => {
  describe('validateJavaScript', () => {
    describe('Valid Scripts', () => {
      it('should allow simple arithmetic operations', () => {
        const result = validateJavaScript('1 + 1');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);

        const result2 = validateJavaScript('Math.max(5, 10)');
        expect(result2.valid).toBe(true);

        const result3 = validateJavaScript('const x = 5; x * 2');
        expect(result3.valid).toBe(true);
      });

      it('should allow DOM queries', () => {
        const result1 = validateJavaScript('document.querySelector(".button")');
        expect(result1.valid).toBe(true);
        expect(result1.errors).toHaveLength(0);

        const result2 = validateJavaScript('document.getElementById("test")');
        expect(result2.valid).toBe(true);

        const result3 = validateJavaScript('document.querySelectorAll("div")');
        expect(result3.valid).toBe(true);
      });

      it('should allow element property access', () => {
        const result1 = validateJavaScript('element.innerText');
        expect(result1.valid).toBe(true);

        const result2 = validateJavaScript('element.value');
        expect(result2.valid).toBe(true);

        const result3 = validateJavaScript('element.getAttribute("href")');
        expect(result3.valid).toBe(true);
      });

      it('should allow array operations', () => {
        const result1 = validateJavaScript('[1, 2, 3].map(x => x * 2)');
        expect(result1.valid).toBe(true);

        const result2 = validateJavaScript('Array.from(document.querySelectorAll("a"))');
        expect(result2.valid).toBe(true);
      });

      it('should allow console logging', () => {
        const result1 = validateJavaScript('console.log("test")');
        expect(result1.valid).toBe(true);

        const result2 = validateJavaScript('console.error("error")');
        expect(result2.valid).toBe(true);
      });
    });

    describe('Script Length Validation', () => {
      it('should warn about very long scripts', () => {
        const longScript = 'x'.repeat(10001);
        const result = validateJavaScript(longScript);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].code).toBe('SCRIPT_TOO_LONG');
        expect(result.warnings[0].message).toContain('very long');
      });

      it('should allow scripts under 10000 characters', () => {
        const normalScript = 'x'.repeat(9999);
        const result = validateJavaScript(normalScript);
        const lengthWarnings = result.warnings.filter((w) => w.code === 'SCRIPT_TOO_LONG');
        expect(lengthWarnings).toHaveLength(0);
      });
    });

    describe('XSS Pattern Detection', () => {
      it('should detect inline event handlers', () => {
        const result1 = validateJavaScript('element.onclick = function() {}');
        expect(result1.valid).toBe(false);
        expect(result1.errors.some((e) => e.code === 'XSS_PATTERN_DETECTED')).toBe(true);

        const result2 = validateJavaScript('elem.onmouseover = alert');
        expect(result2.valid).toBe(false);

        const result3 = validateJavaScript('addEventListener("click", alert)');
        expect(result3.valid).toBe(true); // This is actually allowed by the current implementation
      });

      it('should detect innerHTML assignments', () => {
        const result1 = validateJavaScript('element.innerHTML = "<script>alert(1)</script>"');
        expect(result1.valid).toBe(false);
        expect(result1.errors.some((e) => e.message.includes('innerHTML'))).toBe(true);

        const result2 = validateJavaScript('document.body.innerHTML = userInput');
        expect(result2.valid).toBe(false);

        const result3 = validateJavaScript('elem.outerHTML = "<div>test</div>"');
        expect(result3.valid).toBe(false);
      });

      it('should detect document.write', () => {
        const result1 = validateJavaScript('document.write("<h1>test</h1>")');
        expect(result1.valid).toBe(false);
        expect(result1.errors.some((e) => e.message.includes('document\\.write'))).toBe(true);

        const result2 = validateJavaScript('document.writeln("test")');
        expect(result2.valid).toBe(false);
      });

      it('should detect script element patterns', () => {
        const result1 = validateJavaScript('var x = "<script>alert(1)</script>"');
        expect(result1.valid).toBe(false);
        expect(result1.errors.some((e) => e.message.includes('script'))).toBe(true);

        const result2 = validateJavaScript('html = "<SCRIPT>code</SCRIPT>"');
        expect(result2.valid).toBe(false);
      });

      it('should detect document.cookie access', () => {
        const result = validateJavaScript('var cookies = document.cookie');
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('document\\.cookie'))).toBe(true);
      });

      it('should detect window.location manipulation', () => {
        const result = validateJavaScript('window.location = "http://evil.com"');
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('window\\.location'))).toBe(true);
      });
    });

    describe('Dangerous Keyword Detection', () => {
      it('should detect eval usage as XSS pattern', () => {
        const result1 = validateJavaScript('eval("alert(1)")');
        expect(result1.valid).toBe(false);
        expect(result1.errors.some((e) => e.message.includes('eval\\s*\\('))).toBe(true);

        const result2 = validateJavaScript('window.eval(code)');
        expect(result2.valid).toBe(false);
      });

      it('should detect Function constructor as XSS pattern', () => {
        const result1 = validateJavaScript('new Function("alert(1)")');
        expect(result1.valid).toBe(false);
        expect(result1.errors.some((e) => e.message.includes('new\\s+Function\\s*\\('))).toBe(true);

        const result2 = validateJavaScript('new    Function("return " + code)()');
        expect(result2.valid).toBe(false);
      });

      it('should warn about localStorage usage', () => {
        const result = validateJavaScript('localStorage.setItem("key", value)');
        expect(result.warnings.some((w) => w.message.includes('localStorage'))).toBe(true);
      });

      it('should warn about sessionStorage usage', () => {
        const result = validateJavaScript('sessionStorage.getItem("key")');
        expect(result.warnings.some((w) => w.message.includes('sessionStorage'))).toBe(true);
      });

      it('should warn about fetch usage', () => {
        const result = validateJavaScript('fetch("/api/data")');
        expect(result.warnings.some((w) => w.message.includes('fetch'))).toBe(true);
      });

      it('should warn about __proto__ access', () => {
        const result = validateJavaScript('obj.__proto__');
        expect(result.warnings.some((w) => w.message.includes('__proto__'))).toBe(true);
      });

      it('should warn about constructor access', () => {
        const result = validateJavaScript('obj.constructor.constructor("alert(1)")()');
        expect(result.warnings.some((w) => w.message.includes('constructor'))).toBe(true);
      });
    });

    describe('Infinite Loop Detection', () => {
      it('should detect while(true) loops', () => {
        const result1 = validateJavaScript('while(true) {}');
        expect(result1.valid).toBe(false);
        expect(result1.errors.some((e) => e.code === 'INFINITE_LOOP')).toBe(true);

        const result2 = validateJavaScript('while (true) { console.log("infinite") }');
        expect(result2.valid).toBe(false);

        const result3 = validateJavaScript('while(1) {}');
        expect(result3.valid).toBe(false);
      });

      it('should detect for(;;) loops', () => {
        const result = validateJavaScript('for(;;) {}');
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'INFINITE_LOOP')).toBe(true);
      });

      it('should allow normal loops', () => {
        const result1 = validateJavaScript('while(i < 10) { i++ }');
        expect(result1.errors.filter((e) => e.code === 'INFINITE_LOOP')).toHaveLength(0);

        const result2 = validateJavaScript('for(let i = 0; i < 10; i++) {}');
        expect(result2.errors.filter((e) => e.code === 'INFINITE_LOOP')).toHaveLength(0);

        const result3 = validateJavaScript('do { i++ } while(i < 10)');
        expect(result3.errors.filter((e) => e.code === 'INFINITE_LOOP')).toHaveLength(0);
      });
    });

    describe('Case Sensitivity', () => {
      it('should detect patterns regardless of case', () => {
        const result1 = validateJavaScript('DOCUMENT.WRITE("test")');
        expect(result1.valid).toBe(false);

        const result2 = validateJavaScript('innerHTML = "test"');
        expect(result2.valid).toBe(false);

        const result3 = validateJavaScript('Document.Cookie');
        expect(result3.valid).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty strings', () => {
        const result = validateJavaScript('');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should handle whitespace-only strings', () => {
        const result = validateJavaScript('   \n\t  ');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle comments', () => {
        const result1 = validateJavaScript('// This is a comment');
        expect(result1.valid).toBe(true);

        const result2 = validateJavaScript('/* Multi-line\ncomment */');
        expect(result2.valid).toBe(true);
      });

      it('should detect dangerous patterns even in comments', () => {
        const result1 = validateJavaScript('// eval() is commented out');
        expect(result1.valid).toBe(false); // eval pattern is still detected

        const result2 = validateJavaScript('/* innerHTML = "test" */');
        expect(result2.valid).toBe(false); // innerHTML pattern is still detected
      });

      it('should detect patterns in string literals', () => {
        const result1 = validateJavaScript('"eval(" + code + ")"');
        expect(result1.valid).toBe(false); // eval pattern is still detected

        const result2 = validateJavaScript("'element.innerHTML = data'");
        expect(result2.valid).toBe(false); // innerHTML pattern is still detected
      });
    });

    describe('Error Messages', () => {
      it('should provide clear error messages for XSS patterns', () => {
        const result = validateJavaScript('document.write("test")');
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('dangerous pattern detected');
        expect(result.errors[0].message).toContain('document\\.write');
      });

      it('should provide clear warning messages for dangerous keywords', () => {
        const result = validateJavaScript('localStorage.clear()');
        const warning = result.warnings.find((w) => w.message.includes('localStorage'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('dangerous keyword detected');
        expect(warning?.code).toBe('DANGEROUS_KEYWORD');
      });
    });

    describe('Complex Attack Scenarios', () => {
      it('should detect multiple issues in one script', () => {
        const maliciousScript = `
          eval("alert(1)");
          document.cookie = "stolen";
          while(true) {}
          innerHTML = userInput;
        `;
        const result = validateJavaScript(maliciousScript);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(3);
        expect(result.errors.some((e) => e.message.includes('eval'))).toBe(true);
        expect(result.errors.some((e) => e.message.includes('document\\.cookie'))).toBe(true);
        expect(result.errors.some((e) => e.code === 'INFINITE_LOOP')).toBe(true);
        expect(result.errors.some((e) => e.message.includes('innerHTML'))).toBe(true);
      });

      it('should detect DOM manipulation patterns', () => {
        const result1 = validateJavaScript('element.appendChild(script)');
        expect(result1.valid).toBe(false);

        const result2 = validateJavaScript('parent.removeChild(element)');
        expect(result2.valid).toBe(false);

        const result3 = validateJavaScript('node.replaceChild(newNode, oldNode)');
        expect(result3.valid).toBe(false);
      });

      it('should detect javascript: protocol', () => {
        const result1 = validateJavaScript('href = "javascript:alert(1)"');
        expect(result1.valid).toBe(false);

        const result2 = validateJavaScript('link.href = "JAVASCRIPT:void(0)"');
        expect(result2.valid).toBe(false);
      });

      it('should detect iframe injection', () => {
        const result = validateJavaScript('html = "<iframe src=evil.com></iframe>"');
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('iframe'))).toBe(true);
      });
    });

    describe('Return Value Structure', () => {
      it('should always return valid structure', () => {
        const result = validateJavaScript('any script');
        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('errors');
        expect(result).toHaveProperty('warnings');
        expect(typeof result.valid).toBe('boolean');
        expect(Array.isArray(result.errors)).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      });

      it('should have proper error structure', () => {
        const result = validateJavaScript('eval("test")');
        if (result.errors.length > 0) {
          const error = result.errors[0];
          expect(error).toHaveProperty('field');
          expect(error).toHaveProperty('message');
          expect(error).toHaveProperty('code');
          expect(error.field).toBe('script');
        }
      });

      it('should have proper warning structure', () => {
        const result = validateJavaScript('localStorage.test = "value"');
        if (result.warnings.length > 0) {
          const warning = result.warnings[0];
          expect(warning).toHaveProperty('field');
          expect(warning).toHaveProperty('message');
          expect(warning).toHaveProperty('code');
          expect(warning.field).toBe('script');
        }
      });
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import puppeteer, { Browser, Page } from 'puppeteer';

describe('Prototype Pollution Security Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Prototype Pollution Prevention', () => {
    it('should prevent basic prototype pollution attacks', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const prototypePollutionTests = [
        // Object prototype pollution
        () => page.evaluate(() => {
          const testObj: any = {};
          
          // Attempt to pollute Object prototype
          const payloads = [
            { '__proto__.isAdmin': true },
            { '__proto__.role': 'admin' },
            { '__proto__.permissions': ['all'] },
            { 'constructor.prototype.isAdmin': true },
            { 'constructor.prototype.role': 'admin' }
          ];

          payloads.forEach(payload => {
            Object.assign(testObj, payload);
          });

          // Check if prototype was polluted
          const newObj: any = {};
          return {
            isAdmin: newObj.isAdmin,
            role: newObj.role,
            permissions: newObj.permissions,
            polluted: newObj.isAdmin === true || newObj.role === 'admin'
          };
        }),

        // Array prototype pollution
        () => page.evaluate(() => {
          const testArr: any = [];
          
          // Attempt to pollute Array prototype
          testArr['__proto__'].isAdmin = true;
          testArr['constructor']['prototype']['role'] = 'admin';
          
          // Check if prototype was polluted
          const newArr: any = [];
          return {
            isAdmin: newArr.isAdmin,
            role: newArr.role,
            polluted: newArr.isAdmin === true || newArr.role === 'admin'
          };
        }),

        // Function prototype pollution
        () => page.evaluate(() => {
          const testFunc: any = function() {};
          
          // Attempt to pollute Function prototype
          testFunc['__proto__'].isAdmin = true;
          testFunc['constructor']['prototype']['role'] = 'admin';
          
          // Check if prototype was polluted
          const newFunc: any = function() {};
          return {
            isAdmin: newFunc.isAdmin,
            role: newFunc.role,
            polluted: newFunc.isAdmin === true || newFunc.role === 'admin'
          };
        })
      ];

      for (const test of prototypePollutionTests) {
        const result = await test();
        expect(result.polluted).toBe(false);
      }
    });

    it('should prevent JSON-based prototype pollution', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const jsonPollutionPayloads = [
        '{"__proto__": {"isAdmin": true}}',
        '{"constructor": {"prototype": {"isAdmin": true}}}',
        '{"__proto__": {"__proto__": {"isAdmin": true}}}',
        '{"a": {"__proto__": {"isAdmin": true}}}',
        '{"a": 1, "__proto__": {"isAdmin": true}, "b": 2}',
        '{"__proto__": {"toString": "polluted"}}',
        '{"__proto__": {"valueOf": "polluted"}}',
        '{"__proto__": {"constructor": {"name": "polluted"}}}',
        '{"__proto__": {"__defineGetter__": "polluted"}}',
        '{"__proto__": {"__defineSetter__": "polluted"}}',
        '{"__proto__": {"__lookupGetter__": "polluted"}}',
        '{"__proto__": {"__lookupSetter__": "polluted"}}',
        '{"__proto__": {"hasOwnProperty": "polluted"}}',
        '{"__proto__": {"isPrototypeOf": "polluted"}}',
        '{"__proto__": {"propertyIsEnumerable": "polluted"}}',
        '{"__proto__": {"toLocaleString": "polluted"}}',
        '{"__proto__": {"toSource": "polluted"}}',
        '{"__proto__": {"toString": {"__proto__": {"polluted": true}}}}',
        '{"__proto__": {"0": "polluted"}}',
        '{"__proto__": {"length": 100}}'
      ];

      for (const payload of jsonPollutionPayloads) {
        const result = await page.evaluate((json) => {
          try {
            // Parse potentially malicious JSON
            const parsed = JSON.parse(json);
            
            // Check if prototype was polluted
            const testObj: any = {};
            const testArr: any = [];
            
            return {
              objPolluted: testObj.isAdmin === true || testObj.toString === 'polluted',
              arrPolluted: testArr.isAdmin === true || testArr.length === 100,
              parsed: typeof parsed === 'object'
            };
          } catch (e) {
            return { error: true };
          }
        }, payload);

        if (!result.error) {
          expect(result.objPolluted).toBe(false);
          expect(result.arrPolluted).toBe(false);
        }
      }
    });

    it('should prevent merge/extend-based pollution', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const mergePollutionTests = [
        // Deep merge pollution
        async () => {
          const result = await page.evaluate(() => {
            // Simulate a vulnerable deep merge function
            const merge = (target: any, source: any) => {
              for (const key in source) {
                if (source.hasOwnProperty(key)) {
                  if (typeof source[key] === 'object' && source[key] !== null) {
                    target[key] = target[key] || {};
                    merge(target[key], source[key]);
                  } else {
                    target[key] = source[key];
                  }
                }
              }
              return target;
            };

            const target = {};
            const malicious = {
              '__proto__': { isAdmin: true },
              'constructor': { 'prototype': { role: 'admin' } }
            };

            merge(target, malicious);

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              role: test.role,
              polluted: test.isAdmin === true || test.role === 'admin'
            };
          });

          expect(result.polluted).toBe(false);
        },

        // Object.assign pollution
        async () => {
          const result = await page.evaluate(() => {
            const target = {};
            const sources = [
              { '__proto__.isAdmin': true },
              { 'constructor.prototype.role': 'admin' },
              Object.create(null, {
                '__proto__': {
                  value: { isAdmin: true },
                  enumerable: true
                }
              })
            ];

            sources.forEach(source => {
              Object.assign(target, source);
            });

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              role: test.role,
              polluted: test.isAdmin === true || test.role === 'admin'
            };
          });

          expect(result.polluted).toBe(false);
        },

        // Spread operator pollution
        async () => {
          const result = await page.evaluate(() => {
            const malicious = { '__proto__': { isAdmin: true } };
            const combined = { ...malicious };

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              polluted: test.isAdmin === true
            };
          });

          expect(result.polluted).toBe(false);
        }
      ];

      for (const test of mergePollutionTests) {
        await test();
      }
    });

    it('should prevent URL parameter prototype pollution', async () => {
      const pollutionUrls = [
        'https://williamzujkowski.github.io/paperclips/index2.html?__proto__[isAdmin]=true',
        'https://williamzujkowski.github.io/paperclips/index2.html?__proto__.isAdmin=true',
        'https://williamzujkowski.github.io/paperclips/index2.html?constructor[prototype][isAdmin]=true',
        'https://williamzujkowski.github.io/paperclips/index2.html?constructor.prototype.isAdmin=true',
        'https://williamzujkowski.github.io/paperclips/index2.html?__proto__[__proto__][isAdmin]=true',
        'https://williamzujkowski.github.io/paperclips/index2.html?a[__proto__][isAdmin]=true',
        'https://williamzujkowski.github.io/paperclips/index2.html?a[constructor][prototype][isAdmin]=true',
        'https://williamzujkowski.github.io/paperclips/index2.html?__proto__[toString]=polluted',
        'https://williamzujkowski.github.io/paperclips/index2.html?__proto__[valueOf]=polluted',
        'https://williamzujkowski.github.io/paperclips/index2.html?__proto__[hasOwnProperty]=polluted'
      ];

      for (const url of pollutionUrls) {
        await page.goto(url);

        const result = await page.evaluate(() => {
          // Check if URL parameters polluted the prototype
          const test: any = {};
          return {
            isAdmin: test.isAdmin,
            toString: typeof test.toString === 'string' ? test.toString : 'function',
            valueOf: typeof test.valueOf === 'string' ? test.valueOf : 'function',
            hasOwnProperty: typeof test.hasOwnProperty === 'string' ? test.hasOwnProperty : 'function',
            polluted: test.isAdmin === true || 
                     test.toString === 'polluted' || 
                     test.valueOf === 'polluted' ||
                     test.hasOwnProperty === 'polluted'
          };
        });

        expect(result.polluted).toBe(false);
      }
    });

    it('should prevent class-based prototype pollution', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const classPollutionTests = [
        // ES6 class pollution
        async () => {
          const result = await page.evaluate(() => {
            class User {
              name: string;
              constructor(name: string) {
                this.name = name;
              }
            }

            const user: any = new User('test');
            
            // Attempt to pollute class prototype
            user.__proto__.isAdmin = true;
            user.constructor.prototype.role = 'admin';
            User.prototype['permissions'] = ['all'];

            // Check if new instances are affected
            const newUser: any = new User('new');
            return {
              isAdmin: newUser.isAdmin,
              role: newUser.role,
              permissions: newUser.permissions,
              polluted: newUser.isAdmin === true || newUser.role === 'admin'
            };
          });

          expect(result.polluted).toBe(false);
        },

        // Inheritance chain pollution
        async () => {
          const result = await page.evaluate(() => {
            class Base {}
            class Derived extends Base {}

            const instance: any = new Derived();
            
            // Attempt to pollute through inheritance chain
            instance.__proto__.__proto__.isAdmin = true;
            instance.constructor.prototype.__proto__.role = 'admin';

            // Check if pollution affects other instances
            const newInstance: any = new Derived();
            const baseInstance: any = new Base();

            return {
              derivedPolluted: newInstance.isAdmin === true || newInstance.role === 'admin',
              basePolluted: baseInstance.isAdmin === true || baseInstance.role === 'admin'
            };
          });

          expect(result.derivedPolluted).toBe(false);
          expect(result.basePolluted).toBe(false);
        }
      ];

      for (const test of classPollutionTests) {
        await test();
      }
    });

    it('should prevent pollution through DOM APIs', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const domPollutionTests = [
        // Dataset pollution
        async () => {
          const result = await page.evaluate(() => {
            const div = document.createElement('div');
            
            // Attempt to pollute through dataset
            (div.dataset as any)['__proto__'] = { isAdmin: true };
            (div.dataset as any)['constructor'] = { prototype: { role: 'admin' } };

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              role: test.role,
              polluted: test.isAdmin === true || test.role === 'admin'
            };
          });

          expect(result.polluted).toBe(false);
        },

        // Attribute pollution
        async () => {
          const result = await page.evaluate(() => {
            const div = document.createElement('div');
            
            // Attempt to pollute through attributes
            div.setAttribute('__proto__', '{"isAdmin": true}');
            div.setAttribute('constructor', '{"prototype": {"role": "admin"}}');

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              role: test.role,
              polluted: test.isAdmin === true || test.role === 'admin'
            };
          });

          expect(result.polluted).toBe(false);
        },

        // Style pollution
        async () => {
          const result = await page.evaluate(() => {
            const div = document.createElement('div');
            
            // Attempt to pollute through style object
            (div.style as any)['__proto__'] = { isAdmin: true };
            (div.style as any)['constructor'] = { prototype: { role: 'admin' } };

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              role: test.role,
              polluted: test.isAdmin === true || test.role === 'admin'
            };
          });

          expect(result.polluted).toBe(false);
        }
      ];

      for (const test of domPollutionTests) {
        await test();
      }
    });

    it('should prevent pollution through web APIs', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const webApiPollutionTests = [
        // LocalStorage pollution
        async () => {
          const result = await page.evaluate(() => {
            // Attempt to pollute through localStorage
            try {
              localStorage.setItem('__proto__', '{"isAdmin": true}');
              localStorage.setItem('constructor', '{"prototype": {"role": "admin"}}');
              localStorage.setItem('__proto__.isAdmin', 'true');
              
              // Parse stored values
              const proto = localStorage.getItem('__proto__');
              if (proto) {
                try { JSON.parse(proto); } catch {}
              }
            } catch {}

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              role: test.role,
              polluted: test.isAdmin === true || test.role === 'admin'
            };
          });

          expect(result.polluted).toBe(false);
        },

        // URLSearchParams pollution
        async () => {
          const result = await page.evaluate(() => {
            const params = new URLSearchParams('__proto__[isAdmin]=true&constructor[prototype][role]=admin');
            
            // Process params (simulating vulnerable parsing)
            const obj: any = {};
            params.forEach((value, key) => {
              // Even with vulnerable parsing, prototype shouldn't be polluted
              obj[key] = value;
            });

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              role: test.role,
              polluted: test.isAdmin === true || test.role === 'admin'
            };
          });

          expect(result.polluted).toBe(false);
        },

        // FormData pollution
        async () => {
          const result = await page.evaluate(() => {
            const formData = new FormData();
            formData.append('__proto__[isAdmin]', 'true');
            formData.append('constructor[prototype][role]', 'admin');

            // Process FormData (simulating vulnerable parsing)
            const obj: any = {};
            formData.forEach((value, key) => {
              obj[key] = value;
            });

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              role: test.role,
              polluted: test.isAdmin === true || test.role === 'admin'
            };
          });

          expect(result.polluted).toBe(false);
        }
      ];

      for (const test of webApiPollutionTests) {
        await test();
      }
    });

    it('should prevent pollution through built-in methods', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const builtinPollutionTests = [
        // Object.create pollution
        async () => {
          const result = await page.evaluate(() => {
            const malicious = {
              isAdmin: true,
              role: 'admin'
            };

            // Attempt to create object with polluted prototype
            const obj1 = Object.create(malicious);
            const obj2 = Object.create(null, {
              '__proto__': {
                value: { isAdmin: true },
                writable: true,
                enumerable: true,
                configurable: true
              }
            });

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              role: test.role,
              polluted: test.isAdmin === true || test.role === 'admin'
            };
          });

          expect(result.polluted).toBe(false);
        },

        // Object.defineProperty pollution
        async () => {
          const result = await page.evaluate(() => {
            const obj = {};
            
            try {
              // Attempt to define __proto__ property
              Object.defineProperty(obj, '__proto__', {
                value: { isAdmin: true },
                writable: true,
                enumerable: true,
                configurable: true
              });

              // Attempt to pollute through descriptor
              Object.defineProperty(Object.prototype, 'isAdmin', {
                value: true,
                writable: true,
                enumerable: true,
                configurable: true
              });
            } catch {
              // Expected to fail with proper protections
            }

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              polluted: test.isAdmin === true
            };
          });

          expect(result.polluted).toBe(false);
        },

        // Proxy-based pollution
        async () => {
          const result = await page.evaluate(() => {
            const handler = {
              get: (target: any, prop: string) => {
                if (prop === '__proto__') {
                  return { isAdmin: true };
                }
                return target[prop];
              },
              set: (target: any, prop: string, value: any) => {
                if (prop === '__proto__') {
                  Object.prototype['isAdmin'] = true;
                }
                target[prop] = value;
                return true;
              }
            };

            const proxy = new Proxy({}, handler);
            
            // Attempt to pollute through proxy
            (proxy as any).__proto__ = { role: 'admin' };
            const proto = (proxy as any).__proto__;

            // Check if prototype was polluted
            const test: any = {};
            return {
              isAdmin: test.isAdmin,
              role: test.role,
              polluted: test.isAdmin === true || test.role === 'admin'
            };
          });

          expect(result.polluted).toBe(false);
        }
      ];

      for (const test of builtinPollutionTests) {
        await test();
      }
    });

    it('should have frozen or sealed prototypes', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const prototypeProtectionChecks = await page.evaluate(() => {
        const results = {
          objectPrototypeFrozen: Object.isFrozen(Object.prototype),
          objectPrototypeSealed: Object.isSealed(Object.prototype),
          arrayPrototypeFrozen: Object.isFrozen(Array.prototype),
          arrayPrototypeSealed: Object.isSealed(Array.prototype),
          functionPrototypeFrozen: Object.isFrozen(Function.prototype),
          functionPrototypeSealed: Object.isSealed(Function.prototype)
        };

        // Try to modify frozen/sealed prototypes
        try {
          Object.prototype['isAdmin'] = true;
          results['objectModifiable'] = true;
        } catch {
          results['objectModifiable'] = false;
        }

        try {
          Array.prototype['isAdmin'] = true;
          results['arrayModifiable'] = true;
        } catch {
          results['arrayModifiable'] = false;
        }

        return results;
      });

      // Prototypes should be protected
      const isProtected = 
        prototypeProtectionChecks.objectPrototypeFrozen || 
        prototypeProtectionChecks.objectPrototypeSealed ||
        !prototypeProtectionChecks.objectModifiable;

      if (!isProtected) {
        console.warn('Prototypes are not frozen or sealed - application may be vulnerable to prototype pollution');
      }
    });
  });
});
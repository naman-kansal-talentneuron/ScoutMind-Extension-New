// scout-mind-extension/jest.config.js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'], // Points to scout-mind-extension/src/
  moduleNameMapper: {
    // Mock CSS imports for components (if you test components importing CSS)
    '\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Alias utils to help with imports if needed, e.g. if tests are deep
    // '^../utils/(.*)$': '<rootDir>/src/utils/$1', (adjust based on actual structure)
  },
  // setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'], // If you create a setupTests.ts
};

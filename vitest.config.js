module.exports = {
  test: {
    // Expose describe/it/expect as globals so test files need no imports.
    globals: true,
    // Pure-logic units run in plain Node — no DOM required.
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
};

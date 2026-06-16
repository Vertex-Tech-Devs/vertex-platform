module.exports = {
  '**/*.ts': () => [
    'npm run lint',
    'npm run typecheck'
  ]
};

const serverless = require('serverless-http');
const app = require('../../src/app');

// Wrap Express app with serverless-http
const serverlessHandler = serverless(app);

exports.handler = async (event, context) => {
  // Prevent function from waiting for background node event loops (e.g. database connections)
  context.callbackWaitsForEmptyEventLoop = false;
  return await serverlessHandler(event, context);
};

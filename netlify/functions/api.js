const serverless = require('serverless-http');
const app = require('../../src/app');

// Wrap Express app with serverless-http
const serverlessHandler = serverless(app);

exports.handler = async (event, context) => {
  // Ensure background asynchronous tasks (e.g. Supabase writes) complete before ending invocation
  if (context) {
    context.callbackWaitsForEmptyEventLoop = true;
  }
  return await serverlessHandler(event, context);
};

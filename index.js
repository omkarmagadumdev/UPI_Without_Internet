const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const config = require('./src/config');
const routes = require('./src/routes');
const { AppError } = require('./src/errors/appError');

async function bootstrap(){
  await config.init();
  const app = express();
  app.set('views', path.join(__dirname, 'src', 'views'));
  app.set('view engine', 'ejs');
  app.use(bodyParser.json({limit: '1mb'}));
  app.use(bodyParser.urlencoded({extended:true}));

  app.use((req, res, next) => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      console.log(JSON.stringify({
        level: 'info',
        event: 'request',
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs
      }));
    });
    next();
  });

  app.use(express.static(path.join(__dirname, 'src', 'views')));
  app.use('/', routes);

  app.use((err, req, res, next) => {
    if (!err) return next();

    if (err instanceof AppError) {
      return res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          requestId: req.requestId
        }
      });
    }

    console.error('Unhandled error', { requestId: req.requestId, err });
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error',
        requestId: req.requestId
      }
    });
  });

  const port = config.env.PORT || 3000;
  const server = app.listen(port, ()=>{
    console.log(`UPI Mesh Node demo listening on ${port}`);
  });
  return {app, server};
}

if (require.main === module) {
  bootstrap().catch(err=>{
    console.error('Failed to start', err);
    process.exit(1);
  });
}

module.exports = { bootstrap };

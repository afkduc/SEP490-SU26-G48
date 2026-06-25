function logger(req, res, next) {
  const { method, originalUrl } = req;
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${method} ${originalUrl} ${res.statusCode} - ${duration}ms`);
  });

  next();
}

module.exports = logger;

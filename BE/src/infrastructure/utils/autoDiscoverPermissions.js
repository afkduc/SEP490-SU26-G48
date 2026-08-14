/**
 * autoDiscoverPermissions.js
 *
 * Quét tĩnh các route file trong src/presentation/routes để sinh permission
 * keys tu cac route dang co. Moi route duoc bien thanh 1 entry:
 *
 *   { module, resource, action, method }
 *
 * - module   : ten file route (bo 'Routes.js')  -> "manager", "admin", "users"
 * - resource : path segment dau tien trong route (vd "/employees/:id" -> "employees")
 * - action   : map tu HTTP method (GET -> read, POST -> create, PUT/PATCH -> update, DELETE -> delete)
 * - method   : HTTP method goc (GET, POST, ...)
 *
 * Phuong phap static scan (khong execute router) de tranh circular dependency
 * giua controllers va routes/index.js.
 */

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', '..', 'presentation', 'routes');

// Map HTTP method -> action. Su dung de dinh danh quyen trong DB.
const METHOD_TO_ACTION = {
  GET: 'read',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

// Regex bat cac route declaration:
//   router.get('/employees', ...)
//   router.post('/employees/:id/transfer', ...)
//   router.use(...)  -> middleware, khong phai route (bo qua)
//   router.route('/x').get().post()  -> it xuat hien, khong bat
const ROUTE_RE = /\b(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;

/**
 * Ten file route -> module. Bo hau to 'Routes.js' (hoac 'Router.js').
 *   managerRoutes.js     -> "manager"
 *   adminRoutes.js       -> "admin"
 *   (legacy userRoutes.js da go)
 */
function _moduleFromFilename(filename) {
  return filename.replace(/\.js$/, '').replace(/Rout(er|es)\.?$/i, '');
}

/**
 * Doc tat ca route tu 1 file, tra ve array [{ module, resource, action, method }].
 * Bo qua route '/' (index cua router) va route '_debug/*' (chi danh cho dev).
 */
function _scanFile(filePath, moduleName) {
  const src = fs.readFileSync(filePath, 'utf8');
  const results = [];
  let m;
  ROUTE_RE.lastIndex = 0;
  while ((m = ROUTE_RE.exec(src)) !== null) {
    const method = m[2].toUpperCase();
    const routePath = m[3];
    if (routePath === '/') continue; // index/root cua router
    if (routePath.startsWith('_debug')) continue;

    const pathSegments = routePath.replace(/^\/+/, '').split('/').filter(Boolean);
    const resource = pathSegments[0] || moduleName;
    const action = METHOD_TO_ACTION[method] || method.toLowerCase();

    results.push({
      module: moduleName,
      resource,
      action,
      method,
    });
  }
  return results;
}

let _cache = null;

function generatePermissionKeys() {
  if (_cache) return _cache;

  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js') && f !== 'index.js');

  const all = [];
  for (const f of files) {
    const module = _moduleFromFilename(f);
    const filePath = path.join(ROUTES_DIR, f);
    try {
      const perms = _scanFile(filePath, module);
      all.push(...perms);
    } catch (err) {
      // Loi doc file -> bo qua, khong chan ca qua trinh
      console.warn(`[autoDiscoverPermissions] skip ${f}: ${err.message}`);
    }
  }

  _cache = all.slice();
  return _cache;
}

function _resetCache() {
  _cache = null;
}

module.exports = {
  generatePermissionKeys,
  _resetCache,
};

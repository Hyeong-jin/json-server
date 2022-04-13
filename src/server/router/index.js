const express = require('express');
const methodOverride = require('method-override');
const _ = require('lodash');
const lodashId = require('lodash-id');
const low = require('lowdb');
const Memory = require('lowdb/adapters/Memory');
const FileSync = require('lowdb/adapters/FileSync');
const bodyParser = require('../body-parser');
const validateData = require('./validate-data');
const plural = require('./plural');
const nested = require('./nested');
const singular = require('./singular');
const mixins = require('../mixins');

module.exports = (db, opts) => {
  opts = Object.assign(
    {
      foreignKeySuffix: 'Id',
      _isFake: false,
      parentColumn: undefined,
      parentId: undefined,
    },
    opts
  );

  if (typeof db === 'string') {
    db = low(new FileSync(db));
  } else if (!_.has(db, '__chain__') || !_.has(db, '__wrapped__')) {
    db = low(new Memory()).setState(db);
  }

  // Create router
  const router = express.Router();

  // Add middlewares
  router.use(methodOverride());
  router.use(bodyParser);

  validateData(db.getState());

  // Add lodash-id methods to db
  db._.mixin(lodashId);

  // Add specific mixins
  db._.mixin(mixins);

  // Expose database
  router.db = db;

  // Expose render
  router.render = (req, res) => {
    // NOTE Channel Ai 에서 id로 사용하는 컬럼이 다르다.
    // routes.json에서 이를 교정해 주고 결과를 목록조회의 배열이 아닌 단건조회의 객체로 반환한다.
    if (/_one/.test(req.originalUrl)) {
      if (res.locals.data[0]) {
        res.locals.data = res.locals.data[0];
      } else {
        res.status(404);
      }
    }

    // FAILUREs
    if (res.statusCode === 404) {
      res.status(200);
      res.jsonp({
        resultCode: 'F',
        errorCode: 'CAI-0404',
        title: '오류',
        errorMessage: 'Not Found',
        details: null,
      });
      return;
    }

    if (res.statusCode >= 500) {
      res.status(200);
      res.jsonp({
        resultCode: 'F',
        errorCode: 'CAI-05XX',
        title: '서버오류',
        errorMessage: '서버 오류 발생',
        details: res.body,
      });
      return;
    }

    // Response 데이터 형식 맞춤
    switch (req.method) {
      case 'POST':
      case 'PUT':
        res.jsonp({
          resultCode: 'S',
          data: res.locals.data, // [] | {} | undefined
        });
        break;

      case 'DELETE':
        res.jsonp({
          resultCode: 'S',
        });
        break;

      case 'GET':
      default:
        res.jsonp({
          resultCode: 'S',
          data: res.locals.data, // [] | {} | undefined
          pagenation: res.pagenation, // undefined 이면 출력되지 않는다.
        });
    }
  };

  // GET /db
  router.get('/db', (req, res) => {
    res.jsonp(db.getState());
  });

  // Handle /:parent/:parentId/:resource
  router.use(nested(opts));

  // Create routes
  db.forEach((value, key) => {
    if (_.isPlainObject(value)) {
      router.use(`/${key}`, singular(db, key, opts));
      return;
    }

    if (_.isArray(value)) {
      router.use(`/${key}`, plural(db, key, opts));
      return;
    }

    const sourceMessage = '';
    // if (!_.isObject(source)) {
    //   sourceMessage = `in ${source}`
    // }

    const msg =
      `Type of "${key}" (${typeof value}) ${sourceMessage} is not supported. ` +
      `Use objects or arrays of objects.`;

    throw new Error(msg);
  }).value();

  router.use((req, res) => {
    if (!res.locals.data) {
      res.status(404);
      res.locals.data = {};
    }

    router.render(req, res);
  });

  router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send(err.stack);
  });

  return router;
};

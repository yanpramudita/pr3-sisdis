const express = require('express');
const bodyParser = require('body-parser');
const util = require('util');
const moment = require('moment');
const http = require('http');
const mongoose = require('mongoose');
const _ = require('lodash');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const ip = require("ip");

const app = express();
const router = express.Router();

const port = process.env.PORT || 8080;
const greetingHost = process.env.GREETING_HOST || 'localhost';
const greetingPort = process.env.GREETING_PORT || process.env.PORT || 8080;
const greetingPath = process.env.GREETING_PATH || '/api/greeting';
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/';

const Request = require('./models/Request');

const spesifications = yaml.load(fs.readFileSync(path.join(__dirname, 'spesifikasi.yaml'), 'utf8'));
const apiVersion = _.parseInt(spesifications.info.version);

spesifications.host = util.format('%s:%s', ip.address(), port);
fs.writeFileSync(path.join(__dirname, 'spesifikasi', 'spesifikasi.yaml'), yaml.dump(spesifications), 'utf8')

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

mongoose.connect(mongoURI);

if (greetingHost === 'localhost') {
  router.get('/greeting', function(req, res) {
    res.json({
      datetime: util.format('%s', moment().toISOString()),
      state: 'Afternoon'
    });
  });
}

router.get('/spesifikasi.yaml', function(req, res) {
  res.sendFile(path.join(__dirname, 'spesifikasi', 'spesifikasi.yaml'));
});

router.get('/plus_one/:number', function(req, res) {
  const number = _.parseInt(req.params.number);
  if (!_.isInteger(number)) {
    sendError(req, res, 'parameter must be a valid integer', 400, 'Bad Request');
    return;
  }
  res.json({
    apiversion: apiVersion,
    plusoneret: number + 1
  });
});

router.post('/hello', function(req, res) {
  const currentVisit = util.format('%s', moment().toISOString())
  if (!req.body.request) {
    missingRequiredProperty(req, res, 'request');
  } else {
    Request.findOne({
        content: req.body.request
    }, function(err, request) {
      if (err) {
        internalServerError(req, res);
        return;
      }
      if (!request) {
        request = new Request();
        request.content = req.body.request;
        request.count = 0;
      }
      request.count++;

      request.save(function(err) {
        if (err) {
          internalServerError(req, res);
          return;
        }

        http.get({
          host: greetingHost,
          port: greetingPort,
          path: greetingPath
        }, function(response) {
          // Continuously update stream with data
          var body = '';
          response.on('data', function(d) {
            body += d;
          });

          response.on('end', function() {
            try {
              body = JSON.parse(body);
              res.json({
                apiVersion: apiVersion,
                count: request.count,
                currentVisit: currentVisit,
                response: util.format('Good %s, %s', body.state, req.body.request)
              });
            } catch (err) {
              internalServerError(req, res);
            }
          });

          response.on('error', function(err) {
            internalServerError(req, res);
          });
        });
      });
    });
  }
});

function internalServerError(req, res) {
  sendError(req, res, util.format('Oops. Something weird has occured in the server'), 500, 'Internal Server Error');
}

function missingRequiredProperty(req, res, property) {
  sendError(req, res, util.format('\'%s\' is a required property', property), 400, 'Bad Request');
}

function sendError(req, res, detail, status, title) {
  res.status(status).json({
    detail: detail,
    status: status,
    title: title
  });
}

app.use('/api', router);
app.use(function(req, res) {
  sendError(req, res, 'The requested URL was not found on the server.  If you entered the URL manually please check your spelling and try again.', 404, 'Not Found');
});

app.listen(port);
console.log('Magic happens on port ' + port);

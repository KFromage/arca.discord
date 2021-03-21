const express = require('express');
const arca = require('./arca');

class Auth {
  static initialize() {
    this.router = express.Router();
    this._requests = {};
    this._listeners = {};

    this.router.post('/auth', (req, res) => {
      this.takeRequest(req, res);
    });

    return this;
  }

  static async takeRequest(req, res) {
    const token = `${Date.now() + Math.random() * 10}`;

    setTimeout(() => {
      delete this._requests[token];
      res.status(408).end();
    }, 30000);

    this._requests[token] = () => {
      arca._session._checkSession().then(() => {
        res.json({
          'arca.session2': arca._session._cookies['arca.session2'],
          'arca.session2.sig': arca._session._cookies['arca.session2.sig']
        });
      });
    };

    this._dispatch('request', [ token, req.body.explain ]);
  }

  static acceptRequest(token) {
    if(this._requests[token]) {
      this._requests[token]();
    }
  }

  static _dispatch(msg, args) {
    this._listeners[msg].forEach(listener => listener.apply(null, args));
  }

  static on(msg, listener) {
    this._listeners[msg] = this._listeners[msg] || [];

    this._listeners[msg].push(listener);
  }
};

module.exports = Auth;
const url = require('url');
const htmlParser = require('node-html-parser');
const fq = require('./fetch-queue');
const Board = require('./board');

function RequestSession(username, password) {
  this._username = username;
  this._password = password;

  if(!username || !password) {
    this._anonymous = true;
  }

  this._cookies = {};
}

RequestSession.anonymousSession = function() {
  return new RequestSession();
}

RequestSession.setAnonymous = function(nickname, password) {
  this._username = nickname;
  this._password = password;
}

RequestSession.prototype._loadCookies = function(res) {
  const setCookies = res.headers.get('Set-Cookie') || '';

  this._cookies = this._cookies || {};
  setCookies.split(/[;,]\s*/)
  // filters 'Secure' or 'HttpOnly'
  .filter(_ => _.indexOf('=') != -1)
  // filters 'Expires', 'Max-Age', 'Domain', 'Path', 'SameSite'
  .filter(_ => !_.match(/^(Expires|Max-Age|Domain|Path|SameSite)=/i))
  // set cookie
  .map(_ => {
    const [key, val] = _.split('=');
    this._cookies[key] = val;
  });

  return res;
};

RequestSession.prototype._makeCookieString = function() {
  let cookieKeyVal = [];
  this._cookies = this._cookies || {};
  for(const key in this._cookies) {
    cookieKeyVal.push(`${key}=${this._cookies[key]}`);
  }

  return cookieKeyVal.join(';');
}

RequestSession.prototype._getCSRFToken = async function(url, tokenName = '_csrf') {
  const page = await this._fetch(url);

  const tokens = {};

  const inputElements = page.querySelectorAll('input');
  for(const key in inputElements) {
    if('string' === typeof tokenName && inputElements[key].attributes.name == tokenName) {
      return inputElements[key].attributes.value;
    } else if(tokenName.includes(inputElements[key].attributes.name)) {
      tokens[inputElements[key].attributes.name] = inputElements[key].attributes.value;
    }
  }
  return tokens;
}

RequestSession.prototype._checkSession = async function() {
  if(this._anonymous) return;

  this._lastSessionChecked = this._lastSessionChecked || 0;
  if(this._lastSessionChecked + 1000 * 60 * 10 < new Date()) {
    this._lastSessionChecked = new Date().getTime();
    const shouldLogin = await this._fetch('https://arca.live', { parse: false })
    .then(res => res.text())
    .then(text => text.indexOf('/u/logout') == -1);

    if(shouldLogin) {
      await this._login();
    }
  }
}

RequestSession.prototype._login = async function() {
  // fetch login page and load cookies
  const csrfToken = await this._getCSRFToken('https://arca.live/u/login?goto=/');

  const accountInfo = new url.URLSearchParams();
  accountInfo.append('_csrf', csrfToken);
  accountInfo.append('goto', '/');
  accountInfo.append('username', this._username);
  accountInfo.append('password', this._password);

  return await this._fetch('https://arca.live/u/login', {
    method: 'POST',
    headers: { referer: 'https://arca.live/u/login?goto=/' },
    body: accountInfo
  });
}

RequestSession.prototype._fetch = async function(resource, init = {}) {
  await this._checkSession();

  init.method = init.method || 'GET';
  init.headers = init.headers || {};
  init.headers.Cookie = this._makeCookieString();

  const parse = (init.parse === undefined) ? true : init.parse;
  const csrfRequired = init.csrfRequired || false;

  delete init.csrfRequired;
  delete init.parse;

  if(csrfRequired) {
    const csrfToken = await this._getCSRFToken(resource);
    
    init.body = init.body || new url.URLSearchParams();
    init.body.append('_csrf', csrfToken);

    init.headers.referer = init.headers.referer || resource;
    init.headers.Cookie = this._makeCookieString();

    console.log(resource, init);
  }

  let response = await fq.fetch(resource, init);

  while(response.status == 526) {
    response = await fq.fetch(resource, init);
  }

  if(response.status >= 400) {
    throw new Error(`HTTP ${response.status}: ${resource}`);
  }

  this._loadCookies(response);

  if(parse) {
    return response.text().then(html => htmlParser.parse(html));
  }

  return response;
}

RequestSession.prototype.getBoard = async function(boardName) {
  await this._checkSession();

  const primaryBoardUrl = `https://arca.live/b/${boardName}`;

  const response = await this._fetch(primaryBoardUrl, { parse: false });

  if(300 <= response.status && response.status < 400) {
    return new Board(this, 'https:' + response.headers.get('Location'));
  } else if(response.status < 300) {
    return new Board(this, primaryBoardUrl);
  }
}

RequestSession.prototype.closeSession = function() {
  fq.stop();
}

module.exports = RequestSession;
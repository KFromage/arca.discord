const url = require('url');
const RequestSession = require('./request-session');
const Article = require('./article');

function Board(session, boardUrl) {
  this._session = session;
  this._boardUrl = boardUrl;
  this._hostUrl = 'https://' + new url.URL(boardUrl).host;

  this._cachedArticles = {};
}

Board.fromUrl = function(session = null) {
  try {
    const pureUrl = articleUrl.split('?')[0];
    const boardUrl = pureUrl.match(/^https?:[/]{2}(([^.]+[.])?arca.live)\/b\/[^/]+/)[0];
    const session = session || RequestSession.anonymousSession();

    return new Board(session, boardUrl);
  } catch(e) {
    throw new Error('This is not a valid board url.');
  }
}

Board.prototype.getArticle = async function(articleId) {
  const articleObject = this._cachedArticles[articleId] || (this._cachedArticles[articleId] = new Article(this, articleId));

  return articleObject;
}

Board.prototype.readArticle = async function(articleId, withComments = false) {
  const articleObject = this._cachedArticles[articleId] || (this._cachedArticles[articleId] = new Article(this, articleId));

  return articleObject.read(withComments);
}

Board.prototype.writeArticle = async function(article = {
  category: null,
  title: '',
  content: ''
}) {
  if(this._session._anonymous) {
    throw new Error('This is an anonymous session(anonymous session requires reCAPTCHA auth).');
  }

  const writePage = await this._session._fetch(`${this._boardUrl}/write`);

  const tokens = {};

  const inputElements = writePage.querySelectorAll('#article_write_form input');
  for(const key in inputElements) {
    if(inputElements[key].attributes.name == '_csrf') {
      tokens.csrf = inputElements[key].attributes.value;
    }
    if(inputElements[key].attributes.name == 'token') {
      tokens.token = inputElements[key].attributes.value;
    }
  }

  const articleInfo = new url.URLSearchParams();
  articleInfo.append('_csrf', tokens.csrf);
  articleInfo.append('token', tokens.token);
  articleInfo.append('contentType', 'html');
  articleInfo.append('category', article.category);
  articleInfo.append('title', article.title);
  articleInfo.append('content', article.content);

  if(article.anonymous) {
    articleInfo.append('nickname', article.nickname);
    articleInfo.append('password', article.password);
  }

  return await this._session._fetch(`${this._boardUrl}/write`, {
    method: 'POST',
    headers: { referer: `${this._boardUrl}/write` },
    body: articleInfo
  });
}

Board.prototype.deleteArticle = async function(articleId) {
  const articleObject = this._cachedArticles[articleId] || (this._cachedArticles[articleId] = new Article(this, articleId));
  
  const response = articleObject.delete();
  if(response.status < 400) {
    delete this._cachedArticles[articleId];
    return true;
  }
  return false;
}

Board.prototype.editArticle = async function(articleId, article) {
  const articleObject = this._cachedArticles[articleId] || (this._cachedArticles[articleId] = new Article(this, articleId));

  return articleObject.edit(article);
}

Board.prototype.writeComment = async function(articleId, comment) {
  const articleObject = this._cachedArticles[articleId] || (this._cachedArticles[articleId] = new Article(this, articleId));
  
  return articleObject.writeComment(comment);
}

Board.prototype.deleteComment = async function(articleId, commentId) {
  const articleObject = this._cachedArticles[articleId] || (this._cachedArticles[articleId] = new Article(this, articleId));
  
  return articleObject.deleteComment(commentId);
}

Board.prototype.editComment = async function(articleId, commentId, comment) {
  const articleObject = this._cachedArticles[articleId] || (this._cachedArticles[articleId] = new Article(this, articleId));
  
  return articleObject.editComment(commentId, comment);
}

Board.prototype.readPage = async function(page, options = {
  withNotices: false
}) {
  const boardPage = await this._session._fetch(`${this._boardUrl}?p=${page}`);

  const articles = boardPage.querySelectorAll('.article-list a.vrow');

  let filteredArticles = articles.filter(article => article.classNames.indexOf('notice-unfilter') === -1);

  if(!options.withNotices) {
    filteredArticles = articles.filter(article => article.classNames.indexOf('notice') === -1);
  }

  return filteredArticles.map(articleElem => {
    const articleData = {
      articleId: 0,
      isNotice: false,
      category: null,
      title: null,
      time: 0,
      views: 0,
      commentCount: 0,
      rateDiff: 0
    };

    const commentElement = articleElem.querySelector('.comment-count');

    articleData.articleId = +articleElem.attributes.href.match(/(\d+)[?]p=1$/)[1];
    articleData.isNotice = articleElem.classNames.indexOf('notice') !== -1;
    articleData.category = articleElem.querySelector('.badge').innerText;
    articleData.title = articleElem.querySelector('.title').innerText.replace(/\n/g, '');

    articleData.time = new Date(articleElem.querySelector('.col-time time').attributes.datetime);
    articleData.views = +articleElem.querySelector('.col-view').innerText;
    articleData.commentCount = commentElement ? +commentElement.innerText.match(/\d+/)[0] : 0;
    articleData.rateDiff = +articleElem.querySelector('.col-rate').innerText;

    return new Article(this, articleData.articleId, articleData);
  });
}

module.exports = Board;
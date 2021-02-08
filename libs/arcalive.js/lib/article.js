const url = require('url');
const RequestSession = require('./request-session');
const Comment = require('./comment');

function Article(board, articleId, articleData = {}) {
  this._session = board._session;
  this.articleId = articleId;
  this._boardUrl = board._boardUrl;
  this._articleUrl = `${this._boardUrl}/${articleId}`;

  this._loaded = false;
  this._articleData = { ...articleData };
}

Article.fromUrl = function(articleUrl, session = null) {
  try {
    const pureUrl = articleUrl.split('?')[0];
    const urlMatches = pureUrl.match(/(https?:[/]{2}(([^.]+[.])?arca.live)\/b\/[^/]+)\/(\d+)/);
    const [ _boardUrl, articleId ] = [ urlMatches[1], +urlMatches[4] ];
    session = session || RequestSession.anonymousSession();

    return new Article({
      _session: session || RequestSession.anonymousSession(),
      _boardUrl: _boardUrl
    }, articleId);
  } catch(e) {
    console.error(e);
    throw new Error('This is not a valid article url.');
  }
}

Article.prototype.read = async function(mustReload = false, withComments = false) {
  if(!mustReload || (!this._loaded || !this._articleData)) {
    const article = await this._session._fetch(`${this._boardUrl}/${this.articleId}`);

    const articleTitle = article.querySelector('.article-wrapper .title');
    const badge = articleTitle.querySelector('span.badge');

    this._articleData = {
      articleId: this.articleId,
      category: null,
      title: null,
      content: null,
      time: 0,
      views: 0,
      commentCount: 0,
      rate: 0
    };

    const articleInfo = article.querySelector('.article-info');
    const [ rateUp, rateDown, commentCount, views, time ] = articleInfo.querySelectorAll('.body');

    if(badge !== null) {
      this._articleData.category = badge.innerText;
      this._articleData.title = articleTitle.innerText.replace(this._articleData.category, '');
    } else {
      this._articleData.category = null;
      this._articleData.title = articleTitle.innerText;
    }

    this._articleData.title = this._articleData.title.replace(/\n/g, '');

    this._articleData.time = new Date(time.attributes.datetime);
    this._articleData.views = +views.innerText;
    this._articleData.commentCount = +commentCount.innerText;
    this._articleData.rate = [ +rateUp.innerText, +rateDown.innerText ];

    this._articleData.content = article.querySelector('.article-wrapper .article-body .article-content').innerHTML;

    if(withComments) {
      this._articleData.comments = [];

      const lastCommentPage = +article.querySelector('.article-comment .page-item.active a').innerText;
      for(let i = lastCommentPage; i >= 1; i--) {
        const commentPage = await this._session._fetch(`${this._boardUrl}/${this.articleId}?cp=${i}`);
        const comments = commentPage.querySelectorAll('.comment-wrapper');

        this._articleData.comments.push(...comments.map(comment => {
          const userInfo = comment.querySelector('span.user-info');
          const userLink = userInfo.querySelector('a') || userInfo.querySelector('span');

          const message = comment.querySelector('.message');
          const content = comment.querySelector('div').innerHTML;
          let textContent;

          if(message.querySelector('.emoticon-wrapper')) {
            textContent = message.querySelector('.emoticon-wrapper').attributes.src || '';
          } else if(message.querySelector('.text')) {
            textContent = message.querySelector('.text pre').textContent || '';
          }

          return new Comment(this, {
            commentId: +comment.id.match(/(\d+)$/)[1],
            author: userLink.attributes['data-filter'],
            content: content,
            textContent: textContent,
            time: new Date(comment.querySelector('time').attributes.datetime)
          });
        }));
      }
    }
  }

  return {...this._articleData};
}

Article.prototype.delete = async function() {

  const body = new url.URLSearchParams();

  if(this._session._anonymous) {
    body.append('password', this._session.password);
  }

  return await this._session._fetch(`${this._boardUrl}/${this.articleId}/delete`, {
    method: POST,
    body: body,
    csrfRequired: true
  });
}

Article.prototype.edit = async function(article = {
  category: null,
  title: '',
  content: ''
}) {
  if(this._session._anonymous) {
    article.anonymous = true;
    if(!article.nickname) {
      article.nickname = this._session._username;
    }
    if(!article.password) {
      article.password = this._session._password;
    }
  }

  const editPage = await this._session._fetch(`${boardUrl}/edit`);

  const tokens = {};

  const inputElements = editPage.querySelectorAll('#article_write_form input');
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

  return await this._session._fetch(`${boardUrl}/edit`, {
    method: 'POST',
    headers: { Cookie: this._makeCookieString(), referer: `${boardUrl}/edit` },
    body: articleInfo
  });
}

Article.prototype.blockUser = async function(duration) {
  const body = new url.URLSearchParams();
  body.append('until', duration);

  return await this._session._fetch(`${this._boardUrl}/block/article/${this._articleId}`, {
    method: 'POST',
    headers: { referer: this._articleUrl },
    body: body
  });
}

Article.prototype.writeComment = async function(comment) {
  if(this._session._anonymous) {
    throw new Error('This is an anonymous session(anonymous session requires reCAPTCHA auth).');
  }

  const csrfToken = await this._session._getCSRFToken(`${this._articleUrl}`);

  const body = new url.URLSearchParams();
  accountInfo.append('_csrf', csrfToken);
  accountInfo.append('contentType', 'text');
  accountInfo.append('content', comment);
  
  return await this._session._fetch(`${this._articleUrl}/comment`, {
    method: 'POST',
    headers: { referer: this._articleUrl },
    body: body
  });
}

Article.prototype.deleteComment = function(commentId) {
  const commentObject = this._articleData.comments[commentId] || new Comment(this, {
    commentId: commentId
  });

  return commentObject.delete();
}

Article.prototype.editComment = function(commentId, comment) {
  const commentObject = this._articleData.comments[commentId] || new Comment(this, {
    commentId: commentId
  });

  return commentObject.edit(comment);
}

module.exports = Article;
const url = require('url');

function Comment(article, commentData) {
  this._session = article._session;
  this._article = article;
  this.commentId = commentData.commentId;

  this._commentApiUrl = `${this._article._articleUrl}/${this.commentId}`;
  this._commentUrl = `${this._article._articleUrl}#c_${this.commentId}`;

  this._commentData = commentData;
}

Comment.prototype.delete = async function() {
  const body = new url.URLSearchParams();

  if(this._session._anonymous) {
    body.append('password', this._session.password);
  }

  return await this._session._fetch(`${this._commentApiUrl}/delete`, {
    method: 'POST',
    body: body,
    csrfRequired: true
  });
}

Comment.prototype.edit = async function(content) {
  if(this._session._anonymous) {
    body.append('password', this._session.password);
  }

  const csrfToken = await this._session._getCSRFToken(`${this._article._articleUrl}`);
  const body = new url.URLSearchParams();

  body.append('_csrf', csrfToken);
  body.append('contentType', 'text');
  body.append('content', content);

  return await this._session._fetch(`${this._commentApiUrl}/edit`, {
    method: 'POST',
    headers: { referer: `${this._article._articleUrl}` },
    body: body
  });
}

module.exports = Comment;
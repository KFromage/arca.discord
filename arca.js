const Arca = require('./libs/arcalive.js');

function Arcalive(username, password) {
  this._session = new Arca.Session(username, password);
  this._listeners = {};
  this._autoDelete = [];

  (async function() {
    this._board = await this._session.getBoard('smpeople');
    this._board._boardUrl = 'https://sm.arca.live/b/smpeople';
    this._article = await Arca.Article.fromUrl('https://sm.arca.live/b/smpeople/20309237', this._session);
  }.bind(this))()
  .then(() => {
    this._lastArticleId = -1;
    this._lastCommentId = -1;
    this._checkedAggro = [];

    this._checkNoti();
    this._checkClaim();
    this._checkArticles();
  });
}

Arcalive.prototype._checkNoti = async function() {
  try {
    const notifications = await this._session._fetch('https://arca.live/api/notification', { parse: false }).then(res => res.json());
    const smNotification = notifications.filter(noti => noti.link.indexOf('/b/smpeople') !== -1);

    if(smNotification.length !== 0) {
      for(const i in smNotification) {
        const notification = smNotification[i];
        await this._session._fetch('https://sm.arca.live' + notification.link);
      }
      this._dispatch('notification', smNotification);
    }
  } catch(err) {
    console.error(err);
  }

  setTimeout(this._checkNoti.bind(this), 10000);
};

Arcalive.prototype._checkClaim = async function() {
  try {
    const claims = await this._article.read(true, true).then(articleData => articleData.comments);
    let currentLast = 0;
    const newClaims = claims.filter(claim => {
      currentLast = currentLast < claim.commentId ? claim.commentId : currentLast;
      return claim.commentId > this._lastCommentId
    });
    
    if(this._lastCommentId !== -1) {
      newClaims.forEach(claim => this._dispatch('claim', claim));
    }
    this._lastCommentId = currentLast;
  } catch(err) {
    console.error(err);
  }

  setTimeout(this._checkClaim.bind(this), 10000);
}

Arcalive.prototype._checkArticles = async function() {
  try {
    const articles = await this._board.readPage(1);

    const aggroArticles = articles.filter(article => article._articleData.rateDiff <= -5);
    const newAggroArticles = aggroArticles.filter(article => this._checkedAggro.indexOf(article.articleId) === -1);

    const newArticles = articles.filter(article => article.articleId > this._lastArticleId);

    newAggroArticles.forEach(aggroArticle => {
      this._checkedAggro.push(aggroArticle.articleId);
      this._dispatch('aggro', aggroArticle);
    });

    if(this._lastArticleId) {
      newArticles.forEach(async (article) => {
        const data = await article.read();
        if(this._autoDelete.some(deleteRule => {
          return deleteRule.pattern.exec(data.title) || deleteRule.pattern.exec(data.content);
        })) {
          this._dispatch('delete', article);
        }
      });
    }

    this._lastArticleId = articles[0].articleId;
    this._checkedAggro = this._checkedAggro.slice(this._checkedAggro.length - 30, this._checkedAggro.length);
  } catch(err) {
    console.error(err);
  }

  setTimeout(this._checkArticles.bind(this), 10000);
};

Arcalive.prototype._dispatch = function(msg, args) {
  this._listeners[msg].forEach(listener => listener.call(null, args));
}

Arcalive.prototype.on = function(msg, listener) {
  this._listeners[msg] = this._listeners[msg] || [];

  this._listeners[msg].push(listener);
}

Arcalive.prototype.autoDelete = function(option = {
  word: ''
}) {
  this._autoDelete.push(option);
}

Arcalive.prototype.deleteArticle = function(articleUrl) {
  Arca.Article.fromUrl(articleUrl, this._session).delete().then(console.log).catch(console.log);
}

Arcalive.prototype.blockArticle = function(articleUrl, duration) {
  Arca.Article.fromUrl(articleUrl, this._session).blockUser(duration);
}

module.exports = Arcalive;
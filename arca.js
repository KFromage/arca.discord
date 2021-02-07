const Arca = require('./libs/arcalive.js');

function Arcalive(username, password) {
  this._session = new Arca.Session(username, password);
  this._listeners = {};

  (async function() {
    this._board = await this._session.getBoard('smpeople');
    this._article = await Arca.Article.fromUrl('https://sm.arca.live/b/smpeople/20309237', this._session);
  }.bind(this))()
  .then(() => {
    this._lastCommentId = null;
    this._checkedArticles = [];

    this._checkNoti();
    this._checkClaim();
    this._checkAggro();
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
    
    if(this._lastCommentId !== null) {
      newClaims.forEach(claim => this._dispatch('claim', claim));
    }
    this._lastCommentId = currentLast;
  } catch(err) {
    console.error(err);
  }

  setTimeout(this._checkClaim.bind(this), 10000);
}

Arcalive.prototype._checkAggro = async function() {
  try {
    const articles = await this._board.readPage(1)
      .then(articles => {
        return articles.map(article => {
          const data = {...article._articleData};
          data.url = article._articleUrl;
          return data;
        })
      });

    const aggroArticles = articles.filter(article => article.rateDiff <= -5);
    const newAggroArticles = aggroArticles.filter(article => this._checkedArticles.indexOf(article.articleId) === -1);

    if(this._lastArticleId !== null) {
      newAggroArticles.forEach(aggroArticle => {
        this._checkedArticles.push(aggroArticle.articleId);
        this._dispatch('aggro', aggroArticle);
      });
    }
    
    this._checkedArticles = this._checkedArticles.slice(this._checkedArticles.length - 30, this._checkedArticles.length);
  } catch(err) {
    console.error(err);
  }

  setTimeout(this._checkAggro.bind(this), 10000);
};

Arcalive.prototype._dispatch = function(msg, args) {
  this._listeners[msg].forEach(listener => listener.call(null, args));
}

Arcalive.prototype.on = function(msg, listener) {
  this._listeners[msg] = this._listeners[msg] || [];

  this._listeners[msg].push(listener);
}

Arcalive.prototype.blockArticle = function(articleUrl, duration) {
  Arca.Article.fromUrl(articleUrl, this._session).blockUser(duration);
}

module.exports = Arcalive;
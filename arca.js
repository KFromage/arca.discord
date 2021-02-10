const Arca = require('./lib/arcalive.js');

function Arcalive(username, password) {
  this._session = new Arca.Session(username, password);
  this._listeners = {};
  this._autoDelete = [];

  this._aggroCount = -5;
  this._quarantineCount = -10;

  (async function() {
    this._board = await this._session.getBoard('smpeople');
    this._board.url = new URL('https://sm.arca.live/b/smpeople');
    this._article = await this._session.fromUrl('https://sm.arca.live/b/smpeople/20309237', this._session);
  }.bind(this))()
  .then(() => {
    this._lastArticleId = -1;
    this._lastCommentId = -1;
    this._checkedAggro = [];
    this._checkedQuarantine = [];

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
      this._dispatch('notification', [ smNotification ]);
    }
  } catch(err) {
    console.error(err);
  }

  setTimeout(this._checkNoti.bind(this), 10000);
};

Arcalive.prototype._checkClaim = async function() {
  try {
    const claims = await this._article.read({ noCache: true, withComments: true }).then(articleData => articleData.comments);
    let currentLast = 0;
    const newClaims = claims.filter(claim => {
      currentLast = currentLast < claim.commentId ? claim.commentId : currentLast;
      return claim.commentId > this._lastCommentId
    });
    
    if(this._lastCommentId !== -1) {
      newClaims.forEach(claim => this._dispatch('claim', [ claim ]));
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

    const aggroArticles = articles.filter(article => article._articleData.rateDiff <= this._aggroCount);
    const newAggroArticles = aggroArticles.filter(article => this._checkedAggro.indexOf(article.articleId) === -1);

    const quarantineArticles = articles.filter(article => article._articleData.rateDiff <= this._quarantineCount);
    const newQuarantineArticles = quarantineArticles.filter(article => this._checkedQuarantine.indexOf(article.articleId) === -1);

    const newArticles = articles.filter(article => article.articleId > this._lastArticleId);

    newAggroArticles.forEach(aggroArticle => {
      this._checkedAggro.push(aggroArticle.articleId);
      this._dispatch('aggro', [ aggroArticle ]);
    });

    newQuarantineArticles.forEach(quarantineArticle => {
      this._checkedQuarantine.push(quarantineArticle.articleId);
      this._dispatch('quarantine', [ quarantineArticle ]);
    })

    if(this._lastArticleId) {
      newArticles.forEach(async (article) => {
        const data = await article.read({ noCache: false, withComments: false });
        this._autoDelete.forEach(deleteRule => {
          if(deleteRule.pattern.exec(data.title) || deleteRule.pattern.exec(data.content)) {
            this._dispatch(deleteRule.event, [ article ]);
          }
        });
      });
    }

    this._lastArticleId = articles[0].articleId;
    this._checkedAggro = this._checkedAggro.slice(this._checkedAggro.length - 30, this._checkedAggro.length);
    this._checkedQuarantine = this._checkedQuarantine.slice(this._checkedQuarantine.length - 30, this._checkedQuarantine.length);
  } catch(err) {
    console.error(err);
  }

  setTimeout(this._checkArticles.bind(this), 10000);
};

Arcalive.prototype._dispatch = function(msg, args) {
  this._listeners[msg].forEach(listener => listener.apply(null, args));
}

Arcalive.prototype.on = function(msg, listener) {
  this._listeners[msg] = this._listeners[msg] || [];

  this._listeners[msg].push(listener);
}

Arcalive.prototype.setAggroCount = function(newCount) {
  this._aggroCount = newCount;
}

Arcalive.prototype.setQuarantineCount = function(newCount) {
  this._quarantineCount = newCount;
}

Arcalive.prototype.watch = function(option = {
  word: '',
  event: 'delete'
}) {
  this._autoDelete.push(option);
}

Arcalive.prototype.cancelWatch = function(option = {
  word: '',
  event: 'delete'
}) {
  const index = this._autoDelete.findIndex(rule => (rule.word === option.word && rule.event === option.event));
  this._autoDelete.splice(index, 1);
}

Arcalive.prototype.deleteArticle = function(articleUrl) {
  this._session.fromUrl(articleUrl).delete();
}

Arcalive.prototype.blockArticle = function(articleUrl, duration) {
  this._session.fromUrl(articleUrl).blockUser(duration);
}

Arcalive.prototype.quarantineArticle = async function(articleUrl) {
  const article = this._session.fromUrl(articleUrl);
  await article.read({
    noCache: false,
    withComments: false
  });
  article.edit({
    category: '운영'
  });
}

module.exports = Arcalive;
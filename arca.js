const Arca = require('arcalive');

class Arcalive {
  static initialize(username, password) {
    this._session = new Arca.Session(username, password);
    this._listeners = {};
    this._watch = [];
  
    this._aggroCount = -5;
    this._quarantineCount = -20;
    this._running = true;

    this._dailyAggros = 0;
    this._dailyQuarantines = 0;
    this._dailyArticles = 0;

    this._zeroHour = false;

    (async function() {
      this._board = await this._session.getBoard('smpeople');
      this._board.url = new URL('https://arca.live/b/smpeople');
      this._article = this._session.fromUrl('https://arca.live/b/smpeople/20309237', this._session);
      this._memoArticle = this._session.fromUrl('https://arca.live/b/smeyes/19962770');
    }.bind(this))()
    .then(() => {
      this._lastArticleId = -1;
      this._lastCommentId = -1;
      this._checkedAggro = [];
      this._checkedQuarantine = [];
  
      this._checkNoti();
      this._checkClaim();
      this._checkArticles();
      this._zeroHour();
    });

    return this;
  }

  static close() {
    this._running = false;
    this._session.closeSession();
  }
  
  static async _checkNoti() {
    if(!this._running) {
      return;
    }
    try {
      const notifications = await this._session._fetch('https://arca.live/api/notification', { parse: false }).then(res => res.json());
      const smNotification = notifications.filter(noti => noti.link.indexOf('/b/smpeople') !== -1);
  
      if(smNotification.length !== 0) {
        for(const i in smNotification) {
          const notification = smNotification[i];
          await this._session._fetch('https://arca.live' + notification.link);
        }
        this._dispatch('notification', [ smNotification ]);
      }
    } catch(err) {
      console.error(err);
    }
  
    setTimeout(this._checkNoti.bind(this), 10000);
  }

  static async _checkClaim() {
    if(!this._running) {
      return;
    }
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

  static async _checkArticles() {
    if(!this._running) {
      return;
    }
    try {
      const articles = await this._board.readPage(1);
  
      const aggroArticles = articles.filter(article => article._articleData.rateDiff <= this._aggroCount);
      const newAggroArticles = aggroArticles.filter(article => this._checkedAggro.indexOf(article.articleId) === -1);
  
      const quarantineArticles = articles.filter(article => article._articleData.rateDiff <= this._quarantineCount);
      const newQuarantineArticles = quarantineArticles.filter(article => this._checkedQuarantine.indexOf(article.articleId) === -1);
  
      const newArticles = articles.filter(article => article.articleId > this._lastArticleId);
  
      newAggroArticles.forEach(aggroArticle => {
        this._checkedAggro.push(aggroArticle.articleId);
        this._dailyAggros++;
        this._dispatch('aggro', [ aggroArticle ]);
      });
  
      newQuarantineArticles.forEach(quarantineArticle => {
        this._checkedQuarantine.push(quarantineArticle.articleId);
        this._dailyQuarantines++;
        this._dispatch('quarantine', [ quarantineArticle ]);
      })
  
      if(this._lastArticleId) {
        this._dailyArticles += newArticles.length;
        newArticles.forEach(async (article) => {
          const data = await article.read({ noCache: false, withComments: false });
          this._watch.forEach(rule => {
            if(rule.pattern.exec(data.title) || rule.pattern.exec(data.content)) {
              this._dispatch(rule.event, [ article ]);
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
  }

  static _zeroHour() {

    if(!this._running) {
      return;
    }

    const now = new Date();
    const [ h, m ] = [ now.getHours(), now.getMinutes() ];

    if(h === 23 && m === 51) {
      if(!this._zeroHour) {
        this._dispatch('zerohour-report', [{
          aggros: this._dailyAggros,
          quarantines: this._dailyQuarantines,
          articles: this._dailyArticles
        }]);

        this._dailyAggros = 0;
        this._dailyQuarantines = 0;
        this._dailyArticles = 0;

        this._zeroHour = true;
      }
    } else {
      this._zeroHour = false;
    }

    setTimeout(this._zeroHour.bind(this), 10000);
  }

  static _dispatch(msg, args) {
    this._listeners[msg].forEach(listener => listener.apply(null, args));
  }

  static on(msg, listener) {
    this._listeners[msg] = this._listeners[msg] || [];
  
    this._listeners[msg].push(listener);
  }

  static setAggroCount(newCount) {
    this._aggroCount = newCount;
  }

  static setQuarantineCount(newCount) {
    this._quarantineCount = newCount;
  }

  static watch(option = {
    word: '',
    event: 'delete'
  }) {
    this._watch.push(option);
  }

  static cancelWatch(option = {
    word: '',
    event: 'delete'
  }) {
    const index = this._watch.findIndex(rule => (rule.word === option.word && rule.event === option.event));
    this._watch.splice(index, 1);
  }
  
  static deleteArticle(articleUrl) {
    this._session.fromUrl(articleUrl).delete();
  }

  static readArticle(articleUrl) {
    return this._session.fromUrl(articleUrl).read({ noCache: true, withComments: false });
  }

  static blockArticle(articleUrl, duration) {
    this._session.fromUrl(articleUrl).blockUser(duration);
  }

  static async cleanArticle(articleUrl) {
    const article = this._session.fromUrl(articleUrl);
    const articleData = await article.read({ noCache: true, withComments: true});
  
    Arca.FetchQueue.setRateLimit(5000);
  
    for(let i = 0; i < articleData.comments.length; i++) {
      const comment = articleData.comments[i];
      if(!comment._commentData.deleted) {
        await article.deleteComment(comment.commentId);
      }
    }
  
    Arca.FetchQueue.setRateLimit(500);
  }

  static async quarantineArticle(articleUrl) {
    const article = this._session.fromUrl(articleUrl);
    const articleData = await article.read({
      noCache: false,
      withComments: false
    });
  
    if(articleData.category === '운영') return;
  
    const editContent = `기존 카테고리 : ${articleData.category || '-'}<br>${articleData.content}`;
  
    article.edit({
      category: '운영',
      content: editContent
    });
  }

  static async releaseArticle(articleUrl) {
    const article = this._session.fromUrl(articleUrl);
    const articleData = await article.read({
      noCache: false,
      withComments: false
    });
  
    const [ categoryString, categoryName ] = articleData.content.match(/기존 카테고리 : ([^<]*)/);
    const editContent = articleData.content.replace(categoryString, '');
  
    article.edit({
      category: categoryName === '-' ? '' : categoryName,
      content: editContent
    });
  }

  static async memoArticle(articleUrl, content) {
    const articleData = await this._session.fromUrl(articleUrl).read({
      noCache: false,
      withComments: false
    });
  
    this._memoArticle.writeComment(JSON.stringify({
      id: articleData.author,
      note: content,
      link: articleUrl,
      padding: 0
    }));
  }
};

module.exports = Arcalive;
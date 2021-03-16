const Arca = require('arcalive');

function Arcalive(username, password) {
  this._session = new Arca.Session(username, password);
  this._listeners = {};
  this._watch = [];

  this._aggroCount = -5;
  this._quarantineCount = -10;

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
  });
}

Arcalive.prototype._checkNoti = async function() {
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
        this._watch.forEach(rule => {
          if(rule.pattern.exec(data.title) || rule.pattern.exec(data.content)) {
            this._dispatch(rule.event, [ article ]);
          }
        });

        /*article.restrictCountry(
          'GH', 'GA', 'GY', 'GM', 'GP', 'GT', 'GU', 'GD', 'GR', 'GL', 'GN', 'GW', 'NA', 'NR', 'NG', 'SS',
          'ZA', 'NL', 'NP', 'NO', 'NF', 'NC', 'NZ', 'NU', 'NE', 'NI', 'KR', 'DK', 'DO', 'DM', 'DE', 'TL',
          'LA', 'LR', 'LV', 'RU', 'LB', 'LS', 'RE', 'RO', 'LU', 'RW', 'LY', 'LT', 'LI', 'MG', 'MQ', 'MH',
          'YT', 'MO', 'MW', 'MY', 'ML', 'MX', 'MC', 'MA', 'MU', 'MR', 'MZ', 'ME', 'MS', 'MD', 'MV', 'MT',
          'MN', 'US', 'UM', 'VI', 'MM', 'FM', 'VU', 'BH', 'BB', 'VA', 'BS', 'BD', 'BM', 'BJ', 'VE', 'VN',
          'BE', 'BY', 'BZ', 'BQ', 'BA', 'BW', 'BO', 'BI', 'BF', 'BV', 'BT', 'MP', 'MK', 'BG', 'BR', 'BN',
          'WS', 'SA', 'GS', 'SM', 'ST', 'MF', 'BL', 'PM', 'EH', 'SN', 'RS', 'SC', 'LC', 'VC', 'KN', 'SH',
          'SO', 'SB', 'SD', 'SR', 'LK', 'SJ', 'SE', 'CH', 'ES', 'SK', 'SI', 'SY', 'SL', 'SX', 'SG', 'AE',
          'AW', 'AM', 'AR', 'AS', 'IS', 'HT', 'IE', 'AZ', 'AF', 'AD', 'AL', 'DZ', 'AO', 'AG', 'AI', 'ER',
          'SZ', 'EC', 'ET', 'SV', 'GB', 'VG', 'IO', 'YE', 'AU', 'AT', 'HN', 'AX', 'WF', 'JO', 'UG', 'UY',
          'UZ', 'UA', 'IQ', 'IR', 'IL', 'EG', 'IT', 'IN', 'ID', 'JP', 'JM', 'ZM', 'JE', 'GQ', 'KP', 'GE',
          'CN', 'CF', 'TW', 'DJ', 'GI', 'ZW', 'TD', 'CZ', 'CL', 'CM', 'CV', 'KZ', 'QA', 'KH', 'CA', 'KE',
          'KY', 'KM', 'CR', 'CC', 'CI', 'CO', 'CG', 'CD', 'CU', 'KW', 'CK', 'CW', 'HR', 'CX', 'KG', 'KI',
          'CY', 'TJ', 'TZ', 'TH', 'TC', 'TR', 'TG', 'TK', 'TO', 'TM', 'TV', 'TN', 'TT', 'PA', 'PK', 'PG',
          'PW', 'PS', 'FO', 'PE', 'PT', 'FK', 'PL', 'PR', 'FR', 'GF', 'TF', 'PF', 'FJ', 'FI', 'PH', 'PN',
          'HU', 'HK'
        );*/
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
  this._watch.push(option);
}

Arcalive.prototype.cancelWatch = function(option = {
  word: '',
  event: 'delete'
}) {
  const index = this._watch.findIndex(rule => (rule.word === option.word && rule.event === option.event));
  this._watch.splice(index, 1);
}

Arcalive.prototype.deleteArticle = function(articleUrl) {
  this._session.fromUrl(articleUrl).delete();
}

Arcalive.prototype.readArticle = function(articleUrl) {
  return this._session.fromUrl(articleUrl).read({ noCache: true, withComments: false });
}

Arcalive.prototype.blockArticle = function(articleUrl, duration) {
  this._session.fromUrl(articleUrl).blockUser(duration);
}

Arcalive.prototype.cleanArticle = async function(articleUrl) {
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

Arcalive.prototype.quarantineArticle = async function(articleUrl) {
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

Arcalive.prototype.releaseArticle = async function(articleUrl) {
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

Arcalive.prototype.memoArticle = async function(articleUrl, content) {
  const articleData = await this._session.fromUrl(articleUrl).read({
    noCache: false,
    withComments: false
  });

  console.log(articleData);

  this._memoArticle.writeComment(JSON.stringify({
    id: articleData.author,
    note: content,
    link: articleUrl,
    padding: 0
  }));
}

module.exports = Arcalive;
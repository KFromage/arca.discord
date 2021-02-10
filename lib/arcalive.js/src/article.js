const url = require('url');
const Comment = require('./comment');

/**
 * 새 게시글 객체 Article을 만든다.
 * 생성시에는 존재 여부를 확인하지 않는다(Rate Limit때문).
 * 
 * @param {Board} board 해당 게시글이 속해 있는 게시판 객체
 * @param {Object} articleData 게시글 정보
 * @param {number} articleData.articleId 게시글 번호
 * @param {URL} [articleData.url] 게시글 URL(주어지지 않을 경우 board와 articleId를 통해 생성함)
 */
function Article(board, articleData) {
  if(!board._session) {
    throw new Error('Invalid board session');
  }
  if(!articleData.articleId) {
    throw new Error('Invalid article id');
  }

  this._session = board._session;
  this._board = board;

  this.articleId = articleData.articleId;
  this.url = articleData.url || new url.URL(`${board.url}/${articleData.articleId}`);

  this._loaded = false;
  this._articleData = { ...articleData };
}

/**
 * 해당 게시글을 fetch한다.
 * 만일 이미 읽어온 게시글일 경우, fetch 없이 정보를 그대로 반환한다.
 * 
 * @param {Object} options 게시글 읽기 옵션
 * @param {boolean} options.noCache true일 경우 저장된 정보를 무시하고 무조건 fetch함
 * @param {boolean} options.withComments true일 경우 게시글에 작성된 모든 댓글을 추가로 fetch함
 * @returns {Promise<Object>} 해당 게시글의 articleData 사본
 */
Article.prototype.read = async function(options) {
  if(options.noCache || (!this._loaded || !this._articleData)) {
    const article = await this._session._fetch(`${this._board.url}/${this.articleId}`);

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
    this._articleData.rateDiff = this._articleData.rate[0] - this._articleData.rate[1];

    this._articleData.content = article.querySelector('.article-wrapper .article-body .article-content').innerHTML;

    if(options.withComments) {
      this._articleData.comments = [];

      const commentLink = article.querySelector('.article-comment .page-item.active a');
      const lastCommentPage = commentLink ? +commentLink.innerText : 1;
      for(let i = lastCommentPage; i >= 1; i--) {
        const commentPage = await this._session._fetch(`${this._board.url}/${this.articleId}?cp=${i}`);
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

/**
 * 해당 게시글을 삭제한다.
 * 
 * @returns {Promise<Response>} 삭제 fetch에 대한 Response
 */
Article.prototype.delete = async function() {

  const body = new url.URLSearchParams();

  if(this._session._anonymous) {
    body.append('password', this._session.password);
  }

  return await this._session._fetch(`${this._board.url}/${this.articleId}/delete`, {
    method: 'POST',
    body: body,
    csrfRequired: true,
    parse: false
  });
}

/**
 * 해당 게시글을 수정한다.
 * 
 * @param {Object} article 수정될 내용(지정되지 않은 property는 현재의 값을 그대로 가지고 감)
 * @param {string} [article.category] 게시글 분류
 * @param {string} [article.title] 게시글 제목
 * @param {string} [article.content] 게시글 내용
 * @returns {Promise<Response>} 수정 fetch에 대한 Response
 */
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

  article.category = article.category || this._articleData.category;
  article.title = article.title || this._articleData.title;
  article.content = article.content || this._articleData.content;

  const editPage = await this._session._fetch(`${this.url}/edit`);

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

  return await this._session._fetch(`${this.url}/edit`, {
    method: 'POST',
    headers: { referer: `${this.url}/edit` },
    body: articleInfo,
    parse: false
  });
}

/**
 * 해당 게시글의 작성자를 차단한다.
 * 
 * @param {number} duration 차단 기간(단위 : 초)
 * @returns {Promise<Response>} 차단 fetch에 대한 Response
 */
Article.prototype.blockUser = async function(duration) {
  const body = new url.URLSearchParams();
  body.append('until', duration);

  return await this._session._fetch(`${this._board.url}/block/article/${this.articleId}`, {
    method: 'POST',
    headers: { referer: this.url },
    body: body,
    parse: false
  });
}

/**
 * 해당 게시글을 볼 수 없는 국가를 설정한다.
 * 
 * @param {string[]} countries 제한 국가 목록
 * @returns {Promise<Response>} 국가 제한 fetch에 대한 Response
 */
Article.prototype.restrictCountry = async function(...countries) {
  const body = new url.URLSearchParams();
  body.append('restricted_countries[]', '');
  countries.forEach(country => {
    body.append('restricted_countries[]', country);
  });

  return await this._session._fetch(`${this.url}/config`, {
    method: 'POST',
    headers: { referer: this.url },
    body: body,
    parse: false,
    csrfRequired: true,
    parse: false
  });
}

/**
 * 해당 게시글에 새 댓글을 작성한다.
 * 작성하더라도 articleData에는 추가되지 않으며, 변경 사항을 확인하려면 noCache로 다시 read해와야 한다.
 * 
 * @param {string} comment 댓글 내용(HTML)
 * @returns {Promise<Response>} 댓글 작성 fetch에 대한 Response
 */
Article.prototype.writeComment = async function(comment) {
  if(this._session._anonymous) {
    throw new Error('This is an anonymous session(anonymous session requires reCAPTCHA auth).');
  }

  const body = new url.URLSearchParams();
  accountInfo.append('contentType', 'text');
  accountInfo.append('content', comment);
  
  return await this._session._fetch(`${this.url}/comment`, {
    method: 'POST',
    headers: { referer: this.url },
    body: body,
    csrfRequired: true,
    parse: false
  });
}

/**
 * 해당 게시글에서 댓글을 삭제한다.
 * 삭제하더라도 articleData에서는 삭제되지 않으며, 변경 사항을 확인하려면 noCache로 다시 read해와야 한다.
 * 
 * @param {number} commentId 댓글 번호
 * @returns {Promise<Response>} 댓글 작성 fetch에 대한 Response
 */
Article.prototype.deleteComment = function(commentId) {
  const commentObject = this._articleData.comments[commentId] || new Comment(this, {
    commentId: commentId
  });

  return commentObject.delete();
}

/**
 * 해당 게시글에 작성된 댓글을 수정한다.
 * 수정하더라도 articleData에는 수정되지 않으며, 변경 사항을 확인하려면 noCache로 다시 read해와야 한다.
 * 
 * @param {number} commentId 댓글 번호
 * @param {string} comment 댓글 내용(HTML)
 * @returns {Promise<Response>} 댓글 수정 fetch에 대한 Response
 */
Article.prototype.editComment = function(commentId, comment) {
  const commentObject = this._articleData.comments[commentId] || new Comment(this, {
    commentId: commentId
  });

  return commentObject.edit(comment);
}

module.exports = Article;
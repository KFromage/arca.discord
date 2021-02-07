
Usage

1. 세션 만들기

```javascript
const RequestSession = require('./lib/request-session');

const session = new RequestSession(username, password); // username과 password로 아이디와 비밀번호 전달
```

2. 원하는 게시판(채널) 열기

```javascript
const board = await session.getBoard('breaking');
```

3. 게시판에 대해서 원하는 조작 수행

```javascript

board.readArticle(articleId, /* withComments: */true); // 해당 board에서 articleId에 해당하는 게시글을 읽어옴.
board.writeArticle({ // 해당 board에 게시글을 작성함
  category: '정보',
  title: '게시글 작성',
  content: '테스트 내용입니다.<br>HTML 코드를 전달합니다.'
});
board.deleteArticle(articleId); // 해당 board에서 articleId에 해당하는 게시글을 삭제함
board.editArticle(articleId, { // 해당 게시글의 내용을 수정함
  category: '정보',
  title: '게시글 작성',
  content: '테스트 내용입니다.<br>HTML 코드를 전달합니다.'
});

board.writeComment(articleId, comment); // 해당 board에서 articleId에 해당하는 게시글에 comment에 해당하는 내용으로 댓글을 작성함
board.deleteComment(articleId, commentId); // 해당 board에서 articleId에 해당하는 게시글에 commentId에 해당하는 댓글을 삭제함
board.editComment(articleId, commentId, comment); // 해당 board에서 articleId에 해당하는 게시글에 commentId에 해당하는 댓글을 수정함

board.readPage(pageNo); // 해당 board에서 pageNo번째 페이지에 있는 게시글들의 미리보기를 읽어옴(인덱스는 1부터 시작)

const article = board.getArticle(articleId); // 해당 board에서 articleId에 해당하는 객체를 얻어옴
article.read(/* withComments: */true); // 위의 함수들과 동일
article.writeComment(comment);
article.deleteComment(commentId);

```

모든 조작은 Promise로 반환됩니다.
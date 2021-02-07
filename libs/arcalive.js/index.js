const RequestSession = require('./lib/request-session');
const Board = require('./lib/board');
const Article = require('./lib/article');
const Comment = require('./lib/comment');
const fq = require('./lib/fetch-queue');

fq.setRateLimit(400);

module.exports = {
  Session: RequestSession,
  Board: Board,
  Article: Article,
  Comment: Comment
};
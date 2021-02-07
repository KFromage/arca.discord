const DiscordBot = require('./discord');
const Arca = require('./arca');
const settings = require('./settings');
const express = require('express');

const bot = new DiscordBot(settings.discord.token, settings.discord.channelId);
const arca = new Arca(settings.arcalive.username, settings.arcalive.password);
const server = express();

arca.on('notification', function(notifications) {
  notifications
    .filter(notification => notification.type === 'submentioned')
    .forEach(notification => {

      const link = `https://arca.live${notification.link}`;
      bot.sendMessage({embed: {
        color: '#0000ff',
        title: '호출',
        url: link,
        description: '호출이 발생하였습니다.',
        fields: [{
          name: notification.title,
          value: `호출 : ${notification.by}`
        }],
        timestamp: new Date()
      }});
    });
});

arca.on('claim', function(claimComment) {
  bot.sendMessage({embed: {
    color: '#00ff00',
    title: '새 신문고 댓글',
    url: claimComment._commentUrl,
    description: '새 신문고 댓글이 등록되었습니다.',
    fields: [{
      name: claimComment._commentData.textContent.slice(0, 100) + (claimComment._commentData.textContent.length > 100 ? '...' : ''),
      value: `작성자 : ${claimComment._commentData.author}`
    }],
    timestamp: new Date()
  }});
});

arca.on('aggro', function(article) {
  bot.sendMessage({embed: {
    color: '#ff0000',
    title: '비추천 감지',
    url: article.url,
    description: '다수의 비추천이 감지되었습니다.',
    fields: [{
      name: article.title,
      value: `조회수 : ${article.views} | 댓글 : ${article.commentCount}`
    }],
    timestamp: new Date()
  }});
});

bot.on('strikeOut', function(banDays, embed) {
  bot.sendMessage({embed: {
    color: '#ff0000',
    title: '게시글 차단',
    url: embed.url,
    description: '관리자 3인의 동의로 해당 게시글의 작성자를 차단합니다.',
    fields: embed.fields.slice(),
    timestamp: new Date()
  }});
  arca.blockArticle(embed.url, 3600 * 24 * banDays);
});

server.listen(settings.server.port, function() {
  console.log(`App is listening at ${settings.server.port}`);
});

server.get('/', function(req, res) {
  res.json({
    'status': 'running',
    discord: {
      'channel': bot._channel.id
    },
    arcalive: {
      'lastArticle': arca._lastArticleId,
      'lastComment': arca._lastCommentId
    }
  });
});
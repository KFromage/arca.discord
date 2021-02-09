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

arca.on('redact', function(article) {
  bot.sendMessage({embed: {
    color: '#ff0000',
    title: '차단어 감지',
    url: article.url,
    description: '해당 게시글에서 차단어가 감지되어 삭제합니다.',
    fields: [{
      name: article._articleData.title,
      value: `조회수 : ${article._articleData.views} | 댓글 : ${article._articleData.commentCount}`
    }],
    timestamp: new Date()
  }});

  arca.deleteArticle(article.url);
});

arca.on('quarantine', function(article) {
  bot.sendMessage({embed: {
    color: '#ff0000',
    title: '차단어 감지',
    url: article.url,
    description: '해당 게시글의 비추천 과다가 감지되어 격리합니다.',
    fields: [{
      name: article._articleData.title,
      value: `조회수 : ${article._articleData.views} | 댓글 : ${article._articleData.commentCount}`
    }],
    timestamp: new Date()
  }});

  arca.quarantineArticle(article.url);
});

arca.on('aggro', function(article) {
  bot.sendMessage({embed: {
    color: '#ff0000',
    title: '비추천 감지',
    url: article.url,
    description: '다수의 비추천이 감지되었습니다.',
    fields: [{
      name: article._articleData.title,
      value: `조회수 : ${article._articleData.views} | 댓글 : ${article._articleData.commentCount}`
    }],
    timestamp: new Date()
  }});
});

bot.on('setquarantine', function(newCount) {
  bot.sendMessage({embed: {
    color: '#ff0000',
    title: '게시글 격리 변경',
    description: '지금부터 게시글 격리 감지 기준을 재설정합니다.',
    fields: [{
      name: '기준 변경',
      value: `기존 ${arca._quarantineCount} => 신규 ${newCount}`
    }],
    timestamp: new Date()
  }});
  
  arca.setQuarantineCount(newCount);
});

bot.on('setaggro', function(newCount) {
  bot.sendMessage({embed: {
    color: '#ff0000',
    title: '비추천 감지 변경',
    description: '지금부터 비추천 감지 기준을 재설정합니다.',
    fields: [{
      name: '기준 변경',
      value: `기존 ${arca._aggroCount} => 신규 ${newCount}`
    }],
    timestamp: new Date()
  }});

  arca.setAggroCount(newCount);
});

bot.on('redact', function(banPattern) {
  bot.sendMessage({embed: {
    color: '#ff0000',
    title: '게시글 삭제 시작',
    description: '지금부터 해당 정규식 패턴에 해당하는 모든 글을 자동으로 삭제합니다.',
    fields: [{
      name: '삭제 규칙',
      value: `/${banPattern}/`
    }],
    timestamp: new Date()
  }});

  arca.watch({
    pattern: new RegExp(banPattern),
    event: 'redact'
  });
});

bot.on('noredact', function(banPattern) {
  bot.sendMessage({embed: {
    color: '#ff0000',
    title: '게시글 삭제 중지',
    description: `지금부터 해당 정규식 패턴에 해당하는 모든 글을 자동으로 삭제하지 않습니다.`,
    fields: [{
      name: '삭제 규칙',
      value: `/${banPattern}/`
    }],
    timestamp: new Date()
  }});

  arca.cancelWatch({
    pattern: new RegExp(banPattern),
    event: 'redact'
  });
});

bot.on('release', function(embed) {
  bot.sendMessage({embed: {
    color: '#ff0000',
    title: '게시글 격리 해제',
    url: embed.url,
    description: '관리자의 확인으로 해당 게시글을 격리 해제합니다.',
    fields: embed.fields.slice(),
    timestamp: new Date()
  }});

  arca.releaseArticle(embed.url);
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

const Discord = require('discord.js');

function DiscordBot(token, channelId) {
  this._channelId = channelId;
  this._client = new Discord.Client();

  this._client.login(token);
  this._listeners = {};

  this._client.on('ready', () => {
    console.log(`Logged in as ${this._client.user.tag}`);
    this._initClient();
  });
}

DiscordBot.prototype._initClient = function() {
  this._client.on('message', msg => {
    if(msg.author.bot) return;
    if(msg.channel.id !== this._channelId) return;
    if(msg.content.indexOf('$channel') !== -1) {
      const newChannelId = msg.content.split(/ /)[1];
      this._channelId = newChannelId;
      this._client.channels.fetch(this._channelId).then(channel => { this._channel = channel; });

      bot.sendMessage({embed: {
        color: '#ff0000',
        title: '채널 이동',
        description: '지금부터 작동 채널을 이동합니다.',
        fields: [{
          name: '새 채널',
          value: `채널 ID : ${newChannelId}`
        }],
        timestamp: new Date()
      }});
    }

    if(msg.content.indexOf('$aggro') !== -1) {
      const aggroCount = +msg.content.split(/ /)[1];
      this._dispatch('setaggro', [ aggroCount ]);
    }
    if(msg.content.indexOf('$quarantine') !== -1) {
      const quarantineCount = +msg.content.split(/ /)[1];
      this._dispatch('setquarantine', [ quarantineCount ]);
    }

    if(msg.content.indexOf('$redact') !== -1) {
      const pattern = msg.content.split(/ /).slice(1).join(' ');
      this._dispatch('redact', [ pattern ]);
    }

    if(msg.content.indexOf('$noredact') !== -1) {
      const pattern = msg.content.split(/ /).slice(1).join(' ');
      this._dispatch('noredact', [ pattern ]);
    }
  });
  
  this._client.on('messageReactionAdd', (reaction, user) => {
    if(reaction.message.author.id !== this._client.user.id) return;
    if(!reaction.message.guild.member(user).roles.cache.find(role => role.name === '관리자')) return;

    if(reaction.count >= 1 && reaction.emoji.name === 'release') {
      this._dispatch('release', [ reaction.message.embeds[0] ]);
    }
    if(reaction.count >= 3 && reaction.emoji.name.indexOf('ban') !== -1) {
      this._dispatch('strikeOut', [ +reaction.emoji.name.match(/(\d+)ban/)[1], reaction.message.embeds[0] ]);
    }
  });

  this._client.channels.fetch(this._channelId).then(channel => { this._channel = channel; });
}

DiscordBot.prototype._dispatch = function(msg, args) {
  this._listeners[msg].forEach(listener => listener.apply(null, args));
}

DiscordBot.prototype.on = function(msg, listener) {
  this._listeners[msg] = this._listeners[msg] || [];

  this._listeners[msg].push(listener);
}

DiscordBot.prototype.sendMessage = function(msg) {
  if(!this._channel) return;
  this._channel.send(msg);
}

module.exports = DiscordBot;
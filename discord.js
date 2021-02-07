
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
    if(msg.content.indexOf('@channel')) {
      const newChannelId = msg.content.split(/ /)[1];
      this._channelId = newChannelId;
      this._client.channels.fetch(this._channelId).then(channel => { this._channel = channel; });
    }
  });
  
  this._client.on('messageReactionAdd', (reaction, user) => {
    if(reaction.message.author.id !== this._client.user.id) return;
    if(!reaction.message.guild.member(user).roles.cache.find(role => role.name === '관리자')) return;
    if(reaction.count >= 3) {
      this._dispatch('strikeOut', [ +reaction.emoji.name.match(/ban(\d+)/)[1], reaction.message.embeds[0] ]);
    }
  });

  this._client.channels.fetch(this._channelId).then(channel => { this._channel = channel; });
}

DiscordBot.prototype._dispatch = function(msg, args) {
  this._listeners[msg].forEach(listener => listener.call(null, args));
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